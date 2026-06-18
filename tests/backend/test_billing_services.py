from decimal import Decimal

import pytest
from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
    _validated_settlement,
)

from apps.audit.models import AuditEvent
from apps.billing.models import BillingInvoice, BillingInvoiceStatus
from apps.billing.services import (
    BILLING_INVOICE_ALREADY_EXISTS,
    INVALID_BILLING_SETTLEMENT_PAYMENT,
    BillingLifecycleError,
    issue_billing_invoice_for_excess_receivable,
    settle_billing_invoice,
)
from apps.documents.models import DocumentInstance
from apps.inventory.models import InventoryDamageLossExcessReceivableStatus
from apps.inventory.services import (
    create_inventory_damage_loss_settlement_execution,
    execute_inventory_damage_loss_settlement_execution,
)
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import confirm_payment, create_payment

pytestmark = pytest.mark.django_db


def _executed_excess_receivable(
    django_user_model,
    *,
    caution_amount: Decimal = Decimal("10000.00"),
    unit_amount: Decimal = Decimal("25000.00"),
):
    actor, reservation_draft, settlement = _validated_settlement(
        django_user_model,
        caution_amount=caution_amount,
        unit_amount=unit_amount,
    )
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor,
        settlement=settlement,
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    assert result.excess_receivable is not None
    return actor, reservation_draft, result.excess_receivable


def test_issue_billing_invoice_creates_billing_record_and_generated_document(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, reservation_draft, excess_receivable = _executed_excess_receivable(django_user_model)

    with django_capture_on_commit_callbacks(execute=True):
        invoice = issue_billing_invoice_for_excess_receivable(
            excess_receivable=excess_receivable,
            actor=actor,
            notes="Issue excess receivable invoice",
        )

    excess_receivable.refresh_from_db()
    invoice.refresh_from_db()

    assert invoice.reservation_draft_id == reservation_draft.id
    assert invoice.amount == excess_receivable.amount
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN
    assert invoice.document_instance.status == "generated"
    assert excess_receivable.status == InventoryDamageLossExcessReceivableStatus.INVOICED
    assert AuditEvent.objects.filter(
        action="billing.invoice_issued",
        target_id=str(invoice.id),
    ).exists()


def test_issue_billing_invoice_rolls_back_duplicate_attempt(django_user_model) -> None:
    actor, _, excess_receivable = _executed_excess_receivable(django_user_model)
    first_invoice = issue_billing_invoice_for_excess_receivable(
        excess_receivable=excess_receivable,
        actor=actor,
    )
    before_document_count = DocumentInstance.objects.count()

    with pytest.raises(BillingLifecycleError) as error_info:
        issue_billing_invoice_for_excess_receivable(
            excess_receivable=excess_receivable,
            actor=actor,
        )

    assert error_info.value.code == BILLING_INVOICE_ALREADY_EXISTS
    assert BillingInvoice.objects.get(pk=first_invoice.pk).invoice_status == (
        BillingInvoiceStatus.OPEN
    )
    assert DocumentInstance.objects.count() == before_document_count


def test_settle_billing_invoice_creates_exact_match_settlement(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, reservation_draft, excess_receivable = _executed_excess_receivable(django_user_model)
    invoice = issue_billing_invoice_for_excess_receivable(
        excess_receivable=excess_receivable,
        actor=actor,
    )
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=invoice.amount,
        source_label="Damage/loss excess settlement",
    )

    with django_capture_on_commit_callbacks(execute=True):
        confirmed_payment = confirm_payment(payment=payment, actor=actor).payment
        result = settle_billing_invoice(
            invoice=invoice,
            payment=confirmed_payment,
            actor=actor,
            notes="Settle billed excess receivable",
        )

    invoice.refresh_from_db()

    assert result.settlement.payment_id == confirmed_payment.id
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED
    assert invoice.settlement.amount == invoice.amount
    assert AuditEvent.objects.filter(
        action="billing.invoice_settled",
        target_id=str(invoice.id),
    ).exists()


def test_settle_billing_invoice_rejects_amount_mismatch(django_user_model) -> None:
    actor, reservation_draft, excess_receivable = _executed_excess_receivable(django_user_model)
    invoice = issue_billing_invoice_for_excess_receivable(
        excess_receivable=excess_receivable,
        actor=actor,
    )
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("1000.00"),
        source_label="Wrong amount payment",
    )
    confirmed_payment = confirm_payment(payment=payment, actor=actor).payment

    with pytest.raises(BillingLifecycleError) as error_info:
        settle_billing_invoice(
            invoice=invoice,
            payment=confirmed_payment,
            actor=actor,
        )

    assert error_info.value.code == INVALID_BILLING_SETTLEMENT_PAYMENT
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN
