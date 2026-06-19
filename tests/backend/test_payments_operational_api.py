from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

PAYMENT_LIST_URL = "/api/v1/payments/"


@pytest.fixture
def authenticated_user(django_user_model):
    return django_user_model.objects.create_user(
        username="payment-ops-user",
        password="test-pass",
    )


@pytest.fixture
def authenticated_client(client, authenticated_user):
    client.force_login(authenticated_user)
    return client


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="payment-ops-sensitive-user",
        password="test-pass",
        is_staff=True,
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
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
def confirmed_payment(authenticated_user):
    receipt = _generated_receipt_document()
    return Payment.objects.create(
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("500000.00"),
        paid_at=timezone.now(),
        source_label="Client deposit",
        receipt_document=receipt,
        confirmed_at=timezone.now(),
        confirmed_by=authenticated_user,
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )


def test_payment_cancel_requires_authentication(client, pending_payment) -> None:
    response = client.post(
        f"{PAYMENT_LIST_URL}{pending_payment.id}/cancel/",
        data={"notes": "Anon attempt"},
        content_type="application/json",
    )

    assert response.status_code in {401, 403}


def test_payment_cancel_requires_sensitive_access(authenticated_client, pending_payment) -> None:
    response = authenticated_client.post(
        f"{PAYMENT_LIST_URL}{pending_payment.id}/cancel/",
        data={"notes": "Non-sensitive attempt"},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_payment_reconcile_requires_authentication(client, confirmed_payment) -> None:
    response = client.post(
        f"{PAYMENT_LIST_URL}{confirmed_payment.id}/reconcile/",
        data={"notes": "Anon attempt"},
        content_type="application/json",
    )

    assert response.status_code in {401, 403}


def test_payment_reconcile_requires_sensitive_access(
    authenticated_client,
    confirmed_payment,
) -> None:
    response = authenticated_client.post(
        f"{PAYMENT_LIST_URL}{confirmed_payment.id}/reconcile/",
        data={"notes": "Non-sensitive attempt"},
        content_type="application/json",
    )

    assert response.status_code == 403


def test_cancel_payment_from_pending(sensitive_client, pending_payment):
    response = sensitive_client.post(
        PAYMENT_LIST_URL + str(pending_payment.id) + "/cancel/",
        data={"notes": "Cancelled by customer"},
        content_type="application/json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["payment_status"] == PaymentStatus.CANCELLED
    assert payload["notes"] == "Cancelled by customer"


def test_cancel_payment_fails_from_confirmed(sensitive_client, confirmed_payment):
    response = sensitive_client.post(
        PAYMENT_LIST_URL + str(confirmed_payment.id) + "/cancel/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 400
    payload = response.json()
    assert payload["code"] == "invalid_payment_cancel_state"


def test_cancel_payment_returns_404_for_unknown_payment(sensitive_client):
    response = sensitive_client.post(
        "/api/v1/payments/00000000-0000-0000-0000-000000000000/cancel/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 404


def test_reconcile_payment_from_confirmed(sensitive_client, confirmed_payment):
    response = sensitive_client.post(
        PAYMENT_LIST_URL + str(confirmed_payment.id) + "/reconcile/",
        data={"notes": "Reconciled by accountant"},
        content_type="application/json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["payment_status"] == PaymentStatus.RECONCILED
    assert payload["notes"] == "Reconciled by accountant"


def test_reconcile_payment_fails_from_pending(sensitive_client, pending_payment):
    response = sensitive_client.post(
        PAYMENT_LIST_URL + str(pending_payment.id) + "/reconcile/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 400
    payload = response.json()
    assert payload["code"] == "invalid_payment_reconcile_state"


def test_reconcile_payment_returns_404_for_unknown_payment(sensitive_client):
    response = sensitive_client.post(
        "/api/v1/payments/00000000-0000-0000-0000-000000000000/reconcile/",
        data={},
        content_type="application/json",
    )
    assert response.status_code == 404


def test_payment_list_filter_by_status(authenticated_client, authenticated_user):
    Payment.objects.create(
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100000.00"),
        source_label="Pending payment",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )
    Payment.objects.create(
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.CANCELLED,
        amount=Decimal("200000.00"),
        source_label="Cancelled payment",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )

    response = authenticated_client.get(PAYMENT_LIST_URL + "?status=pending")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["payment_status"] == PaymentStatus.PENDING


def test_payment_list_filter_by_kind(authenticated_client, authenticated_user):
    Payment.objects.create(
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100000.00"),
        source_label="Deposit",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )
    Payment.objects.create(
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("200000.00"),
        source_label="Balance",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )

    response = authenticated_client.get(PAYMENT_LIST_URL + "?kind=deposit")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["payment_kind"] == PaymentKind.DEPOSIT


def test_payment_list_filter_by_method(authenticated_client, authenticated_user):
    Payment.objects.create(
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100000.00"),
        source_label="Cash",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )
    Payment.objects.create(
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.BANK_TRANSFER,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("200000.00"),
        source_label="Transfer",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )

    response = authenticated_client.get(PAYMENT_LIST_URL + "?method=bank_transfer")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["payment_method"] == PaymentMethod.BANK_TRANSFER


def test_payment_list_filter_by_reservation_draft_id(authenticated_client, authenticated_user):

    customer = Customer.objects.create(
        display_name="Filter customer",
        email="filter@example.test",
        phone="+261340000555",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=3)
    end_at = start_at + timedelta(hours=6)
    reservation = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Filter reservation",
    )

    Payment.objects.create(
        reservation_draft=reservation,
        payment_kind=PaymentKind.DEPOSIT,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("100000.00"),
        source_label="With reservation",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )
    Payment.objects.create(
        payment_kind=PaymentKind.BALANCE,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("200000.00"),
        source_label="Without reservation",
        created_by=authenticated_user,
        updated_by=authenticated_user,
    )

    response = authenticated_client.get(
        PAYMENT_LIST_URL + "?reservation_draft_id=" + str(reservation.id)
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["reservation_draft"] == str(reservation.id)
