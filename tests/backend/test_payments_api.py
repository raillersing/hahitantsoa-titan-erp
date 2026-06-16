from decimal import Decimal

import pytest

from apps.documents.models import DocumentInstanceStatus
from apps.payments.models import PaymentStatus

pytestmark = pytest.mark.django_db

PAYMENT_LIST_URL = "/api/v1/payments/"


@pytest.fixture
def authenticated_user(django_user_model):
    return django_user_model.objects.create_user(
        username="payment-api-user",
        password="test-pass",
    )


@pytest.fixture
def authenticated_client(client, authenticated_user):
    client.force_login(authenticated_user)
    return client


def test_payment_list_requires_authentication(client) -> None:
    response = client.get(PAYMENT_LIST_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_create_list_and_confirm_payment(authenticated_client) -> None:
    create_response = authenticated_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "date_reservation",
            "payment_method": "mobile_money",
            "payment_status": "pending",
            "amount": "250000.00",
            "source_label": "Date reservation payment",
            "external_reference": "MVOLA-001",
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    create_payload = create_response.json()
    assert create_payload["payment_status"] == PaymentStatus.PENDING
    assert create_payload["receipt_document"] is None

    list_response = authenticated_client.get(PAYMENT_LIST_URL)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    confirm_response = authenticated_client.post(
        f"{PAYMENT_LIST_URL}{create_payload['id']}/confirm/",
        data={"external_reference": "MVOLA-001-CONFIRMED"},
        content_type="application/json",
    )

    assert confirm_response.status_code == 200
    confirm_payload = confirm_response.json()
    assert confirm_payload["payment_status"] == PaymentStatus.CONFIRMED
    assert Decimal(confirm_payload["amount"]) == Decimal("250000.00")
    assert confirm_payload["receipt_document"]["template_key"] == "shared.payment_receipt.v1"
    assert confirm_payload["receipt_document"]["status"] == DocumentInstanceStatus.GENERATED


def test_payment_create_rejects_confirmed_status(authenticated_client) -> None:
    response = authenticated_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "deposit",
            "payment_method": "bank_transfer",
            "payment_status": "confirmed",
            "amount": "500000.00",
            "source_label": "Client deposit",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "payment_status" in response.json()


def test_payment_confirm_returns_404_for_unknown_payment(authenticated_client) -> None:
    response = authenticated_client.post(
        "/api/v1/payments/00000000-0000-0000-0000-000000000000/confirm/",
        data={},
        content_type="application/json",
    )

    assert response.status_code == 404
