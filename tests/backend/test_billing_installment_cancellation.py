from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from tests.backend.test_billing_installments import _confirmed_payment, _issued_invoice

from apps.billing.models import BillingInvoiceStatus
from apps.billing.services import (
    BILLING_INVOICE_HAS_INSTALLMENT_PAYMENTS,
    INVALID_BILLING_INVOICE_CANCEL_STATE,
    BillingInstallmentItem,
    allocate_payment_to_installment,
    cancel_billing_invoice,
    create_billing_invoice_installments,
)

pytestmark = pytest.mark.django_db

BILLING_INVOICE_LIST_URL = "/api/v1/billing/invoices/"


def _item(amount, *, due_at):
    return BillingInstallmentItem(amount=Decimal(amount), due_at=due_at)


def _future(days=10):
    return timezone.now() + timedelta(days=days)


# service-level cancellation guards


def test_cancel_open_invoice_with_unpaid_schedule_succeeds(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    cancelled = cancel_billing_invoice(invoice=invoice, actor=actor, notes="Void schedule")
    assert cancelled.invoice_status == BillingInvoiceStatus.CANCELLED
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.CANCELLED


def test_cancel_rejects_invoice_with_installment_allocation(django_user_model) -> None:
    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("10000.00", due_at=_future(30)), _item("5000.00", due_at=_future(10))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("4000.00")),
        actor=actor,
    )

    with pytest.raises(Exception) as error_info:
        cancel_billing_invoice(invoice=invoice, actor=actor)
    assert error_info.value.code == BILLING_INVOICE_HAS_INSTALLMENT_PAYMENTS
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.OPEN


def test_cancel_rejects_auto_settled_installment_invoice(django_user_model) -> None:
    from apps.billing.services import allocate_payment_to_installment

    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("15000.00")),
        actor=actor,
    )
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED

    with pytest.raises(Exception) as error_info:
        cancel_billing_invoice(invoice=invoice, actor=actor)
    assert error_info.value.code == INVALID_BILLING_INVOICE_CANCEL_STATE
    invoice.refresh_from_db()
    assert invoice.invoice_status == BillingInvoiceStatus.SETTLED


def test_cancel_rejects_already_cancelled_installment_invoice(django_user_model) -> None:
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    cancel_billing_invoice(invoice=invoice, actor=actor)
    with pytest.raises(Exception) as error_info:
        cancel_billing_invoice(invoice=invoice, actor=actor)
    assert error_info.value.code == INVALID_BILLING_INVOICE_CANCEL_STATE


# API cancellation guards


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(username="cancel-api-user", password="test-pass")
    client.force_login(user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="cancel-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


def test_cancel_api_open_invoice_with_unpaid_schedule_succeeds(sensitive_client, django_user_model):
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/cancel/",
        data={"notes": "Void schedule"},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["invoice_status"] == "cancelled"


def test_cancel_api_rejects_invoice_with_installment_allocation(
    sensitive_client, django_user_model
):
    from apps.billing.services import allocate_payment_to_installment

    actor, reservation_draft, invoice = _issued_invoice(django_user_model)
    installments = create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("10000.00", due_at=_future(30)), _item("5000.00", due_at=_future(10))],
        actor=actor,
    )
    allocate_payment_to_installment(
        installment=installments[0],
        payment=_confirmed_payment(actor, reservation_draft, Decimal("4000.00")),
        actor=actor,
    )
    response = sensitive_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/cancel/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "billing_invoice_has_installment_payments"


def test_cancel_api_requires_sensitive_access(authenticated_client, django_user_model):
    actor, _, invoice = _issued_invoice(django_user_model)
    create_billing_invoice_installments(
        invoice=invoice,
        installments=[_item("15000.00", due_at=_future(30))],
        actor=actor,
    )
    response = authenticated_client.post(
        f"{BILLING_INVOICE_LIST_URL}{invoice.id}/cancel/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 403
