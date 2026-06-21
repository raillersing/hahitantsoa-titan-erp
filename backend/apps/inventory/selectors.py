from datetime import datetime

from django.db.models import Exists, OuterRef, QuerySet

from apps.inventory.availability import (
    UNAVAILABLE_AVAILABILITY_STATUSES,
    validate_availability_period,
)
from apps.inventory.models import (
    InventoryAvailability,
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLineConditionStatus,
)
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
        is_deleted=False,
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


def get_return_operation_classification_breakdown(
    *,
    return_operation: InventoryReturnOperation,
) -> list[dict]:
    lines = list(
        return_operation.lines.select_related("inventory_item").order_by("created_at", "id")
    )
    breakdown: list[dict] = []
    for line in lines:
        item = line.inventory_item
        condition = InventoryReturnOperationLineConditionStatus(line.condition_status)
        intact_quantity = line.intact_quantity
        entry = {
            "return_operation_line_id": str(line.id),
            "inventory_item_id": str(item.id),
            "inventory_item_name": item.name,
            "condition_status": line.condition_status,
            "expected_quantity": line.expected_quantity,
            "returned_quantity": line.returned_quantity,
            "damaged_quantity": line.damaged_quantity,
            "missing_quantity": line.missing_quantity,
            "intact_quantity": intact_quantity,
            "classification_suggestions": [],
        }
        if condition == InventoryReturnOperationLineConditionStatus.INTACT:
            entry["classification_suggestions"] = []
        elif condition == InventoryReturnOperationLineConditionStatus.DAMAGED:
            entry["classification_suggestions"] = [
                {"kind": "damage", "quantity": line.damaged_quantity},
            ]
        elif condition == InventoryReturnOperationLineConditionStatus.MISSING:
            entry["classification_suggestions"] = [
                {"kind": "loss", "quantity": line.missing_quantity},
            ]
        elif condition == InventoryReturnOperationLineConditionStatus.MIXED:
            suggestions = []
            if intact_quantity > 0:
                suggestions.append({"kind": "intact", "quantity": intact_quantity})
            if line.damaged_quantity > 0:
                suggestions.append({"kind": "damage", "quantity": line.damaged_quantity})
            if line.missing_quantity > 0:
                suggestions.append({"kind": "loss", "quantity": line.missing_quantity})
            entry["classification_suggestions"] = suggestions

        breakdown.append(entry)
    return breakdown
