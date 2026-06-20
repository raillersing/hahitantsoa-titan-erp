from datetime import timedelta

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


# list filtering


def _create_event(
    reservation_draft, *, event_type, status=LogisticsEventStatus.PLANNED, scheduled_at=None
):
    return LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=event_type,
        status=status,
        scheduled_at=scheduled_at,
    )


def _make_reservation_draft():
    from apps.customers.models import Customer

    start = timezone.now().replace(microsecond=0)
    customer = Customer.objects.create(display_name="Filter customer")
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start,
        end_at=start + timedelta(hours=4),
    )


def test_list_filter_by_status(operator_authenticated_client, reservation_draft):
    _create_event(
        reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    _create_event(
        reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.DISPATCHED,
    )

    response = operator_authenticated_client.get(f"{LOGISTICS_EVENT_LIST_URL}?status=dispatched")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["status"] == "dispatched"


def test_list_filter_by_event_type(operator_authenticated_client, reservation_draft):
    _create_event(reservation_draft, event_type=LogisticsEventType.DELIVERY)
    _create_event(reservation_draft, event_type=LogisticsEventType.PICKUP)

    response = operator_authenticated_client.get(f"{LOGISTICS_EVENT_LIST_URL}?event_type=pickup")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["event_type"] == "pickup"


def test_list_filter_by_scheduled_date_range(operator_authenticated_client, reservation_draft):
    past = timezone.now() - timedelta(days=2)
    future = timezone.now() + timedelta(days=2)
    target = timezone.now() + timedelta(hours=6)

    _create_event(reservation_draft, event_type=LogisticsEventType.DELIVERY, scheduled_at=past)
    _create_event(reservation_draft, event_type=LogisticsEventType.DELIVERY, scheduled_at=target)
    _create_event(reservation_draft, event_type=LogisticsEventType.DELIVERY, scheduled_at=future)

    after = (timezone.now()).strftime("%Y-%m-%dT%H:%M:%S")
    before = (target + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")
    response = operator_authenticated_client.get(
        f"{LOGISTICS_EVENT_LIST_URL}?scheduled_after={after}&scheduled_before={before}"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["scheduled_at"] is not None


def test_list_filter_by_reservation_draft_id(operator_authenticated_client, reservation_draft):
    other_draft = _make_reservation_draft()
    _create_event(reservation_draft, event_type=LogisticsEventType.DELIVERY)
    _create_event(other_draft, event_type=LogisticsEventType.DELIVERY)

    response = operator_authenticated_client.get(
        f"{LOGISTICS_EVENT_LIST_URL}?reservation_draft_id={reservation_draft.id}"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["reservation_draft"] == str(reservation_draft.id)


def test_list_filter_combined_status_and_event_type(
    operator_authenticated_client, reservation_draft
):
    _create_event(
        reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    _create_event(
        reservation_draft,
        event_type=LogisticsEventType.PICKUP,
        status=LogisticsEventStatus.DISPATCHED,
    )
    _create_event(
        reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.DISPATCHED,
    )

    response = operator_authenticated_client.get(
        f"{LOGISTICS_EVENT_LIST_URL}?status=dispatched&event_type=delivery"
    )
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["status"] == "dispatched"
    assert results[0]["event_type"] == "delivery"


def test_list_filter_status_with_no_match_returns_empty(
    operator_authenticated_client, reservation_draft
):
    _create_event(
        reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )

    response = operator_authenticated_client.get(f"{LOGISTICS_EVENT_LIST_URL}?status=completed")
    assert response.status_code == 200
    assert response.json() == []


# lifecycle invariant negative tests


NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000"


def test_create_invalid_event_type_returns_400(staff_authenticated_client, reservation_draft):
    payload = {
        "reservation_draft_id": str(reservation_draft.id),
        "event_type": "invalid_event_type",
    }
    response = staff_authenticated_client.post(
        LOGISTICS_EVENT_CREATE_URL, payload, content_type="application/json"
    )
    assert response.status_code == 400


def test_update_nonexistent_returns_404(staff_authenticated_client):
    url = f"/api/v1/logistics/events/{NON_EXISTENT_ID}/update/"
    response = staff_authenticated_client.post(
        url, {"address": "Nowhere"}, content_type="application/json"
    )
    assert response.status_code == 404


def test_transition_nonexistent_returns_404(staff_authenticated_client):
    url = f"/api/v1/logistics/events/{NON_EXISTENT_ID}/transition/"
    response = staff_authenticated_client.post(
        url, {"new_status": "completed"}, content_type="application/json"
    )
    assert response.status_code == 404


def test_update_completed_event_returns_400(staff_authenticated_client, reservation_draft):
    now = timezone.now()
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.COMPLETED,
        scheduled_at=now,
        executed_at=now,
    )
    url = f"/api/v1/logistics/events/{event.id}/update/"
    response = staff_authenticated_client.post(
        url, {"address": "Too late"}, content_type="application/json"
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_status_transition"


def test_transition_to_cancelled_with_executed_at_returns_400(
    staff_authenticated_client, reservation_draft
):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    url = f"/api/v1/logistics/events/{event.id}/transition/"
    response = staff_authenticated_client.post(
        url,
        {"new_status": "cancelled", "executed_at": timezone.now().isoformat()},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_status_transition"
