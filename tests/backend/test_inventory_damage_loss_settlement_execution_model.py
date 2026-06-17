from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from tests.backend.test_inventory_damage_loss_settlement_model import (
    _inventory_item,
    _reservation_draft,
)

from apps.inventory.models import (
    InventoryCautionRefundObligation,
    InventoryDamageLossExcessReceivable,
    InventoryDamageLossSettlementExecution,
    InventoryDamageLossSettlementExecutionStatus,
)
from apps.inventory.services import (
    create_inventory_damage_loss_settlement,
    create_inventory_return_operation,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)

pytestmark = pytest.mark.django_db


def _validated_settlement(django_user_model):
    actor = django_user_model.objects.create_user(
        username="execution-model",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=_reservation_draft(),
        lines=[
            {
                "inventory_item": _inventory_item("Execution model item"),
                "expected_quantity": 1,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "missing",
                "notes": "",
            }
        ],
    )
    return_result = validate_inventory_return_operation(
        return_operation=return_operation,
        actor=actor,
    )
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_result.return_operation,
        lines=[
            {
                "return_operation_line": return_result.return_operation.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 1,
                "unit_amount": Decimal("10000.00"),
                "notes": "",
            }
        ],
    )
    settlement_result = validate_inventory_damage_loss_settlement(
        settlement=settlement,
        actor=actor,
    )
    return actor, settlement_result.settlement


def test_execution_requires_validated_settlement(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="execution-invalid-settlement",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        lines=[
            {
                "inventory_item": _inventory_item("Draft settlement execution item"),
                "expected_quantity": 1,
                "returned_quantity": 1,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            }
        ],
    )
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=validate_inventory_return_operation(
            return_operation=return_operation,
            actor=actor,
        ).return_operation,
        lines=[
            {
                "return_operation_line": return_operation.lines.get(),
                "settlement_line_kind": "damage",
                "quantity": 1,
                "unit_amount": Decimal("1000.00"),
                "notes": "",
            }
        ],
    )
    execution = InventoryDamageLossSettlementExecution(settlement=settlement)

    with pytest.raises(ValidationError) as error_info:
        execution.full_clean()

    assert "settlement" in error_info.value.message_dict


def test_executed_execution_requires_executed_by(django_user_model) -> None:
    _, settlement = _validated_settlement(django_user_model)
    execution = InventoryDamageLossSettlementExecution(
        settlement=settlement,
        status=InventoryDamageLossSettlementExecutionStatus.EXECUTED,
    )

    with pytest.raises(ValidationError) as error_info:
        execution.full_clean()

    assert "executed_by" in error_info.value.message_dict


def test_refund_obligation_requires_executed_execution(django_user_model) -> None:
    _, settlement = _validated_settlement(django_user_model)
    execution = InventoryDamageLossSettlementExecution.objects.create(settlement=settlement)
    obligation = InventoryCautionRefundObligation(
        settlement_execution=execution,
        amount=Decimal("5000.00"),
    )

    with pytest.raises(ValidationError) as error_info:
        obligation.full_clean()

    assert "settlement_execution" in error_info.value.message_dict


def test_excess_receivable_requires_executed_execution(django_user_model) -> None:
    _, settlement = _validated_settlement(django_user_model)
    execution = InventoryDamageLossSettlementExecution.objects.create(settlement=settlement)
    receivable = InventoryDamageLossExcessReceivable(
        settlement_execution=execution,
        amount=Decimal("5000.00"),
    )

    with pytest.raises(ValidationError) as error_info:
        receivable.full_clean()

    assert "settlement_execution" in error_info.value.message_dict
