from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.audit.models import AuditEvent
from apps.cashbox.models import (
    CashboxClosureAttempt,
    CashboxClosureValidation,
    CashboxMovement,
    CashboxMovementDirection,
    CashboxSession,
)
from apps.cashbox.services import (
    open_cashbox_session,
    record_cashbox_movement,
    submit_cashbox_count,
    validate_cashbox_count,
)
from apps.finance.models import FinanceAccountKind, FinanceBusinessScope
from apps.finance.services import create_finance_account
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import CompanyRole, IdentityRole

User = get_user_model()
pytestmark = pytest.mark.django_db(transaction=True)


def _create_user_with_role(username: str, role_slug: str | None = None) -> User:
    user = User.objects.create_user(username=username, password="test-password-123")
    if role_slug is not None:
        role, _ = ApplicationRole.objects.get_or_create(
            slug=role_slug,
            defaults={"name": role_slug.replace("_", " ").capitalize()},
        )
        UserRoleAssignment.objects.create(user=user, role=role)
    return user


def _create_cash_account(code: str):
    admin = User.objects.create_superuser(
        username=f"admin_{code.lower().replace('-', '_')}",
        password="test-password-123",
    )
    return create_finance_account(
        actor=admin,
        business_scope=FinanceBusinessScope.TITAN,
        code=code,
        label=code,
        kind=FinanceAccountKind.CASH,
    )


# ---------------------------------------------------------------------------
# SUBMIT CASHBOX COUNT TESTS
# ---------------------------------------------------------------------------


def test_submit_cashbox_count_allows_session_operator():
    """An active operator with cashbox capability can submit count for their own open session."""
    operator = _create_user_with_role("operator_alice", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-alice-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    attempt = submit_cashbox_count(
        session=session,
        actor=operator,
        actual_amount=Decimal("100.00"),
        idempotency_key="alice-count-1",
    )

    session.refresh_from_db()
    assert session.status == "count_submitted"
    assert attempt.submitted_by_id == operator.id
    assert AuditEvent.objects.filter(
        action="cashbox.count_submitted",
        actor_id=str(operator.id),
        target_id=str(attempt.id),
    ).exists()


def test_submit_cashbox_count_allows_cashbox_supervisor():
    """An active cashbox supervisor can submit count for an operator's session."""
    operator = _create_user_with_role("operator_bob", IdentityRole.CASHBOX_OPERATOR)
    supervisor = _create_user_with_role("supervisor_carol", IdentityRole.CASHBOX_SUPERVISOR)
    account = _create_cash_account("till-bob-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    attempt = submit_cashbox_count(
        session=session,
        actor=supervisor,
        actual_amount=Decimal("50.00"),
        idempotency_key="carol-count-1",
    )

    session.refresh_from_db()
    assert session.status == "count_submitted"
    assert attempt.submitted_by_id == supervisor.id
    assert AuditEvent.objects.filter(
        action="cashbox.count_submitted",
        actor_id=str(supervisor.id),
        target_id=str(attempt.id),
    ).exists()


def test_submit_cashbox_count_allows_owner_manager():
    """An active owner_manager has cashbox supervisor capabilities and can submit count."""
    operator = _create_user_with_role("operator_dan", IdentityRole.CASHBOX_OPERATOR)
    owner = _create_user_with_role("owner_dan_mgr", CompanyRole.OWNER_MANAGER)
    account = _create_cash_account("till-dan-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("75.00"),
    )

    attempt = submit_cashbox_count(
        session=session,
        actor=owner,
        actual_amount=Decimal("75.00"),
        idempotency_key="owner-dan-count-1",
    )

    session.refresh_from_db()
    assert session.status == "count_submitted"
    assert attempt.submitted_by_id == owner.id


def test_submit_cashbox_count_rejects_third_party_operator_at_service_level():
    """Another cashier cannot submit count for someone else's session; rolls back cleanly."""
    operator1 = _create_user_with_role("operator_dave", IdentityRole.CASHBOX_OPERATOR)
    operator2 = _create_user_with_role("operator_eve", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-dave-1")
    session = open_cashbox_session(
        operator=operator1,
        actor=operator1,
        cash_account=account,
        opening_amount=Decimal("20.00"),
    )

    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=operator2,
            actual_amount=Decimal("20.00"),
            idempotency_key="eve-illegal-count",
        )

    session.refresh_from_db()
    assert session.status == "open"
    assert not CashboxClosureAttempt.objects.filter(session=session).exists()
    assert not AuditEvent.objects.filter(
        action="cashbox.count_submitted",
        actor_id=str(operator2.id),
    ).exists()


def test_submit_cashbox_count_rejects_unprivileged_actor_at_service_level():
    """A user without cashbox permissions cannot submit count for a session."""
    operator = _create_user_with_role("operator_frank", IdentityRole.CASHBOX_OPERATOR)
    outsider = _create_user_with_role("outsider_grace", None)
    account = _create_cash_account("till-frank-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("30.00"),
    )

    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=outsider,
            actual_amount=Decimal("30.00"),
            idempotency_key="grace-illegal-count",
        )

    session.refresh_from_db()
    assert session.status == "open"
    assert not CashboxClosureAttempt.objects.filter(session=session).exists()


def test_submit_cashbox_count_rejects_none_actor():
    """Calling submit_cashbox_count with actor=None is refused immediately."""
    operator = _create_user_with_role("operator_none_sub", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-none-sub")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("10.00"),
    )

    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=None,
            actual_amount=Decimal("10.00"),
            idempotency_key="none-count-key",
        )

    session.refresh_from_db()
    assert session.status == "open"
    assert not CashboxClosureAttempt.objects.filter(session=session).exists()


def test_submit_cashbox_count_rejects_operator_after_role_revocation():
    """An operator whose role was revoked cannot submit count on their session."""
    operator = _create_user_with_role("operator_revoked_sub", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-revoked-sub")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("25.00"),
    )

    # Revoke operator role
    UserRoleAssignment.objects.filter(user=operator).delete()

    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=operator,
            actual_amount=Decimal("25.00"),
            idempotency_key="revoked-count-attempt",
        )

    session.refresh_from_db()
    assert session.status == "open"
    assert not CashboxClosureAttempt.objects.filter(session=session).exists()


def test_submit_cashbox_count_rejects_inactive_operator():
    """An operator whose account is deactivated cannot submit count."""
    operator = _create_user_with_role("operator_inact_sub", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-inact-sub")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("40.00"),
    )

    operator.is_active = False
    operator.save(update_fields=["is_active"])

    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=operator,
            actual_amount=Decimal("40.00"),
            idempotency_key="inactive-count-attempt",
        )

    session.refresh_from_db()
    assert session.status == "open"
    assert not CashboxClosureAttempt.objects.filter(session=session).exists()


def test_submit_cashbox_count_rejects_inactive_or_revoked_supervisor():
    """A supervisor who is inactive or whose role was revoked cannot submit count."""
    operator = _create_user_with_role("operator_for_sup", IdentityRole.CASHBOX_OPERATOR)
    supervisor = _create_user_with_role("supervisor_rev_sub", IdentityRole.CASHBOX_SUPERVISOR)
    account = _create_cash_account("till-for-sup")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    # Inactive supervisor
    supervisor.is_active = False
    supervisor.save(update_fields=["is_active"])
    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=supervisor,
            actual_amount=Decimal("50.00"),
            idempotency_key="inact-sup-count",
        )

    # Reactivated but revoked role
    supervisor.is_active = True
    supervisor.save(update_fields=["is_active"])
    UserRoleAssignment.objects.filter(user=supervisor).delete()
    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=supervisor,
            actual_amount=Decimal("50.00"),
            idempotency_key="revoked-sup-count",
        )

    session.refresh_from_db()
    assert session.status == "open"


# ---------------------------------------------------------------------------
# RECORD CASHBOX MOVEMENT TESTS
# ---------------------------------------------------------------------------


def test_record_cashbox_movement_allows_session_operator():
    """An active operator can record movement on their own open session."""
    operator = _create_user_with_role("operator_heidi", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-heidi-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=Decimal("25.00"),
        actor=operator,
        note="Manual deposit",
    )

    assert movement.moved_by_id == operator.id
    assert movement.amount == Decimal("25.00")
    assert AuditEvent.objects.filter(
        action="cashbox.movement_recorded",
        actor_id=str(operator.id),
        target_id=str(movement.id),
    ).exists()


def test_record_cashbox_movement_allows_cashbox_supervisor():
    """An active cashbox supervisor can record movement on an operator's session."""
    operator = _create_user_with_role("operator_ivan", IdentityRole.CASHBOX_OPERATOR)
    supervisor = _create_user_with_role("supervisor_judy", IdentityRole.CASHBOX_SUPERVISOR)
    account = _create_cash_account("till-ivan-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_OUT,
        amount=Decimal("10.00"),
        actor=supervisor,
        note="Supervisor cash adjustment",
    )

    assert movement.moved_by_id == supervisor.id
    assert movement.amount == Decimal("10.00")
    assert AuditEvent.objects.filter(
        action="cashbox.movement_recorded",
        actor_id=str(supervisor.id),
        target_id=str(movement.id),
    ).exists()


def test_record_cashbox_movement_allows_owner_manager():
    """An active owner_manager can record movements on a cashbox session."""
    operator = _create_user_with_role("operator_ken", IdentityRole.CASHBOX_OPERATOR)
    owner = _create_user_with_role("owner_ken_mgr", CompanyRole.OWNER_MANAGER)
    account = _create_cash_account("till-ken-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    movement = record_cashbox_movement(
        session=session,
        direction=CashboxMovementDirection.CASH_IN,
        amount=Decimal("30.00"),
        actor=owner,
        note="Owner cash adjustment",
    )

    assert movement.moved_by_id == owner.id
    assert movement.amount == Decimal("30.00")


def test_record_cashbox_movement_rejects_third_party_operator_at_service_level():
    """Another cashier cannot record movement on someone else's session; rolls back cleanly."""
    operator1 = _create_user_with_role("operator_karl", IdentityRole.CASHBOX_OPERATOR)
    operator2 = _create_user_with_role("operator_leo", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-karl-1")
    session = open_cashbox_session(
        operator=operator1,
        actor=operator1,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("50.00"),
            actor=operator2,
            note="Illicit movement",
        )

    assert not CashboxMovement.objects.filter(session=session).exists()
    assert not AuditEvent.objects.filter(
        action="cashbox.movement_recorded",
        actor_id=str(operator2.id),
    ).exists()


def test_record_cashbox_movement_rejects_unprivileged_actor_at_service_level():
    """An unprivileged actor cannot record cashbox movements."""
    operator = _create_user_with_role("operator_mallory", IdentityRole.CASHBOX_OPERATOR)
    outsider = _create_user_with_role("outsider_ned", None)
    account = _create_cash_account("till-mallory-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("5.00"),
            actor=outsider,
            note="Outsider deposit",
        )

    assert not CashboxMovement.objects.filter(session=session).exists()


def test_record_cashbox_movement_rejects_none_actor():
    """Calling record_cashbox_movement with actor=None raises PermissionError."""
    operator = _create_user_with_role("operator_none_mov", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-none-mov")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("10.00"),
            actor=None,
        )

    assert not CashboxMovement.objects.filter(session=session).exists()


def test_record_cashbox_movement_rejects_operator_after_role_revocation():
    """An operator whose role was revoked cannot record movements."""
    operator = _create_user_with_role("operator_rev_mov", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-rev-mov")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    UserRoleAssignment.objects.filter(user=operator).delete()

    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("15.00"),
            actor=operator,
        )

    assert not CashboxMovement.objects.filter(session=session).exists()


def test_record_cashbox_movement_rejects_inactive_operator():
    """An inactive operator cannot record movements."""
    operator = _create_user_with_role("operator_inact_mov", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-inact-mov")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    operator.is_active = False
    operator.save(update_fields=["is_active"])

    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("15.00"),
            actor=operator,
        )

    assert not CashboxMovement.objects.filter(session=session).exists()


def test_record_cashbox_movement_rejects_inactive_or_revoked_supervisor():
    """An inactive or revoked supervisor cannot record movements."""
    operator = _create_user_with_role("operator_for_sup_mov", IdentityRole.CASHBOX_OPERATOR)
    supervisor = _create_user_with_role("supervisor_mov_rev", IdentityRole.CASHBOX_SUPERVISOR)
    account = _create_cash_account("till-for-sup-mov")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    supervisor.is_active = False
    supervisor.save(update_fields=["is_active"])
    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_OUT,
            amount=Decimal("5.00"),
            actor=supervisor,
        )

    supervisor.is_active = True
    supervisor.save(update_fields=["is_active"])
    UserRoleAssignment.objects.filter(user=supervisor).delete()
    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_OUT,
            amount=Decimal("5.00"),
            actor=supervisor,
        )

    assert not CashboxMovement.objects.filter(session=session).exists()


# ---------------------------------------------------------------------------
# OPEN CASHBOX SESSION TESTS
# ---------------------------------------------------------------------------


def test_open_cashbox_session_service_rejects_none_or_inactive_actor():
    """An absent or inactive actor cannot open a cashbox session."""
    operator = _create_user_with_role("operator_inact_open", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-inact-open")

    # actor = None
    with pytest.raises(PermissionError, match="Un acteur authentifié et actif est requis"):
        open_cashbox_session(
            operator=operator,
            actor=None,
            cash_account=account,
            opening_amount=Decimal("0.00"),
        )

    # Inactive operator opening own till
    operator.is_active = False
    operator.save(update_fields=["is_active"])
    with pytest.raises(PermissionError, match="L'acteur doit être authentifié et actif"):
        open_cashbox_session(
            operator=operator,
            actor=operator,
            cash_account=account,
            opening_amount=Decimal("0.00"),
        )

    assert not CashboxSession.objects.filter(operator=operator).exists()


def test_open_cashbox_session_service_rejects_operator_without_role():
    """An active user without cashbox_operator role cannot open a cashbox."""
    unprivileged = _create_user_with_role("unprivileged_open", None)
    account = _create_cash_account("till-unprivileged-open")

    with pytest.raises(PermissionError, match="Cet opérateur n'a pas l'autorisation"):
        open_cashbox_session(
            operator=unprivileged,
            actor=unprivileged,
            cash_account=account,
            opening_amount=Decimal("0.00"),
        )

    assert not CashboxSession.objects.filter(operator=unprivileged).exists()


def test_open_cashbox_session_service_rejects_third_party_actor():
    """An unprivileged operator cannot open a cashbox session for another user."""
    operator1 = _create_user_with_role("operator_olivia", IdentityRole.CASHBOX_OPERATOR)
    operator2 = _create_user_with_role("operator_peter", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-olivia-1")

    with pytest.raises(PermissionError, match="Un opérateur ne peut ouvrir que sa propre caisse"):
        open_cashbox_session(
            operator=operator1,
            actor=operator2,
            cash_account=account,
            opening_amount=Decimal("0.00"),
        )

    assert not CashboxSession.objects.filter(operator=operator1).exists()


def test_open_cashbox_session_allows_supervisor_to_open_for_operator():
    """A cashbox supervisor can open a session for an authorized operator."""
    operator = _create_user_with_role("operator_paul", IdentityRole.CASHBOX_OPERATOR)
    supervisor = _create_user_with_role("supervisor_sarah", IdentityRole.CASHBOX_SUPERVISOR)
    account = _create_cash_account("till-paul-1")

    session = open_cashbox_session(
        operator=operator,
        actor=supervisor,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    assert session.operator_id == operator.id
    assert session.opened_by_id == supervisor.id
    assert session.status == "open"


# ---------------------------------------------------------------------------
# TECHNICAL ACCOUNT INACTIVE TESTS (SUPERUSER / STAFF)
# ---------------------------------------------------------------------------


def test_cashbox_operations_reject_inactive_superuser_and_staff():
    """Inactive superuser or staff accounts must NOT be permitted to operate cashboxes."""
    operator = _create_user_with_role("operator_for_tech", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-for-tech")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    inactive_admin = User.objects.create_superuser(
        username="inactive_superuser", password="test-pass-123", is_active=False
    )
    inactive_staff = User.objects.create_user(
        username="inactive_staff", password="test-pass-123", is_staff=True, is_active=False
    )

    for tech_actor in [inactive_admin, inactive_staff]:
        with pytest.raises(PermissionError):
            submit_cashbox_count(
                session=session,
                actor=tech_actor,
                actual_amount=Decimal("50.00"),
                idempotency_key=f"tech-count-{tech_actor.username}",
            )
        with pytest.raises(PermissionError):
            record_cashbox_movement(
                session=session,
                direction=CashboxMovementDirection.CASH_IN,
                amount=Decimal("10.00"),
                actor=tech_actor,
            )
        with pytest.raises(PermissionError):
            open_cashbox_session(
                operator=operator,
                actor=tech_actor,
                cash_account=account,
                opening_amount=Decimal("0.00"),
            )

    session.refresh_from_db()
    assert session.status == "open"
    assert not CashboxMovement.objects.filter(session=session).exists()
    assert not CashboxClosureAttempt.objects.filter(session=session).exists()


# ---------------------------------------------------------------------------
# VALIDATE CASHBOX COUNT TESTS
# ---------------------------------------------------------------------------


def test_validate_cashbox_count_rejects_inactive_or_revoked_supervisor():
    """Validating cashbox counts requires an active user holding supervisor capability."""
    operator = _create_user_with_role("operator_val", IdentityRole.CASHBOX_OPERATOR)
    supervisor = _create_user_with_role("supervisor_val", IdentityRole.CASHBOX_SUPERVISOR)
    account = _create_cash_account("till-val-1")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("0.00"),
    )
    closure = submit_cashbox_count(
        session=session,
        actor=operator,
        actual_amount=Decimal("0.00"),
        idempotency_key="val-count-1",
    )

    # Inactive supervisor
    supervisor.is_active = False
    supervisor.save(update_fields=["is_active"])
    with pytest.raises(PermissionError):
        validate_cashbox_count(
            closure=closure,
            actor=supervisor,
            idempotency_key="val-key-1",
        )

    # Revoked supervisor role
    supervisor.is_active = True
    supervisor.save(update_fields=["is_active"])
    UserRoleAssignment.objects.filter(user=supervisor).delete()
    with pytest.raises(PermissionError):
        validate_cashbox_count(
            closure=closure,
            actor=supervisor,
            idempotency_key="val-key-2",
        )

    session.refresh_from_db()
    assert session.status == "count_submitted"
    assert not CashboxClosureValidation.objects.filter(closure_attempt=closure).exists()


# ---------------------------------------------------------------------------
# API ACCESS TESTS
# ---------------------------------------------------------------------------


def test_api_submit_count_and_movements_enforce_forbidden_and_not_found():
    """API endpoints reject unauthorized cross-operator writes with 403 or 404."""
    operator1 = _create_user_with_role("api_op_quinn", IdentityRole.CASHBOX_OPERATOR)
    operator2 = _create_user_with_role("api_op_rachel", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-quinn-1")
    session = open_cashbox_session(
        operator=operator1,
        actor=operator1,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    client2 = Client()
    client2.force_login(operator2)

    # Quinn's session is not visible to Rachel in the view filter -> 404
    resp_movement = client2.post(
        f"/api/v1/cashbox/sessions/{session.id}/movements/",
        data={"direction": "cash_in", "amount": "10.00"},
        content_type="application/json",
    )
    assert resp_movement.status_code == 404

    resp_count = client2.post(
        f"/api/v1/cashbox/sessions/{session.id}/submit-count/",
        data={"actual_amount": "100.00", "idempotency_key": "rachel-hack"},
        content_type="application/json",
    )
    assert resp_count.status_code == 404

    # Quinn can submit count to their own session via API -> 200
    client1 = Client()
    client1.force_login(operator1)
    resp_quinn_count = client1.post(
        f"/api/v1/cashbox/sessions/{session.id}/submit-count/",
        data={"actual_amount": "100.00", "idempotency_key": "quinn-legit"},
        content_type="application/json",
    )
    assert resp_quinn_count.status_code == 200
    assert resp_quinn_count.json()["status"] == "count_submitted"


# ---------------------------------------------------------------------------
# STALE IN-MEMORY ACTOR DEACTIVATION IN DB TESTS
# ---------------------------------------------------------------------------


def test_open_cashbox_session_rejects_stale_in_memory_actor_deactivated_in_db():
    """If an actor is deactivated in DB by another instance without refreshing the in-memory
    object, open_cashbox_session must reload persistent state and reject with PermissionError.
    """
    operator = _create_user_with_role("operator_stale_open", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-stale-open")

    # In-memory actor object has is_active = True
    assert operator.is_active is True

    # Deactivate the account directly in the database without touching the `operator` instance
    User.objects.filter(pk=operator.pk).update(is_active=False)
    # Confirm in-memory object was NOT refreshed
    assert operator.is_active is True

    with pytest.raises(PermissionError, match="L'acteur doit être authentifié et actif"):
        open_cashbox_session(
            operator=operator,
            actor=operator,
            cash_account=account,
            opening_amount=Decimal("0.00"),
        )

    assert not CashboxSession.objects.filter(operator=operator).exists()
    assert not AuditEvent.objects.filter(action="cashbox.session_opened").exists()


def test_submit_cashbox_count_rejects_stale_in_memory_actor_deactivated_in_db():
    """If an operator is deactivated in DB without refreshing the in-memory instance,
    submit_cashbox_count must reload persistent state and reject the submission."""
    operator = _create_user_with_role("operator_stale_count", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-stale-count")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("50.00"),
    )

    # Deactivate directly in database
    User.objects.filter(pk=operator.pk).update(is_active=False)
    assert operator.is_active is True  # Stale in-memory

    with pytest.raises(PermissionError, match="Actor is not allowed to submit count"):
        submit_cashbox_count(
            session=session,
            actor=operator,
            actual_amount=Decimal("50.00"),
            idempotency_key="stale-count-key",
        )

    session.refresh_from_db()
    assert session.status == "open"
    assert not CashboxClosureAttempt.objects.filter(session=session).exists()
    assert not AuditEvent.objects.filter(
        action="cashbox.count_submitted",
        actor_id=str(operator.id),
    ).exists()


def test_record_cashbox_movement_rejects_stale_in_memory_actor_deactivated_in_db():
    """If an operator is deactivated in DB without refreshing the in-memory instance,
    record_cashbox_movement must reload persistent state and reject the movement."""
    operator = _create_user_with_role("operator_stale_move", IdentityRole.CASHBOX_OPERATOR)
    account = _create_cash_account("till-stale-move")
    session = open_cashbox_session(
        operator=operator,
        actor=operator,
        cash_account=account,
        opening_amount=Decimal("100.00"),
    )

    # Deactivate directly in database
    User.objects.filter(pk=operator.pk).update(is_active=False)
    assert operator.is_active is True  # Stale in-memory

    with pytest.raises(PermissionError, match="Actor is not allowed to record movements"):
        record_cashbox_movement(
            session=session,
            direction=CashboxMovementDirection.CASH_IN,
            amount=Decimal("20.00"),
            actor=operator,
        )

    assert not CashboxMovement.objects.filter(session=session).exists()
    assert not AuditEvent.objects.filter(
        action="cashbox.movement_recorded",
        actor_id=str(operator.id),
    ).exists()
