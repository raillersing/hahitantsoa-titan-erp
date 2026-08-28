from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.documents.models import DocumentInstance
from apps.documents.services import (
    create_document_instance_from_reservation_draft,
    generate_document_instance_pdf,
    generate_reservation_draft_document_instance_html,
)
from apps.identity.authorization import require_reservation_sensitive_actor
from apps.inventory.availability import get_inventory_availability_conflicts
from apps.inventory.models import InventoryItem
from apps.reservations.commercial import (
    recalculate_reservation_draft_totals,
    snapshot_inventory_rental_price,
)
from apps.reservations.periods import validate_reservation_period

from .models import ReservationDraft, ReservationDraftAmendment, ReservationDraftLine


class ReservationAmendmentError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class ReservationAmendmentResult:
    amendment: ReservationDraftAmendment


@transaction.atomic
def create_reservation_draft_amendment(
    *,
    reservation_draft: ReservationDraft,
    actor,
    reason: str,
    notes: str = "",
    changed_start_at=None,
    changed_end_at=None,
    changed_lines=None,
) -> ReservationAmendmentResult:
    require_reservation_sensitive_actor(actor=actor)
    locked_draft = ReservationDraft.objects.select_for_update().get(pk=reservation_draft.pk)
    if locked_draft.status == "cancelled":
        raise ReservationAmendmentError(
            "A cancelled reservation cannot be amended.", code="reservation_cancelled"
        )
    if timezone.localdate() > timezone.localtime(locked_draft.start_at).date():
        raise ReservationAmendmentError(
            "A reservation can only be amended up to and including the event day.",
            code="amendment_deadline_passed",
        )
    if not reason.strip():
        raise ReservationAmendmentError("An amendment reason is required.", code="reason_required")

    start_at = changed_start_at or locked_draft.start_at
    end_at = changed_end_at or locked_draft.end_at
    try:
        validate_reservation_period(start_at=start_at, end_at=end_at)
    except ValueError as error:
        raise ReservationAmendmentError(str(error), code="invalid_amendment_period") from error

    active_lines = list(
        locked_draft.lines.filter(is_deleted=False).select_related("inventory_item")
    )
    line_data = (
        changed_lines
        if changed_lines is not None
        else [
            {"inventory_item": line.inventory_item, "quantity": line.quantity, "notes": line.notes}
            for line in active_lines
        ]
    )
    if not line_data:
        raise ReservationAmendmentError(
            "An amendment must keep at least one article.", code="empty_amendment_lines"
        )

    existing = (
        ReservationDraftAmendment.objects.select_for_update()
        .filter(reservation_draft=locked_draft, applied_at__isnull=False)
        .order_by("-amendment_sequence")
        .first()
    )
    next_sequence = (
        existing.amendment_sequence if existing and existing.amendment_sequence else 0
    ) + 1
    source_contract = (
        DocumentInstance.objects.filter(
            reservation_draft=locked_draft,
            template_key="titan.material_contract.v1",
        )
        .order_by("-created_at", "-id")
        .first()
    )
    item_ids = [line["inventory_item"].id for line in line_data]
    if len(item_ids) != len(set(item_ids)):
        raise ReservationAmendmentError(
            "An article can appear only once in an amendment.",
            code="duplicate_amendment_line",
        )
    locked_items = {
        item.id: item for item in InventoryItem.objects.select_for_update().filter(id__in=item_ids)
    }
    for line in line_data:
        line["inventory_item"] = locked_items[line["inventory_item"].id]
        conflicts = get_inventory_availability_conflicts(
            inventory_item=line["inventory_item"], start_at=start_at, end_at=end_at
        ).exclude(reservation_draft=locked_draft)
        if conflicts:
            raise ReservationAmendmentError(
                f"Article indisponible pour la période modifiée: {line['inventory_item'].name}.",
                code="amendment_unavailable",
            )

    amendment = ReservationDraftAmendment(
        reservation_draft=locked_draft,
        reason=reason,
        notes=notes,
        changed_start_at=changed_start_at,
        changed_end_at=changed_end_at,
        changed_lines=[
            {
                "inventory_item_id": str(line["inventory_item"].id),
                "quantity": line["quantity"],
                "notes": line.get("notes", ""),
            }
            for line in line_data
        ],
        amendment_sequence=next_sequence,
        source_contract_document_id=source_contract.id if source_contract else None,
        applied_at=timezone.now(),
        applied_by=actor,
        created_by=actor,
        updated_by=actor,
    )
    amendment.full_clean()
    amendment.save()
    if changed_start_at is not None:
        locked_draft.start_at = start_at
    if changed_end_at is not None:
        locked_draft.end_at = end_at
    if changed_start_at is not None or changed_end_at is not None:
        locked_draft.full_clean()
        locked_draft.updated_by = actor
        locked_draft.save(update_fields=["start_at", "end_at", "updated_by", "updated_at"])
    if changed_lines is not None:
        now = timezone.now()
        existing_by_item_id = {line.inventory_item_id: line for line in active_lines}
        requested_item_ids = set(item_ids)
        locked_draft.lines.filter(is_deleted=False).exclude(
            inventory_item_id__in=requested_item_ids
        ).update(is_deleted=True, deleted_at=now, updated_by=actor, updated_at=now)
        for line in line_data:
            existing_line = existing_by_item_id.get(line["inventory_item"].id)
            if existing_line is None:
                ReservationDraftLine.objects.create(
                    reservation_draft=locked_draft,
                    inventory_item=line["inventory_item"],
                    quantity=line["quantity"],
                    unit_rental_price=snapshot_inventory_rental_price(
                        inventory_item=line["inventory_item"]
                    ),
                    notes=line.get("notes", ""),
                    created_by=actor,
                    updated_by=actor,
                )
            else:
                existing_line.quantity = line["quantity"]
                existing_line.notes = line.get("notes", "")
                existing_line.updated_by = actor
                existing_line.save(update_fields=["quantity", "notes", "updated_by", "updated_at"])
    locked_draft.updated_by = actor
    recalculate_reservation_draft_totals(reservation_draft=locked_draft)
    document = create_document_instance_from_reservation_draft(
        reservation_draft=locked_draft,
        template_key="titan.material_amendment.v1",
        actor=actor,
        notes=f"Avenant: {reason}. {notes}".strip(),
        amendment_sequence=next_sequence,
        amendment_source_document_id=source_contract.id if source_contract else None,
    )
    document = generate_reservation_draft_document_instance_html(
        reservation_draft=locked_draft,
        document_instance_id=document.id,
        actor=actor,
    )
    document = generate_document_instance_pdf(document_instance=document, actor=actor)
    amendment.document_instance_id = document.id
    amendment.save(update_fields=["document_instance_id", "updated_at", "updated_by"])
    record_audit_event_on_commit(
        actor=actor,
        action="reservation_draft.amendment.created",
        target_type="reservation_draft_amendment",
        target_id=str(amendment.id),
        metadata={
            "reservation_draft_id": str(locked_draft.id),
            "document_instance_id": str(document.id),
        },
    )
    return ReservationAmendmentResult(amendment=amendment)
