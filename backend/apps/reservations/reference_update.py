from __future__ import annotations

import logging

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import record_audit_event_on_commit
from apps.documents.models import DocumentInstance
from apps.documents.services import (
    build_amendment_document_reference,
    build_document_reference,
)
from apps.reservations.models import ReservationDraft

logger = logging.getLogger(__name__)


@transaction.atomic
def update_reservation_draft_public_reference(
    *,
    reservation_draft: ReservationDraft,
    new_public_reference: str,
    actor: object | None = None,
) -> ReservationDraft:
    new_ref = str(new_public_reference).strip()
    if not new_ref:
        raise ValidationError("La référence du dossier ne peut pas être vide.")

    if len(new_ref) > 32:
        raise ValidationError("La référence ne peut pas dépasser 32 caractères.")

    old_ref = reservation_draft.public_reference
    if old_ref == new_ref:
        return reservation_draft

    # Check uniqueness
    if (
        ReservationDraft.objects.filter(public_reference=new_ref, is_deleted=False)
        .exclude(id=reservation_draft.id)
        .exists()
    ):
        raise ValidationError(
            f"La référence '{new_ref}' est déjà utilisée par une autre réservation."
        )

    # Update draft
    reservation_draft.public_reference = new_ref
    if actor and getattr(actor, "is_authenticated", False):
        reservation_draft.updated_by = actor
    reservation_draft.save(update_fields=["public_reference", "updated_by", "updated_at"])

    # Cascade update all associated document instances
    instances = DocumentInstance.objects.filter(reservation_draft=reservation_draft)
    for inst in instances:
        inst.reservation_public_reference = new_ref
        if inst.amendment_sequence is not None:
            inst.document_reference = build_amendment_document_reference(
                public_reference=new_ref,
                amendment_sequence=inst.amendment_sequence,
            )
        else:
            inst.document_reference = build_document_reference(
                public_reference=new_ref,
                template_key=inst.template_key,
            )

        inst.save(
            update_fields=[
                "reservation_public_reference",
                "document_reference",
                "updated_at",
            ]
        )

        # If already generated to storage, re-generate so files reflect new reference
        if inst.status in {"generated", "issued"} and inst.storage_path:
            try:
                from apps.documents.runtime import generate_document_instance_html
                from apps.documents.services import generate_document_instance_pdf

                generate_document_instance_html(document_instance=inst, actor=actor)
                if inst.pdf_storage_path:
                    generate_document_instance_pdf(document_instance=inst, actor=actor)
            except Exception as ex:
                logger.warning("Could not re-generate document on reference update: %s", ex)

    # Record audit trail
    record_audit_event_on_commit(
        actor=actor,
        action="reservation.public_reference_updated",
        target_type="reservation_draft",
        target_id=str(reservation_draft.id),
        metadata={
            "old_public_reference": old_ref,
            "new_public_reference": new_ref,
        },
    )

    return reservation_draft
