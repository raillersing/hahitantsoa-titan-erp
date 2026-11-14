"""Atomic bridges from private recovery state to the existing business services."""

import hashlib
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.text import get_valid_filename
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.audit.models import AuditEvent
from apps.documents.commercial import CommercialDocumentContextError
from apps.documents.models import DocumentInstance, UploadedAttachment
from apps.documents.serializers import UploadedAttachmentSerializer
from apps.reservations.wizard import (
    WizardConflict,
    _actor_lock,
    _audit,
    _fingerprint,
    _owned_session,
)


def _permission(permission, actor):
    if not permission().has_permission(SimpleNamespace(user=actor, method="POST"), None):
        raise PermissionDenied()


def _draft_contract(domain):
    if domain == "titan":
        from apps.reservations.permissions import IsAuthenticatedReservationDraftBoundary
        from apps.reservations.serializers import ReservationDraftSerializer

        return (
            "reservation_draft",
            ReservationDraftSerializer,
            IsAuthenticatedReservationDraftBoundary,
        )
    from apps.hahitantsoa.permissions import IsAuthenticatedHahitantsoaEventDraftBoundary
    from apps.hahitantsoa.serializers import HahitantsoaEventDraftSerializer

    return (
        "hahitantsoa_event_draft",
        HahitantsoaEventDraftSerializer,
        IsAuthenticatedHahitantsoaEventDraftBoundary,
    )


def _editable_draft(session, field):
    model = session._meta.get_field(field).remote_field.model
    draft = model.objects.select_for_update().filter(pk=getattr(session, f"{field}_id")).first()
    if not draft or draft.is_deleted or draft.status != "draft" or draft.contract_signed_at:
        raise WizardConflict(
            "Ce dossier doit être repris depuis sa fiche métier.",
            code="wizard_dossier_not_editable",
            version=session.version,
        )
    if draft.customer_id != session.customer_id:
        raise WizardConflict("Le client du dossier a changé.", version=session.version)
    return draft


def _version(session, expected_version):
    if session.status != "active" or session.version != expected_version:
        raise WizardConflict(
            "Rechargez la dernière version de cette saisie.",
            code="wizard_version_conflict",
            version=session.version,
        )


@transaction.atomic
def create_session_draft(
    *, actor, session_id, expected_version, domain, payload, proforma_validity_days=15
):
    _actor_lock(actor)
    session = _owned_session(actor, session_id)
    field, serializer_class, permission = _draft_contract(domain)
    _permission(permission, actor)
    fingerprint = _fingerprint(
        {"domain": domain, "payload": payload, "proforma_validity_days": proforma_validity_days}
    )
    if session.draft_creation_fingerprint:
        if session.draft_creation_fingerprint != fingerprint:
            raise WizardConflict(
                "Cette session possède déjà une autre création de dossier.", version=session.version
            )
        return session, _editable_draft(session, field), False
    _version(session, expected_version)
    if session.reservation_draft_id or session.hahitantsoa_event_draft_id:
        raise WizardConflict("Cette session est déjà liée à un dossier.", version=session.version)
    if session.domain and session.domain != domain:
        raise ValidationError({"domain": "Le volet ne correspond pas à la session."})
    serializer = serializer_class(data=payload, context={"request": SimpleNamespace(user=actor)})
    if set(payload) - set(serializer.fields):
        raise ValidationError({"payload": "Champ inconnu dans le dossier."})
    serializer.is_valid(raise_exception=True)
    customer = serializer.validated_data["customer"]
    if session.customer_id and session.customer_id != customer.pk:
        raise ValidationError({"customer_id": "Le client ne correspond pas à la session."})
    selected = session.state.get("selectedClientId")
    if selected and selected != str(customer.pk):
        raise ValidationError(
            {"customer_id": "Le client sélectionné ne correspond pas à la session."}
        )
    try:
        draft = serializer.save(created_by=actor)
    except CommercialDocumentContextError as error:
        raise ValidationError({"detail": str(error)}) from error
    DocumentInstance.objects.filter(**{field: draft}, template_key=f"{domain}.proforma.v1").update(
        proforma_validity_days=proforma_validity_days
    )
    session.proforma = DocumentInstance.objects.get(
        **{field: draft}, template_key=f"{domain}.proforma.v1"
    )
    session.customer = customer
    session.domain = domain
    setattr(session, field, draft)
    session.draft_creation_fingerprint = fingerprint
    session.version += 1
    session.last_write_fingerprint = ""
    session.save()
    _audit(
        actor, session, "reservations.wizard_draft_created", domain=domain, draft_id=str(draft.pk)
    )
    return session, draft, True


def draft_response(session, draft):
    field, serializer, _ = _draft_contract(session.domain)
    proforma = session.proforma
    return {
        "draft": serializer(draft).data,
        "version": session.version,
        "proforma_id": str(proforma.pk) if proforma else None,
    }


def promote_session_file(*, actor, session_id, file_id, expected_version, target):
    from apps.identity.permissions import HasReservationSensitiveAccess

    attachment = None
    try:
        with transaction.atomic():
            _actor_lock(actor)
            session = _owned_session(actor, session_id)
            _permission(HasReservationSensitiveAccess, actor)
            file = get_object_or_404(
                session.files.select_for_update(), pk=file_id, is_deleted=False
            )
            values = {"customer_id": str(session.customer_id)} if session.customer_id else {}
            if target == "draft":
                field, _, permission = _draft_contract(session.domain)
                _permission(permission, actor)
                draft = _editable_draft(session, field)
                values[f"{field}_id"] = str(draft.pk)
            if not values:
                raise ValidationError(
                    {"target": "Sélectionnez un client avant de joindre ce fichier."}
                )
            if file.promoted_attachment_id:
                existing = file.promoted_attachment
                if (
                    file.promotion_target != target
                    or existing.is_deleted
                    or existing.customer_id != session.customer_id
                    or (target == "draft" and getattr(existing, f"{field}_id") != draft.pk)
                ):
                    raise WizardConflict(
                        "Cette promotion ne peut pas être réutilisée.", version=session.version
                    )
                return existing, session.version, False
            _version(session, expected_version)
            try:
                with file.file.open("rb") as source:
                    uploaded = SimpleUploadedFile(
                        file.original_name, source.read(), content_type=file.content_type
                    )
            except FileNotFoundError, ValueError:
                raise WizardConflict(
                    "Cette pièce jointe n’est plus disponible.", version=session.version
                ) from None
            if hashlib.sha256(uploaded.read()).hexdigest() != file.sha256:
                raise WizardConflict(
                    "Le fichier de récupération a changé.", version=session.version
                )
            uploaded.seek(0)
            serializer = UploadedAttachmentSerializer(
                data={**values, "file": uploaded, "category": file.category, "label": file.label},
                context={"request": SimpleNamespace(user=actor)},
            )
            serializer.is_valid(raise_exception=True)
            # Retain the instance before FileField.save so a failed INSERT is compensable.
            attachment = UploadedAttachment(
                **serializer.validated_data,
                original_name=get_valid_filename(file.original_name)[:255] or "attachment",
                content_type=file.content_type,
                size_bytes=file.size_bytes,
                sha256=file.sha256,
                created_by=actor,
                updated_by=actor,
            )
            attachment.save()
            file.promoted_attachment = attachment
            file.promotion_target = target
            file.save(update_fields=["promoted_attachment", "promotion_target", "updated_at"])
            session.version += 1
            session.last_write_fingerprint = ""
            session.save(update_fields=["version", "last_write_fingerprint", "updated_at"])
            AuditEvent.objects.create(
                actor=actor,
                action="documents.attachment_uploaded",
                target_type="uploaded_attachment",
                target_id=str(attachment.pk),
                metadata={
                    "category": attachment.category,
                    "content_type": attachment.content_type,
                    "size_bytes": attachment.size_bytes,
                },
            )
            _audit(
                actor,
                session,
                "reservations.wizard_file_promoted",
                file_id=str(file.pk),
                attachment_id=str(attachment.pk),
            )
            return attachment, session.version, True
    except Exception:
        if attachment is not None and attachment.file._committed:
            attachment.file.delete(save=False)
        raise


@transaction.atomic
def create_session_discharge(*, actor, session_id, expected_version, payload):
    from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft
    from apps.hahitantsoa.serializers import HahitantsoaEventDraftDocumentInstanceCreateSerializer

    _actor_lock(actor)
    session = _owned_session(actor, session_id)
    if session.domain != "hahitantsoa":
        raise ValidationError({"domain": "Une décharge concerne uniquement Hahitantsoa."})
    field, _, permission = _draft_contract(session.domain)
    _permission(permission, actor)
    draft = _editable_draft(session, field)
    fingerprint = _fingerprint(payload)
    if session.discharge_id:
        if session.discharge_fingerprint != fingerprint:
            raise WizardConflict(
                "Cette session possède déjà une autre décharge.", version=session.version
            )
        document = session.discharge
        if document.hahitantsoa_event_draft_id != draft.pk or document.status == "voided":
            raise WizardConflict("Cette décharge n'est plus disponible.", version=session.version)
        return document, session.version, False
    _version(session, expected_version)
    if payload.get("template_key") != "hahitantsoa.liability_release.v1":
        raise ValidationError({"template_key": "Seule la décharge Hahitantsoa est autorisée."})
    serializer = HahitantsoaEventDraftDocumentInstanceCreateSerializer(data=payload)
    if set(payload) - set(serializer.fields):
        raise ValidationError({"payload": "Champ inconnu dans la décharge."})
    serializer.is_valid(raise_exception=True)
    try:
        document = create_document_instance_from_hahitantsoa_event_draft(
            event_draft=draft, actor=actor, **serializer.validated_data
        )
    except CommercialDocumentContextError as error:
        raise ValidationError({"detail": str(error)}) from error
    session.discharge = document
    session.discharge_fingerprint = fingerprint
    session.version += 1
    session.last_write_fingerprint = ""
    session.save()
    _audit(actor, session, "reservations.wizard_discharge_created", document_id=str(document.pk))
    return document, session.version, True


@transaction.atomic
def update_session_proforma(
    *,
    actor,
    session_id,
    expected_version,
    proforma_validity_days,
    proforma_id=None,
    revision_key=None,
):
    from apps.documents.services import (
        create_document_instance_from_hahitantsoa_event_draft,
        create_document_instance_from_reservation_draft,
    )
    from apps.reservations.models import ReservationWizardProformaOperation

    _actor_lock(actor)
    session = _owned_session(actor, session_id)
    field, _, permission = _draft_contract(session.domain)
    _permission(permission, actor)
    draft = _editable_draft(session, field)
    fingerprint = _fingerprint(
        {
            "proforma_validity_days": proforma_validity_days,
            "proforma_id": str(proforma_id) if proforma_id else None,
        }
    )
    if revision_key:
        operation = session.proforma_operations.filter(client_key=revision_key).first()
        if operation:
            if operation.fingerprint != fingerprint:
                raise WizardConflict(
                    "Cette clé correspond à une autre révision.", version=session.version
                )
            document = DocumentInstance.objects.select_for_update().get(pk=operation.document_id)
            if document.status == "voided" or getattr(document, f"{field}_id") != draft.pk:
                raise WizardConflict(
                    "Cette révision n'est plus disponible.", version=session.version
                )
            return document, session.version
    candidate_id = proforma_id or session.proforma_id
    if not candidate_id:
        raise ValidationError({"proforma_id": "Indiquez la proforma officielle de ce dossier."})
    document = (
        DocumentInstance.objects.select_for_update()
        .filter(pk=candidate_id, **{field: draft}, template_key=f"{session.domain}.proforma.v1")
        .first()
    )
    if not document or document.status == "voided":
        raise WizardConflict(
            "La proforma ne correspond pas au dossier actif.", version=session.version
        )
    if revision_key:
        _version(session, expected_version)
        try:
            if session.domain == "titan":
                replacement = create_document_instance_from_reservation_draft(
                    reservation_draft=draft,
                    template_key="titan.proforma.v1",
                    actor=actor,
                    proforma_validity_days=proforma_validity_days,
                    notes=f"Révision de la proforma {document.pk}",
                )
            else:
                replacement = create_document_instance_from_hahitantsoa_event_draft(
                    event_draft=draft,
                    template_key="hahitantsoa.proforma.v1",
                    actor=actor,
                    proforma_validity_days=proforma_validity_days,
                    notes=f"Révision de la proforma {document.pk}",
                )
        except CommercialDocumentContextError as error:
            raise ValidationError({"detail": str(error)}) from error
        ReservationWizardProformaOperation.objects.create(
            session=session, client_key=revision_key, fingerprint=fingerprint, document=replacement
        )
        session.proforma = replacement
        session.version += 1
        session.last_write_fingerprint = ""
        session.proforma_write_fingerprint = ""
        session.save()
        _audit(
            actor,
            session,
            "reservations.wizard_proforma_revised",
            source_document_id=str(document.pk),
            document_id=str(replacement.pk),
            revision_key=str(revision_key),
        )
        return replacement, session.version
    if session.proforma_id and session.proforma_id != document.pk:
        raise WizardConflict(
            "Cette session est liée à une autre proforma.", version=session.version
        )
    adoption = session.proforma_id is None
    write_fingerprint = _fingerprint(
        {"expected_version": expected_version, "proforma_validity_days": proforma_validity_days}
    )
    if not adoption and (
        document.proforma_validity_days == proforma_validity_days
        or session.proforma_write_fingerprint == write_fingerprint
    ):
        return document, session.version
    _version(session, expected_version)
    if document.proforma_validity_days != proforma_validity_days:
        if document.status != "prepared":
            raise WizardConflict(
                "Une nouvelle révision est requise pour modifier cette proforma.",
                version=session.version,
            )
        document.proforma_validity_days = proforma_validity_days
        document.save(update_fields=["proforma_validity_days", "updated_at"])
    session.proforma = document
    session.proforma_write_fingerprint = write_fingerprint
    session.version += 1
    session.last_write_fingerprint = ""
    session.save()
    _audit(
        actor,
        session,
        "reservations.wizard_proforma_updated",
        document_id=str(document.pk),
        proforma_validity_days=proforma_validity_days,
    )
    return document, session.version
