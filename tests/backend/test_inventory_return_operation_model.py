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


def test_return_operation_line_normalizes_legacy_damage_and_missing_into_casse() -> None:
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
    assert line.conforming_quantity == 3
    assert line.breakage_quantity == 2
    assert line.casse_quantity == 2


def test_return_operation_line_rejects_incomplete_return() -> None:
    return_operation = InventoryReturnOperation.objects.create()
    line = InventoryReturnOperationLine(
        return_operation=return_operation,
        inventory_item=_inventory_item(),
        expected_quantity=2,
        conforming_quantity=1,
        breakage_quantity=0,
        returned_quantity=0,
        damaged_quantity=0,
        missing_quantity=0,
        condition_status=InventoryReturnOperationLineConditionStatus.INTACT,
    )

    with pytest.raises(ValidationError) as error_info:
        line.full_clean()

    assert "breakage_quantity" in error_info.value.message_dict


def test_return_operation_line_accepts_canonical_casse_without_legacy_categories() -> None:
    return_operation = InventoryReturnOperation.objects.create()
    line = InventoryReturnOperationLine(
        return_operation=return_operation,
        inventory_item=_inventory_item(),
        expected_quantity=2,
        conforming_quantity=0,
        breakage_quantity=2,
        condition_status=InventoryReturnOperationLineConditionStatus.BREAKAGE,
    )

    line.full_clean()

    assert line.casse_quantity == 2
    assert line.intact_quantity == 0


def test_return_operation_line_derives_compatibility_status_when_omitted() -> None:
    return_operation = InventoryReturnOperation.objects.create()
    line = InventoryReturnOperationLine(
        return_operation=return_operation,
        inventory_item=_inventory_item(),
        expected_quantity=2,
        conforming_quantity=0,
        breakage_quantity=2,
    )

    line.full_clean()

    assert line.condition_status == InventoryReturnOperationLineConditionStatus.DAMAGED


def test_validated_return_operation_requires_validated_by(django_user_model) -> None:
    return_operation = InventoryReturnOperation(
        status=InventoryReturnOperationStatus.VALIDATED,
        validated_at=timezone.now(),
    )

    with pytest.raises(ValidationError) as error_info:
        return_operation.full_clean()

    assert "validated_by" in error_info.value.message_dict
