from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from math import ceil

from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from apps.audit.models import AuditEvent
from apps.identity.models import LoginAttemptBucket

LOGIN_FAILURE_ACTION = "identity.login_failed"
LOGIN_SUCCESS_ACTION = "identity.login_succeeded"
LOGOUT_ACTION = "identity.logout_succeeded"
LOGOUT_STARTED_ACTION = "identity.logout_started"
LOGIN_ACCOUNT_ATTEMPT_LIMIT = 10
LOGIN_ACCOUNT_PEER_ATTEMPT_LIMIT = 5
LOGIN_TRANSPORT_PEER_ATTEMPT_LIMIT = 100
LOGIN_EXPIRED_BUCKET_PURGE_BATCH_SIZE = 100
LOGIN_ATTEMPT_WINDOW = timedelta(minutes=5)


@dataclass(frozen=True)
class LoginThrottleKeys:
    account: str
    account_peer: str
    transport_peer: str


class _LoginThrottleRejected(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after
        super().__init__(retry_after)


def login_throttle_keys(*, username: str, remote_address: str) -> LoginThrottleKeys:
    # Match Django's default username lookup semantics; do not merge case-distinct accounts.
    normalized_username = username.strip()
    normalized_address = remote_address.strip() or "unknown"
    account_key = salted_hmac(
        "identity.login-throttle.account",
        normalized_username,
    ).hexdigest()
    account_peer_key = salted_hmac(
        "identity.login-throttle.pair",
        f"{normalized_username}\0{normalized_address}",
    ).hexdigest()
    transport_peer_key = salted_hmac(
        "identity.login-throttle.transport-peer",
        normalized_address,
    ).hexdigest()
    return LoginThrottleKeys(
        account=account_key,
        account_peer=account_peer_key,
        transport_peer=transport_peer_key,
    )


def consume_login_attempt(*, keys: LoginThrottleKeys) -> int | None:
    """Atomically rate-limit all login attempts, including successful ones."""

    now = timezone.now()
    specifications = sorted(
        (
            (keys.account, LoginAttemptBucket.Dimension.ACCOUNT, LOGIN_ACCOUNT_ATTEMPT_LIMIT),
            (
                keys.account_peer,
                LoginAttemptBucket.Dimension.ACCOUNT_PEER,
                LOGIN_ACCOUNT_PEER_ATTEMPT_LIMIT,
            ),
            (
                keys.transport_peer,
                LoginAttemptBucket.Dimension.TRANSPORT_PEER,
                LOGIN_TRANSPORT_PEER_ATTEMPT_LIMIT,
            ),
        ),
        key=lambda specification: specification[0],
    )

    with transaction.atomic():
        # ponytail: keep cleanup indexed and bounded on the public request path.
        expired_keys = list(
            LoginAttemptBucket.objects.filter(expires_at__lte=now)
            .order_by("expires_at")
            .values_list("key", flat=True)[:LOGIN_EXPIRED_BUCKET_PURGE_BATCH_SIZE]
        )
        if expired_keys:
            LoginAttemptBucket.objects.filter(key__in=expired_keys).delete()
        try:
            with transaction.atomic():
                locked_buckets: list[tuple[LoginAttemptBucket, int]] = []
                for key, dimension, limit in specifications:
                    bucket, created = LoginAttemptBucket.objects.get_or_create(
                        key=key,
                        defaults={
                            "dimension": dimension,
                            "window_started_at": now,
                            "expires_at": now + LOGIN_ATTEMPT_WINDOW,
                        },
                    )
                    if not created:
                        bucket = LoginAttemptBucket.objects.select_for_update().get(pk=key)
                    if bucket.expires_at <= now:
                        bucket.attempt_count = 0
                        bucket.window_started_at = now
                        bucket.expires_at = now + LOGIN_ATTEMPT_WINDOW
                    locked_buckets.append((bucket, limit))

                blocked_until = [
                    bucket.expires_at
                    for bucket, limit in locked_buckets
                    if bucket.attempt_count >= limit
                ]
                if blocked_until:
                    retry_after = max(
                        1,
                        ceil((max(blocked_until) - now).total_seconds()),
                    )
                    # Roll back auxiliary buckets created during a rejected reservation.
                    raise _LoginThrottleRejected(retry_after)

                for bucket, _limit in locked_buckets:
                    bucket.attempt_count += 1
                    bucket.save(
                        update_fields=(
                            "attempt_count",
                            "window_started_at",
                            "expires_at",
                            "updated_at",
                        )
                    )
        except _LoginThrottleRejected as rejection:
            return rejection.retry_after
    return None


def record_login_failure(*, keys: LoginThrottleKeys) -> None:
    AuditEvent.objects.create(
        actor=None,
        action=LOGIN_FAILURE_ACTION,
        target_type="authentication",
        target_id=keys.account,
        metadata={"account_peer_key": keys.account_peer},
    )


def record_login_success(*, user: object, keys: LoginThrottleKeys) -> None:
    AuditEvent.objects.create(
        actor_id=getattr(user, "pk"),
        action=LOGIN_SUCCESS_ACTION,
        target_type="user",
        target_id=str(getattr(user, "pk")),
        metadata={"throttle_account_key": keys.account},
    )


def record_logout_success(*, user: object) -> None:
    AuditEvent.objects.create(
        actor_id=getattr(user, "pk"),
        action=LOGOUT_ACTION,
        target_type="user",
        target_id=str(getattr(user, "pk")),
    )


def record_logout_started(*, user: object) -> None:
    AuditEvent.objects.create(
        actor_id=getattr(user, "pk"),
        action=LOGOUT_STARTED_ACTION,
        target_type="user",
        target_id=str(getattr(user, "pk")),
    )
