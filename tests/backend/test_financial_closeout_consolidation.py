from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from tests.backend.test_billing_installments import (
    _confirmed_payment,
    _issued_invoice,
    _items,
)
from tests.backend.test_cashbox_services import _actor

from apps.audit.models import AuditEvent
from apps.billing.models import BillingInvoice, BillingInvoiceSourceKind, BillingInvoiceStatus
from apps.billing.services import (
    RESERVATION_FINANCIAL_CLOSEOUT_COHERENT,
    allocate_payment_to_installment,
    compute_reservation_financial_closeout_summary,
    create_billing_invoice_installments,
    create_billing_invoice_refund_obligation,
    execute_billing_refund_obligation,
    execute_commercial_closeout,
    issue_billing_invoice_for_commercial_closeout,
    issue_billing_invoice_for_excess_receivable,
)
from apps.cashbox.models import CashboxMovementDirection
from apps.cashbox.services import (
    CASHBOX_MOVEMENT_INVOICE_AMOUNT_MISMATCH,
    CASHBOX_MOVEMENT_PAYMENT_AMOUNT_MISMATCH,
    CASHBOX_MOVEMENT_REFUND_AMOUNT_MISMATCH,
    CashboxLifecycleError,
    close_cashbox_session,
    open_cashbox_session,
    record_cashbox_movement,
)
from apps.inventory.services import (
    create_inventory_damage_loss_settlement_execution,
    execute_inventory_damage_loss_settlement_execution,
)
from apps.payments.models import PaymentKind
from apps.payments.services import create_payment

pytestmark = pytest.mark.django_db


def test_full_closeout_lifecycle_invoice_settle_refund_cashbox(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, reservation_draft, settlement = _validated_settlement(django_user_model)
    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    excess_receivable = result.excess_receivable
    assert excess_receivable is not None

    with django_capture_on_commit_callbacks(execute=True):
        invoice = issue_billing_invoice_for_excess_receivable(
            excess_receivable=excess_receivable,
            actor=actor,
        )

    assert invoice.amount == Decimal("15000.00")
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN

    with django_capture_on_commit_callbacks(execute=True):
        installments = create_billing_invoice_installments(
            invoice=invoice,
            installments=_items("10000.00", "5000.00"),
            actor=actor,
        )

    payment1 = _confirmed_payment(actor, reservation_draft, Decimal("4000.00"))
    payment2 = _confirmed_payment(actor, reservation_draft, Decimal("3000.00"))

    with django_capture_on_commit_callbacks(execute=True):
        allocate_payment_to_installment(
            installment=installments[0],
            payment=payment1,
            actor=actor,
        )
        allocate_payment_to_installment(
            installment=installments[1],
            payment=payment2,
            actor=actor,
        )

    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN

    with django_capture_on_commit_callbacks(execute=True):
        refund_obligation = create_billing_invoice_refund_obligation(
            invoice=invoice,
            actor=actor,
            notes="Partial refund on cancellation",
        )

    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.CANCELLED
    assert refund_obligation.refund_amount == Decimal("7000.00")

    with django_capture_on_commit_callbacks(execute=True):
        refund_result = execute_billing_refund_obligation(
            obligation=refund_obligation,
            actor=actor,
            notes="Refund executed",
        )

    refund_payment = refund_result.payment
    assert refund_payment.payment_kind == PaymentKind.REFUND
    assert refund_payment.amount == Decimal("7000.00")

    cashbox_actor = _actor("cashbox-closeout-lifecycle")

    with django_capture_on_commit_callbacks(execute=True):
        session = open_cashbox_session(operator=cashbox_actor, actor=cashbox_actor)

        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("4000.00"),
            actor=cashbox_actor,
            payment=payment1,
            note="First payment received",
        )
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("3000.00"),
            actor=cashbox_actor,
            payment=payment2,
            note="Second payment received",
        )
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_OUT,
            amount=Decimal("7000.00"),
            actor=cashbox_actor,
            billing_refund_obligation=refund_obligation,
            note="Refund paid out",
        )

        close_result = close_cashbox_session(
            session=session,
            actor=cashbox_actor,
            closing_note="End of shift",
        )
    assert close_result.net_amount == Decimal("0.00")

    summary = compute_reservation_financial_closeout_summary(reservation_draft)
    assert summary.total_invoiced == Decimal("15000.00")
    assert summary.total_settled == Decimal("7000.00")
    assert summary.total_refunded == Decimal("7000.00")
    assert summary.total_cashbox_in == Decimal("7000.00")
    assert summary.total_cashbox_out == Decimal("7000.00")
    assert summary.net_balance == Decimal("0.00")
    assert summary.coherence_status == RESERVATION_FINANCIAL_CLOSEOUT_COHERENT
    assert summary.total_paid >= summary.total_settled
    assert summary.total_refunded <= summary.total_paid
    assert summary.total_refunded <= summary.total_invoiced

    assert AuditEvent.objects.filter(action="billing.invoice_issued").exists()
    assert AuditEvent.objects.filter(action="billing.installment_schedule_created").exists()
    assert AuditEvent.objects.filter(action="billing.installment_payment_allocated").exists()
    assert AuditEvent.objects.filter(action="billing.invoice_cancelled").exists()
    assert AuditEvent.objects.filter(action="billing.invoice_refund_obligation_created").exists()
    assert AuditEvent.objects.filter(action="billing.refund_obligation_executed").exists()
    assert AuditEvent.objects.filter(action="cashbox.session_opened").exists()
    assert AuditEvent.objects.filter(action="cashbox.movement_recorded").exists()
    assert AuditEvent.objects.filter(action="cashbox.session_closed").exists()


def test_closeout_summary_empty_reservation(django_user_model) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    start_at = datetime(2026, 1, 1, tzinfo=UTC)
    end_at = start_at + timedelta(days=3)

    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Closeout Empty"),
        start_at=start_at,
        end_at=end_at,
    )

    summary = compute_reservation_financial_closeout_summary(reservation_draft)
    assert summary.total_invoiced == Decimal("0.00")
    assert summary.total_paid == Decimal("0.00")
    assert summary.total_settled == Decimal("0.00")
    assert summary.total_refunded == Decimal("0.00")
    assert summary.total_cashbox_in == Decimal("0.00")
    assert summary.total_cashbox_out == Decimal("0.00")
    assert summary.net_balance == Decimal("0.00")
    assert summary.coherence_status == RESERVATION_FINANCIAL_CLOSEOUT_COHERENT


def test_cashbox_movement_guard_rejects_amount_mismatch_with_payment(
    django_user_model,
) -> None:
    actor = _actor("cashbox-guard-amt-pmt")
    session = open_cashbox_session(operator=actor, actor=actor)
    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.BALANCE,
        payment_method="cash",
        payment_status="pending",
        amount=Decimal("100.00"),
        source_label="Test payment",
    )

    with pytest.raises(CashboxLifecycleError) as error_info:
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("200.00"),
            actor=actor,
            payment=payment,
        )
    assert error_info.value.code == CASHBOX_MOVEMENT_PAYMENT_AMOUNT_MISMATCH


def test_cashbox_movement_guard_rejects_amount_mismatch_with_invoice(
    django_user_model,
) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    cash_actor = _actor("cashbox-guard-amt-inv")
    session = open_cashbox_session(operator=cash_actor, actor=cash_actor)

    with pytest.raises(CashboxLifecycleError) as error_info:
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("1.00"),
            actor=cash_actor,
            billing_invoice=invoice,
        )
    assert error_info.value.code == CASHBOX_MOVEMENT_INVOICE_AMOUNT_MISMATCH


def test_cashbox_movement_guard_rejects_amount_mismatch_with_refund_obligation(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)

    with django_capture_on_commit_callbacks(execute=True):
        installments = create_billing_invoice_installments(
            invoice=invoice,
            installments=_items("10000.00", "5000.00"),
            actor=actor,
        )
    payment1 = _confirmed_payment(actor, reservation_draft, Decimal("4000.00"))
    with django_capture_on_commit_callbacks(execute=True):
        allocate_payment_to_installment(
            installment=installments[0],
            payment=payment1,
            actor=actor,
        )

    with django_capture_on_commit_callbacks(execute=True):
        refund_obligation = create_billing_invoice_refund_obligation(
            invoice=invoice,
            actor=actor,
            notes="Partial refund",
        )

    cash_actor = _actor("cashbox-guard-amt-ref")
    session = open_cashbox_session(operator=cash_actor, actor=cash_actor)

    with pytest.raises(CashboxLifecycleError) as error_info:
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_OUT,
            amount=Decimal("1.00"),
            actor=cash_actor,
            billing_refund_obligation=refund_obligation,
        )
    assert error_info.value.code == CASHBOX_MOVEMENT_REFUND_AMOUNT_MISMATCH


def test_cashbox_movement_guard_accepts_exact_match(django_user_model) -> None:
    actor = _actor("cashbox-guard-exact")
    session = open_cashbox_session(operator=actor, actor=actor)
    payment = create_payment(
        actor=actor,
        payment_kind=PaymentKind.BALANCE,
        payment_method="cash",
        payment_status="pending",
        amount=Decimal("100.00"),
        source_label="Exact match payment",
    )

    movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=Decimal("100.00"),
        actor=actor,
        payment=payment,
    )
    assert movement.amount == Decimal("100.00")
    assert movement.payment_id == payment.id


def test_closeout_summary_invoice_only_no_payments(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    assert invoice.amount == Decimal("15000.00")

    summary = compute_reservation_financial_closeout_summary(reservation_draft)
    assert summary.total_invoiced == Decimal("15000.00")
    assert summary.total_settled == Decimal("0.00")
    assert summary.total_refunded == Decimal("0.00")
    assert summary.coherence_status == RESERVATION_FINANCIAL_CLOSEOUT_COHERENT
    assert summary.total_paid >= summary.total_settled


def test_commercial_closeout_invoice_creation(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    start_at = datetime(2026, 6, 1, tzinfo=UTC)
    end_at = start_at + timedelta(days=3)
    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Closeout Invoice"),
        start_at=start_at,
        end_at=end_at,
    )

    with django_capture_on_commit_callbacks(execute=True):
        invoice = issue_billing_invoice_for_commercial_closeout(
            reservation_draft=reservation_draft,
            amount=Decimal("5000.00"),
            notes="Commercial closeout invoice",
        )

    assert invoice.amount == Decimal("5000.00")
    assert invoice.source_kind == BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN
    assert invoice.excess_receivable is None
    assert invoice.document_instance is None
    assert invoice.reservation_draft == reservation_draft

    assert AuditEvent.objects.filter(
        action="billing.invoice_issued",
        target_id=str(invoice.id),
    ).exists()


def test_commercial_closeout_invoice_rejects_excess_receivable(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor, reservation_draft, settlement = _validated_settlement(django_user_model)
    from apps.inventory.models import InventoryDamageLossExcessReceivableStatus

    execution = create_inventory_damage_loss_settlement_execution(
        actor=actor, settlement=settlement
    )
    result = execute_inventory_damage_loss_settlement_execution(execution=execution, actor=actor)
    excess = result.excess_receivable
    excess.status = InventoryDamageLossExcessReceivableStatus.PENDING_INVOICE
    excess.save()

    invoice = BillingInvoice(
        excess_receivable=excess,
        reservation_draft=reservation_draft,
        source_kind=BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT,
        invoice_status=BillingInvoiceStatus.OPEN,
        amount=Decimal("5000.00"),
        issued_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    from django.core.exceptions import ValidationError

    with pytest.raises(ValidationError):
        invoice.full_clean()


def test_execute_commercial_closeout_creates_invoice(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    from apps.customers.models import Customer
    from apps.reservations.models import ReservationDraft

    start_at = datetime(2026, 6, 1, tzinfo=UTC)
    end_at = start_at + timedelta(days=3)
    reservation_draft = ReservationDraft.objects.create(
        customer=Customer.objects.create(display_name="Execute Closeout"),
        start_at=start_at,
        end_at=end_at,
    )

    with django_capture_on_commit_callbacks(execute=True):
        invoice = execute_commercial_closeout(
            reservation_draft=reservation_draft,
            amount=Decimal("7500.00"),
            notes="Orchestrated closeout",
        )

    assert invoice.amount == Decimal("7500.00")
    assert invoice.source_kind == BillingInvoiceSourceKind.COMMERCIAL_CLOSEOUT
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN

    summary = compute_reservation_financial_closeout_summary(reservation_draft)
    assert summary.total_invoiced == Decimal("7500.00")
    assert summary.coherence_status == RESERVATION_FINANCIAL_CLOSEOUT_COHERENT


def _validated_settlement(
    django_user_model,
    *,
    caution_amount: Decimal = Decimal("10000.00"),
    unit_amount: Decimal = Decimal("25000.00"),
):
    from tests.backend.test_inventory_damage_loss_settlement_execution_services import (
        _validated_settlement as vs,
    )

    return vs(
        django_user_model,
        caution_amount=caution_amount,
        unit_amount=unit_amount,
    )
