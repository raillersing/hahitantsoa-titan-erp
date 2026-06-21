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
from apps.inventory.services import (
    propose_damage_loss_classification_lines,
)
from apps.logistics.models import LogisticsEvent

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


def get_event_operations_summary(
    *,
    event: LogisticsEvent,
) -> dict:
    return_operation = InventoryReturnOperation.objects.filter(logistics_event=event).first()
    has_return_operation = return_operation is not None
    return_operation_data = None
    classification_data = None
    completeness = None

    if return_operation:
        from apps.inventory.models import InventoryReturnOperationStatus

        lines_data = []
        for line in return_operation.lines.select_related("inventory_item").order_by(
            "created_at", "id"
        ):
            lines_data.append(
                {
                    "line_id": str(line.id),
                    "inventory_item_id": str(line.inventory_item_id),
                    "inventory_item_name": line.inventory_item.name,
                    "condition_status": line.condition_status,
                    "expected_quantity": line.expected_quantity,
                    "returned_quantity": line.returned_quantity,
                    "damaged_quantity": line.damaged_quantity,
                    "missing_quantity": line.missing_quantity,
                    "intact_quantity": line.intact_quantity,
                }
            )

        return_operation_data = {
            "id": str(return_operation.id),
            "status": return_operation.status,
            "validated": return_operation.status == InventoryReturnOperationStatus.VALIDATED,
            "validated_at": return_operation.validated_at.isoformat()
            if return_operation.validated_at
            else None,
            "lines": lines_data,
            "line_count": len(lines_data),
        }

        if return_operation.status == InventoryReturnOperationStatus.VALIDATED:
            class_result = propose_damage_loss_classification_lines(
                return_operation=return_operation
            )
            classification_data = {
                "proposal_count": len(class_result.proposals),
                "proposals": [
                    {
                        "settlement_line_kind": p.settlement_line_kind,
                        "quantity": p.quantity,
                        "inventory_item_name": p.inventory_item_name,
                    }
                    for p in class_result.proposals
                ],
                "intact_line_count": len(class_result.intact_summary),
                "intact_lines": list(class_result.intact_summary),
            }

        from apps.inventory.services import check_event_operations_completeness

        completeness = check_event_operations_completeness(event=event)

    return {
        "event_id": str(event.id),
        "event_type": event.event_type,
        "event_status": event.status,
        "scheduled_at": event.scheduled_at.isoformat() if event.scheduled_at else None,
        "executed_at": event.executed_at.isoformat() if event.executed_at else None,
        "reservation_draft_id": str(event.reservation_draft_id),
        "has_return_operation": has_return_operation,
        "return_operation": return_operation_data,
        "classification": classification_data,
        "completeness": {
            "is_complete": completeness.is_complete if completeness else False,
            "has_return_operation": completeness.has_return_operation if completeness else False,
            "return_operation_validated": completeness.return_operation_validated
            if completeness
            else False,
            "has_classification_proposals": completeness.has_classification_proposals
            if completeness
            else False,
            "all_lines_accounted": completeness.all_lines_accounted if completeness else False,
        }
        if completeness
        else None,
    }
