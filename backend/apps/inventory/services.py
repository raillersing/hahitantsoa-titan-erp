from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.inventory.models import (
    FIXED_INVENTORY_STOCK_MOVEMENT_DIRECTIONS,
    InventoryItem,
    InventoryStockMovement,
    InventoryStockMovementDirection,
    InventoryStockMovementType,
)


class InventoryStockMovementError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION = "invalid_inventory_stock_movement_direction"
INVALID_INVENTORY_STOCK_MOVEMENT = "invalid_inventory_stock_movement"


def active_inventory_stock_movements():
    return InventoryStockMovement.objects.select_related(
        "inventory_item",
        "reservation_draft",
        "document_instance",
        "validated_by",
        "created_by",
        "updated_by",
    ).order_by("-effective_at", "-created_at", "id")


def resolve_inventory_stock_movement_direction(
    *,
    movement_type: str,
    direction: str | None,
) -> str:
    movement_type_value = InventoryStockMovementType(movement_type)
    expected_direction = FIXED_INVENTORY_STOCK_MOVEMENT_DIRECTIONS.get(movement_type_value)
    if expected_direction is not None:
        if direction is not None and direction != expected_direction:
            raise InventoryStockMovementError(
                (
                    f"Movement type '{movement_type}' requires direction "
                    f"'{expected_direction.value}'."
                ),
                code=INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION,
            )
        return expected_direction

    if direction is None:
        raise InventoryStockMovementError(
            "Movement type 'other' requires an explicit direction.",
            code=INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION,
        )

    return InventoryStockMovementDirection(direction)


@transaction.atomic
def create_inventory_stock_movement(
    *,
    inventory_item: InventoryItem,
    movement_type: str,
    direction: str | None = None,
    quantity: int,
    actor: object | None = None,
    reservation_draft=None,
    document_instance=None,
    source_label: str = "",
    notes: str = "",
    effective_at=None,
) -> InventoryStockMovement:
    actor_id = getattr(actor, "pk", None)
    resolved_direction = resolve_inventory_stock_movement_direction(
        movement_type=movement_type,
        direction=direction,
    )
    movement = InventoryStockMovement(
        inventory_item=inventory_item,
        reservation_draft=reservation_draft,
        document_instance=document_instance,
        movement_type=movement_type,
        direction=resolved_direction,
        quantity=quantity,
        source_label=source_label,
        notes=notes,
        effective_at=effective_at or timezone.now(),
        validated_at=timezone.now(),
        validated_by_id=actor_id,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    try:
        movement.full_clean()
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = first_field_errors[0] if first_field_errors else "Invalid stock movement."
        raise InventoryStockMovementError(
            message,
            code=INVALID_INVENTORY_STOCK_MOVEMENT,
        ) from error
    movement.save()
    record_audit_event_on_commit(
        actor=actor,
        action="inventory.stock_movement_created",
        target_type="inventory_stock_movement",
        target_id=str(movement.id),
        metadata={
            "inventory_item_id": str(movement.inventory_item_id),
            "movement_type": movement.movement_type,
            "direction": movement.direction,
            "quantity": movement.quantity,
            "signed_quantity": movement.signed_quantity,
            "reservation_draft_id": (
                str(movement.reservation_draft_id) if movement.reservation_draft_id else None
            ),
            "document_instance_id": (
                str(movement.document_instance_id) if movement.document_instance_id else None
            ),
        },
    )
    return movement
