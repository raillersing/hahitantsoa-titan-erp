from datetime import datetime

from django.db.models import QuerySet

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)

UNAVAILABLE_AVAILABILITY_STATUSES = (
    InventoryAvailabilityStatus.BLOCKED.value,
    InventoryAvailabilityStatus.RESERVED.value,
)


def validate_availability_period(*, start_at: datetime, end_at: datetime) -> None:
    if end_at <= start_at:
        raise ValueError("end_at must be greater than start_at")


def get_inventory_availability_conflicts(
    *,
    inventory_item: InventoryItem,
    start_at: datetime,
    end_at: datetime,
) -> QuerySet[InventoryAvailability]:
    validate_availability_period(start_at=start_at, end_at=end_at)

    return InventoryAvailability.objects.filter(
        inventory_item=inventory_item,
        status__in=UNAVAILABLE_AVAILABILITY_STATUSES,
        start_at__lt=end_at,
        end_at__gt=start_at,
    ).order_by("start_at", "end_at")


def is_inventory_item_available(
    *,
    inventory_item: InventoryItem,
    start_at: datetime,
    end_at: datetime,
) -> bool:
    return not get_inventory_availability_conflicts(
        inventory_item=inventory_item,
        start_at=start_at,
        end_at=end_at,
    ).exists()
