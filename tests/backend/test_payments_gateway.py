from __future__ import annotations

from decimal import Decimal

import pytest
from django.utils import timezone

from apps.payments.gateway import (
    MockPaymentGatewayAdapter,
    MVolaGatewayAdapter,
    PaymentGatewayError,
    get_payment_gateway_adapter,
)
from apps.payments.models import Payment, PaymentMethod, PaymentStatus
from apps.payments.services import (
    initiate_mobile_money_payment,
    process_gateway_callback,
)


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="gateway-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


class TestMockPaymentGatewayAdapter:
    def test_initiate_payment_returns_reference(self) -> None:
        adapter = MockPaymentGatewayAdapter()
        result = adapter.initiate_payment(
            amount=Decimal("1000.00"), currency="MGA", description="Test"
        )
        assert isinstance(result.transaction_reference, str)
        assert result.status == "pending"
        assert result.raw_response["mock"] is True

    def test_check_status_returns_confirmed(self) -> None:
        adapter = MockPaymentGatewayAdapter()
        result = adapter.check_status("MOCK-123")
        assert result.status == "confirmed"

    def test_validate_callback_with_valid_payload(self) -> None:
        adapter = MockPaymentGatewayAdapter()
        result = adapter.validate_callback(
            {"transaction_reference": "MOCK-123", "amount": "1000.00", "status": "confirmed"}
        )
        assert result.valid is True
        assert result.transaction_reference == "MOCK-123"
        assert result.amount == Decimal("1000.00")
        assert result.status == "confirmed"

    def test_validate_callback_with_missing_reference(self) -> None:
        adapter = MockPaymentGatewayAdapter()
        result = adapter.validate_callback({})
        assert result.valid is False


class TestMVolaGatewayAdapter:
    def test_initiate_payment_returns_mvola_reference(self) -> None:
        adapter = MVolaGatewayAdapter()
        result = adapter.initiate_payment(
            amount=Decimal("500.00"), currency="MGA", description="MVola test"
        )
        assert result.transaction_reference.startswith("MVOLA-SANDBOX-")
        assert result.status == "pending"
        assert result.raw_response["gateway"] == "mvola_sandbox"

    def test_gateway_name(self) -> None:
        adapter = MVolaGatewayAdapter()
        assert adapter.gateway_name == "mvola_sandbox"


class TestGetPaymentGatewayAdapter:
    def test_default_returns_mock(self) -> None:
        adapter = get_payment_gateway_adapter()
        assert isinstance(adapter, MockPaymentGatewayAdapter)

    def test_explicit_mvola_returns_mvola(self) -> None:
        adapter = get_payment_gateway_adapter(gateway_name="mvola")
        assert isinstance(adapter, MVolaGatewayAdapter)


class TestInitiateMobileMoneyPaymentService:
    @pytest.mark.django_db
    def test_creates_pending_payment(self, django_user_model) -> None:
        from apps.customers.models import Customer
        from apps.reservations.models import ReservationDraft

        customer = Customer.objects.create(display_name="Gateway Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-GW-001",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )

        result = initiate_mobile_money_payment(
            reservation_draft=draft,
            amount=Decimal("2500.00"),
        )

        assert result.payment.payment_method == PaymentMethod.MOBILE_MONEY
        assert result.payment.payment_status == PaymentStatus.PENDING
        assert result.payment.external_reference != ""
        assert result.gateway_result.transaction_reference == result.payment.external_reference

    @pytest.mark.django_db
    def test_fails_with_invalid_amount(self) -> None:
        with pytest.raises(Exception):
            initiate_mobile_money_payment(
                reservation_draft=None,
                amount=Decimal("-10.00"),
            )


class TestProcessGatewayCallbackService:
    @pytest.mark.django_db
    def test_confirms_pending_payment(self, django_user_model) -> None:
        from apps.customers.models import Customer
        from apps.reservations.models import ReservationDraft

        customer = Customer.objects.create(display_name="Callback Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CB-001",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        payment = Payment.objects.create(
            reservation_draft=draft,
            payment_kind="balance",
            payment_method=PaymentMethod.MOBILE_MONEY,
            payment_status=PaymentStatus.PENDING,
            amount=Decimal("1000.00"),
            external_reference="MOCK-CALLBACK-001",
        )

        user = django_user_model.objects.create_user(
            username="callback-actor", password="p", is_staff=True
        )
        result = process_gateway_callback(
            payload={
                "transaction_reference": "MOCK-CALLBACK-001",
                "status": "confirmed",
                "amount": "1000.00",
            },
            actor=user,
        )

        payment.refresh_from_db()
        assert payment.payment_status == PaymentStatus.CONFIRMED
        assert result.callback_result.valid is True

    @pytest.mark.django_db
    def test_fails_for_missing_payment(self) -> None:
        with pytest.raises(PaymentGatewayError) as exc_info:
            process_gateway_callback(
                payload={"transaction_reference": "UNKNOWN", "status": "confirmed"}
            )
        assert exc_info.value.code == "gateway_callback_payment_not_found"


class TestGatewayPaymentInitiateAPI:
    @pytest.mark.django_db
    def test_initiate_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="gw_auth", password="p", is_staff=True)
        response = client.post(
            "/api/v1/payments/gateway/initiate/11111111-1111-1111-1111-111111111111/",
            {"amount": "100.00"},
            content_type="application/json",
        )
        assert response.status_code in {401, 403}

    @pytest.mark.django_db
    def test_initiate_success(self, sensitive_client, django_user_model) -> None:
        from apps.customers.models import Customer
        from apps.reservations.models import ReservationDraft

        django_user_model.objects.create_user(username="gw_init", password="p", is_staff=True)
        customer = Customer.objects.create(display_name="GW Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-GW-API",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )

        response = sensitive_client.post(
            f"/api/v1/payments/gateway/initiate/{draft.id}/",
            {"amount": "1500.00", "currency": "MGA", "notes": "test"},
            content_type="application/json",
        )
        assert response.status_code == 201
        data = response.json()
        assert "transaction_reference" in data
        assert data["status"] == "pending"


class TestGatewayPaymentCallbackAPI:
    @pytest.mark.django_db
    def test_callback_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="gw_cb_auth", password="p", is_staff=True)
        response = client.post(
            "/api/v1/payments/gateway/callback/",
            {"transaction_reference": "REF", "status": "confirmed"},
            content_type="application/json",
        )
        assert response.status_code in {401, 403}

    @pytest.mark.django_db
    def test_callback_success(self, sensitive_client, django_user_model) -> None:
        from apps.customers.models import Customer
        from apps.reservations.models import ReservationDraft

        django_user_model.objects.create_user(username="gw_cb", password="p", is_staff=True)
        customer = Customer.objects.create(display_name="CB Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CB-API",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        Payment.objects.create(
            reservation_draft=draft,
            payment_kind="balance",
            payment_method=PaymentMethod.MOBILE_MONEY,
            payment_status=PaymentStatus.PENDING,
            amount=Decimal("500.00"),
            external_reference="CB-REF-001",
        )

        # Callback endpoint is authenticated; the user is the actor
        response = sensitive_client.post(
            "/api/v1/payments/gateway/callback/",
            {"transaction_reference": "CB-REF-001", "status": "confirmed", "amount": "500.00"},
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "confirmed"
