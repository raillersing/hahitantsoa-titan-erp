from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.documents.services import create_document_instance_from_reservation_draft
from apps.identity.authorization import is_reservation_sensitive_actor
from apps.logistics.models import (
    LogisticsEvent,
    LogisticsEventItemLine,
    LogisticsEventStatus,
    LogisticsEventType,
    LogisticsOperationKind,
    TitanClosedDay,
)

if TYPE_CHECKING:
    from apps.hahitantsoa.models import HahitantsoaEventDraft
    from apps.inventory.models import InventoryItem
    from apps.reservations.models import ReservationDraft


UNAUTHORIZED_LOGISTICS_WRITE = "unauthorized_logistics_write"
INVALID_STATUS_TRANSITION = "invalid_status_transition"
LOGISTICS_EVENT_NOT_FOUND = "logistics_event_not_found"
PASSATION_NOT_ALLOWED = "PASSATION_NOT_ALLOWED"
DELIVERY_NOTE_TEMPLATE_KEY = "titan.delivery_note.v1"
ITEM_LINE_NOT_FOUND = "item_line_not_found"
TITAN_OPERATING_START = time(6, 0)
TITAN_OPERATING_END = time(22, 0)


class LogisticsServiceError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


def is_titan_closed_day(*, scheduled_date: date) -> bool:
    return (
        scheduled_date.weekday() == 6
        or TitanClosedDay.objects.filter(date=scheduled_date, is_active=True).exists()
    )


def previous_titan_working_day(*, scheduled_date: date) -> date:
    candidate = scheduled_date
    while is_titan_closed_day(scheduled_date=candidate):
        candidate -= timedelta(days=1)
    return candidate


def next_titan_working_day(*, scheduled_date: date) -> date:
    candidate = scheduled_date
    while is_titan_closed_day(scheduled_date=candidate):
        candidate += timedelta(days=1)
    return candidate


def _validate_operational_schedule(*, scheduled_at: timezone.datetime | None) -> None:
    if scheduled_at is None:
        return
    local_scheduled_at = timezone.localtime(scheduled_at)
    if is_titan_closed_day(scheduled_date=local_scheduled_at.date()):
        raise LogisticsServiceError(
            "Les manœuvres Titan ne peuvent pas être planifiées le dimanche ou un jour férié.",
            code="titan_closed_day",
        )
    if not TITAN_OPERATING_START <= local_scheduled_at.time() <= TITAN_OPERATING_END:
        raise LogisticsServiceError(
            "Les manœuvres Titan doivent être planifiées entre 06:00 et 22:00.",
            code="titan_outside_operating_hours",
        )


def default_logistics_scheduled_at(
    *, reservation_start_at: timezone.datetime, operation: str = "outbound"
) -> timezone.datetime:
    """Return Titan's previous/next working day at the start of operations."""
    local_start = timezone.localtime(reservation_start_at)
    requested_date = local_start.date() - timedelta(days=1)
    if operation == "return":
        requested_date = local_start.date() + timedelta(days=1)
        scheduled_date = next_titan_working_day(scheduled_date=requested_date)
    else:
        scheduled_date = previous_titan_working_day(scheduled_date=requested_date)
    return timezone.make_aware(
        datetime.combine(scheduled_date, TITAN_OPERATING_START),
        timezone.get_current_timezone(),
    )


def _require_logistics_actor(*, actor: object | None) -> None:
    if not is_reservation_sensitive_actor(actor=actor):
        raise LogisticsServiceError(
            "Actor is not authorized to manage logistics events.",
            code=UNAUTHORIZED_LOGISTICS_WRITE,
        )


VALID_TRANSITIONS: dict[str, set[str]] = {
    LogisticsEventStatus.PLANNED: {
        LogisticsEventStatus.DISPATCHED,
        LogisticsEventStatus.CANCELLED,
    },
    LogisticsEventStatus.DISPATCHED: {
        LogisticsEventStatus.COMPLETED,
        LogisticsEventStatus.CANCELLED,
    },
    LogisticsEventStatus.COMPLETED: set(),
    LogisticsEventStatus.CANCELLED: set(),
}


def _transition_allowed(from_status: str, to_status: str) -> bool:
    return to_status in VALID_TRANSITIONS.get(from_status, set())


@transaction.atomic
def create_logistics_event(
    *,
    actor: object | None,
    reservation_draft: ReservationDraft | None = None,
    hahitantsoa_event_draft: HahitantsoaEventDraft | None = None,
    event_type: str,
    operation: str = LogisticsOperationKind.OUTBOUND,
    scheduled_at: timezone.datetime | None = None,
    address: str = "",
    contact_name: str = "",
    contact_phone: str = "",
    notes: str = "",
    signature_required: bool = False,
) -> LogisticsEvent:
    _require_logistics_actor(actor=actor)
    if (reservation_draft is None) == (hahitantsoa_event_draft is None):
        raise LogisticsServiceError(
            "Exactly one business draft is required for a logistics event.",
            code="logistics_event_single_business_draft_required",
        )
    reservation_start_at = (
        reservation_draft.start_at
        if reservation_draft is not None
        else hahitantsoa_event_draft.start_at
    )
    if scheduled_at is None:
        scheduled_at = default_logistics_scheduled_at(
            reservation_start_at=reservation_start_at,
            operation=operation,
        )
    if reservation_draft is not None:
        _validate_operational_schedule(scheduled_at=scheduled_at)

    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        hahitantsoa_event_draft=hahitantsoa_event_draft,
        event_type=event_type,
        operation=operation,
        scheduled_at=scheduled_at,
        address=address,
        contact_name=contact_name,
        contact_phone=contact_phone,
        notes=notes,
        signature_required=signature_required,
        created_by=actor,
        updated_by=actor,
    )
    return event


@transaction.atomic
def update_logistics_event(
    *,
    actor: object | None,
    event: LogisticsEvent,
    scheduled_at: timezone.datetime | None = None,
    address: str = "",
    contact_name: str = "",
    contact_phone: str = "",
    notes: str = "",
    signature_required: bool | None = None,
) -> LogisticsEvent:
    _require_logistics_actor(actor=actor)
    _validate_operational_schedule(scheduled_at=scheduled_at)

    if event.status in {LogisticsEventStatus.COMPLETED, LogisticsEventStatus.CANCELLED}:
        raise LogisticsServiceError(
            "Cannot update a completed or cancelled event.",
            code=INVALID_STATUS_TRANSITION,
        )

    event.scheduled_at = scheduled_at
    event.address = address
    event.contact_name = contact_name
    event.contact_phone = contact_phone
    event.notes = notes
    if signature_required is not None:
        event.signature_required = signature_required
    event.updated_by = actor
    event.save(
        update_fields=[
            "scheduled_at",
            "address",
            "contact_name",
            "contact_phone",
            "notes",
            "signature_required",
            "updated_at",
            "updated_by",
        ]
    )
    return event


@transaction.atomic
def transition_logistics_event_status(
    *,
    actor: object | None,
    event: LogisticsEvent,
    new_status: str,
    executed_at: timezone.datetime | None = None,
    notes: str = "",
) -> LogisticsEvent:
    _require_logistics_actor(actor=actor)
    event = LogisticsEvent.objects.select_for_update().get(pk=event.pk)

    if not _transition_allowed(event.status, new_status):
        raise LogisticsServiceError(
            f"Transition from {event.status} to {new_status} is not allowed.",
            code=INVALID_STATUS_TRANSITION,
        )

    if new_status == LogisticsEventStatus.COMPLETED and executed_at is None:
        executed_at = timezone.now()

    if new_status == LogisticsEventStatus.CANCELLED and executed_at is not None:
        raise LogisticsServiceError(
            "Cancelled event cannot have an executed_at timestamp.",
            code=INVALID_STATUS_TRANSITION,
        )

    event.status = new_status
    if executed_at is not None:
        event.executed_at = executed_at
    if notes:
        event.notes = f"{event.notes}\nStatus change: {notes}".strip()
    event.updated_by = actor
    event.save(update_fields=["status", "executed_at", "notes", "updated_at", "updated_by"])
    return event


@transaction.atomic
def add_item_line_to_logistics_event(
    *,
    actor: object | None,
    event: LogisticsEvent,
    inventory_item: InventoryItem,
    quantity: int = 1,
    notes: str = "",
) -> LogisticsEventItemLine:
    _require_logistics_actor(actor=actor)

    if event.status in {LogisticsEventStatus.COMPLETED, LogisticsEventStatus.CANCELLED}:
        raise LogisticsServiceError(
            "Cannot add lines to a completed or cancelled event.",
            code=INVALID_STATUS_TRANSITION,
        )

    line, created = LogisticsEventItemLine.objects.get_or_create(
        logistics_event=event,
        inventory_item=inventory_item,
        defaults={
            "quantity": quantity,
            "notes": notes,
            "created_by": actor,
            "updated_by": actor,
        },
    )
    if not created:
        line.quantity = quantity
        line.notes = notes
        line.updated_by = actor
        line.save(update_fields=["quantity", "notes", "updated_at", "updated_by"])

    return line


@transaction.atomic
def remove_item_line_from_logistics_event(
    *,
    actor: object | None,
    event: LogisticsEvent,
    line_id: str,
) -> None:
    _require_logistics_actor(actor=actor)

    if event.status in {LogisticsEventStatus.COMPLETED, LogisticsEventStatus.CANCELLED}:
        raise LogisticsServiceError(
            "Cannot remove lines from a completed or cancelled event.",
            code=INVALID_STATUS_TRANSITION,
        )

    line = LogisticsEventItemLine.objects.filter(
        logistics_event=event,
        id=line_id,
    ).first()
    if line is None:
        raise LogisticsServiceError(
            "Item line does not exist or does not belong to this event.",
            code=ITEM_LINE_NOT_FOUND,
        )
    line.delete()


@transaction.atomic
def complete_handover_passation(
    *,
    actor: object | None,
    event: LogisticsEvent,
    signed_at: timezone.datetime | None = None,
    notes: str = "",
) -> tuple[LogisticsEvent, object]:
    _require_logistics_actor(actor=actor)

    if event.event_type != LogisticsEventType.HANDOVER:
        raise LogisticsServiceError(
            "Passation completion is only allowed for handover events.",
            code=PASSATION_NOT_ALLOWED,
        )

    if event.status != LogisticsEventStatus.COMPLETED:
        raise LogisticsServiceError(
            "Passation can only be completed for events that are already completed.",
            code=PASSATION_NOT_ALLOWED,
        )

    if not event.signature_required:
        raise LogisticsServiceError(
            "Passation completion requires signature_required to be set.",
            code=PASSATION_NOT_ALLOWED,
        )

    if event.signature_received:
        raise LogisticsServiceError(
            "Passation has already been completed for this event.",
            code=PASSATION_NOT_ALLOWED,
        )

    if signed_at is None:
        signed_at = timezone.now()

    event.signature_received = True
    event.signed_by = actor
    event.signed_at = signed_at
    if notes:
        event.notes = f"{event.notes}\nPassation: {notes}".strip()
    event.updated_by = actor
    event.save(
        update_fields=[
            "signature_received",
            "signed_by",
            "signed_at",
            "notes",
            "updated_at",
            "updated_by",
        ]
    )

    # Generate delivery note document instance
    document_instance = create_delivery_note_from_handover_event(
        actor=actor,
        event=event,
        notes=notes,
    )
    from apps.documents.services import generate_document_instance_pdf

    if event.hahitantsoa_event_draft_id:
        from apps.documents.services import generate_hahitantsoa_event_draft_document_instance_html
    else:
        from apps.documents.services import (
            ensure_reservation_draft_preparation_document,
            generate_reservation_draft_document_instance_html,
        )
    from apps.inventory.services import InventoryStockMovementError, issue_delivery_note_stock

    if event.hahitantsoa_event_draft_id:
        document_instance = generate_hahitantsoa_event_draft_document_instance_html(
            event_draft=event.hahitantsoa_event_draft,
            document_instance_id=document_instance.id,
            actor=actor,
        )
    else:
        document_instance = generate_reservation_draft_document_instance_html(
            reservation_draft=event.reservation_draft,
            document_instance_id=document_instance.id,
            actor=actor,
        )
    document_instance = generate_document_instance_pdf(
        document_instance=document_instance,
        actor=actor,
    )
    if not event.hahitantsoa_event_draft_id:
        ensure_reservation_draft_preparation_document(
            reservation_draft=event.reservation_draft,
            actor=actor,
        )
    try:
        issue_delivery_note_stock(
            document_instance=document_instance,
            actor=actor,
            logistics_event=event,
        )
    except InventoryStockMovementError as error:
        raise LogisticsServiceError(str(error), code=error.code) from error

    record_audit_event_on_commit(
        actor=actor,
        action="logistics.handover_passation_completed",
        target_type="logistics_event",
        target_id=str(event.id),
        metadata={
            "signed_at": signed_at.isoformat() if signed_at else None,
            "document_instance_id": str(document_instance.id),
        },
    )

    return event, document_instance


def create_delivery_note_from_handover_event(
    *,
    actor: object | None,
    event: LogisticsEvent,
    notes: str = "",
) -> object:
    if event.event_type != LogisticsEventType.HANDOVER:
        raise LogisticsServiceError(
            "Delivery note can only be generated for handover events.",
            code=PASSATION_NOT_ALLOWED,
        )

    document_notes = f"Delivery note for handover event {event.id}"
    if notes:
        document_notes = f"{document_notes}. Notes: {notes}"

    document_date = timezone.localtime(event.scheduled_at).date() if event.scheduled_at else None
    if event.hahitantsoa_event_draft_id:
        from apps.documents.services import create_document_instance_from_hahitantsoa_event_draft

        return create_document_instance_from_hahitantsoa_event_draft(
            event_draft=event.hahitantsoa_event_draft,
            template_key="hahitantsoa.delivery_note.v1",
            actor=actor,
            notes=document_notes,
            document_date=document_date,
        )
    return create_document_instance_from_reservation_draft(
        reservation_draft=event.reservation_draft,
        template_key=DELIVERY_NOTE_TEMPLATE_KEY,
        actor=actor,
        notes=document_notes,
        document_date=document_date,
    )


@transaction.atomic
def update_logistics_event_signature(
    *,
    actor: object | None,
    event: LogisticsEvent,
    signature_status: str,
    signed_by_client_name: str = "",
    signature_exception_reason: str = "",
    signed_document_file: str = "",
) -> LogisticsEvent:
    _require_logistics_actor(actor=actor)

    event = LogisticsEvent.objects.select_for_update().get(pk=event.pk)

    if event.event_type != LogisticsEventType.HANDOVER:
        raise LogisticsServiceError(
            "Signature update is only allowed for handover events.",
            code=PASSATION_NOT_ALLOWED,
        )

    if event.status != LogisticsEventStatus.COMPLETED:
        raise LogisticsServiceError(
            "Signature update is only allowed for completed events.",
            code=PASSATION_NOT_ALLOWED,
        )

    if not event.signature_required:
        raise LogisticsServiceError(
            "Signature update requires signature_required to be set.",
            code=PASSATION_NOT_ALLOWED,
        )

    event.signature_status = signature_status
    event.signed_by_client_name = signed_by_client_name
    event.signature_exception_reason = signature_exception_reason
    if signed_document_file:
        event.signed_document_file = signed_document_file
    event.signed_by = actor
    event.signed_at = timezone.now()
    event.updated_by = actor
    event.save(
        update_fields=[
            "signature_status",
            "signed_by_client_name",
            "signature_exception_reason",
            "signed_document_file",
            "signed_by",
            "signed_at",
            "updated_at",
            "updated_by",
        ]
    )

    record_audit_event_on_commit(
        actor=actor,
        action="logistics.handover_signature_updated",
        target_type="logistics_event",
        target_id=str(event.id),
        metadata={
            "signature_status": signature_status,
            "signed_by_client_name": signed_by_client_name,
            "signature_exception_reason": signature_exception_reason,
            "signed_document_file": signed_document_file,
            "signed_at": event.signed_at.isoformat() if event.signed_at else None,
        },
    )

    return event
