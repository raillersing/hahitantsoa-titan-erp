from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone

from apps.identity.roles import IdentityRole
from apps.inventory.models import InventoryItem
from apps.logistics.models import LogisticsEvent, LogisticsEventStatus, LogisticsEventType
from apps.logistics.services import ITEM_LINE_NOT_FOUND, PASSATION_NOT_ALLOWED
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
        status=LogisticsEventStatus.PLANNED,
    )
    response = operator_authenticated_client.get(LOGISTICS_EVENT_LIST_URL)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1


def test_list_filter_by_event_type(operator_authenticated_client, reservation_draft):
    LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.PLANNED,
    )
    response = operator_authenticated_client.get(
        LOGISTICS_EVENT_LIST_URL, {"event_type": "handover"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["event_type"] == "handover"


def test_list_filter_by_status(operator_authenticated_client, reservation_draft):
    LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.DISPATCHED,
    )
    response = operator_authenticated_client.get(LOGISTICS_EVENT_LIST_URL, {"status": "dispatched"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "dispatched"


# create


def test_create_logistics_event(operator_authenticated_client, reservation_draft):
    payload = {
        "reservation_draft_id": str(reservation_draft.id),
        "event_type": "handover",
        "scheduled_at": timezone.now().isoformat(),
        "address": "123 Rue de la Paix",
        "signature_required": True,
    }
    response = operator_authenticated_client.post(
        LOGISTICS_EVENT_CREATE_URL, payload, content_type="application/json"
    )
    assert response.status_code == 201
    data = response.json()
    assert data["event_type"] == "handover"
    assert data["signature_required"] is True


# retrieve


def test_retrieve_logistics_event(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.PLANNED,
    )
    url = f"/api/v1/logistics/events/{event.id}/"
    response = operator_authenticated_client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(event.id)
    assert data["item_lines"] == []


# update


def test_update_logistics_event(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.PLANNED,
    )
    url = f"/api/v1/logistics/events/{event.id}/update/"
    payload = {"address": "Updated Address", "signature_required": True}
    response = operator_authenticated_client.post(url, payload, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["address"] == "Updated Address"
    assert data["signature_required"] is True


# transition


def test_transition_logistics_event(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    url = f"/api/v1/logistics/events/{event.id}/transition/"
    payload = {"new_status": "dispatched"}
    response = operator_authenticated_client.post(url, payload, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "dispatched"


# item lines


def test_add_item_line(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    item = InventoryItem.objects.create(name="Chair", kind="article")
    url = f"/api/v1/logistics/events/{event.id}/lines/add/"
    payload = {
        "inventory_item_id": str(item.id),
        "quantity": 3,
        "notes": "Fragile",
    }
    response = operator_authenticated_client.post(url, payload, content_type="application/json")
    assert response.status_code == 201
    data = response.json()
    assert data["quantity"] == 3
    assert data["inventory_item_name"] == "Chair"


def test_list_item_lines(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    item = InventoryItem.objects.create(name="Table", kind="material")
    from apps.logistics.models import LogisticsEventItemLine

    LogisticsEventItemLine.objects.create(
        logistics_event=event,
        inventory_item=item,
        quantity=2,
    )
    url = f"/api/v1/logistics/events/{event.id}/lines/"
    response = operator_authenticated_client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["quantity"] == 2


def test_remove_item_line(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    item = InventoryItem.objects.create(name="Lamp", kind="article")
    from apps.logistics.models import LogisticsEventItemLine

    line = LogisticsEventItemLine.objects.create(
        logistics_event=event,
        inventory_item=item,
        quantity=1,
    )
    url = f"/api/v1/logistics/events/{event.id}/lines/{line.id}/remove/"
    response = operator_authenticated_client.post(url)
    assert response.status_code == 204


# passation


def test_remove_item_line_not_found(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
    )
    url = f"/api/v1/logistics/events/{event.id}/lines/11111111-1111-1111-1111-111111111111/remove/"
    response = operator_authenticated_client.post(url)
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == ITEM_LINE_NOT_FOUND


def test_complete_passation(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.HANDOVER,
        status=LogisticsEventStatus.PLANNED,
        signature_required=True,
        scheduled_at=timezone.now(),
    )
    # transition to completed
    url = f"/api/v1/logistics/events/{event.id}/transition/"
    operator_authenticated_client.post(
        url, {"new_status": "dispatched"}, content_type="application/json"
    )
    operator_authenticated_client.post(
        url, {"new_status": "completed"}, content_type="application/json"
    )

    # complete passation
    url = f"/api/v1/logistics/events/{event.id}/complete-passation/"
    response = operator_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 200
    data = response.json()
    assert data["event"]["signature_received"] is True
    assert data["event"]["signed_at"] is not None
    assert "document_instance_id" in data


def test_complete_passation_not_handover(operator_authenticated_client, reservation_draft):
    event = LogisticsEvent.objects.create(
        reservation_draft=reservation_draft,
        event_type=LogisticsEventType.DELIVERY,
        status=LogisticsEventStatus.PLANNED,
        signature_required=True,
        scheduled_at=timezone.now(),
    )
    url = f"/api/v1/logistics/events/{event.id}/transition/"
    operator_authenticated_client.post(
        url, {"new_status": "dispatched"}, content_type="application/json"
    )
    operator_authenticated_client.post(
        url, {"new_status": "completed"}, content_type="application/json"
    )

    url = f"/api/v1/logistics/events/{event.id}/complete-passation/"
    response = operator_authenticated_client.post(url, {}, content_type="application/json")
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == PASSATION_NOT_ALLOWED
