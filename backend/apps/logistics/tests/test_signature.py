"""Tests signature logistique : received/exception et autorisations."""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone

from apps.customers.models import Customer
from apps.identity.roles import IdentityRole
from apps.logistics.models import (
    HandoverSignatureStatus,
    LogisticsEvent,
    LogisticsEventStatus,
    LogisticsEventType,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def staff_user():
    return User.objects.create_user(username="staff", password="test-pass", is_staff=True)


@pytest.fixture
def regular_user():
    return User.objects.create_user(username="regular", password="test-pass")


@pytest.fixture
def operator_user():
    user = User.objects.create_user(username="operator", password="test-pass")
    group = Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    user.groups.add(group)
    return user


@pytest.fixture
def handover_event():
    customer = Customer.objects.create(display_name="Event Customer")
    start_at = timezone.now() + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    draft = ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
    )
    event = LogisticsEvent.objects.create(
        reservation_draft=draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.COMPLETED,
        executed_at=timezone.now(),
        signature_required=True,
        created_by=None,
        updated_by=None,
    )
    return event


@pytest.fixture
def staff_client(client, staff_user):
    client.force_login(staff_user)
    return client


@pytest.fixture
def regular_client(client, regular_user):
    client.force_login(regular_user)
    return client


@pytest.fixture
def operator_client(client, operator_user):
    client.force_login(operator_user)
    return client


class TestLogisticsSignatureReceived:
    def test_signature_received_success(self, staff_client, handover_event):
        url = f"/api/v1/logistics/events/{handover_event.id}/signature/"
        response = staff_client.post(
            url,
            {
                "signature_status": HandoverSignatureStatus.RECEIVED,
                "signed_by_client_name": "John Doe",
                "signed_document_file": "documents/signed_123.pdf",
            },
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["signature_status"] == HandoverSignatureStatus.RECEIVED
        assert data["signed_by_client_name"] == "John Doe"
        handover_event.refresh_from_db()
        assert handover_event.signature_status == HandoverSignatureStatus.RECEIVED
        assert handover_event.signed_by is not None
        assert handover_event.signed_at is not None

    def test_signature_received_requires_client_name_or_file(self, staff_client, handover_event):
        url = f"/api/v1/logistics/events/{handover_event.id}/signature/"
        response = staff_client.post(
            url,
            {"signature_status": HandoverSignatureStatus.RECEIVED},
            content_type="application/json",
        )
        assert response.status_code == 400


class TestLogisticsSignatureException:
    def test_signature_exception_success(self, staff_client, handover_event):
        url = f"/api/v1/logistics/events/{handover_event.id}/signature/"
        response = staff_client.post(
            url,
            {
                "signature_status": HandoverSignatureStatus.EXCEPTION,
                "signature_exception_reason": "Client unavailable",
            },
            content_type="application/json",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["signature_status"] == HandoverSignatureStatus.EXCEPTION
        assert data["signature_exception_reason"] == "Client unavailable"
        handover_event.refresh_from_db()
        assert handover_event.signature_status == HandoverSignatureStatus.EXCEPTION

    def test_signature_exception_requires_reason(self, staff_client, handover_event):
        url = f"/api/v1/logistics/events/{handover_event.id}/signature/"
        response = staff_client.post(
            url,
            {"signature_status": HandoverSignatureStatus.EXCEPTION},
            content_type="application/json",
        )
        assert response.status_code == 400


class TestLogisticsSignatureAuthorization:
    def test_signature_unauthenticated(self, client, handover_event):
        url = f"/api/v1/logistics/events/{handover_event.id}/signature/"
        response = client.post(
            url,
            {"signature_status": HandoverSignatureStatus.RECEIVED, "signed_by_client_name": "X"},
            content_type="application/json",
        )
        assert response.status_code in {401, 403}

    def test_signature_regular_forbidden(self, regular_client, handover_event):
        url = f"/api/v1/logistics/events/{handover_event.id}/signature/"
        response = regular_client.post(
            url,
            {"signature_status": HandoverSignatureStatus.RECEIVED, "signed_by_client_name": "X"},
            content_type="application/json",
        )
        assert response.status_code == 403

    def test_signature_operator_allowed(self, operator_client, handover_event):
        url = f"/api/v1/logistics/events/{handover_event.id}/signature/"
        response = operator_client.post(
            url,
            {
                "signature_status": HandoverSignatureStatus.RECEIVED,
                "signed_by_client_name": "Jane Doe",
            },
            content_type="application/json",
        )
        assert response.status_code == 200

    def test_signature_non_handover_returns_400(self, staff_client):
        customer = Customer.objects.create(display_name="Delivery Customer")
        start_at = timezone.now() + timedelta(days=2)
        end_at = start_at + timedelta(hours=4)
        draft = ReservationDraft.objects.create(
            customer=customer,
            start_at=start_at,
            end_at=end_at,
        )
        event = LogisticsEvent.objects.create(
            reservation_draft=draft,
            event_type=LogisticsEventType.DELIVERY,
            status=LogisticsEventStatus.COMPLETED,
            executed_at=timezone.now(),
            signature_required=True,
            created_by=None,
            updated_by=None,
        )
        url = f"/api/v1/logistics/events/{event.id}/signature/"
        response = staff_client.post(
            url,
            {
                "signature_status": HandoverSignatureStatus.RECEIVED,
                "signed_by_client_name": "X",
            },
            content_type="application/json",
        )
        assert response.status_code == 400
        assert "PASSATION_NOT_ALLOWED" == response.json()["code"]

    def test_signature_not_completed_returns_400(self, staff_client):
        customer = Customer.objects.create(display_name="Handover Customer")
        start_at = timezone.now() + timedelta(days=2)
        end_at = start_at + timedelta(hours=4)
        draft = ReservationDraft.objects.create(
            customer=customer,
            start_at=start_at,
            end_at=end_at,
        )
        event = LogisticsEvent.objects.create(
            reservation_draft=draft,
            event_type=LogisticsEventType.HANDOVER,
            status=LogisticsEventStatus.PLANNED,
            signature_required=True,
            created_by=None,
            updated_by=None,
        )
        url = f"/api/v1/logistics/events/{event.id}/signature/"
        response = staff_client.post(
            url,
            {
                "signature_status": HandoverSignatureStatus.RECEIVED,
                "signed_by_client_name": "X",
            },
            content_type="application/json",
        )
        assert response.status_code == 400
        assert "PASSATION_NOT_ALLOWED" == response.json()["code"]
