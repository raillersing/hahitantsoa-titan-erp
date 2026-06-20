from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from tests.backend.test_payments_refund import _pending_refund_obligation

from apps.customers.models import Customer
from apps.documents.models import DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.payments.models import PaymentStatus
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

PAYMENT_LIST_URL = "/api/v1/payments/"
PAYMENT_REFUND_CREATE_URL = "/api/v1/payments/refund/"


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


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="payment-api-sensitive-user",
        password="test-pass",
        is_staff=True,
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


def _hahitantsoa_event_draft(*, user) -> HahitantsoaEventDraft:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=4)
    customer = Customer.objects.create(display_name="Payments Hahitantsoa Customer")
    return HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Payments linked event",
        start_at=start_at,
        end_at=end_at,
        created_by=user,
        updated_by=user,
    )


def test_payment_list_requires_authentication(client) -> None:
    response = client.get(PAYMENT_LIST_URL)

    assert response.status_code in {401, 403}


def test_sensitive_user_can_create_confirm_and_authenticated_user_can_list_payment(
    sensitive_client,
    authenticated_client,
) -> None:
    create_response = sensitive_client.post(
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

    confirm_response = sensitive_client.post(
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


def test_payment_create_requires_authentication(client) -> None:
    response = client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "date_reservation",
            "payment_method": "mobile_money",
            "payment_status": "pending",
            "amount": "250000.00",
            "source_label": "Anon attempt",
        },
        content_type="application/json",
    )

    assert response.status_code in {401, 403}


def test_payment_create_requires_sensitive_access(authenticated_client) -> None:
    response = authenticated_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "date_reservation",
            "payment_method": "mobile_money",
            "payment_status": "pending",
            "amount": "250000.00",
            "source_label": "Non-sensitive attempt",
        },
        content_type="application/json",
    )

    assert response.status_code == 403


def test_payment_confirm_requires_sensitive_access(
    sensitive_client,
    authenticated_client,
) -> None:
    create_response = sensitive_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "date_reservation",
            "payment_method": "mobile_money",
            "payment_status": "pending",
            "amount": "250000.00",
            "source_label": "Confirm split payment",
        },
        content_type="application/json",
    )
    payment_id = create_response.json()["id"]

    response = authenticated_client.post(
        f"{PAYMENT_LIST_URL}{payment_id}/confirm/",
        data={"external_reference": "NON-SENSITIVE-CONFIRM"},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_payment_create_rejects_confirmed_status(sensitive_client) -> None:
    response = sensitive_client.post(
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


def test_payment_confirm_returns_404_for_unknown_payment(sensitive_client) -> None:
    response = sensitive_client.post(
        "/api/v1/payments/00000000-0000-0000-0000-000000000000/confirm/",
        data={},
        content_type="application/json",
    )

    assert response.status_code == 404


def test_sensitive_user_can_create_and_filter_hahitantsoa_event_draft_payment(
    sensitive_client,
    sensitive_user,
    authenticated_client,
) -> None:
    event_draft = _hahitantsoa_event_draft(user=sensitive_user)

    create_response = sensitive_client.post(
        PAYMENT_LIST_URL,
        data={
            "hahitantsoa_event_draft": str(event_draft.id),
            "payment_kind": "deposit",
            "payment_method": "cash",
            "payment_status": "pending",
            "amount": "300000.00",
            "notes": "Event deposit",
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["reservation_draft"] is None
    assert payload["hahitantsoa_event_draft"] == str(event_draft.id)

    list_response = authenticated_client.get(
        f"{PAYMENT_LIST_URL}?hahitantsoa_event_draft_id={event_draft.id}"
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["id"] == payload["id"]


def test_payment_create_rejects_both_reservation_and_hahitantsoa_draft_links(
    sensitive_client,
    sensitive_user,
) -> None:
    event_draft = _hahitantsoa_event_draft(user=sensitive_user)
    reservation_draft = ReservationDraft.objects.create(
        customer=event_draft.customer,
        start_at=event_draft.start_at,
        end_at=event_draft.end_at,
    )

    response = sensitive_client.post(
        PAYMENT_LIST_URL,
        data={
            "reservation_draft": str(reservation_draft.id),
            "hahitantsoa_event_draft": str(event_draft.id),
            "payment_kind": "deposit",
            "payment_method": "cash",
            "payment_status": "pending",
            "amount": "300000.00",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "hahitantsoa_event_draft" in response.json()


def test_sensitive_user_can_create_and_confirm_refund_payment(
    sensitive_client,
    django_user_model,
) -> None:
    _, obligation, _ = _pending_refund_obligation(django_user_model)

    create_response = sensitive_client.post(
        PAYMENT_REFUND_CREATE_URL,
        data={
            "refund_obligation_id": str(obligation.id),
            "notes": "Customer caution refund",
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    create_payload = create_response.json()
    assert create_payload["payment_kind"] == "refund"
    assert create_payload["payment_status"] == PaymentStatus.PENDING
    assert Decimal(create_payload["amount"]) == obligation.amount
    assert create_payload["refund_obligation"] == str(obligation.id)
    assert create_payload["receipt_document"] is None

    confirm_response = sensitive_client.post(
        f"{PAYMENT_LIST_URL}{create_payload['id']}/refund-confirm/",
        data={"notes": "Refund issued"},
        content_type="application/json",
    )

    assert confirm_response.status_code == 200
    confirm_payload = confirm_response.json()
    assert confirm_payload["payment_kind"] == "refund"
    assert confirm_payload["payment_status"] == PaymentStatus.CONFIRMED
    assert Decimal(confirm_payload["amount"]) == obligation.amount
    assert confirm_payload["receipt_document"]["template_key"] == "shared.payment_refund_receipt.v1"
    assert confirm_payload["receipt_document"]["status"] == DocumentInstanceStatus.GENERATED


def test_refund_payment_create_rejects_unknown_obligation(sensitive_client) -> None:
    response = sensitive_client.post(
        PAYMENT_REFUND_CREATE_URL,
        data={"refund_obligation_id": "00000000-0000-0000-0000-000000000000"},
        content_type="application/json",
    )

    assert response.status_code == 400
    assert "refund_obligation_id" in response.json()


def test_refund_payment_confirm_returns_404_for_unknown_payment(sensitive_client) -> None:
    response = sensitive_client.post(
        "/api/v1/payments/00000000-0000-0000-0000-000000000000/refund-confirm/",
        data={},
        content_type="application/json",
    )

    assert response.status_code == 404
