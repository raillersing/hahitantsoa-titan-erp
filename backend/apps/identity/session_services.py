"""
Business services for tracking multi-device user sessions, detecting concurrent usage,
throttling activity updates, and safely revoking active sessions.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.identity.authorization import is_identity_admin_actor
from apps.identity.device_detector import detect_client_device
from apps.identity.models import UserDeviceSession

logger = logging.getLogger(__name__)

SESSION_REVOKE_ACTION = "identity.session.revoke"
SESSION_REVOKE_OTHERS_ACTION = "identity.session.revoke_others"
CONCURRENT_THRESHOLD_MINUTES = 15
TOUCH_THROTTLE_SECONDS = 60


def record_device_session_login(*, request: Any, user: Any) -> UserDeviceSession:
    """
    Records or updates a UserDeviceSession upon successful login.
    """
    if not request.session.session_key:
        request.session.save()

    session_key = request.session.session_key
    device_info = detect_client_device(request.META)
    now = timezone.now()

    with transaction.atomic():
        session_obj, created = UserDeviceSession.objects.select_for_update().get_or_create(
            session_key=session_key,
            defaults={
                "user": user,
                "ip_address": device_info["ip_address"],
                "user_agent": device_info["user_agent"],
                "device_type": device_info["device_type"],
                "device_name": device_info["device_name"],
                "os_name": device_info["os_name"],
                "browser_name": device_info["browser_name"],
                "client_platform": device_info["client_platform"],
                "logged_in_at": now,
                "last_seen_at": now,
                "is_active": True,
            },
        )
        if not created:
            session_obj.user = user
            session_obj.ip_address = device_info["ip_address"]
            session_obj.user_agent = device_info["user_agent"]
            session_obj.device_type = device_info["device_type"]
            session_obj.device_name = device_info["device_name"]
            session_obj.os_name = device_info["os_name"]
            session_obj.browser_name = device_info["browser_name"]
            session_obj.client_platform = device_info["client_platform"]
            session_obj.last_seen_at = now
            session_obj.is_active = True
            session_obj.revoked_at = None
            session_obj.revoked_by = None
            session_obj.revocation_reason = ""
            session_obj.save()

    return session_obj


def record_device_session_logout(*, request: Any) -> None:
    """
    Marks the UserDeviceSession inactive when the user explicitly logs out.
    """
    session_key = getattr(request.session, "session_key", None)
    if not session_key:
        return

    now = timezone.now()
    UserDeviceSession.objects.filter(session_key=session_key, is_active=True).update(
        is_active=False,
        revoked_at=now,
        revocation_reason="user_logout",
    )


def check_session_revocation_and_touch(*, request: Any, user: Any, session_key: str) -> bool:
    """
    Checks if a session has been revoked. If active, throttles the update
    of `last_seen_at` to avoid high database write volume.
    Returns True if the session is revoked (should be terminated immediately).
    """
    now = timezone.now()
    session_obj = (
        UserDeviceSession.objects.filter(session_key=session_key)
        .only("id", "is_active", "last_seen_at", "user_id")
        .first()
    )

    if session_obj is None:
        # Self-healing: if session wasn't recorded, record it now
        device_info = detect_client_device(request.META)
        try:
            UserDeviceSession.objects.create(
                user=user,
                session_key=session_key,
                ip_address=device_info["ip_address"],
                user_agent=device_info["user_agent"],
                device_type=device_info["device_type"],
                device_name=device_info["device_name"],
                os_name=device_info["os_name"],
                browser_name=device_info["browser_name"],
                client_platform=device_info["client_platform"],
                logged_in_at=now,
                last_seen_at=now,
                is_active=True,
            )
        except Exception as exc:
            logger.warning("Could not auto-create missing UserDeviceSession: %s", exc)
        return False

    if not session_obj.is_active:
        return True

    # Throttled update of last_seen_at: at most once every 60 seconds
    delta = (now - session_obj.last_seen_at).total_seconds()
    if delta >= TOUCH_THROTTLE_SECONDS:
        UserDeviceSession.objects.filter(pk=session_obj.pk).update(last_seen_at=now)

    return False


def revoke_session_by_id(
    *, session_id: str, actor: Any, reason: str = "admin_revocation"
) -> UserDeviceSession:
    """
    Revokes an active UserDeviceSession and invalidates the Django Session.
    Authorized if actor is identity admin OR the owner of the session.
    """
    with transaction.atomic():
        try:
            device_session = UserDeviceSession.objects.select_for_update().get(pk=session_id)
        except UserDeviceSession.DoesNotExist as exc:
            raise ValueError(f"Session with id '{session_id}' not found.") from exc

        # Permission check
        is_owner = str(device_session.user_id) == str(actor.pk)
        is_admin = is_identity_admin_actor(actor=actor)
        if not (is_owner or is_admin):
            raise PermissionError("Actor is not authorized to revoke this session.")

        if not device_session.is_active:
            return device_session

        now = timezone.now()
        device_session.is_active = False
        device_session.revoked_at = now
        device_session.revoked_by = actor
        device_session.revocation_reason = reason if not is_owner else "user_remote_disconnect"
        device_session.save(
            update_fields=[
                "is_active",
                "revoked_at",
                "revoked_by",
                "revocation_reason",
                "updated_at",
            ]
        )

        # Invalidate the Django Session row in database
        Session.objects.filter(session_key=device_session.session_key).delete()

        AuditEvent.objects.create(
            actor_id=actor.pk,
            action=SESSION_REVOKE_ACTION,
            target_type="UserDeviceSession",
            target_id=str(device_session.pk),
            metadata={
                "target_user_id": str(device_session.user_id),
                "target_username": device_session.user.username,
                "session_key": device_session.session_key,
                "device_name": device_session.device_name,
                "ip_address": device_session.ip_address,
                "revoked_by_id": str(actor.pk),
                "reason": device_session.revocation_reason,
            },
        )

    return device_session


def revoke_all_other_sessions(*, user: Any, current_session_key: str, actor: Any) -> int:
    """
    Revokes all active sessions for a user EXCEPT the current session.
    """
    with transaction.atomic():
        other_sessions = list(
            UserDeviceSession.objects.select_for_update()
            .filter(user=user, is_active=True)
            .exclude(session_key=current_session_key)
        )
        if not other_sessions:
            return 0

        now = timezone.now()
        session_keys_to_delete = [s.session_key for s in other_sessions]

        UserDeviceSession.objects.filter(pk__in=[s.pk for s in other_sessions]).update(
            is_active=False,
            revoked_at=now,
            revoked_by=actor,
            revocation_reason="revoke_others",
            updated_at=now,
        )

        # Invalidate Django Session rows
        Session.objects.filter(session_key__in=session_keys_to_delete).delete()

        AuditEvent.objects.create(
            actor_id=actor.pk,
            action=SESSION_REVOKE_OTHERS_ACTION,
            target_type="user",
            target_id=str(user.pk),
            metadata={
                "user_id": str(user.pk),
                "username": user.username,
                "revoked_count": len(other_sessions),
                "current_session_key": current_session_key,
            },
        )

        return len(other_sessions)


def get_user_concurrent_status(
    *, user: Any, threshold_minutes: int = CONCURRENT_THRESHOLD_MINUTES
) -> dict[str, Any]:
    """
    Calculates active sessions and concurrent usage status for a user.
    """
    cutoff = timezone.now() - timedelta(minutes=threshold_minutes)
    active_qs = UserDeviceSession.objects.filter(
        user=user,
        is_active=True,
        last_seen_at__gte=cutoff,
    ).order_by("-last_seen_at")

    active_count = active_qs.count()
    device_names = list(active_qs.values_list("device_name", flat=True)[:5])

    return {
        "active_sessions_count": active_count,
        "has_concurrent_sessions": active_count > 1,
        "active_devices": device_names,
    }


def get_all_concurrent_users_summary(
    threshold_minutes: int = CONCURRENT_THRESHOLD_MINUTES,
) -> list[dict[str, Any]]:
    """
    Identifies all users who currently have 2 or more active/online sessions across devices.
    """
    cutoff = timezone.now() - timedelta(minutes=threshold_minutes)
    active_sessions = (
        UserDeviceSession.objects.filter(is_active=True, last_seen_at__gte=cutoff)
        .select_related("user")
        .order_by("user_id", "-last_seen_at")
    )

    sessions_by_user: dict[str, list[UserDeviceSession]] = {}
    for s in active_sessions:
        uid = str(s.user_id)
        sessions_by_user.setdefault(uid, []).append(s)

    concurrent_users = []

    for uid, sessions in sessions_by_user.items():
        if len(sessions) > 1:
            first = sessions[0]
            user = first.user
            get_full_name = getattr(user, "get_full_name", lambda: "")
            get_username = getattr(user, "get_username", lambda: getattr(user, "username", ""))
            display_name = get_full_name().strip() or get_username()

            concurrent_users.append(
                {
                    "user_id": uid,
                    "username": get_username(),
                    "display_name": display_name,
                    "active_devices_count": len(sessions),
                    "devices": [f"{s.device_name} ({s.os_name})" for s in sessions],
                }
            )

    return concurrent_users
