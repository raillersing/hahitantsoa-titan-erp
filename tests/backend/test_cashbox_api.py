from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from tests.backend.test_billing_refund_obligation import _partially_paid_invoice

from apps.billing.services import create_billing_invoice_refund_obligation
from apps.cashbox.models import CashboxMovement
from apps.payments.models import PaymentKind, PaymentMethod, PaymentStatus
from apps.payments.services import create_payment

pytestmark = pytest.mark.django_db

CASHBOX_SESSION_LIST_URL = "/api/v1/cashbox/sessions/"
CASHBOX_MOVEMENT_LIST_URL = "/api/v1/cashbox/movements/"


@pytest.fixture
def sensitive_user():
    return get_user_model().objects.create_user(
        username="cashbox-sensitive-user",
        password="test-pass",
        is_staff=True,
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    client = Client()
    client.force_login(sensitive_user)
    return client


@pytest.fixture
def authenticated_client(client):
    user = get_user_model().objects.create_user(
        username="cashbox-read-user",
        password="test-pass",
    )
    client.force_login(user)
    return client


def test_cashbox_session_open_requires_sensitive_access(authenticated_client, sensitive_user):
    response = authenticated_client.post(
        f"{CASHBOX_SESSION_LIST_URL}open/",
        data={"operator": str(sensitive_user.id)},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_sensitive_user_can_open_retrieve_close_session_and_record_movement(
    sensitive_client, sensitive_user
):
    open_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}open/",
        data={"operator": str(sensitive_user.id), "opening_note": "Open till"},
        content_type="application/json",
    )
    assert open_response.status_code == 201
    session_id = open_response.json()["id"]

    movement_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/movements/",
        data={"direction": "cash_in", "amount": "100.00", "note": "Cash received"},
        content_type="application/json",
    )
    assert movement_response.status_code == 201
    assert movement_response.json()["direction"] == "cash_in"

    detail_response = sensitive_client.get(f"{CASHBOX_SESSION_LIST_URL}{session_id}/")
    assert detail_response.status_code == 200
    assert Decimal(str(detail_response.json()["net_amount"])) == Decimal("100.00")

    close_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/close/",
        data={"closing_note": "Close till"},
        content_type="application/json",
    )
    assert close_response.status_code == 200
    assert close_response.json()["closed_at"] is not None


def test_cashbox_read_endpoints_require_authentication(client):
    assert client.get(CASHBOX_SESSION_LIST_URL).status_code in {401, 403}
    assert client.get(CASHBOX_MOVEMENT_LIST_URL).status_code in {401, 403}


def test_cashbox_read_endpoints_require_sensitive_access(authenticated_client):
    assert authenticated_client.get(CASHBOX_SESSION_LIST_URL).status_code == 403
    assert authenticated_client.get(CASHBOX_MOVEMENT_LIST_URL).status_code == 403


def test_cashbox_list_filters_by_operator_and_status(sensitive_client, sensitive_user):
    open_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}open/",
        data={"operator": str(sensitive_user.id)},
        content_type="application/json",
    )
    session_id = open_response.json()["id"]
    open_list = sensitive_client.get(
        f"{CASHBOX_SESSION_LIST_URL}?operator_id={sensitive_user.id}&status=open"
    )
    assert open_list.status_code == 200
    assert [item["id"] for item in open_list.json()] == [session_id]

    sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/close/",
        data={},
        content_type="application/json",
    )
    closed_list = sensitive_client.get(
        f"{CASHBOX_SESSION_LIST_URL}?operator_id={sensitive_user.id}&status=closed"
    )
    assert closed_list.status_code == 200
    assert [item["id"] for item in closed_list.json()] == [session_id]


def test_cashbox_movement_can_link_payment_invoice_or_refund_obligation(sensitive_client):
    actor, reservation_draft, invoice, _ = _partially_paid_invoice(get_user_model())
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("50.00"),
        source_label="Cashbox API reference",
    )
    obligation = create_billing_invoice_refund_obligation(
        invoice=invoice,
        actor=actor,
        notes="Cashbox API refund linkage",
    )
    open_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}open/",
        data={"operator": str(actor.id)},
        content_type="application/json",
    )
    session_id = open_response.json()["id"]

    payment_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/movements/",
        data={"direction": "cash_in", "amount": "50.00", "payment": str(payment.id)},
        content_type="application/json",
    )
    invoice_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/movements/",
        data={
            "direction": "cash_in",
            "amount": str(invoice.amount),
            "billing_invoice": str(invoice.id),
        },
        content_type="application/json",
    )
    refund_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/movements/",
        data={
            "direction": "cash_out",
            "amount": str(obligation.refund_amount),
            "billing_refund_obligation": str(obligation.id),
        },
        content_type="application/json",
    )

    assert payment_response.status_code == 201
    assert invoice_response.status_code == 201
    assert refund_response.status_code == 201
    assert CashboxMovement.objects.filter(session_id=session_id).count() == 3


def test_cashbox_movement_rejects_multiple_financial_references(
    sensitive_client,
    sensitive_user,
):
    open_response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}open/",
        data={"operator": str(sensitive_user.id)},
        content_type="application/json",
    )
    session_id = open_response.json()["id"]

    actor, reservation_draft, invoice, _ = _partially_paid_invoice(get_user_model())
    payment = create_payment(
        actor=actor,
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("50.00"),
        source_label="Cashbox duplicate reference",
    )

    response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/movements/",
        data={
            "direction": "cash_in",
            "amount": "50.00",
            "payment": str(payment.id),
            "billing_invoice": str(invoice.id),
        },
        content_type="application/json",
    )

    assert response.status_code == 400
