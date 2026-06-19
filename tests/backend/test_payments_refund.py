from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone
from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
    _confirmed_caution_payment,
)
from tests.backend.test_inventory_damage_loss_settlement_model import (
    _inventory_item,
)

from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.inventory.models import (
    InventoryCautionRefundObligationStatus,
)
from apps.inventory.services import (
    create_inventory_damage_loss_settlement,
    create_inventory_damage_loss_settlement_execution,
    create_inventory_return_operation,
    execute_inventory_damage_loss_settlement_execution,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import (
    INVALID_PAYMENT_REFUND_STATE,
    REFUND_OBLIGATION_NOT_PENDING,
    PaymentLifecycleError,
    confirm_refund_payment,
    create_refund_payment,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(
        display_name="Refund customer",
        email="refund@example.test",
        phone="+261340000333",
        address="Antananarivo",
    )


def _reservation_draft_refund() -> ReservationDraft:
    customer = _customer()
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=5)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Refund reservation draft",
    )


def _pending_refund_obligation(
    django_user_model,
    *,
    caution_amount: Decimal = Decimal("60000.00"),
    unit_amount: Decimal = Decimal("25000.00"),
):
    actor = django_user_model.objects.create_user(
        username=f"refund-test-{caution_amount}-{unit_amount}", password="test-pass"
    )
    reservation_draft = _reservation_draft_refund()
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=reservation_draft,
        lines=[
            {
                "inventory_item": _inventory_item("Refund test item"),
                "expected_quantity": 2,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 2,
                "condition_status": "missing",
                "notes": "",
            },
        ],
    )
    return_result = validate_inventory_return_operation(
        return_operation=return_operation, actor=actor
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
                "quantity": 2,
                "unit_amount": unit_amount,
                "notes": "",
            }
        ],
    )
    settlement_result = validate_inventory_damage_loss_settlement(
        settlement=settlement, actor=actor
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement_result.settlement
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    obligation = result.refund_obligation
    assert obligation is not None
    assert obligation.status == InventoryCautionRefundObligationStatus.PENDING
    assert obligation.amount > 0
    return actor, obligation, execution


def test_create_refund_payment_from_pending_obligation(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    payment = create_refund_payment(
        refund_obligation=obligation,
        actor=actor,
        notes="Test refund",
    )
    assert payment.payment_kind == PaymentKind.REFUND
    assert payment.payment_status == PaymentStatus.PENDING
    assert payment.amount == obligation.amount
    assert payment.refund_obligation_id == obligation.id
    assert payment.source_label == "Caution refund"


def test_create_refund_payment_rejects_non_pending_obligation(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    obligation.status = InventoryCautionRefundObligationStatus.SETTLED
    obligation.save(update_fields=["status"])

    with pytest.raises(PaymentLifecycleError) as error_info:
        create_refund_payment(refund_obligation=obligation, actor=actor)

    assert error_info.value.code == REFUND_OBLIGATION_NOT_PENDING


def test_confirm_refund_payment_confirms_and_settles(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    payment = create_refund_payment(
        refund_obligation=obligation,
        actor=actor,
        notes="Test refund",
    )

    result = confirm_refund_payment(payment=payment, actor=actor)

    payment.refresh_from_db()
    obligation.refresh_from_db()
    assert payment.payment_status == PaymentStatus.CONFIRMED
    assert payment.receipt_document is not None
    assert payment.receipt_document.template_key == "shared.payment_refund_receipt.v1"
    assert obligation.status == InventoryCautionRefundObligationStatus.SETTLED
    assert result.payment.id == payment.id
    assert result.receipt_document.id == payment.receipt_document.id


def test_confirm_refund_payment_rejects_non_refund_kind(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="refund-non-refund", password="test-pass"
    )
    reservation_draft = _reservation_draft_refund()
    payment = Payment.objects.create(
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Balance payment",
    )

    with pytest.raises(PaymentLifecycleError) as error_info:
        confirm_refund_payment(payment=payment, actor=actor)

    assert error_info.value.code == INVALID_PAYMENT_REFUND_STATE


def test_confirm_refund_payment_rejects_non_pending_payment(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    payment = create_refund_payment(refund_obligation=obligation, actor=actor)
    payment.payment_status = PaymentStatus.CANCELLED
    payment.save(update_fields=["payment_status"])

    with pytest.raises(PaymentLifecycleError) as error_info:
        confirm_refund_payment(payment=payment, actor=actor)

    assert error_info.value.code == INVALID_PAYMENT_REFUND_STATE


def test_confirm_refund_payment_rejects_missing_obligation(django_user_model) -> None:
    from django.db import IntegrityError

    django_user_model.objects.create_user(
        username="refund-missing-obligation", password="test-pass"
    )
    reservation_draft = _reservation_draft_refund()

    with pytest.raises(IntegrityError):
        Payment.objects.create(
            reservation_draft=reservation_draft,
            payment_kind=PaymentKind.REFUND,
            payment_method=PaymentMethod.BANK_TRANSFER,
            payment_status=PaymentStatus.PENDING,
            amount=Decimal("10000.00"),
            source_label="Caution refund",
        )


def test_payment_model_clean_rejects_refund_without_obligation(django_user_model) -> None:
    django_user_model.objects.create_user(username="refund-clean-test", password="test-pass")
    reservation_draft = _reservation_draft_refund()
    payment = Payment(
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.REFUND,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Caution refund",
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "refund_obligation" in error_info.value.message_dict


def test_payment_model_clean_rejects_refund_with_settled_obligation(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    obligation.status = InventoryCautionRefundObligationStatus.SETTLED
    obligation.save(update_fields=["status"])

    payment = Payment(
        reservation_draft=_reservation_draft_refund(),
        payment_kind=PaymentKind.REFUND,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Caution refund",
        refund_obligation=obligation,
    )

    with pytest.raises(ValidationError) as error_info:
        payment.full_clean()

    assert "refund_obligation" in error_info.value.message_dict


def test_refund_amount_must_be_positive(django_user_model) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)
    obligation.amount = Decimal("0.00")

    with pytest.raises(ValidationError):
        obligation.full_clean()


def test_refund_payment_audit_events(django_user_model, django_capture_on_commit_callbacks) -> None:
    actor, obligation, _ = _pending_refund_obligation(django_user_model)

    with django_capture_on_commit_callbacks(execute=True):
        payment = create_refund_payment(refund_obligation=obligation, actor=actor)

    assert AuditEvent.objects.filter(
        action="payment.refund.created",
        target_id=str(payment.id),
    ).exists()

    with django_capture_on_commit_callbacks(execute=True):
        confirm_refund_payment(payment=payment, actor=actor)

    assert AuditEvent.objects.filter(
        action="payment.refund.confirmed",
        target_id=str(payment.id),
    ).exists()
    assert AuditEvent.objects.filter(
        action="document.instance_generated",
        target_type="document_instance",
    ).exists()
