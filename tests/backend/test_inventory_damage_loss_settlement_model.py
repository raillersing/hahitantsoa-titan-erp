from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementLine,
    InventoryDamageLossSettlementStatus,
    InventoryItem,
)
from apps.inventory.services import (
    create_inventory_return_operation,
    validate_inventory_return_operation,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _inventory_item(name: str) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind="material",
        description=f"{name} description",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Settlement model customer",
        email="settlement-model@example.test",
        phone="+261340001001",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Settlement model reservation",
    )


def _validated_return_operation(django_user_model):
    actor = django_user_model.objects.create_user(username="settlement-model", password="test-pass")
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=_reservation_draft(),
        lines=[
            {
                "inventory_item": _inventory_item("Settlement model item"),
                "expected_quantity": 2,
                "returned_quantity": 1,
                "damaged_quantity": 1,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "Settlement model line",
            }
        ],
    )
    result = validate_inventory_return_operation(return_operation=return_operation, actor=actor)
    return actor, result.return_operation


def test_damage_loss_settlement_requires_validated_return_operation(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="settlement-invalid-return",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        lines=[
            {
                "inventory_item": _inventory_item("Draft return item"),
                "expected_quantity": 1,
                "returned_quantity": 1,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            }
        ],
    )
    settlement = InventoryDamageLossSettlement(return_operation=return_operation)

    with pytest.raises(ValidationError) as error_info:
        settlement.full_clean()

    assert "return_operation" in error_info.value.message_dict


def test_damage_loss_settlement_line_requires_manual_label_without_return_line(
    django_user_model,
) -> None:
    _, return_operation = _validated_return_operation(django_user_model)
    settlement = InventoryDamageLossSettlement.objects.create(return_operation=return_operation)
    line = InventoryDamageLossSettlementLine(
        settlement=settlement,
        settlement_line_kind="other",
        quantity=1,
        unit_amount=Decimal("100.00"),
    )

    with pytest.raises(ValidationError) as error_info:
        line.full_clean()

    assert "manual_label" in error_info.value.message_dict


def test_validated_damage_loss_settlement_requires_validated_by(django_user_model) -> None:
    _, return_operation = _validated_return_operation(django_user_model)
    settlement = InventoryDamageLossSettlement(
        return_operation=return_operation,
        settlement_status=InventoryDamageLossSettlementStatus.VALIDATED,
    )

    with pytest.raises(ValidationError) as error_info:
        settlement.full_clean()

    assert "validated_by" in error_info.value.message_dict


def test_damage_loss_settlement_line_computes_total_amount(django_user_model) -> None:
    _, return_operation = _validated_return_operation(django_user_model)
    settlement = InventoryDamageLossSettlement.objects.create(return_operation=return_operation)
    return_operation_line = return_operation.lines.get()
    line = InventoryDamageLossSettlementLine(
        settlement=settlement,
        return_operation_line=return_operation_line,
        settlement_line_kind="damage",
        quantity=2,
        unit_amount=Decimal("15000.00"),
    )

    line.full_clean()

    assert line.total_amount == Decimal("30000.00")
