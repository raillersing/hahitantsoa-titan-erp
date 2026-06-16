from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryItem,
    InventoryStockMovement,
    InventoryStockMovementDirection,
    InventoryStockMovementType,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _inventory_item() -> InventoryItem:
    return InventoryItem.objects.create(
        name="Movement Camera",
        kind="material",
        description="Stock movement test item",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Movement Customer",
        email="movement@example.test",
        phone="+261340000444",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Movement draft",
    )


def test_stock_movement_accepts_outbound_delivery_with_positive_quantity() -> None:
    movement = InventoryStockMovement(
        inventory_item=_inventory_item(),
        reservation_draft=_reservation_draft(),
        movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
        direction=InventoryStockMovementDirection.OUTBOUND,
        quantity=2,
    )

    movement.full_clean()

    assert movement.signed_quantity == -2


def test_stock_movement_rejects_non_positive_quantity() -> None:
    movement = InventoryStockMovement(
        inventory_item=_inventory_item(),
        reservation_draft=_reservation_draft(),
        movement_type=InventoryStockMovementType.ADJUSTMENT_IN,
        direction=InventoryStockMovementDirection.INBOUND,
        quantity=0,
    )

    with pytest.raises(ValidationError) as error_info:
        movement.full_clean()

    assert "quantity" in error_info.value.message_dict


def test_stock_movement_rejects_wrong_fixed_direction() -> None:
    movement = InventoryStockMovement(
        inventory_item=_inventory_item(),
        reservation_draft=_reservation_draft(),
        movement_type=InventoryStockMovementType.LOSS,
        direction=InventoryStockMovementDirection.INBOUND,
        quantity=1,
    )

    with pytest.raises(ValidationError) as error_info:
        movement.full_clean()

    assert "direction" in error_info.value.message_dict


def test_stock_movement_requires_source_label_and_notes_for_standalone() -> None:
    movement = InventoryStockMovement(
        inventory_item=_inventory_item(),
        movement_type=InventoryStockMovementType.OTHER,
        direction=InventoryStockMovementDirection.OUTBOUND,
        quantity=1,
        source_label="",
        notes="",
    )

    with pytest.raises(ValidationError) as error_info:
        movement.full_clean()

    assert "source_label" in error_info.value.message_dict


def test_stock_movement_allows_standalone_other_with_explicit_direction() -> None:
    movement = InventoryStockMovement(
        inventory_item=_inventory_item(),
        movement_type=InventoryStockMovementType.OTHER,
        direction=InventoryStockMovementDirection.INBOUND,
        quantity=3,
        source_label="Manual recount",
        notes="Manual inbound correction",
    )

    movement.full_clean()

    assert movement.signed_quantity == 3
