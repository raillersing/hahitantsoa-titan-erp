from dataclasses import dataclass
from datetime import datetime

from apps.inventory.availability import get_inventory_availability_conflicts
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.validation import (
    ReservationItemValidation,
    validate_reservation_item_request,
)

INVENTORY_ITEM_UNAVAILABLE_ERROR = "Inventory item is not available for the requested period."


@dataclass(frozen=True)
class ReservationItemAvailabilityDetails:
    item_validation: ReservationItemValidation
    conflicts: tuple[InventoryAvailability, ...]


@dataclass(frozen=True)
class ReservationItemAvailabilityValidation:
    valid: bool
    available: bool
    errors: tuple[str, ...]
    inventory_unit_count: int | None
    details: ReservationItemAvailabilityDetails | None = None


def validate_reservation_item_availability_request(
    *,
    inventory_item: InventoryItem,
    inventory_item_kind: str,
    start_at: datetime,
    end_at: datetime,
) -> ReservationItemAvailabilityValidation:
    try:
        item_validation = validate_reservation_item_request(
            inventory_item_kind=inventory_item_kind,
            start_at=start_at,
            end_at=end_at,
        )
    except ValueError as error:
        return ReservationItemAvailabilityValidation(
            valid=False,
            available=False,
            errors=(str(error),),
            inventory_unit_count=None,
        )

    conflicts = tuple(
        get_inventory_availability_conflicts(
            inventory_item=inventory_item,
            start_at=item_validation.period.start_at,
            end_at=item_validation.period.end_at,
        )
    )
    available = not conflicts
    errors = () if available else (INVENTORY_ITEM_UNAVAILABLE_ERROR,)

    return ReservationItemAvailabilityValidation(
        valid=True,
        available=available,
        errors=errors,
        inventory_unit_count=None,
        details=ReservationItemAvailabilityDetails(
            item_validation=item_validation,
            conflicts=conflicts,
        ),
    )
