from __future__ import annotations

from datetime import datetime, time, timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.documents.services import create_document_instance_from_reservation_draft
from apps.identity.authorization import is_reservation_sensitive_actor
from apps.inventory.models import InventoryStockMovement, InventoryStockMovementType
from apps.inventory.services import (
    InventoryStockMovementError,
    create_inventory_stock_movement,
)
from apps.logistics.models import (
    LogisticsEvent,
    LogisticsEventItemLine,
    LogisticsEventStatus,
    LogisticsEventType,
)

if TYPE_CHECKING:
    from apps.inventory.models import InventoryItem
    from apps.reservations.models import ReservationDraft


UNAUTHORIZED_LOGISTICS_WRITE = "unauthorized_logistics_write"
INVALID_STATUS_TRANSITION = "invalid_status_transition"
LOGISTICS_EVENT_NOT_FOUND = "logistics_event_not_found"
PASSATION_NOT_ALLOWED = "passation_not_allowed"
DELIVERY_NOTE_TEMPLATE_KEY = "titan.delivery_note.v1"
ITEM_LINE_NOT_FOUND = "item_line_not_found"
LEGACY_UNBOUNDED_STOCK = 2**31 - 1


class LogisticsServiceError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


def _validate_operational_schedule(*, scheduled_at: timezone.datetime | None) -> None:
    if scheduled_at is not None and timezone.localtime(scheduled_at).weekday() == 6:
        raise LogisticsServiceError(
            "Les manœuvres Titan ne peuvent pas être planifiées le dimanche.",
            code="sunday_logistics_closed",
        )


def default_logistics_scheduled_at(*, reservation_start_at: timezone.datetime) -> timezone.datetime:
    """Return J-1, moving back to Saturday when J is Monday or Sunday."""
    local_start = timezone.localtime(reservation_start_at)
    scheduled_date = local_start.date() - timedelta(days=1)
    while scheduled_date.weekday() == 6:
        scheduled_date -= timedelta(days=1)
    return timezone.make_aware(
        datetime.combine(scheduled_date, time.min),
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
    reservation_draft: ReservationDraft,
    event_type: str,
    scheduled_at: timezone.datetime | None = None,
    address: str = "",
    contact_name: str = "",
    contact_phone: str = "",
    notes: str = "",
    signature_required: bool = False,
) -> LogisticsEvent:
    _require_logistics_actor(actor=actor)
    if scheduled_at is None:
        scheduled_at = default_logistics_scheduled_at(
            reservation_start_at=reservation_draft.start_at
        )
    _validate_operational_schedule(scheduled_at=scheduled_at)

    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=event_type,
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

    if new_status == LogisticsEventStatus.DISPATCHED:
        _dispatch_event_stock(event=event, actor=actor)

    event.status = new_status
    if executed_at is not None:
        event.executed_at = executed_at
    if notes:
        event.notes = f"{event.notes}\nStatus change: {notes}".strip()
    event.updated_by = actor
    event.save(update_fields=["status", "executed_at", "notes", "updated_at", "updated_by"])
    return event


def _current_stock_for_item(*, inventory_item_id) -> int:
    from apps.inventory.models import InventoryItem

    item = InventoryItem.objects.select_for_update().get(pk=inventory_item_id)
    movements = list(InventoryStockMovement.objects.filter(inventory_item_id=inventory_item_id))
    initial_movements = [
        movement for movement in movements if movement.source_label == "Initial inventory import"
    ]
    if initial_movements:
        baseline = sum(movement.quantity for movement in initial_movements)
        movements = [movement for movement in movements if movement not in initial_movements]
    else:
        baseline = item.reported_inventory_quantity
        # Existing reservations created before stock import have no reliable
        # baseline. Preserve their dispatch workflow while still enforcing
        # quantities once an inventory baseline or movement exists.
        if baseline == 0 and not movements:
            return LEGACY_UNBOUNDED_STOCK
    return max(baseline + sum(movement.signed_quantity for movement in movements), 0)


def _dispatch_event_stock(*, event: LogisticsEvent, actor: object | None) -> None:
    """Create outbound movements once when a delivery/handover actually leaves."""
    if event.event_type not in {LogisticsEventType.DELIVERY, LogisticsEventType.HANDOVER}:
        return

    lines = list(event.item_lines.select_related("inventory_item").order_by("created_at", "id"))
    source_label = f"logistics_event:{event.id}"
    for line in lines:
        existing = InventoryStockMovement.objects.filter(
            reservation_draft=event.reservation_draft,
            inventory_item=line.inventory_item,
            movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
            source_label=source_label,
        ).first()
        if existing is not None:
            if existing.quantity != line.quantity:
                raise LogisticsServiceError(
                    "La quantité de sortie déjà validée ne correspond plus à la ligne.",
                    code="stock_dispatch_conflict",
                )
            continue

        current_stock = _current_stock_for_item(inventory_item_id=line.inventory_item_id)
        if current_stock < line.quantity:
            raise LogisticsServiceError(
                (
                    f"Stock insuffisant pour {line.inventory_item.name}: "
                    f"{current_stock} disponible(s)."
                ),
                code="insufficient_stock_for_dispatch",
            )
        try:
            create_inventory_stock_movement(
                actor=actor,
                inventory_item=line.inventory_item,
                reservation_draft=event.reservation_draft,
                movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
                quantity=line.quantity,
                source_label=source_label,
                notes=line.notes or "Sortie de stock liée au bon de livraison.",
                effective_at=timezone.now(),
            )
        except InventoryStockMovementError as error:
            raise LogisticsServiceError(str(error), code=error.code) from error


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

    return create_document_instance_from_reservation_draft(
        reservation_draft=event.reservation_draft,
        template_key=DELIVERY_NOTE_TEMPLATE_KEY,
        actor=actor,
        notes=document_notes,
    )
