from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from tests.backend.test_billing_installments import _confirmed_payment, _issued_invoice

from apps.audit.models import AuditEvent
from apps.billing.models import (
    BillingInstallmentAllocation,
    BillingInvoiceStatus,
    BillingRefundObligation,
    BillingRefundObligationStatus,
)
from apps.billing.services import (
    BILLING_INVOICE_CORRECTION_NOT_APPLICABLE,
    INVALID_BILLING_INVOICE_STATUS,
    BillingInstallmentItem,
    allocate_payment_to_installment,
    cancel_billing_invoice,
    create_billing_invoice_installments,
    create_billing_invoice_refund_obligation,
    settle_billing_invoice,
)
from apps.payments.models import Payment

pytestmark = pytest.mark.django_db

BILLING_INVOICE_LIST_URL = "/api/v1/billing/invoices/"


def _item(amount, *, due_at):
    return BillingInstallmentItem(amount=Decimal(amount), due_at=due_at)


def _future(days=10):
    return timezone.now() + timedelta(days=days)


def _partially_paid_invoice(
    django_user_model, *, first=Decimal("4000.00"), second=Decimal("3000.00")
):
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("10000.00", due_at=_future(30)), _item("5000.00", due_at=_future(10))],
        actor=actor,
    )
    if first:
        allocate_payment_to_installment(
            installment=installments[0],
            payment=_confirmed_payment(actor, reservation_draft, first),
            actor=actor,
        )
    if second:
        allocate_payment_to_installment(
            installment=installments[1],
            payment=_confirmed_payment(actor, reservation_draft, second),
            actor=actor,
        )
    return actor, reservation_draft, invoice, installments


# service-level correction


def test_create_refund_obligation_cancels_invoice_and_records_total_allocated(
    django_user_model, django_capture_on_commit_callbacks
) -> None:
    actor, _, invoice, installments = _partially_paid_invoice(
        django_user_model, first=Decimal("4000.00"), second=Decimal("3000.00")
    )

    with django_capture_on_commit_callbacks(execute=True):
        obligation = create_billing_invoice_refund_obligation(
            invoice=invoice, actor=actor, notes="Customer cancellation"
        )

    invoice.refresh_from_db()
    assert obligation.refund_amount == Decimal("7000.00")
    assert obligation.status == BillingRefundObligationStatus.PENDING
    assert obligation.invoice_id == invoice.id
    assert invoice.invoice_status == BillingInvoiceStatus.CANCELLED
    assert AuditEvent.objects.filter(
        action="billing.invoice_refund_obligation_created",
        target_id=str(obligation.id),
    ).exists()
    assert AuditEvent.objects.filter(
        action="billing.invoice_cancelled",
        target_id=str(invoice.id),
    ).exists()


def test_create_refund_obligation_keeps_allocations_and_payments_immutable(
    django_user_model,
) -> None:
    actor, _, invoice, installments = _partially_paid_invoice(
        django_user_model, first=Decimal("4000.00"), second=Decimal("3000.00")
    )
    allocations_before = BillingInstallmentAllocation.objects.filter(
        installment__invoice=invoice
    ).count()
    payments_before = Payment.objects.count()

    create_billing_invoice_refund_obligation(invoice=invoice, actor=actor)

    assert BillingInstallmentAllocation.objects.filter(installment__invoice=invoice).count() == (
        allocations_before
    )
    assert Payment.objects.count() == payments_before
    installments[0].refresh_from_db()
    installments[1].refresh_from_db()
    assert installments[0].paid_amount == Decimal("4000.00")
    assert installments[1].paid_amount == Decimal("3000.00")
    assert not Payment.objects.filter(amount__lte=Decimal("0.00")).exists()


def test_create_refund_obligation_rejects_invoice_without_allocations(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_refund_obligation(invoice=invoice, actor=actor)
    assert error_info.value.code == BILLING_INVOICE_CORRECTION_NOT_APPLICABLE
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN
    assert not BillingRefundObligation.objects.filter(invoice=invoice).exists()


def test_create_refund_obligation_rejects_invoice_without_installments(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_refund_obligation(invoice=invoice, actor=actor)
    assert error_info.value.code == BILLING_INVOICE_CORRECTION_NOT_APPLICABLE


def test_create_refund_obligation_rejects_settled_invoice(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    payment = _confirmed_payment(actor, reservation_draft, Decimal("15000.00"))
    settle_billing_invoice(invoice=invoice, payment=payment, actor=actor)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_refund_obligation(invoice=invoice, actor=actor)
    assert error_info.value.code == INVALID_BILLING_INVOICE_STATUS
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED


def test_create_refund_obligation_rejects_cancelled_invoice(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    cancel_billing_invoice(invoice=invoice, actor=actor)
    with pytest.raises(Exception) as error_info:
        create_billing_invoice_refund_obligation(invoice=invoice, actor=actor)
    assert error_info.value.code == INVALID_BILLING_INVOICE_STATUS


def test_refund_amount_equals_single_partial_payment(django_user_model) -> None:
    actor, _, invoice, _ = _partially_paid_invoice(
        django_user_model, first=Decimal("5000.00"), second=Decimal("0.00")
    )
    obligation = create_billing_invoice_refund_obligation(invoice=invoice, actor=actor)
    assert obligation.refund_amount == Decimal("5000.00")
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.CANCELLED


# API


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(username="refund-api-user", password="test-pass")
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="refund-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


def test_correct_api_requires_sensitive_access(authenticated_client, django_user_model):
    actor, _, invoice, _ = _partially_paid_invoice(
        django_user_model, first=Decimal("4000.00"), second=Decimal("0.00")
    )
    response = authenticated_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/correct/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_sensitive_user_can_correct_partially_paid_invoice(
    sensitive_client, authenticated_client, django_user_model
):
    actor, _, invoice, _ = _partially_paid_invoice(
        django_user_model, first=Decimal("4000.00"), second=Decimal("3000.00")
    )
    response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/correct/",
        data={"notes": "Correction"},
        content_type="application/json",
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["refund_amount"] == "7000.00"
    assert payload["status"] == "pending"

    detail = authenticated_client.get(f"{BILLING_INVOICE_LIST_URL}{invoice.id}/")
    assert detail.status_code == 200
    invoice_payload = detail.json()
    assert invoice_payload["invoice_status"] == "cancelled"
    assert invoice_payload["refund_obligation"]["refund_amount"] == "7000.00"


def test_correct_api_rejects_unpaid_schedule(sensitive_client, django_user_model):
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/correct/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "billing_invoice_correction_not_applicable"
