from datetime import datetime

from django.db.models import Exists, OuterRef, QuerySet

from apps.inventory.availability import (
    UNAVAILABLE_AVAILABILITY_STATUSES,
    validate_availability_period,
)
from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.inventory.scope import InventoryItemKind

TITAN_AVAILABLE_ITEM_KIND_VALUES = (
    InventoryItemKind.MATERIAL.value,
    InventoryItemKind.ARTICLE.value,
    InventoryItemKind.MATERIAL_PACK.value,
)


def get_available_inventory_items_for_period(
    *,
    start_at: datetime,
    end_at: datetime,
) -> QuerySet[InventoryItem]:
    validate_availability_period(start_at=start_at, end_at=end_at)

    conflicting_periods = InventoryAvailability.objects.filter(
        inventory_item=OuterRef("pk"),
        status__in=UNAVAILABLE_AVAILABILITY_STATUSES,
        start_at__lt=end_at,
        end_at__gt=start_at,
    )

    return (
        InventoryItem.objects.filter(
            is_active=True,
            is_deleted=False,
            kind__in=TITAN_AVAILABLE_ITEM_KIND_VALUES,
        )
        .annotate(has_availability_conflict=Exists(conflicting_periods))
        .filter(has_availability_conflict=False)
        .order_by("name", "id")
    )
