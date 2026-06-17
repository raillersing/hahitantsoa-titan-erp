from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLine,
    InventoryReturnOperationLineConditionStatus,
    InventoryReturnOperationStatus,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _inventory_item() -> InventoryItem:
    return InventoryItem.objects.create(
        name="Return model item",
        kind="material",
        description="Return operation test item",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Return model customer",
        email="return-model@example.test",
        phone="+261340000777",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Return model draft",
    )


def test_return_operation_line_accepts_mixed_classification() -> None:
    return_operation = InventoryReturnOperation.objects.create(
        reservation_draft=_reservation_draft(),
    )
    line = InventoryReturnOperationLine(
        return_operation=return_operation,
        inventory_item=_inventory_item(),
        expected_quantity=5,
        returned_quantity=4,
        damaged_quantity=1,
        missing_quantity=1,
        condition_status=InventoryReturnOperationLineConditionStatus.MIXED,
    )

    line.full_clean()

    assert line.intact_quantity == 3


def test_return_operation_line_rejects_damaged_quantity_greater_than_returned() -> None:
    return_operation = InventoryReturnOperation.objects.create()
    line = InventoryReturnOperationLine(
        return_operation=return_operation,
        inventory_item=_inventory_item(),
        expected_quantity=2,
        returned_quantity=1,
        damaged_quantity=2,
        missing_quantity=0,
        condition_status=InventoryReturnOperationLineConditionStatus.DAMAGED,
    )

    with pytest.raises(ValidationError) as error_info:
        line.full_clean()

    assert "damaged_quantity" in error_info.value.message_dict


def test_return_operation_line_rejects_non_mixed_single_category_marked_as_mixed() -> None:
    return_operation = InventoryReturnOperation.objects.create()
    line = InventoryReturnOperationLine(
        return_operation=return_operation,
        inventory_item=_inventory_item(),
        expected_quantity=2,
        returned_quantity=2,
        damaged_quantity=0,
        missing_quantity=0,
        condition_status=InventoryReturnOperationLineConditionStatus.MIXED,
    )

    with pytest.raises(ValidationError) as error_info:
        line.full_clean()

    assert "condition_status" in error_info.value.message_dict


def test_validated_return_operation_requires_validated_by(django_user_model) -> None:
    return_operation = InventoryReturnOperation(
        status=InventoryReturnOperationStatus.VALIDATED,
        validated_at=timezone.now(),
    )

    with pytest.raises(ValidationError) as error_info:
        return_operation.full_clean()

    assert "validated_by" in error_info.value.message_dict
