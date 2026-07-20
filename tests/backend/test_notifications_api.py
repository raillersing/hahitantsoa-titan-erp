"""Backend tests for apps.notifications API endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.notifications.models import SystemNotification

pytestmark = pytest.mark.django_db

NOTIFICATION_LIST_URL = "/api/v1/notifications/"
NOTIFICATION_MARK_ALL_READ_URL = "/api/v1/notifications/mark-all-read/"


@pytest.fixture
def user():
    return get_user_model().objects.create_user(
        username="notification-test-user",
        password="test-pass",
    )


@pytest.fixture
def authenticated_client(user):
    client = Client()
    client.force_login(user)
    return client


@pytest.fixture
def notification(user):
    return SystemNotification.objects.create(
        recipient=user,
        notification_type="payment",
        title="Payment received",
        message="You have a new payment.",
        severity="info",
        is_read=False,
    )


# --- List notifications (authenticated) ---


def test_list_notifications_returns_200(authenticated_client, notification):
    response = authenticated_client.get(NOTIFICATION_LIST_URL)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Payment received"
    assert data[0]["notification_type"] == "payment"
    assert data[0]["is_read"] is False


def test_list_notifications_unread_only_filter(authenticated_client, user, notification):
    SystemNotification.objects.create(
        recipient=user,
        notification_type="stock",
        title="Stock alert",
        is_read=True,
    )
    response = authenticated_client.get(f"{NOTIFICATION_LIST_URL}?unread_only=true")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Payment received"


def test_list_notifications_empty(authenticated_client):
    response = authenticated_client.get(NOTIFICATION_LIST_URL)
    assert response.status_code == 200
    assert response.json() == []


# --- Mark notification as read (authenticated) ---


def test_mark_notification_as_read(authenticated_client, notification):
    url = f"{NOTIFICATION_LIST_URL}{notification.id}/read/"
    response = authenticated_client.patch(
        url,
        data={"is_read": True},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["is_read"] is True
    notification.refresh_from_db()
    assert notification.is_read is True


def test_mark_notification_as_unread(authenticated_client, user):
    notification = SystemNotification.objects.create(
        recipient=user,
        notification_type="system",
        title="System update",
        is_read=True,
    )
    url = f"{NOTIFICATION_LIST_URL}{notification.id}/read/"
    response = authenticated_client.patch(
        url,
        data={"is_read": False},
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["is_read"] is False
    notification.refresh_from_db()
    assert notification.is_read is False


def test_mark_notification_as_read_404(authenticated_client):
    url = f"{NOTIFICATION_LIST_URL}00000000-0000-0000-0000-000000000000/read/"
    response = authenticated_client.patch(
        url,
        data={"is_read": True},
        content_type="application/json",
    )
    assert response.status_code == 404


# --- Mark all as read (authenticated) ---


def test_mark_all_as_read(authenticated_client, user):
    SystemNotification.objects.create(
        recipient=user,
        notification_type="payment",
        title="Payment 1",
        is_read=False,
    )
    SystemNotification.objects.create(
        recipient=user,
        notification_type="stock",
        title="Stock alert",
        is_read=False,
    )
    response = authenticated_client.post(
        NOTIFICATION_MARK_ALL_READ_URL,
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["marked_read"] == 2
    assert not SystemNotification.objects.filter(is_read=False).exists()


def test_mark_all_as_read_when_none_unread(authenticated_client):
    response = authenticated_client.post(
        NOTIFICATION_MARK_ALL_READ_URL,
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["marked_read"] == 0


# --- Unauthenticated access denied (403) ---


def test_unauthenticated_list_notifications_denied(client):
    response = client.get(NOTIFICATION_LIST_URL)
    assert response.status_code == 403


def test_unauthenticated_mark_read_denied(client):
    url = f"{NOTIFICATION_LIST_URL}00000000-0000-0000-0000-000000000000/read/"
    response = client.patch(
        url,
        data={"is_read": True},
        content_type="application/json",
    )
    assert response.status_code == 403


def test_unauthenticated_mark_all_read_denied(client):
    response = client.post(
        NOTIFICATION_MARK_ALL_READ_URL,
        content_type="application/json",
    )
    assert response.status_code == 403
