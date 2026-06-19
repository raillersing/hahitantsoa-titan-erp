import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone

from apps.identity.roles import IdentityRole
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

User = get_user_model()

LOGISTICS_EVENT_LIST_URL = "/api/v1/logistics/events/"
LOGISTICS_EVENT_CREATE_URL = "/api/v1/logistics/events/create/"


@pytest.fixture
def regular_authenticated_client(client):
    user = User.objects.create_user(username="regular", password="test-pass")
    client.force_login(user)
    return client


@pytest.fixture
def staff_authenticated_client(client):
    user = User.objects.create_user(username="staff", password="test-pass", is_staff=True)
    client.force_login(user)
    return client


@pytest.fixture
def operator_authenticated_client(client):
    user = User.objects.create_user(username="operator", password="test-pass")
    group = Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    user.groups.add(group)
    client.force_login(user)
    return client


@pytest.fixture
def reservation_draft():
    from datetime import timedelta

    from apps.customers.models import Customer

    start = timezone.now().replace(microsecond=0)
    customer = Customer.objects.create(display_name="C")
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start,
        end_at=start + timedelta(hours=4),
    )


# list


def test_list_unauthenticated(client):
    response = client.get(LOGISTICS_EVENT_LIST_URL)
    assert response.status_code in {401, 403}


def test_list_regular_forbidden(regular_authenticated_client):
    response = regular_authenticated_client.get(LOGISTICS_EVENT_LIST_URL)
    assert response.status_code == 403


def test_list_staff_empty(staff_authenticated_client):
    response = staff_authenticated_client.get(LOGISTICS_EVENT_LIST_URL)
    assert response.status_code == 200
    assert response.json() == []


def test_list_operator_allowed(operator_authenticated_client, reservation_draft):
    LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
    )
    response = operator_authenticated_client.get(LOGISTICS_EVENT_LIST_URL)
    assert response.status_code == 200
    assert len(response.json()) == 1


# create


def test_create_unauthenticated(client, reservation_draft):
    payload = {
        "reservation_draft_id": str(reservation_draft.id),
        "event_type": "delivery",
    }
    response = client.post(LOGISTICS_EVENT_CREATE_URL, payload, content_type="application/json")
    assert response.status_code in {401, 403}


def test_create_regular_forbidden(regular_authenticated_client, reservation_draft):
    payload = {
        "reservation_draft_id": str(reservation_draft.id),
        "event_type": "delivery",
    }
    response = regular_authenticated_client.post(
        LOGISTICS_EVENT_CREATE_URL, payload, content_type="application/json"
    )
    assert response.status_code == 403


def test_create_staff_success(staff_authenticated_client, reservation_draft):
    payload = {
        "reservation_draft_id": str(reservation_draft.id),
        "event_type": "delivery",
        "address": "456 Oak Ave",
    }
    response = staff_authenticated_client.post(
        LOGISTICS_EVENT_CREATE_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    data = response.json()
    assert data["event_type"] == "delivery"
    assert data["address"] == "456 Oak Ave"


# detail / update / transition


def test_update_staff_success(staff_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
    )
    url = f"/api/v1/logistics/events/{event.id}/update/"
    response = staff_authenticated_client.post(
        url, {"address": "New Addr"}, content_type="application/json"
    )
    assert response.status_code == 200
    assert response.json()["address"] == "New Addr"


def test_transition_staff_success(staff_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.DISPATCHED,
    )
    url = f"/api/v1/logistics/events/{event.id}/transition/"
    response = staff_authenticated_client.post(
        url, {"new_status": "completed"}, content_type="application/json"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["executed_at"] is not None


def test_transition_invalid_returns_400(staff_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
    )
    url = f"/api/v1/logistics/events/{event.id}/transition/"
    response = staff_authenticated_client.post(
        url, {"new_status": "completed"}, content_type="application/json"
    )
    assert response.status_code == 400
    assert "not allowed" in response.json()["detail"]
