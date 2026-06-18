from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

from apps.identity.authorization import is_reservation_sensitive_actor
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus

if TYPE_CHECKING:
    from apps.reservations.models import ReservationDraft


UNAUTHORIZED_LOGISTICS_WRITE = "unauthorized_logistics_write"
INVALID_STATUS_TRANSITION = "invalid_status_transition"
LOGISTICS_EVENT_NOT_FOUND = "logistics_event_not_found"


class LogisticsServiceError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


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
) -> LogisticsEvent:
    _require_logistics_actor(actor=actor)

    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=event_type,
        scheduled_at=scheduled_at,
        address=address,
        contact_name=contact_name,
        contact_phone=contact_phone,
        notes=notes,
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
) -> LogisticsEvent:
    _require_logistics_actor(actor=actor)

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
    event.updated_by = actor
    event.save(
        update_fields=[
            "scheduled_at",
            "address",
            "contact_name",
            "contact_phone",
            "notes",
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
