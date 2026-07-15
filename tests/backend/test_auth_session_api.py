import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from django.db import close_old_connections
from django.test import Client
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.identity import auth_views
from apps.identity.auth_services import (
    LOGIN_ACCOUNT_ATTEMPT_LIMIT,
    LOGIN_ACCOUNT_PEER_ATTEMPT_LIMIT,
    LOGIN_EXPIRED_BUCKET_PURGE_BATCH_SIZE,
    LOGIN_TRANSPORT_PEER_ATTEMPT_LIMIT,
    consume_login_attempt,
    login_throttle_keys,
)
from apps.identity.models import ApplicationRole, LoginAttemptBucket, UserRoleAssignment

pytestmark = pytest.mark.django_db

SESSION_URL = "/api/v1/auth/session/"
LOGIN_URL = "/api/v1/auth/login/"
LOGOUT_URL = "/api/v1/auth/logout/"


@pytest.fixture
def csrf_client() -> Client:
    return Client(enforce_csrf_checks=True)


def _csrf_token(client: Client) -> str:
    response = client.get(SESSION_URL)
    assert response.status_code == 200
    return client.cookies["csrftoken"].value


def _post_json(client: Client, path: str, payload: dict, csrf_token: str):
    return client.post(
        path,
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )


def test_session_bootstrap_is_anonymous_no_store_and_sets_csrf_cookie(csrf_client):
    response = csrf_client.get(SESSION_URL)

    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}
    assert response.headers["Cache-Control"] == "no-store"
    assert "csrftoken" in response.cookies


def test_session_returns_minimal_authenticated_user_and_sorted_active_roles(
    csrf_client,
    django_user_model,
):
    user = django_user_model.objects.create_user(
        username="session-operator",
        first_name="Ada",
        last_name="Operator",
    )
    active_role = ApplicationRole.objects.create(name="Commercial", slug="commercial")
    second_role = ApplicationRole.objects.create(name="Direction", slug="direction")
    inactive_role = ApplicationRole.objects.create(
        name="Inactive",
        slug="inactive",
        is_active=False,
    )
    UserRoleAssignment.objects.create(user=user, role=second_role)
    UserRoleAssignment.objects.create(user=user, role=active_role)
    UserRoleAssignment.objects.create(user=user, role=inactive_role)
    csrf_client.force_login(user)

    response = csrf_client.get(SESSION_URL)

    assert response.status_code == 200
    assert response.json() == {
        "authenticated": True,
        "user": {
            "id": str(user.pk),
            "username": "session-operator",
            "display_name": "Ada Operator",
            "is_staff": False,
            "roles": ["commercial", "direction"],
        },
    }


def test_login_requires_csrf(csrf_client, django_user_model):
    django_user_model.objects.create_user(username="login-csrf-user", password="test-pass")

    response = csrf_client.post(
        LOGIN_URL,
        data=json.dumps({"username": "login-csrf-user", "password": "test-pass"}),
        content_type="application/json",
    )

    assert response.status_code == 403
    assert response.headers["Content-Type"] == "application/json"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {
        "detail": "CSRF verification failed.",
        "code": "csrf_failed",
    }
    assert "_auth_user_id" not in csrf_client.session


def test_login_creates_session_and_returns_user_without_credentials(
    csrf_client,
    django_user_model,
):
    user = django_user_model.objects.create_user(
        username="login-user",
        password="test-pass",
    )
    token = _csrf_token(csrf_client)

    response = _post_json(
        csrf_client,
        LOGIN_URL,
        {"username": "login-user", "password": "test-pass"},
        token,
    )

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["user"]["id"] == str(user.pk)
    assert response.json()["authenticated"] is True
    assert "password" not in response.json()["user"]
    assert "token" not in response.json()["user"]
    assert csrf_client.session["_auth_user_id"] == str(user.pk)
    audit_event = AuditEvent.objects.get(action="identity.login_succeeded")
    assert audit_event.actor == user
    assert audit_event.target_id == str(user.pk)


def test_login_rotates_session_and_csrf_tokens(csrf_client, django_user_model):
    django_user_model.objects.create_user(username="rotation-user", password="test-pass")
    csrf_client.cookies["sessionid"] = "attacker-controlled-session-key"
    csrf_token = _csrf_token(csrf_client)
    session_key_before_login = csrf_client.cookies["sessionid"].value

    response = _post_json(
        csrf_client,
        LOGIN_URL,
        {"username": "rotation-user", "password": "test-pass"},
        csrf_token,
    )

    assert response.status_code == 200
    assert csrf_client.cookies["sessionid"].value != session_key_before_login
    assert csrf_client.cookies["csrftoken"].value != csrf_token

    rejected_logout = csrf_client.post(LOGOUT_URL, HTTP_X_CSRFTOKEN=csrf_token)
    assert rejected_logout.status_code == 403
    assert csrf_client.session["_auth_user_id"]

    current_token = csrf_client.cookies["csrftoken"].value
    accepted_logout = csrf_client.post(LOGOUT_URL, HTTP_X_CSRFTOKEN=current_token)
    assert accepted_logout.status_code == 204


def test_login_audit_failure_compensates_by_removing_session(
    csrf_client,
    django_user_model,
    monkeypatch,
):
    django_user_model.objects.create_user(username="audit-failure-user", password="test-pass")
    token = _csrf_token(csrf_client)
    csrf_client.raise_request_exception = False

    def reject_audit(**_kwargs):
        raise RuntimeError("synthetic audit failure")

    monkeypatch.setattr(auth_views, "record_login_success", reject_audit)

    response = _post_json(
        csrf_client,
        LOGIN_URL,
        {"username": "audit-failure-user", "password": "test-pass"},
        token,
    )

    assert response.status_code == 500
    assert "_auth_user_id" not in csrf_client.session
    assert not AuditEvent.objects.filter(action="identity.login_succeeded").exists()


def test_login_rejects_inactive_user(csrf_client, django_user_model):
    django_user_model.objects.create_user(
        username="inactive-user",
        password="test-pass",
        is_active=False,
    )
    token = _csrf_token(csrf_client)

    response = _post_json(
        csrf_client,
        LOGIN_URL,
        {"username": "inactive-user", "password": "test-pass"},
        token,
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Unable to log in with the provided credentials.",
        "code": "invalid_credentials",
    }
    assert "_auth_user_id" not in csrf_client.session


def test_login_rejects_invalid_credentials_with_stable_generic_error(
    csrf_client,
    django_user_model,
):
    django_user_model.objects.create_user(username="invalid-login-user", password="test-pass")
    token = _csrf_token(csrf_client)

    response = _post_json(
        csrf_client,
        LOGIN_URL,
        {"username": "invalid-login-user", "password": "not-the-password"},
        token,
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Unable to log in with the provided credentials.",
        "code": "invalid_credentials",
    }
    assert response.headers["Cache-Control"] == "no-store"
    assert "_auth_user_id" not in csrf_client.session
    failure = AuditEvent.objects.get(action="identity.login_failed")
    assert failure.actor is None
    assert failure.target_type == "authentication"
    assert "invalid-login-user" not in failure.target_id
    assert "invalid-login-user" not in str(failure.metadata)


def test_login_throttles_repeated_failures_with_shared_audit_state(
    csrf_client,
    django_user_model,
):
    django_user_model.objects.create_user(username="throttled-user", password="test-pass")
    token = _csrf_token(csrf_client)

    for _ in range(5):
        response = _post_json(
            csrf_client,
            LOGIN_URL,
            {"username": "throttled-user", "password": "wrong-pass"},
            token,
        )
        assert response.status_code == 400

    throttled = _post_json(
        csrf_client,
        LOGIN_URL,
        {"username": "throttled-user", "password": "test-pass"},
        token,
    )

    assert throttled.status_code == 429
    assert throttled.json() == {
        "detail": "Too many login attempts. Try again later.",
        "code": "login_throttled",
    }
    assert int(throttled.headers["Retry-After"]) >= 1
    assert throttled.headers["Cache-Control"] == "no-store"
    assert "_auth_user_id" not in csrf_client.session


@pytest.mark.django_db(transaction=True)
def test_login_throttle_reservation_is_atomic_under_concurrency():
    keys = login_throttle_keys(username="parallel-user", remote_address="192.0.2.10")
    worker_count = 12
    start_together = Barrier(worker_count)

    def reserve_attempt():
        close_old_connections()
        try:
            start_together.wait()
            return consume_login_attempt(keys=keys)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        results = list(executor.map(lambda _index: reserve_attempt(), range(worker_count)))

    assert results.count(None) == LOGIN_ACCOUNT_PEER_ATTEMPT_LIMIT
    assert sum(result is not None for result in results) == 7
    assert LoginAttemptBucket.objects.get(pk=keys.account_peer).attempt_count == 5


def test_login_throttle_limits_distributed_peers_for_one_account():
    username = "distributed-target"

    for peer_number in range(LOGIN_ACCOUNT_ATTEMPT_LIMIT):
        keys = login_throttle_keys(
            username=username,
            remote_address=f"192.0.2.{peer_number + 1}",
        )
        assert consume_login_attempt(keys=keys) is None

    blocked_keys = login_throttle_keys(username=username, remote_address="198.51.100.1")

    assert consume_login_attempt(keys=blocked_keys) is not None
    assert LoginAttemptBucket.objects.get(pk=blocked_keys.account).attempt_count == 10


def test_login_throttle_limits_one_transport_peer_across_many_accounts():
    remote_address = "192.0.2.200"

    for account_number in range(LOGIN_TRANSPORT_PEER_ATTEMPT_LIMIT):
        keys = login_throttle_keys(
            username=f"spray-target-{account_number}",
            remote_address=remote_address,
        )
        assert consume_login_attempt(keys=keys) is None

    blocked_keys = login_throttle_keys(username="next-target", remote_address=remote_address)

    assert consume_login_attempt(keys=blocked_keys) is not None
    assert LoginAttemptBucket.objects.get(pk=blocked_keys.transport_peer).attempt_count == 100
    bucket_count_at_limit = LoginAttemptBucket.objects.count()

    for blocked_number in range(20):
        rejected_keys = login_throttle_keys(
            username=f"blocked-spray-{blocked_number}",
            remote_address=remote_address,
        )
        assert consume_login_attempt(keys=rejected_keys) is not None

    assert LoginAttemptBucket.objects.count() == bucket_count_at_limit


def test_login_throttle_resets_expired_window_and_returns_exact_bucket_retry():
    keys = login_throttle_keys(username="window-user", remote_address="192.0.2.50")
    assert consume_login_attempt(keys=keys) is None
    LoginAttemptBucket.objects.filter(pk=keys.account_peer).update(
        attempt_count=LOGIN_ACCOUNT_PEER_ATTEMPT_LIMIT,
        expires_at=timezone.now() + timedelta(seconds=20),
    )

    retry_after = consume_login_attempt(keys=keys)

    assert retry_after is not None
    assert 15 <= retry_after <= 20

    LoginAttemptBucket.objects.filter(pk=keys.account_peer).update(
        expires_at=timezone.now() - timedelta(seconds=1),
    )

    assert consume_login_attempt(keys=keys) is None
    assert LoginAttemptBucket.objects.get(pk=keys.account_peer).attempt_count == 1


def test_login_throttle_buckets_do_not_store_identifiers_in_clear():
    keys = login_throttle_keys(username="private-account", remote_address="203.0.113.9")

    assert consume_login_attempt(keys=keys) is None

    persisted = " ".join(
        f"{bucket.key} {bucket.dimension}" for bucket in LoginAttemptBucket.objects.all()
    )
    assert "private-account" not in persisted
    assert "203.0.113.9" not in persisted


def test_login_throttle_preserves_django_case_sensitive_username_semantics():
    uppercase = login_throttle_keys(username="Alice", remote_address="203.0.113.11")
    lowercase = login_throttle_keys(username="alice", remote_address="203.0.113.11")

    assert uppercase.account != lowercase.account
    assert uppercase.account_peer != lowercase.account_peer
    assert uppercase.transport_peer == lowercase.transport_peer


def test_login_throttle_purges_expired_unrelated_buckets():
    expired_count = LOGIN_EXPIRED_BUCKET_PURGE_BATCH_SIZE + 1
    LoginAttemptBucket.objects.bulk_create(
        [
            LoginAttemptBucket(
                key=f"{index:064x}",
                dimension=LoginAttemptBucket.Dimension.ACCOUNT,
                attempt_count=1,
                window_started_at=timezone.now() - timedelta(minutes=10),
                expires_at=timezone.now() - timedelta(minutes=5),
            )
            for index in range(expired_count)
        ]
    )
    active_keys = login_throttle_keys(username="active-user", remote_address="203.0.113.10")

    assert consume_login_attempt(keys=active_keys) is None

    assert LoginAttemptBucket.objects.filter(expires_at__lte=timezone.now()).count() == 1


def test_logout_requires_csrf_and_keeps_session_when_rejected(csrf_client, django_user_model):
    user = django_user_model.objects.create_user(username="logout-csrf-user")
    csrf_client.force_login(user)
    csrf_client.get(SESSION_URL)

    response = csrf_client.post(LOGOUT_URL)

    assert response.status_code == 403
    assert response.headers["Content-Type"] == "application/json"
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json() == {
        "detail": "CSRF verification failed.",
        "code": "csrf_failed",
    }
    assert csrf_client.session["_auth_user_id"] == str(user.pk)


def test_logout_clears_session_and_is_idempotent(csrf_client, django_user_model):
    user = django_user_model.objects.create_user(username="logout-user")
    csrf_client.force_login(user)
    token = _csrf_token(csrf_client)
    csrf_before_logout = csrf_client.cookies["csrftoken"].value

    response = csrf_client.post(LOGOUT_URL, HTTP_X_CSRFTOKEN=token)

    assert response.status_code == 204
    assert response.content == b""
    assert response.headers["Cache-Control"] == "no-store"
    assert "_auth_user_id" not in csrf_client.session
    assert csrf_client.cookies["csrftoken"].value != csrf_before_logout
    assert AuditEvent.objects.filter(
        action="identity.logout_succeeded",
        actor=user,
        target_id=str(user.pk),
    ).exists()

    session_response = csrf_client.get(SESSION_URL)
    assert session_response.json() == {"authenticated": False, "user": None}

    token = _csrf_token(csrf_client)
    second_response = csrf_client.post(LOGOUT_URL, HTTP_X_CSRFTOKEN=token)
    assert second_response.status_code == 204


def test_logout_success_audit_failure_keeps_durable_started_event(
    csrf_client,
    django_user_model,
    monkeypatch,
):
    user = django_user_model.objects.create_user(username="logout-audit-failure-user")
    csrf_client.force_login(user)
    token = _csrf_token(csrf_client)
    csrf_client.raise_request_exception = False

    def reject_audit(**_kwargs):
        raise RuntimeError("synthetic audit failure")

    monkeypatch.setattr(auth_views, "record_logout_success", reject_audit)

    response = csrf_client.post(LOGOUT_URL, HTTP_X_CSRFTOKEN=token)

    assert response.status_code == 500
    assert "_auth_user_id" not in csrf_client.session
    assert AuditEvent.objects.filter(
        action="identity.logout_started",
        actor=user,
    ).exists()
    assert not AuditEvent.objects.filter(
        action="identity.logout_succeeded",
        actor=user,
    ).exists()


def test_logout_rejects_get(csrf_client):
    response = csrf_client.get(LOGOUT_URL)

    assert response.status_code == 405
