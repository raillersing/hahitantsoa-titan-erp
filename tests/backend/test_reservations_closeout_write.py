from __future__ import annotations

from decimal import Decimal

import pytest
from django.utils import timezone

from apps.reservations.closeout import (
    CloseoutValidationError,
    closeout_reservation_draft,
    validate_reservation_closeable,
)
from apps.reservations.models import ReservationDraft


@pytest.fixture
def sensitive_user(django_user_model):
    return django_user_model.objects.create_user(
        username="closeout-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    from django.test import Client

    client = Client()
    client.force_login(sensitive_user)
    return client


class TestValidateReservationCloseable:
    @pytest.mark.django_db
    def test_returns_empty_when_confirmed_no_events_no_invoices(self) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-001",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert blockers == []

    @pytest.mark.django_db
    def test_blocks_unconfirmed_draft(self) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-002",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert "reservation_not_confirmed" in blockers

    @pytest.mark.django_db
    def test_blocks_open_billing_invoice(self) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-003",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        from apps.billing.models import BillingInvoice

        BillingInvoice.objects.create(
            reservation_draft=draft,
            amount=Decimal("500.00"),
            invoice_status="open",
            issued_at=timezone.now(),
            source_kind="manual",
        )
        blockers = validate_reservation_closeable(reservation_draft=draft)
        assert any("billing_invoices_open" in b for b in blockers)


class TestCloseoutReservationDraft:
    @pytest.mark.django_db
    def test_raises_for_unconfirmed(self, django_user_model) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-004",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        user = django_user_model.objects.create_user(
            username="closeout_actor", password="p", is_staff=True
        )
        with pytest.raises(CloseoutValidationError) as exc_info:
            closeout_reservation_draft(reservation_draft=draft, actor=user)
        assert exc_info.value.code == "reservation_not_closeable"

    @pytest.mark.django_db
    def test_returns_summary_for_confirmed(self, django_user_model) -> None:
        from apps.customers.models import Customer

        customer = Customer.objects.create(display_name="Closeout Customer")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-005",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        user = django_user_model.objects.create_user(
            username="closeout_actor2", password="p", is_staff=True
        )
        result = closeout_reservation_draft(reservation_draft=draft, actor=user)
        assert result.reservation_draft_id == str(draft.id)
        assert result.confirmed is True


class TestCloseoutExecuteAPI:
    @pytest.mark.django_db
    def test_execute_requires_auth(self, client, django_user_model) -> None:
        django_user_model.objects.create_user(username="co_auth", password="p", is_staff=True)
        response = client.post(
            "/api/v1/reservations/drafts/11111111-1111-1111-1111-111111111111/closeout/execute/"
        )
        assert response.status_code in {401, 403}

    @pytest.mark.django_db
    def test_execute_success(self, sensitive_client, django_user_model) -> None:
        from apps.customers.models import Customer

        django_user_model.objects.create_user(username="co_exec", password="p", is_staff=True)
        customer = Customer.objects.create(display_name="Closeout Exec")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-API",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
            confirmed_at=timezone.now(),
        )
        response = sensitive_client.post(
            f"/api/v1/reservations/drafts/{draft.id}/closeout/execute/"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["confirmed"] is True
        assert data["reservation_draft_id"] == str(draft.id)

    @pytest.mark.django_db
    def test_execute_fails_for_unconfirmed(self, sensitive_client, django_user_model) -> None:
        from apps.customers.models import Customer

        django_user_model.objects.create_user(username="co_fail", password="p", is_staff=True)
        customer = Customer.objects.create(display_name="Closeout Fail")
        draft = ReservationDraft.objects.create(
            public_reference="T-CO-FAIL",
            customer=customer,
            start_at=timezone.now(),
            end_at=timezone.now(),
        )
        response = sensitive_client.post(
            f"/api/v1/reservations/drafts/{draft.id}/closeout/execute/"
        )
        assert response.status_code == 400
        data = response.json()
        assert "code" in data
