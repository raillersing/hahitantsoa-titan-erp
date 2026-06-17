from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from tests.backend.test_inventory_damage_loss_settlement_model import (
    _inventory_item,
    _reservation_draft,
)

from apps.audit.models import AuditEvent
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.inventory.models import (
    InventoryCautionRefundObligation,
    InventoryDamageLossExcessReceivable,
    InventoryDamageLossSettlementExecutionStatus,
    InventoryStockMovement,
)
from apps.inventory.services import (
    INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_SETTLEMENT_STATE,
    INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_STATE,
    InventoryStockMovementError,
    create_inventory_damage_loss_settlement,
    create_inventory_damage_loss_settlement_execution,
    create_inventory_return_operation,
    execute_inventory_damage_loss_settlement_execution,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)
from apps.payments.models import Payment

pytestmark = pytest.mark.django_db


def _confirmed_caution_payment(actor, reservation_draft, paid_at, amount: Decimal) -> Payment:
    receipt = DocumentInstance.objects.create(
        reservation_draft=reservation_draft,
        customer=reservation_draft.customer,
        template_key="shared.payment_receipt.v1",
        template_version="v1",
        template_label="Recu de caution",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/shared/payment_receipt/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/shared/payment_receipt/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes="Receipt",
        reservation_public_reference=reservation_draft.public_reference,
        reservation_status=reservation_draft.status,
        customer_display_name=reservation_draft.customer.display_name,
        customer_email=reservation_draft.customer.email,
        customer_phone=reservation_draft.customer.phone,
        customer_address=reservation_draft.customer.address,
        status=DocumentInstanceStatus.GENERATED,
    )
    return Payment.objects.create(
        reservation_draft=reservation_draft,
        receipt_document=receipt,
        payment_kind="caution",
        payment_method="cash",
        payment_status="confirmed",
        amount=amount,
        paid_at=paid_at,
        source_label="Confirmed caution",
        confirmed_at=paid_at,
        confirmed_by=actor,
    )


def _validated_settlement(
    django_user_model,
    *,
    caution_amount: Decimal = Decimal("0.00"),
    unit_amount: Decimal = Decimal("10000.00"),
    quantity: int = 1,
):
    actor = django_user_model.objects.create_user(
        username=f"execution-service-{caution_amount}-{unit_amount}-{quantity}",
        password="test-pass",
    )
    reservation_draft = _reservation_draft()
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=reservation_draft,
        lines=[
            {
                "inventory_item": _inventory_item("Execution service item"),
                "expected_quantity": quantity,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": quantity,
                "condition_status": "missing",
                "notes": "",
            }
        ],
    )
    return_result = validate_inventory_return_operation(
        return_operation=return_operation,
        actor=actor,
    )
    if caution_amount > Decimal("0.00"):
        _confirmed_caution_payment(
            actor,
            reservation_draft,
            return_result.return_operation.validated_at,
            caution_amount,
        )
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_result.return_operation,
        lines=[
            {
                "return_operation_line": return_result.return_operation.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": quantity,
                "unit_amount": unit_amount,
                "notes": "",
            }
        ],
    )
    settlement_result = validate_inventory_damage_loss_settlement(
        settlement=settlement,
        actor=actor,
    )
    return actor, reservation_draft, settlement_result.settlement


def test_create_execution_draft_for_validated_settlement_without_side_effects(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, _, settlement = _validated_settlement(django_user_model)
    before_payment_count = Payment.objects.count()
    before_document_count = DocumentInstance.objects.count()
    before_stock_movement_count = InventoryStockMovement.objects.count()

    with django_capture_on_commit_callbacks(execute=True):
        execution = create_inventory_damage_loss_settlement_execution(
            actor=actor,
            settlement=settlement,
            notes="Prepare settlement execution",
        )

    assert execution.status == InventoryDamageLossSettlementExecutionStatus.DRAFT
    assert not InventoryCautionRefundObligation.objects.filter(
        settlement_execution=execution
    ).exists()
    assert not InventoryDamageLossExcessReceivable.objects.filter(
        settlement_execution=execution
    ).exists()
    assert Payment.objects.count() == before_payment_count
    assert DocumentInstance.objects.count() == before_document_count
    assert InventoryStockMovement.objects.count() == before_stock_movement_count
    assert AuditEvent.objects.filter(
        action="inventory.damage_loss_settlement_execution_created",
        target_id=str(execution.id),
    ).exists()


def test_create_execution_rejects_non_validated_settlement(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="execution-draft-settlement",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=_reservation_draft(),
        lines=[
            {
                "inventory_item": _inventory_item("Execution draft item"),
                "expected_quantity": 1,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "missing",
                "notes": "",
            }
        ],
    )
    validated_return = validate_inventory_return_operation(
        return_operation=return_operation,
        actor=actor,
    ).return_operation
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=validated_return,
        lines=[
            {
                "return_operation_line": validated_return.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 1,
                "unit_amount": Decimal("1000.00"),
                "notes": "",
            }
        ],
    )

    with pytest.raises(InventoryStockMovementError) as error_info:
        create_inventory_damage_loss_settlement_execution(
            actor=actor,
            settlement=settlement,
        )

    assert error_info.value.code == INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_SETTLEMENT_STATE


def test_execute_settlement_with_refund_due_creates_refund_obligation(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("60000.00"),
        unit_amount=Decimal("25000.00"),
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )

    with django_capture_on_commit_callbacks(execute=True):
        result = execute_inventory_damage_loss_settlement_execution(
            execution=execution,
            actor=actor,
        )

    execution.refresh_from_db()
    assert execution.status == InventoryDamageLossSettlementExecutionStatus.EXECUTED
    assert execution.refund_due_snapshot == Decimal("35000.00")
    assert execution.excess_due_snapshot == Decimal("0.00")
    assert result.refund_obligation is not None
    assert result.refund_obligation.amount == Decimal("35000.00")
    assert result.excess_receivable is None


def test_execute_settlement_with_excess_due_creates_excess_receivable(
    django_user_model,
) -> None:
    actor, _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("10000.00"),
        unit_amount=Decimal("25000.00"),
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )

    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)

    execution.refresh_from_db()
    assert execution.caution_applied_snapshot == Decimal("10000.00")
    assert execution.excess_due_snapshot == Decimal("15000.00")
    assert result.refund_obligation is None
    assert result.excess_receivable is not None
    assert result.excess_receivable.amount == Decimal("15000.00")


def test_execute_settlement_with_zero_obligations_is_safe(django_user_model) -> None:
    actor, _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("10000.00"),
        unit_amount=Decimal("10000.00"),
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )

    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)

    execution.refresh_from_db()
    assert execution.refund_due_snapshot == Decimal("0.00")
    assert execution.excess_due_snapshot == Decimal("0.00")
    assert result.refund_obligation is None
    assert result.excess_receivable is None


def test_execute_duplicate_execution_is_rejected(django_user_model) -> None:
    actor, _, settlement = _validated_settlement(django_user_model)
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )
    execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)

    with pytest.raises(InventoryStockMovementError) as error_info:
        execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)

    assert error_info.value.code == INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_STATE


def test_execution_rolls_back_if_obligation_creation_fails(
    django_user_model,
    monkeypatch,
) -> None:
    actor, _, settlement = _validated_settlement(
        django_user_model,
        caution_amount=Decimal("60000.00"),
        unit_amount=Decimal("25000.00"),
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )
    before_payment_count = Payment.objects.count()
    before_document_count = DocumentInstance.objects.count()
    before_stock_movement_count = InventoryStockMovement.objects.count()

    original_full_clean = InventoryCautionRefundObligation.full_clean

    def _failing_full_clean(self, *args, **kwargs):
        raise ValidationError({"amount": ["Synthetic execution rollback failure."]})

    monkeypatch.setattr(
        InventoryCautionRefundObligation,
        "full_clean",
        _failing_full_clean,
    )

    with pytest.raises(ValidationError):
        execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)

    monkeypatch.setattr(InventoryCautionRefundObligation, "full_clean", original_full_clean)
    execution.refresh_from_db()
    assert execution.status == InventoryDamageLossSettlementExecutionStatus.DRAFT
    assert execution.executed_at is None
    assert not InventoryCautionRefundObligation.objects.filter(
        settlement_execution=execution
    ).exists()
    assert not InventoryDamageLossExcessReceivable.objects.filter(
        settlement_execution=execution
    ).exists()
    assert Payment.objects.count() == before_payment_count
    assert DocumentInstance.objects.count() == before_document_count
    assert InventoryStockMovement.objects.count() == before_stock_movement_count
