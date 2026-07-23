from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from django.utils import timezone

from apps.cashbox.models import CashboxSession
from apps.finance.models import FinanceAccountKind, FinanceBusinessScope
from apps.finance.services import create_finance_account
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db

CASHBOX_SESSION_LIST_URL = "/api/v1/cashbox/sessions/"
CASHBOX_MOVEMENT_LIST_URL = "/api/v1/cashbox/movements/"


def test_cashbox_legacy_close_route_keeps_its_public_name() -> None:
    session_id = uuid4()
    assert reverse("cashbox-session-close", kwargs={"id": session_id}) == (
        f"/api/v1/cashbox/sessions/{session_id}/close/"
    )


def _cash_account(user, code="API-TILL"):
    return create_finance_account(
        actor=user,
        business_scope=FinanceBusinessScope.TITAN,
        code=code,
        label=code,
        kind=FinanceAccountKind.CASH,
    )


def _grant_supervisor(user):
    role, _ = ApplicationRole.objects.get_or_create(
        slug=IdentityRole.CASHBOX_SUPERVISOR,
        defaults={"name": "Cashbox supervisor"},
    )
    UserRoleAssignment.objects.get_or_create(user=user, role=role)


@pytest.fixture
def sensitive_user():
    return get_user_model().objects.create_user(
        username="cashbox-sensitive-user", password="test-pass", is_staff=True
    )


@pytest.fixture
def sensitive_client(sensitive_user):
    client = Client()
    client.force_login(sensitive_user)
    return client


@pytest.fixture
def authenticated_client(client):
    user = get_user_model().objects.create_user(username="cashbox-read-user", password="test-pass")
    client.force_login(user)
    return client


def _open(client, user, *, amount="0.00", code="API-TILL"):
    account = _cash_account(user, code)
    response = client.post(
        f"{CASHBOX_SESSION_LIST_URL}open/",
        data={"operator": str(user.id), "cash_account": str(account.id), "opening_amount": amount},
        content_type="application/json",
    )
    assert response.status_code == 201, response.content
    return response.json()


def test_cashbox_session_open_requires_sensitive_access(authenticated_client, sensitive_user):
    account = _cash_account(sensitive_user, "AUTH-TILL")
    response = authenticated_client.post(
        f"{CASHBOX_SESSION_LIST_URL}open/",
        data={
            "operator": str(sensitive_user.id),
            "cash_account": str(account.id),
            "opening_amount": "0.00",
        },
        content_type="application/json",
    )
    assert response.status_code == 403


def test_cashbox_api_requires_cash_account_and_explicit_count_lifecycle(
    sensitive_client, sensitive_user
):
    assert (
        sensitive_client.post(
            f"{CASHBOX_SESSION_LIST_URL}open/",
            data={"operator": str(sensitive_user.id)},
            content_type="application/json",
        ).status_code
        == 400
    )
    session = _open(sensitive_client, sensitive_user, amount="100.00")
    session_id = session["id"]
    movement = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/movements/",
        data={"direction": "cash_in", "amount": "50.00"},
        content_type="application/json",
    )
    assert movement.status_code == 201
    submitted = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/submit-count/",
        data={"actual_amount": "150.00", "idempotency_key": "api-count-1"},
        content_type="application/json",
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "count_submitted"
    assert (
        sensitive_client.post(
            f"{CASHBOX_SESSION_LIST_URL}{session_id}/movements/",
            data={"direction": "cash_in", "amount": "1.00"},
            content_type="application/json",
        ).status_code
        == 400
    )
    assert (
        sensitive_client.post(
            f"{CASHBOX_SESSION_LIST_URL}{session_id}/validate-count/",
            data={"idempotency_key": "api-validate-1"},
            content_type="application/json",
        ).status_code
        == 403
    )
    _grant_supervisor(sensitive_user)
    validated = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/validate-count/",
        data={"idempotency_key": "api-validate-1"},
        content_type="application/json",
    )
    assert validated.status_code == 200
    assert validated.json()["status"] == "validated_closed"
    validation_replay = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/validate-count/",
        data={"idempotency_key": "api-validate-1"},
        content_type="application/json",
    )
    assert validation_replay.status_code == 200
    assert validation_replay.json()["status"] == "validated_closed"


def test_cashbox_api_reopen_requires_reason_and_is_idempotent(sensitive_client, sensitive_user):
    _grant_supervisor(sensitive_user)
    session = _open(sensitive_client, sensitive_user, code="REOPEN-TILL")
    session_id = session["id"]
    assert (
        sensitive_client.post(
            f"{CASHBOX_SESSION_LIST_URL}{session_id}/submit-count/",
            data={"actual_amount": "0.00", "idempotency_key": "reopen-count"},
            content_type="application/json",
        ).status_code
        == 200
    )
    assert (
        sensitive_client.post(
            f"{CASHBOX_SESSION_LIST_URL}{session_id}/validate-count/",
            data={"idempotency_key": "reopen-validate"},
            content_type="application/json",
        ).status_code
        == 200
    )
    assert (
        sensitive_client.post(
            f"{CASHBOX_SESSION_LIST_URL}{session_id}/reopen/",
            data={"reason": " ", "idempotency_key": "reopen-1"},
            content_type="application/json",
        ).status_code
        == 400
    )
    reopened = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/reopen/",
        data={"reason": "Counting correction.", "idempotency_key": "reopen-1"},
        content_type="application/json",
    )
    assert reopened.status_code == 200
    replay = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{session_id}/reopen/",
        data={"reason": "Counting correction.", "idempotency_key": "reopen-1"},
        content_type="application/json",
    )
    assert replay.status_code == 200
    assert len(replay.json()["reopen_events"]) == 1


def test_legacy_close_route_is_preserved_as_a_deprecated_non_mutating_action(
    sensitive_client, sensitive_user
):
    legacy_session = CashboxSession.objects.create(
        operator=sensitive_user,
        opened_at=timezone.now(),
        opened_by=sensitive_user,
    )

    response = sensitive_client.post(
        f"{CASHBOX_SESSION_LIST_URL}{legacy_session.id}/close/",
        data={"closing_note": "Legacy client must migrate."},
        content_type="application/json",
    )

    assert response.status_code == 410
    assert response.json()["code"] == "cashbox_direct_close_deprecated"
    legacy_session.refresh_from_db()
    assert legacy_session.closed_at is None


def test_cashbox_read_endpoints_require_authentication(client):
    assert client.get(CASHBOX_SESSION_LIST_URL).status_code in {401, 403}
    assert client.get(CASHBOX_MOVEMENT_LIST_URL).status_code in {401, 403}


def test_cashbox_read_endpoints_require_sensitive_access(authenticated_client):
    assert authenticated_client.get(CASHBOX_SESSION_LIST_URL).status_code == 403
    assert authenticated_client.get(CASHBOX_MOVEMENT_LIST_URL).status_code == 403
