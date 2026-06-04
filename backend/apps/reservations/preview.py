from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.availability import (
    ReservationItemAvailabilityValidation,
    validate_reservation_item_availability_request,
)
from apps.reservations.periods import ReservationPeriod


class ReservationItemPreviewStatus(StrEnum):
    INVALID = "invalid"
    UNAVAILABLE = "unavailable"
    AVAILABLE = "available"


@dataclass(frozen=True)
class ReservationItemPreview:
    inventory_item: InventoryItem
    inventory_item_kind: str
    start_at: datetime
    end_at: datetime
    period: ReservationPeriod | None
    availability_validation: ReservationItemAvailabilityValidation
    status: ReservationItemPreviewStatus
    errors: tuple[str, ...]
    conflicts: tuple[InventoryAvailability, ...]
    inventory_unit_count: int | None


def preview_reservation_item_request(
    *,
    inventory_item: InventoryItem,
    inventory_item_kind: str,
    start_at: datetime,
    end_at: datetime,
) -> ReservationItemPreview:
    availability_validation = validate_reservation_item_availability_request(
        inventory_item=inventory_item,
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
    )
    details = availability_validation.details
    period = details.item_validation.period if details is not None else None
    conflicts = details.conflicts if details is not None else ()

    if not availability_validation.valid:
        status = ReservationItemPreviewStatus.INVALID
    elif availability_validation.available:
        status = ReservationItemPreviewStatus.AVAILABLE
    else:
        status = ReservationItemPreviewStatus.UNAVAILABLE

    return ReservationItemPreview(
        inventory_item=inventory_item,
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
        period=period,
        availability_validation=availability_validation,
        status=status,
        errors=availability_validation.errors,
        conflicts=conflicts,
        inventory_unit_count=availability_validation.inventory_unit_count,
    )
