"""Private recovery writes; official dossier services remain authoritative."""

import hashlib
import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.audit.models import AuditEvent
from apps.reservations.models import ReservationWizardFile, ReservationWizardSession

WRITE_FIELDS = (
    "schema_version",
    "domain",
    "step",
    "state",
    "status",
    "customer_id",
    "reservation_draft_id",
    "hahitantsoa_event_draft_id",
)


class WizardConflict(APIException):
    status_code = 409
    default_code = "wizard_conflict"

    def __init__(self, message, *, code="wizard_conflict", version=None):
        super().__init__({"detail": message, "code": code})
        if version is not None:
            self.detail["current_version"] = version


def _fingerprint(values):
    def normalize(value):
        if hasattr(value, "pk"):
            return str(value.pk)
        return str(value)

    return hashlib.sha256(
        json.dumps(
            values,
            sort_keys=True,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            default=normalize,
        ).encode()
    ).hexdigest()


def _actor_lock(actor):
    if not getattr(actor, "is_authenticated", False):
        raise PermissionDenied("Une session opérateur active est requise.")
    if (
        not get_user_model()
        .objects.select_for_update(no_key=True)
        .filter(pk=actor.pk, is_active=True)
        .exists()
    ):
        raise PermissionDenied("Une session opérateur active est requise.")


def _owned_session(actor, session_id):
    return get_object_or_404(
        ReservationWizardSession.objects.select_for_update(), pk=session_id, owner=actor
    )


def _audit(actor, session, action, **metadata):
    # Audit belongs to the same database transaction as the acknowledged write.
    AuditEvent.objects.create(
        actor=actor,
        action=action,
        target_type="reservation_wizard_session",
        target_id=str(session.pk),
        metadata={"version": session.version, **metadata},
    )


def _validate_links(session, values):
    from apps.customers.models import Customer
    from apps.hahitantsoa.models import HahitantsoaEventDraft
    from apps.reservations.models import ReservationDraft

    if values == {"status": "completed"}:
        return {
            name: getattr(session, name)
            for name in ("customer_id", "reservation_draft_id", "hahitantsoa_event_draft_id")
        }
    domain = values.get("domain", session.domain)
    ids = {}
    for name in ("customer_id", "reservation_draft_id", "hahitantsoa_event_draft_id"):
        candidate = values.get(name, getattr(session, name))
        ids[name] = getattr(candidate, "pk", candidate)
    customer_id = ids["customer_id"]
    if (
        customer_id
        and not Customer.objects.filter(pk=customer_id, is_active=True, is_deleted=False).exists()
    ):
        raise ValidationError({"customer_id": "Ce client n'est plus actif."})
    state = values.get("state", session.state)
    selected = state.get("selectedClientId")
    if selected and str(customer_id) != selected:
        raise ValidationError(
            {"customer_id": "Le client sélectionné ne correspond pas à la session."}
        )
    if state.get("domain") and state["domain"] != domain:
        raise ValidationError({"domain": "Le volet du contenu ne correspond pas à la session."})
    if ids["reservation_draft_id"] and ids["hahitantsoa_event_draft_id"]:
        raise ValidationError("Une session ne peut pas être liée à deux volets.")
    for field, model, expected_domain in (
        ("reservation_draft_id", ReservationDraft, "titan"),
        ("hahitantsoa_event_draft_id", HahitantsoaEventDraft, "hahitantsoa"),
    ):
        old_id = getattr(session, field)
        if old_id and str(old_id) != str(ids[field]):
            raise ValidationError({field: "La liaison au dossier est immuable."})
        if not ids[field]:
            continue
        draft = model.objects.filter(pk=ids[field], is_deleted=False).first()
        if not draft or domain != expected_domain or draft.customer_id != customer_id:
            raise ValidationError({field: "Le dossier ne correspond pas au client et au volet."})
        if draft.status != "draft" or draft.contract_signed_at:
            # Archiving recovery is allowed; changing a signed/closed draft is not.
            if values.get("status") != "completed" or set(values) - {"status"}:
                raise WizardConflict(
                    "Ce dossier doit être repris depuis sa fiche métier.",
                    code="wizard_dossier_not_editable",
                    version=session.version,
                )
        old_id = getattr(session, field)
        if old_id and str(old_id) != str(ids[field]):
            raise ValidationError({field: "La liaison au dossier est immuable."})
    return ids


@transaction.atomic
def create_wizard_session(*, actor, values):
    _actor_lock(actor)
    values = {
        "schema_version": 1,
        "domain": "",
        "step": 0,
        "state": {},
        "status": "active",
        "customer_id": None,
        "reservation_draft_id": None,
        "hahitantsoa_event_draft_id": None,
        **values,
    }
    fingerprint = _fingerprint(values)
    existing = ReservationWizardSession.objects.filter(
        owner=actor, client_key=values["client_key"]
    ).first()
    if existing:
        if existing.creation_fingerprint != fingerprint:
            raise WizardConflict(
                "Cette opération correspond à une autre session de saisie.",
                version=existing.version,
            )
        return existing, False
    if values["status"] != "active":
        raise ValidationError({"status": "Une nouvelle session doit être active."})
    session = ReservationWizardSession(
        owner=actor, client_key=values["client_key"], creation_fingerprint=fingerprint
    )
    links = _validate_links(session, values)
    for field in WRITE_FIELDS:
        setattr(session, field, links.get(field, values[field]))
    session.save()
    _audit(actor, session, "reservations.wizard_created")
    return session, True


@transaction.atomic
def update_wizard_session(*, actor, session_id, expected_version, values):
    _actor_lock(actor)
    session = _owned_session(actor, session_id)
    fingerprint = _fingerprint({"expected_version": expected_version, **values})
    if session.version == expected_version + 1 and session.last_write_fingerprint == fingerprint:
        return session
    if session.version != expected_version:
        raise WizardConflict(
            "Cette saisie a été modifiée sur un autre terminal. "
            "Rechargez sa dernière version avant de continuer.",
            code="wizard_version_conflict",
            version=session.version,
        )
    if session.status != "active":
        raise WizardConflict(
            "Ce parcours est déjà terminé.", code="wizard_completed", version=session.version
        )
    links = _validate_links(session, values)
    for field, value in values.items():
        setattr(session, field, links.get(field, value))
    session.version += 1
    session.last_write_fingerprint = fingerprint
    session.save()
    _audit(actor, session, "reservations.wizard_saved", step=session.step, status=session.status)
    return session


def add_wizard_file(*, actor, session_id, values):
    created_file = None
    try:
        with transaction.atomic():
            _actor_lock(actor)
            session = _owned_session(actor, session_id)
            uploaded = values["file"]
            digest = hashlib.sha256()
            for chunk in uploaded.chunks():
                digest.update(chunk)
            uploaded.seek(0)
            sha256 = digest.hexdigest()
            existing = session.files.filter(client_file_key=values["client_file_key"]).first()
            if existing:
                same = (
                    existing.sha256 == sha256
                    and existing.original_name == Path(uploaded.name).name
                    and existing.category == values["category"]
                    and existing.label == values["label"]
                )
                if existing.is_deleted or not same:
                    raise WizardConflict(
                        "Cette opération de fichier ne peut pas être réutilisée.",
                        code="wizard_file_conflict",
                        version=session.version,
                    )
                if not existing.file.storage.exists(existing.file.name):
                    raise WizardConflict(
                        "La pièce jointe doit être téléversée à nouveau.",
                        code="wizard_file_unavailable",
                        version=session.version,
                    )
                return existing, session.version, False
            if session.status != "active":
                raise WizardConflict(
                    "Ce parcours est déjà terminé.",
                    code="wizard_completed",
                    version=session.version,
                )
            if session.version != values["expected_version"]:
                raise WizardConflict(
                    "Rechargez la dernière version avant de téléverser ce fichier.",
                    code="wizard_version_conflict",
                    version=session.version,
                )
            rows = list(session.files.values_list("size_bytes", "is_deleted"))
            active_count = sum(not deleted for _, deleted in rows)
            retained_bytes = sum(size for size, _ in rows)
            if active_count >= 20 or retained_bytes + uploaded.size > 100 * 1024 * 1024:
                raise ValidationError(
                    {"file": "Limite de session atteinte (20 fichiers ou 100 Mo)."}
                )
            created_file = ReservationWizardFile(
                session=session,
                client_file_key=values["client_file_key"],
                category=values["category"],
                label=values["label"],
                original_name=Path(uploaded.name).name,
                content_type=uploaded.content_type,
                size_bytes=uploaded.size,
                sha256=sha256,
                file=uploaded,
            )
            created_file.save()
            session.version += 1
            session.last_write_fingerprint = ""
            session.save(update_fields=["version", "updated_at", "last_write_fingerprint"])
            _audit(
                actor,
                session,
                "reservations.wizard_file_uploaded",
                file_id=str(created_file.pk),
                sha256=sha256,
            )
            return created_file, session.version, True
    except Exception:
        if created_file is not None and created_file.file._committed:
            created_file.file.delete(save=False)
        raise


@transaction.atomic
def delete_wizard_file(*, actor, session_id, file_id, expected_version):
    _actor_lock(actor)
    session = _owned_session(actor, session_id)
    file = get_object_or_404(session.files.select_for_update(), pk=file_id)
    fingerprint = _fingerprint({"delete_file": str(file_id), "expected_version": expected_version})
    if (
        file.is_deleted
        and session.version == expected_version + 1
        and session.last_write_fingerprint == fingerprint
    ):
        return session.version
    if session.status != "active" or session.version != expected_version:
        raise WizardConflict(
            "Rechargez la dernière version avant de retirer ce fichier.",
            code="wizard_version_conflict",
            version=session.version,
        )
    file.is_deleted = True
    file.save(update_fields=["is_deleted", "updated_at"])
    session.version += 1
    session.last_write_fingerprint = fingerprint
    session.save(update_fields=["version", "updated_at", "last_write_fingerprint"])
    _audit(actor, session, "reservations.wizard_file_removed", file_id=str(file.pk))
    return session.version
