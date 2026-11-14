from __future__ import annotations

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.identity.device_detector import detect_client_device, extract_client_ip
from apps.identity.middleware import UserDeviceSessionActivityMiddleware
from apps.identity.models import ApplicationRole, DeviceType, UserDeviceSession, UserRoleAssignment
from apps.identity.session_services import (
    get_all_concurrent_users_summary,
    get_user_concurrent_status,
)

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def test_users():
    superadmin = User.objects.create_user(
        username="superadmin-user",
        password="test-password-123",
        is_staff=True,
    )
    admin_role, _ = ApplicationRole.objects.get_or_create(
        name="Super Administrateur",
        slug="superadmin",
        defaults={"is_system_managed": True},
    )
    UserRoleAssignment.objects.get_or_create(
        user=superadmin,
        role=admin_role,
        defaults={"is_active": True},
    )

    regular_user = User.objects.create_user(
        username="regular-collaborator",
        password="test-password-123",
        is_staff=False,
    )

    other_user = User.objects.create_user(
        username="other-collaborator",
        password="test-password-123",
        is_staff=False,
    )

    return {
        "superadmin": superadmin,
        "regular_user": regular_user,
        "other_user": other_user,
    }


# =====================================================================
# 1. Device Detector Tests
# =====================================================================


def test_device_detector_macbook():
    meta = {
        "HTTP_USER_AGENT": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.4 Safari/605.1.15"
        ),
        "HTTP_SEC_CH_UA_PLATFORM": '"macOS"',
        "REMOTE_ADDR": "192.168.1.100",
    }
    details = detect_client_device(meta)
    assert details["device_type"] == DeviceType.DESKTOP
    assert "MacBook" in details["device_name"] or "Mac" in details["device_name"]
    assert "macOS" in details["os_name"]
    assert "Safari" in details["browser_name"]
    assert details["ip_address"] == "192.168.1.100"


def test_device_detector_windows_pc():
    meta = {
        "HTTP_USER_AGENT": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80"
        ),
        "HTTP_SEC_CH_UA_PLATFORM": '"Windows"',
        "REMOTE_ADDR": "10.0.0.5",
    }
    details = detect_client_device(meta)
    assert details["device_type"] == DeviceType.DESKTOP
    assert details["device_name"] == "PC Windows"
    assert "Windows 10/11" in details["os_name"]
    assert "Edge 124" in details["browser_name"]
    assert details["ip_address"] == "10.0.0.5"


def test_device_detector_iphone():
    meta = {
        "HTTP_USER_AGENT": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1"
        ),
        "REMOTE_ADDR": "172.16.0.42",
    }
    details = detect_client_device(meta)
    assert details["device_type"] == DeviceType.MOBILE
    assert details["device_name"] == "iPhone"
    assert "iOS 17.4.1" in details["os_name"]
    assert "Safari" in details["browser_name"]


def test_device_detector_ipad():
    meta = {
        "HTTP_USER_AGENT": (
            "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        ),
        "REMOTE_ADDR": "172.16.0.43",
    }
    details = detect_client_device(meta)
    assert details["device_type"] == DeviceType.TABLET
    assert details["device_name"] == "iPad"
    assert "iOS 17.4" in details["os_name"]


def test_device_detector_android_samsung():
    meta = {
        "HTTP_USER_AGENT": (
            "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        ),
        "HTTP_SEC_CH_UA_MODEL": '"SM-S928B"',
        "REMOTE_ADDR": "192.168.1.150",
    }
    details = detect_client_device(meta)
    assert details["device_type"] == DeviceType.MOBILE
    assert "Samsung Galaxy (SM-S928B)" in details["device_name"]
    assert "Android 14" in details["os_name"]
    assert "Chrome 124" in details["browser_name"]


def test_device_detector_linux_firefox():
    meta = {
        "HTTP_USER_AGENT": (
            "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0"
        ),
        "REMOTE_ADDR": "192.168.1.200",
    }
    details = detect_client_device(meta)
    assert details["device_type"] == DeviceType.DESKTOP
    assert details["device_name"] == "Poste Linux"
    assert "Ubuntu Linux" in details["os_name"]
    assert "Firefox 125" in details["browser_name"]


def test_extract_client_ip_forwarded_for():
    meta = {
        "HTTP_X_FORWARDED_FOR": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        "REMOTE_ADDR": "10.0.0.1",
    }
    assert extract_client_ip(meta) == "203.0.113.195"


def test_extract_client_ip_fallback_invalid():
    meta = {
        "HTTP_X_FORWARDED_FOR": "invalid-ip-string",
        "REMOTE_ADDR": "also-invalid",
    }
    assert extract_client_ip(meta) == "127.0.0.1"


# =====================================================================
# 2. Login, Activity & Logout Session Tracking Tests
# =====================================================================


def test_login_and_logout_tracks_device_session(test_users):
    client = APIClient(enforce_csrf_checks=False)
    user = test_users["regular_user"]

    # 1. Login
    login_res = client.post(
        "/api/v1/auth/login/",
        {"username": user.username, "password": "test-password-123"},
        format="json",
        HTTP_USER_AGENT=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/17.4"
        ),
        REMOTE_ADDR="192.168.1.55",
    )
    assert login_res.status_code == status.HTTP_200_OK

    session_obj = UserDeviceSession.objects.filter(user=user, is_active=True).first()
    assert session_obj is not None
    assert session_obj.device_type == DeviceType.DESKTOP
    assert session_obj.ip_address == "192.168.1.55"
    assert "macOS" in session_obj.os_name
    assert session_obj.is_active is True

    # 2. Logout
    logout_res = client.post("/api/v1/auth/logout/")
    assert logout_res.status_code == status.HTTP_204_NO_CONTENT

    session_obj.refresh_from_db()
    assert session_obj.is_active is False
    assert session_obj.revocation_reason == "user_logout"
    assert session_obj.revoked_at is not None


def test_middleware_blocks_remotely_revoked_session(test_users):
    rf = RequestFactory()
    user = test_users["regular_user"]

    # Create active session in Django Session and UserDeviceSession
    session_engine = __import__(
        "django.contrib.sessions.backends.db", fromlist=["SessionStore"]
    ).SessionStore()
    session_engine["_auth_user_id"] = str(user.pk)
    session_engine.save()

    device_session = UserDeviceSession.objects.create(
        user=user,
        session_key=session_engine.session_key,
        device_name="Test Device",
        device_type=DeviceType.DESKTOP,
        ip_address="127.0.0.1",
        is_active=True,
    )

    # Simulate normal request passing through middleware
    request = rf.get("/api/v1/identity/sessions/me/")
    request.user = user
    request.session = session_engine

    called = False

    def get_response(req):
        nonlocal called
        called = True
        from django.http import HttpResponse

        return HttpResponse("OK")

    middleware = UserDeviceSessionActivityMiddleware(get_response)
    resp = middleware(request)
    assert called is True
    assert resp.status_code == 200

    # Now revoke session remotely
    device_session.is_active = False
    device_session.revoked_at = timezone.now()
    device_session.revocation_reason = "remote_admin"
    device_session.save()

    # Next request should be intercepted and return 401
    called = False
    resp_revoked = middleware(request)
    assert called is False
    assert resp_revoked.status_code == 401
    assert b"session_revoked" in resp_revoked.content


# =====================================================================
# 3. Concurrent Sessions Detection & Admin List API Tests
# =====================================================================


def test_concurrent_sessions_detection(test_users):
    user = test_users["regular_user"]
    now = timezone.now()

    # Session 1 on MacBook (online)
    UserDeviceSession.objects.create(
        user=user,
        session_key="session-key-1",
        device_name="MacBook Pro",
        device_type=DeviceType.DESKTOP,
        os_name="macOS",
        ip_address="192.168.1.10",
        logged_in_at=now - timedelta(minutes=5),
        last_seen_at=now - timedelta(minutes=2),
        is_active=True,
    )

    # Single session -> no concurrent sessions
    status_single = get_user_concurrent_status(user=user)
    assert status_single["has_concurrent_sessions"] is False
    assert status_single["active_sessions_count"] == 1

    # Session 2 on iPhone (online simultaneously)
    UserDeviceSession.objects.create(
        user=user,
        session_key="session-key-2",
        device_name="iPhone 15",
        device_type=DeviceType.MOBILE,
        os_name="iOS 17.4",
        ip_address="192.168.1.50",
        logged_in_at=now - timedelta(minutes=3),
        last_seen_at=now - timedelta(minutes=1),
        is_active=True,
    )

    # Multi-device concurrent status
    status_multi = get_user_concurrent_status(user=user)
    assert status_multi["has_concurrent_sessions"] is True
    assert status_multi["active_sessions_count"] == 2
    assert "MacBook Pro" in status_multi["active_devices"]
    assert "iPhone 15" in status_multi["active_devices"]

    # Global summary check
    summary = get_all_concurrent_users_summary()
    assert len(summary) >= 1
    found = next((row for row in summary if row["user_id"] == str(user.pk)), None)
    assert found is not None
    assert found["active_devices_count"] == 2


def test_admin_sessions_list_endpoint(test_users):
    admin_client = APIClient()
    admin_client.force_authenticate(user=test_users["superadmin"])

    # Create sessions for regular user
    user = test_users["regular_user"]
    s1 = UserDeviceSession.objects.create(
        user=user,
        session_key="admin-test-1",
        device_name="PC Windows Bureau",
        device_type=DeviceType.DESKTOP,
        os_name="Windows 11",
        ip_address="192.168.1.22",
        is_active=True,
    )
    s2 = UserDeviceSession.objects.create(
        user=user,
        session_key="admin-test-2",
        device_name="iPhone 15 Perso",
        device_type=DeviceType.MOBILE,
        os_name="iOS 17",
        ip_address="192.168.1.23",
        is_active=True,
    )

    # GET /api/v1/identity/sessions/ as admin
    res = admin_client.get("/api/v1/identity/sessions/")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "total_active_sessions" in data
    assert "users_with_concurrent_sessions" in data
    assert "results" in data
    assert any(s["id"] == str(s1.pk) for s in data["results"])

    # Search filter
    search_res = admin_client.get("/api/v1/identity/sessions/?search=iPhone")
    assert search_res.status_code == status.HTTP_200_OK
    assert any(s["id"] == str(s2.pk) for s in search_res.json()["results"])

    # Non-admin access denied
    reg_client = APIClient()
    reg_client.force_authenticate(user=test_users["regular_user"])
    forbidden_res = reg_client.get("/api/v1/identity/sessions/")
    assert forbidden_res.status_code == status.HTTP_403_FORBIDDEN


# =====================================================================
# 4. Personal Sessions and Remote Revocation Tests
# =====================================================================


def test_personal_sessions_and_revoke_others(test_users):
    user = test_users["regular_user"]
    client = APIClient()
    client.force_authenticate(user=user)

    # Create 3 sessions for user
    s_current = UserDeviceSession.objects.create(
        user=user,
        session_key="current-dev-key",
        device_name="MacBook Actuel",
        device_type=DeviceType.DESKTOP,
        is_active=True,
    )
    s_other1 = UserDeviceSession.objects.create(
        user=user,
        session_key="other-key-1",
        device_name="PC Maison",
        device_type=DeviceType.DESKTOP,
        is_active=True,
    )
    s_other2 = UserDeviceSession.objects.create(
        user=user,
        session_key="other-key-2",
        device_name="Mobile Safari",
        device_type=DeviceType.MOBILE,
        is_active=True,
    )

    # Set mock current session key on client
    session_engine = client.session
    session_engine["test"] = 1
    session_engine.save()
    s_current.session_key = session_engine.session_key
    s_current.save()

    # GET /api/v1/identity/sessions/me/
    res_me = client.get("/api/v1/identity/sessions/me/")
    assert res_me.status_code == status.HTTP_200_OK
    data_me = res_me.json()
    assert data_me["has_concurrent_sessions"] is True
    assert data_me["active_sessions_count"] == 3
    assert data_me["current_session_id"] == str(s_current.pk)

    # POST /api/v1/identity/sessions/revoke-others/
    res_revoke_others = client.post("/api/v1/identity/sessions/revoke-others/")
    assert res_revoke_others.status_code == status.HTTP_200_OK
    assert res_revoke_others.json()["revoked_count"] == 2

    s_current.refresh_from_db()
    s_other1.refresh_from_db()
    s_other2.refresh_from_db()

    assert s_current.is_active is True
    assert s_other1.is_active is False
    assert s_other2.is_active is False


def test_revoke_single_session_permissions(test_users):
    user = test_users["regular_user"]
    other_user = test_users["other_user"]
    admin = test_users["superadmin"]

    session_to_revoke = UserDeviceSession.objects.create(
        user=user,
        session_key="test-key-rev",
        device_name="iPad Tablet",
        device_type=DeviceType.TABLET,
        is_active=True,
    )

    # 1. Other regular user cannot revoke user's session
    other_client = APIClient()
    other_client.force_authenticate(user=other_user)
    res_forbidden = other_client.post(f"/api/v1/identity/sessions/{session_to_revoke.pk}/revoke/")
    assert res_forbidden.status_code == status.HTTP_403_FORBIDDEN

    # 2. Admin can revoke session
    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)
    res_admin = admin_client.post(
        f"/api/v1/identity/sessions/{session_to_revoke.pk}/revoke/",
        {"reason": "suspicious_activity"},
        format="json",
    )
    assert res_admin.status_code == status.HTTP_200_OK
    assert res_admin.json()["is_active"] is False

    session_to_revoke.refresh_from_db()
    assert session_to_revoke.is_active is False
    assert session_to_revoke.revoked_by == admin
    assert session_to_revoke.revocation_reason == "suspicious_activity"

    # AuditEvent logged
    audit = AuditEvent.objects.filter(
        target_id=str(session_to_revoke.pk),
        action="identity.session.revoke",
    ).first()
    assert audit is not None
    assert audit.actor_id == admin.pk
