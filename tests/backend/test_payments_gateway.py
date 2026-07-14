from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier, Event
from uuid import UUID

import pytest
from django.db import close_old_connections
from django.test import override_settings
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.documents.models import DocumentInstance
from apps.payments.gateway import (
    MockPaymentGatewayAdapter,
    MVolaGatewayAdapter,
    PaymentGatewayError,
    get_payment_gateway_adapter,
)
from apps.payments.models import Payment, PaymentMethod, PaymentStatus
from apps.payments.services import (
    PaymentLifecycleError,
    cancel_payment,
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


def create_gateway_payment(
    *,
    reference: str,
    amount: Decimal = Decimal("500.00"),
    method: str = PaymentMethod.MOBILE_MONEY,
    source_label: str = "mvola_sandbox",
    payment_status: str = PaymentStatus.PENDING,
) -> Payment:
    return Payment.objects.create(
        payment_kind="balance",
        payment_method=method,
        payment_status=payment_status,
        amount=amount,
        external_reference=reference,
        source_label=source_label,
    )


class TestMockPaymentGatewayAdapter:
    def test_initiate_payment_returns_reference(self) -> None:
        adapter = MockPaymentGatewayAdapter()
        result = adapter.initiate_payment(
            amount=Decimal("1000.00"), currency="MGA", description="Test"
        )
        assert isinstance(result.transaction_reference, str)
        assert result.status == "pending"
        assert result.raw_response["mock"] is True
        UUID(result.transaction_reference.removeprefix("MOCK-"))

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
        UUID(result.transaction_reference.removeprefix("MVOLA-SANDBOX-"))

    def test_gateway_name(self) -> None:
        adapter = MVolaGatewayAdapter()
        assert adapter.gateway_name == "mvola_sandbox"

    @pytest.mark.parametrize(
        "payload",
        [
            {"transaction_reference": "REF", "status": "confirmed"},
            {"transaction_reference": "REF", "status": "unknown", "amount": "1.00"},
            {"transaction_reference": "REF", "status": "confirmed", "amount": "NaN"},
            {"transaction_reference": "REF", "status": "confirmed", "amount": "invalid"},
            {"transaction_reference": "R" * 256, "status": "confirmed", "amount": "1.00"},
        ],
    )
    def test_rejects_invalid_callback_payload(self, payload) -> None:
        assert MVolaGatewayAdapter().validate_callback(payload).valid is False


class TestGetPaymentGatewayAdapter:
    def test_default_returns_mock(self) -> None:
        adapter = get_payment_gateway_adapter()
        assert isinstance(adapter, MockPaymentGatewayAdapter)

    def test_explicit_mvola_returns_mvola(self) -> None:
        adapter = get_payment_gateway_adapter(gateway_name="mvola")
        assert isinstance(adapter, MVolaGatewayAdapter)

    @override_settings(PAYMENT_GATEWAY_NAME="unknown-provider")
    def test_unknown_gateway_fails_closed(self) -> None:
        with pytest.raises(PaymentGatewayError) as exc_info:
            get_payment_gateway_adapter()
        assert exc_info.value.code == "gateway_unknown"


class TestInitiateMobileMoneyPaymentService:
    @pytest.mark.django_db
    @override_settings(DEBUG=True)
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
        assert result.payment.source_label == "mvola_sandbox"
        assert result.gateway_result.transaction_reference == result.payment.external_reference

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_sets_actor_attribution(self, sensitive_user) -> None:
        from apps.customers.models import Customer
        from apps.reservations.models import ReservationDraft

        draft = ReservationDraft.objects.create(
            public_reference="T-GW-ACTOR",
            customer=Customer.objects.create(display_name="Gateway actor customer"),
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        result = initiate_mobile_money_payment(
            reservation_draft=draft,
            amount=Decimal("100.00"),
            actor=sensitive_user,
        )
        assert result.payment.created_by_id == sensitive_user.id
        assert result.payment.updated_by_id == sensitive_user.id

    @pytest.mark.django_db
    @override_settings(DEBUG=False)
    def test_fails_closed_in_production(self) -> None:
        with pytest.raises(PaymentGatewayError) as exc_info:
            initiate_mobile_money_payment(
                reservation_draft=None,
                amount=Decimal("100.00"),
            )
        assert exc_info.value.code == "gateway_sandbox_disabled"

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_fails_with_invalid_amount(self) -> None:
        with pytest.raises(Exception):
            initiate_mobile_money_payment(
                reservation_draft=None,
                amount=Decimal("-10.00"),
            )


class TestProcessGatewayCallbackService:
    @pytest.mark.django_db
    @override_settings(DEBUG=True)
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
            source_label="mvola_sandbox",
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
    @override_settings(DEBUG=True)
    def test_fails_for_missing_payment(self) -> None:
        with pytest.raises(PaymentGatewayError) as exc_info:
            process_gateway_callback(
                payload={
                    "transaction_reference": "UNKNOWN",
                    "status": "confirmed",
                    "amount": "1.00",
                }
            )
        assert exc_info.value.code == "gateway_callback_payment_not_found"

    @pytest.mark.django_db
    @override_settings(DEBUG=False)
    def test_fails_closed_in_production(self) -> None:
        with pytest.raises(PaymentGatewayError) as exc_info:
            process_gateway_callback(
                payload={
                    "transaction_reference": "PROD-REF",
                    "status": "confirmed",
                    "amount": "1.00",
                }
            )
        assert exc_info.value.code == "gateway_sandbox_disabled"

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    @pytest.mark.parametrize(
        ("payment_kwargs", "expected_code"),
        [
            ({"amount": Decimal("499.00")}, "gateway_callback_amount_mismatch"),
            ({"method": PaymentMethod.CASH}, "gateway_callback_method_mismatch"),
            ({"source_label": "mock"}, "gateway_callback_source_mismatch"),
        ],
    )
    def test_rejects_payment_identity_mismatch(self, payment_kwargs, expected_code) -> None:
        create_gateway_payment(reference="IDENTITY-MISMATCH", **payment_kwargs)
        with pytest.raises(PaymentGatewayError) as exc_info:
            process_gateway_callback(
                payload={
                    "transaction_reference": "IDENTITY-MISMATCH",
                    "status": "confirmed",
                    "amount": "500.00",
                }
            )
        assert exc_info.value.code == expected_code

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_rejects_ambiguous_reference(self) -> None:
        create_gateway_payment(reference="DUPLICATE-REF")
        create_gateway_payment(reference="DUPLICATE-REF")
        with pytest.raises(PaymentGatewayError) as exc_info:
            process_gateway_callback(
                payload={
                    "transaction_reference": "DUPLICATE-REF",
                    "status": "confirmed",
                    "amount": "500.00",
                }
            )
        assert exc_info.value.code == "gateway_callback_reference_ambiguous"

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_identical_confirmed_replay_is_idempotent(
        self, sensitive_user, django_capture_on_commit_callbacks
    ) -> None:
        payment = create_gateway_payment(reference="REPLAY-CONFIRMED")
        payload = {
            "transaction_reference": "REPLAY-CONFIRMED",
            "status": "confirmed",
            "amount": "500.00",
        }
        with django_capture_on_commit_callbacks(execute=True):
            process_gateway_callback(payload=payload, actor=sensitive_user)
        with django_capture_on_commit_callbacks(execute=True):
            replay = process_gateway_callback(payload=payload, actor=sensitive_user)

        assert replay.payment.payment_status == PaymentStatus.CONFIRMED
        assert DocumentInstance.objects.filter(payment_receipt=payment).count() == 1
        assert (
            AuditEvent.objects.filter(action="payment.confirmed", target_id=str(payment.id)).count()
            == 1
        )

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_contradictory_replay_is_rejected(self, sensitive_user) -> None:
        payment = create_gateway_payment(reference="REPLAY-CONFLICT")
        process_gateway_callback(
            payload={
                "transaction_reference": "REPLAY-CONFLICT",
                "status": "confirmed",
                "amount": "500.00",
            },
            actor=sensitive_user,
        )
        with pytest.raises(PaymentGatewayError) as exc_info:
            process_gateway_callback(
                payload={
                    "transaction_reference": "REPLAY-CONFLICT",
                    "status": "failed",
                    "amount": "500.00",
                },
                actor=sensitive_user,
            )
        assert exc_info.value.code == "gateway_callback_status_conflict"
        payment.refresh_from_db()
        assert payment.payment_status == PaymentStatus.CONFIRMED

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    @pytest.mark.parametrize("callback_status", ["failed", "cancelled"])
    def test_terminal_callback_sets_attribution_and_replays_once(
        self,
        callback_status,
        sensitive_user,
        django_capture_on_commit_callbacks,
    ) -> None:
        payment = create_gateway_payment(reference=f"TERMINAL-{callback_status}")
        payload = {
            "transaction_reference": payment.external_reference,
            "status": callback_status,
            "amount": "500.00",
        }
        with django_capture_on_commit_callbacks(execute=True):
            process_gateway_callback(payload=payload, actor=sensitive_user)
        with django_capture_on_commit_callbacks(execute=True):
            process_gateway_callback(payload=payload, actor=sensitive_user)

        payment.refresh_from_db()
        assert payment.payment_status == callback_status
        assert payment.updated_by_id == sensitive_user.id
        assert (
            AuditEvent.objects.filter(
                action=f"payment.gateway_{callback_status}", target_id=str(payment.id)
            ).count()
            == 1
        )

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_confirmation_rolls_back_when_receipt_generation_fails(
        self, sensitive_user, monkeypatch
    ) -> None:
        payment = create_gateway_payment(reference="ROLLBACK-REF")

        def fail_generation(**kwargs):
            raise RuntimeError("receipt generation failed")

        monkeypatch.setattr(
            "apps.payments.services.generate_document_instance_html", fail_generation
        )
        with pytest.raises(RuntimeError, match="receipt generation failed"):
            process_gateway_callback(
                payload={
                    "transaction_reference": "ROLLBACK-REF",
                    "status": "confirmed",
                    "amount": "500.00",
                },
                actor=sensitive_user,
            )

        payment.refresh_from_db()
        assert payment.payment_status == PaymentStatus.PENDING
        assert payment.receipt_document_id is None
        assert DocumentInstance.objects.filter(payment_receipt=payment).count() == 0


class TestGatewayPaymentInitiateAPI:
    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_initiate_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="gw_auth", password="p", is_staff=True)
        response = client.post(
            "/api/v1/payments/gateway/initiate/11111111-1111-1111-1111-111111111111/",
            {"amount": "100.00"},
            content_type="application/json",
        )
        assert response.status_code in {401, 403}

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
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

    @pytest.mark.django_db
    @override_settings(DEBUG=False)
    def test_initiate_fails_closed_in_production(self, sensitive_client) -> None:
        response = sensitive_client.post(
            "/api/v1/payments/gateway/initiate/11111111-1111-1111-1111-111111111111/",
            {"amount": "100.00"},
            content_type="application/json",
        )
        assert response.status_code == 503
        assert response.json()["code"] == "gateway_sandbox_disabled"


class TestGatewayPaymentCallbackAPI:
    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_callback_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="gw_cb_auth", password="p", is_staff=True)
        response = client.post(
            "/api/v1/payments/gateway/callback/",
            {"transaction_reference": "REF", "status": "confirmed"},
            content_type="application/json",
        )
        assert response.status_code in {401, 403}

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
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
            source_label="mvola_sandbox",
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

    @pytest.mark.django_db
    @override_settings(DEBUG=False)
    def test_callback_fails_closed_in_production(self, sensitive_client) -> None:
        response = sensitive_client.post(
            "/api/v1/payments/gateway/callback/",
            {"transaction_reference": "REF", "status": "confirmed", "amount": "1.00"},
            content_type="application/json",
        )
        assert response.status_code == 503
        assert response.json()["code"] == "gateway_sandbox_disabled"

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_callback_rejects_authenticated_non_sensitive_user(
        self, client, django_user_model
    ) -> None:
        user = django_user_model.objects.create_user(username="gateway-basic", password="p")
        client.force_login(user)
        response = client.post(
            "/api/v1/payments/gateway/callback/",
            {"transaction_reference": "REF", "status": "confirmed", "amount": "1.00"},
            content_type="application/json",
        )
        assert response.status_code == 403

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    @pytest.mark.parametrize(
        "payload",
        [
            {"transaction_reference": "R" * 256, "status": "confirmed", "amount": "1.00"},
            {"transaction_reference": "REF", "status": "unknown", "amount": "1.00"},
            {"transaction_reference": "REF", "status": "confirmed"},
            {"transaction_reference": "REF", "status": "confirmed", "amount": "invalid"},
            {"transaction_reference": "REF", "status": "confirmed", "amount": "-1.00"},
        ],
    )
    def test_callback_rejects_invalid_payload(self, sensitive_client, payload) -> None:
        response = sensitive_client.post(
            "/api/v1/payments/gateway/callback/",
            payload,
            content_type="application/json",
        )
        assert response.status_code == 400

    @pytest.mark.django_db
    @override_settings(DEBUG=True)
    def test_callback_returns_stable_conflict_and_not_found_statuses(
        self, sensitive_client
    ) -> None:
        create_gateway_payment(reference="API-CONFLICT", amount=Decimal("200.00"))
        conflict_response = sensitive_client.post(
            "/api/v1/payments/gateway/callback/",
            {
                "transaction_reference": "API-CONFLICT",
                "status": "confirmed",
                "amount": "201.00",
            },
            content_type="application/json",
        )
        not_found_response = sensitive_client.post(
            "/api/v1/payments/gateway/callback/",
            {
                "transaction_reference": "API-NOT-FOUND",
                "status": "confirmed",
                "amount": "1.00",
            },
            content_type="application/json",
        )
        assert conflict_response.status_code == 409
        assert conflict_response.json()["code"] == "gateway_callback_amount_mismatch"
        assert not_found_response.status_code == 404
        assert not_found_response.json()["code"] == "gateway_callback_payment_not_found"


@pytest.mark.django_db(transaction=True)
@override_settings(DEBUG=True)
def test_concurrent_callback_replay_creates_one_receipt_and_audit(
    sensitive_user,
) -> None:
    payment = create_gateway_payment(reference="CONCURRENT-CALLBACK")
    payload = {
        "transaction_reference": payment.external_reference,
        "status": "confirmed",
        "amount": "500.00",
    }
    barrier = Barrier(2)

    def process_once() -> str:
        close_old_connections()
        actor = type(sensitive_user).objects.get(pk=sensitive_user.pk)
        barrier.wait()
        try:
            result = process_gateway_callback(payload=payload, actor=actor)
            return result.payment.payment_status
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(lambda _: process_once(), range(2)))

    assert statuses == [PaymentStatus.CONFIRMED, PaymentStatus.CONFIRMED]
    assert DocumentInstance.objects.filter(payment_receipt=payment).count() == 1
    assert (
        AuditEvent.objects.filter(action="payment.confirmed", target_id=str(payment.id)).count()
        == 1
    )


@pytest.mark.django_db(transaction=True)
@override_settings(DEBUG=True)
def test_callback_confirmation_lock_prevents_stale_cancellation_overwrite(
    sensitive_user,
    monkeypatch,
) -> None:
    payment = create_gateway_payment(reference="CALLBACK-CANCEL-RACE")
    callback_has_lock = Event()
    cancel_attempt_started = Event()

    from apps.payments import services as payment_services

    original_confirm_payment = payment_services.confirm_payment

    def confirm_after_cancel_attempt(**kwargs):
        callback_has_lock.set()
        assert cancel_attempt_started.wait(timeout=5)
        return original_confirm_payment(**kwargs)

    monkeypatch.setattr(payment_services, "confirm_payment", confirm_after_cancel_attempt)

    def confirm_from_callback() -> str:
        close_old_connections()
        actor = type(sensitive_user).objects.get(pk=sensitive_user.pk)
        try:
            result = process_gateway_callback(
                payload={
                    "transaction_reference": payment.external_reference,
                    "status": "confirmed",
                    "amount": "500.00",
                },
                actor=actor,
            )
            return result.payment.payment_status
        finally:
            close_old_connections()

    def cancel_stale_payment() -> str:
        close_old_connections()
        actor = type(sensitive_user).objects.get(pk=sensitive_user.pk)
        try:
            assert callback_has_lock.wait(timeout=5)
            stale_payment = Payment.objects.get(pk=payment.pk)
            cancel_attempt_started.set()
            try:
                cancel_payment(payment=stale_payment, actor=actor)
            except PaymentLifecycleError as error:
                return error.code
            return PaymentStatus.CANCELLED
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        confirmation_future = executor.submit(confirm_from_callback)
        cancellation_future = executor.submit(cancel_stale_payment)
        results = [confirmation_future.result(), cancellation_future.result()]

    payment.refresh_from_db()
    assert results == [PaymentStatus.CONFIRMED, "invalid_payment_cancel_state"]
    assert payment.payment_status == PaymentStatus.CONFIRMED
    assert payment.receipt_document_id is not None
    assert DocumentInstance.objects.filter(payment_receipt=payment).count() == 1
    assert (
        AuditEvent.objects.filter(action="payment.confirmed", target_id=str(payment.id)).count()
        == 1
    )
    assert not AuditEvent.objects.filter(
        action="payment.cancelled", target_id=str(payment.id)
    ).exists()
