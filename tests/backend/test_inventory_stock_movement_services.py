from datetime import timedelta

import pytest
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryItem,
    InventoryStockMovementDirection,
    InventoryStockMovementType,
)
from apps.inventory.services import (
    INVALID_INVENTORY_STOCK_MOVEMENT,
    INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION,
    InventoryStockMovementError,
    create_inventory_stock_movement,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _inventory_item() -> InventoryItem:
    return InventoryItem.objects.create(
        name="Service Movement Speaker",
        kind="article",
        description="Movement service item",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Service Movement Customer",
        email="service-movement@example.test",
        phone="+261340000555",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Service movement draft",
    )


def test_create_inventory_stock_movement_persists_validated_immutable_movement(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(username="movement-actor", password="test-pass")

    with django_capture_on_commit_callbacks(execute=True):
        movement = create_inventory_stock_movement(
            actor=actor,
            inventory_item=_inventory_item(),
            reservation_draft=_reservation_draft(),
            movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
            direction=InventoryStockMovementDirection.OUTBOUND,
            quantity=2,
            notes="Outbound delivery posted",
        )

    assert movement.validated_by_id == actor.id
    assert movement.created_by_id == actor.id
    assert movement.signed_quantity == -2
    assert AuditEvent.objects.filter(
        action="inventory.stock_movement_created",
        target_id=str(movement.id),
    ).exists()


def test_create_inventory_stock_movement_rejects_invalid_fixed_direction(
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(username="movement-invalid", password="test-pass")

    with pytest.raises(InventoryStockMovementError) as error_info:
        create_inventory_stock_movement(
            actor=actor,
            inventory_item=_inventory_item(),
            movement_type=InventoryStockMovementType.DAMAGE,
            direction=InventoryStockMovementDirection.INBOUND,
            quantity=1,
            source_label="Warehouse incident",
            notes="Damaged item removed",
        )

    assert error_info.value.code == INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION


def test_create_inventory_stock_movement_rejects_standalone_without_source_and_notes(
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(
        username="movement-standalone-invalid",
        password="test-pass",
    )

    with pytest.raises(InventoryStockMovementError) as error_info:
        create_inventory_stock_movement(
            actor=actor,
            inventory_item=_inventory_item(),
            movement_type=InventoryStockMovementType.OTHER,
            direction=InventoryStockMovementDirection.OUTBOUND,
            quantity=1,
            source_label="",
            notes="",
        )

    assert error_info.value.code == INVALID_INVENTORY_STOCK_MOVEMENT
