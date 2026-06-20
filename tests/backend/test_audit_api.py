from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db

User = get_user_model()

AUDIT_EVENT_LIST_URL = "/api/v1/audit/events/"


@pytest.fixture
def regular_user():
    return User.objects.create_user(username="regular", password="test-pass")


@pytest.fixture
def staff_user():
    return User.objects.create_user(username="staff", password="test-pass", is_staff=True)


@pytest.fixture
def operator_user():
    user = User.objects.create_user(username="operator", password="test-pass")
    group = Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    user.groups.add(group)
    return user


@pytest.fixture
def regular_authenticated_client(client, regular_user):
    client.force_login(regular_user)
    return client


@pytest.fixture
def staff_authenticated_client(client, staff_user):
    client.force_login(staff_user)
    return client


@pytest.fixture
def operator_authenticated_client(client, operator_user):
    client.force_login(operator_user)
    return client


def test_list_unauthenticated(client):
    response = client.get(AUDIT_EVENT_LIST_URL)
    assert response.status_code in {401, 403}


def test_list_regular_forbidden(regular_authenticated_client):
    response = regular_authenticated_client.get(AUDIT_EVENT_LIST_URL)
    assert response.status_code == 403


def test_list_staff_empty(staff_authenticated_client):
    response = staff_authenticated_client.get(AUDIT_EVENT_LIST_URL)
    assert response.status_code == 200
    assert response.json() == []


def test_list_staff_with_events(staff_authenticated_client, staff_user):
    AuditEvent.objects.create(
        actor=staff_user,
        action="test_action",
        target_type="TestTarget",
        target_id="abc-123",
    )
    response = staff_authenticated_client.get(AUDIT_EVENT_LIST_URL)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["action"] == "test_action"


def test_list_operator_allowed(operator_authenticated_client):
    AuditEvent.objects.create(action="op_action", target_type="T", target_id="1")
    response = operator_authenticated_client.get(AUDIT_EVENT_LIST_URL)
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_detail_staff(staff_authenticated_client):
    event = AuditEvent.objects.create(action="detail_action", target_type="T", target_id="2")
    url = f"/api/v1/audit/events/{event.id}/"
    response = staff_authenticated_client.get(url)
    assert response.status_code == 200
    assert response.json()["id"] == str(event.id)


def test_filter_by_action(staff_authenticated_client):
    AuditEvent.objects.create(action="create", target_type="T", target_id="a")
    AuditEvent.objects.create(action="delete", target_type="T", target_id="b")
    response = staff_authenticated_client.get(f"{AUDIT_EVENT_LIST_URL}?action=create")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["action"] == "create"


def test_filter_by_target_type(staff_authenticated_client):
    AuditEvent.objects.create(action="x", target_type="Invoice", target_id="i")
    AuditEvent.objects.create(action="y", target_type="Payment", target_id="p")
    response = staff_authenticated_client.get(f"{AUDIT_EVENT_LIST_URL}?target_type=Payment")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["target_type"] == "Payment"


def test_filter_by_actor_id(staff_authenticated_client):
    actor = User.objects.create_user(username="actor", password="p")
    AuditEvent.objects.create(actor=actor, action="a", target_type="T", target_id="t")
    AuditEvent.objects.create(action="b", target_type="T", target_id="u")
    response = staff_authenticated_client.get(f"{AUDIT_EVENT_LIST_URL}?actor_id={actor.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["actor_id"] == actor.id


def test_filter_by_target_id(staff_authenticated_client):
    AuditEvent.objects.create(action="a", target_type="T", target_id="inv-1")
    AuditEvent.objects.create(action="b", target_type="T", target_id="inv-2")
    response = staff_authenticated_client.get(f"{AUDIT_EVENT_LIST_URL}?target_id=inv-1")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["target_id"] == "inv-1"


def test_filter_by_created_date_range(staff_authenticated_client):
    now = timezone.now()

    past = AuditEvent.objects.create(action="past", target_type="T", target_id="1")
    target = AuditEvent.objects.create(action="target", target_type="T", target_id="2")
    future = AuditEvent.objects.create(action="future", target_type="T", target_id="3")

    AuditEvent.objects.filter(pk=past.pk).update(created_at=now - timedelta(days=2))
    AuditEvent.objects.filter(pk=target.pk).update(created_at=now - timedelta(minutes=30))
    AuditEvent.objects.filter(pk=future.pk).update(created_at=now + timedelta(days=2))

    after = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")
    before = (now + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%S")
    response = staff_authenticated_client.get(
        f"{AUDIT_EVENT_LIST_URL}?created_after={after}&created_before={before}"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["action"] == "target"


def test_filter_combined_action_and_target_id(staff_authenticated_client):
    AuditEvent.objects.create(action="create", target_type="Invoice", target_id="inv-1")
    AuditEvent.objects.create(action="create", target_type="Invoice", target_id="inv-2")
    AuditEvent.objects.create(action="delete", target_type="Invoice", target_id="inv-1")
    response = staff_authenticated_client.get(
        f"{AUDIT_EVENT_LIST_URL}?action=create&target_id=inv-1"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["action"] == "create"
    assert data[0]["target_id"] == "inv-1"


def test_filter_created_after_with_no_match_returns_empty(staff_authenticated_client):
    now = timezone.now()
    event = AuditEvent.objects.create(action="old", target_type="T", target_id="1")
    AuditEvent.objects.filter(pk=event.pk).update(created_at=now - timedelta(days=5))

    after = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    response = staff_authenticated_client.get(f"{AUDIT_EVENT_LIST_URL}?created_after={after}")
    assert response.status_code == 200
    assert response.json() == []
