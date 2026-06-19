from decimal import Decimal

import pytest

from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus

pytestmark = pytest.mark.django_db

PAYMENT_LIST_URL = "/api/v1/payments/"


@pytest.fixture
def authenticated_user(django_user_model):
    return django_user_model.objects.create_user(
        username="payment-negative-user",
        password="test-pass",
    )


@pytest.fixture
def authenticated_client(client, authenticated_user):
    client.force_login(authenticated_user)
    return client


def _generated_receipt_document():
    return DocumentInstance.objects.create(
        template_key="shared.payment_receipt.v1",
        template_version="v1",
        template_label="Recu de paiement",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/test.pdf",
        template_path="backend/apps/documents/templates_documents/shared/recu_paiement/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/shared/recu_paiement/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes="",
        reservation_public_reference="",
        reservation_status="",
        customer_display_name="Customer",
        customer_email="",
        customer_phone="",
        customer_address="",
        status=DocumentInstanceStatus.GENERATED,
        content_checksum="a" * 64,
        storage_path="documents/test/receipt.html",
        generated_content_size_bytes=128,
    )


@pytest.fixture
def pending_payment(authenticated_user):
    return Payment.objects.create(
        payment_kind=PaymentKind.DATE_RESERVATION,
        payment_method=PaymentMethod.MOBILE_MONEY,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("250000.00"),
        source_label="Date reservation payment",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )


@pytest.fixture
def cancelled_payment(authenticated_user):
    return Payment.objects.create(
        payment_kind=PaymentKind.OTHER,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.CANCELLED,
        amount=Decimal("10000.00"),
        source_label="Cancelled payment",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )


# Negative permission tests


def test_payment_retrieve_requires_authentication(client, pending_payment):
    response = client.get(f"{PAYMENT_LIST_URL}{pending_payment.id}/")
    assert response.status_code in {401, 403}


def test_payment_confirm_requires_authentication(client):
    response = client.post(
        "/api/v1/payments/00000000-0000-0000-0000-000000000000/confirm/",
        data={},
        content_type="application/json",
    )
    assert response.status_code in {401, 403}


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_payment_list_rejects_write_methods(authenticated_client, method):
    request_method = getattr(authenticated_client, method)
    response = request_method(
        PAYMENT_LIST_URL,
        data={"amount": "100.00"},
        content_type="application/json",
    )
    assert response.status_code == 405


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_payment_retrieve_rejects_write_methods(authenticated_client, pending_payment, method):
    request_method = getattr(authenticated_client, method)
    response = request_method(
        f"{PAYMENT_LIST_URL}{pending_payment.id}/",
        data={"amount": "100.00"},
        content_type="application/json",
    )
    assert response.status_code == 405


@pytest.mark.parametrize("method", ["get", "put", "patch", "delete"])
def test_payment_confirm_rejects_non_post_methods(authenticated_client, pending_payment, method):
    request_method = getattr(authenticated_client, method)
    response = request_method(
        f"{PAYMENT_LIST_URL}{pending_payment.id}/confirm/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 405


# Failure-mode tests


def test_payment_create_rejects_zero_amount(authenticated_client):
    response = authenticated_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "deposit",
            "payment_method": "bank_transfer",
            "payment_status": "pending",
            "amount": "0.00",
            "source_label": "Zero amount",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_payment_create_rejects_negative_amount(authenticated_client):
    response = authenticated_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "deposit",
            "payment_method": "bank_transfer",
            "payment_status": "pending",
            "amount": "-100.00",
            "source_label": "Negative amount",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_payment_create_rejects_invalid_payment_kind(authenticated_client):
    response = authenticated_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "invalid_kind",
            "payment_method": "bank_transfer",
            "payment_status": "pending",
            "amount": "100.00",
            "source_label": "Invalid kind",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_payment_create_rejects_invalid_payment_method(authenticated_client):
    response = authenticated_client.post(
        PAYMENT_LIST_URL,
        data={
            "payment_kind": "deposit",
            "payment_method": "invalid_method",
            "payment_status": "pending",
            "amount": "100.00",
            "source_label": "Invalid method",
        },
        content_type="application/json",
    )
    assert response.status_code == 400


def test_payment_confirm_fails_from_cancelled(authenticated_client, cancelled_payment):
    response = authenticated_client.post(
        f"{PAYMENT_LIST_URL}{cancelled_payment.id}/confirm/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 400
    payload = response.json()
    assert payload["code"] == "invalid_payment_confirmation_state"
