from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, close_old_connections, transaction

from apps.audit.models import AuditEvent
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import IdentityRole
from apps.identity.services import (
    IdentityServiceError,
    assign_role,
    revoke_role,
    sync_system_roles,
)

pytestmark = pytest.mark.django_db

User = get_user_model()


@dataclass
class ActorStub:
    is_authenticated: bool = True
    is_staff: bool = True
    is_active: bool = True
    pk: int = 1


@pytest.fixture
def admin_user():
    return User.objects.create_user(username="admin", password="p", is_staff=True)


@pytest.fixture
def regular_user():
    return User.objects.create_user(username="regular", password="p", is_staff=False)


@pytest.fixture
def sample_role():
    return ApplicationRole.objects.create(name="Sample", slug="sample")


def test_sync_system_roles_requires_admin(regular_user):
    actor = ActorStub(is_staff=False)
    with pytest.raises(IdentityServiceError, match="not authorized"):
        sync_system_roles(actor=actor)


def test_delegated_identity_admin_cannot_sync_or_assign_system_roles(
    django_user_model,
    regular_user,
):
    delegated = django_user_model.objects.create_user(username="delegated-admin")
    delegated.groups.create(name=IdentityRole.IDENTITY_ADMIN.value)
    system_role = ApplicationRole.objects.create(
        name="Identity admin",
        slug=IdentityRole.IDENTITY_ADMIN.value,
        is_system_managed=True,
    )

    with pytest.raises(IdentityServiceError, match="platform administrator"):
        sync_system_roles(actor=delegated)
    with pytest.raises(IdentityServiceError, match="platform administrator"):
        assign_role(actor=delegated, user=regular_user, role=system_role)


def test_delegated_identity_admin_cannot_revoke_system_role(
    django_user_model,
    regular_user,
):
    delegated = django_user_model.objects.create_user(username="delegated-revoker")
    delegated.groups.create(name=IdentityRole.IDENTITY_ADMIN.value)
    system_role = ApplicationRole.objects.create(
        name="Reservation operator",
        slug=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value,
        is_system_managed=True,
    )
    assignment = UserRoleAssignment.objects.create(user=regular_user, role=system_role)

    with pytest.raises(IdentityServiceError, match="platform administrator"):
        revoke_role(actor=delegated, assignment_id=assignment.id)


def test_sync_system_roles_creates_records(admin_user):
    roles = sync_system_roles(actor=admin_user)
    assert len(roles) >= 1
    slugs = {r.slug for r in roles}
    assert "reservation_sensitive_operator" in slugs


def test_assign_role_requires_admin(regular_user, sample_role):
    actor = ActorStub(is_staff=False)
    with pytest.raises(IdentityServiceError, match="not authorized"):
        assign_role(actor=actor, user=regular_user, role=sample_role)


def test_assign_role_to_inactive_user_fails(admin_user, regular_user, sample_role):
    regular_user.is_active = False
    regular_user.save()
    with pytest.raises(IdentityServiceError, match="inactive user"):
        assign_role(actor=admin_user, user=regular_user, role=sample_role)
    assert not AuditEvent.objects.filter(action="identity.role_assigned").exists()


def test_assign_inactive_role_fails_without_assignment_or_audit(
    admin_user,
    regular_user,
):
    role = ApplicationRole.objects.create(
        name="Inactive role",
        slug="inactive-role",
        is_active=False,
    )

    with pytest.raises(IdentityServiceError, match="inactive role"):
        assign_role(actor=admin_user, user=regular_user, role=role)

    assert not UserRoleAssignment.objects.filter(user=regular_user, role=role).exists()
    assert not AuditEvent.objects.filter(action="identity.role_assigned").exists()


@pytest.mark.parametrize("stale_object", ["user", "role"])
def test_assign_role_revalidates_locked_current_state(
    admin_user,
    regular_user,
    sample_role,
    stale_object,
):
    if stale_object == "user":
        User.objects.filter(pk=regular_user.pk).update(is_active=False)
        error_message = "inactive user"
    else:
        ApplicationRole.objects.filter(pk=sample_role.pk).update(is_active=False)
        error_message = "inactive role"

    with pytest.raises(IdentityServiceError, match=error_message):
        assign_role(actor=admin_user, user=regular_user, role=sample_role)

    assert not UserRoleAssignment.objects.filter(user=regular_user, role=sample_role).exists()
    assert not AuditEvent.objects.filter(action="identity.role_assigned").exists()


def test_assign_role_success(
    admin_user,
    regular_user,
    sample_role,
    django_capture_on_commit_callbacks,
):
    with django_capture_on_commit_callbacks(execute=True):
        assignment = assign_role(actor=admin_user, user=regular_user, role=sample_role)
    assert assignment.user == regular_user
    assert assignment.role == sample_role
    assert assignment.is_active is True
    assert assignment.assigned_by == admin_user
    assert assignment.created_by == admin_user
    assert assignment.updated_by == admin_user
    event = AuditEvent.objects.get(action="identity.role_assigned")
    assert event.actor == admin_user
    assert event.target_type == "user_role_assignment"
    assert event.target_id == str(assignment.id)
    assert event.metadata == {
        "user_id": regular_user.pk,
        "role_id": str(sample_role.id),
        "role_slug": sample_role.slug,
    }


def test_assign_role_duplicate_blocked(
    admin_user,
    regular_user,
    sample_role,
    django_capture_on_commit_callbacks,
):
    with django_capture_on_commit_callbacks(execute=True):
        assign_role(actor=admin_user, user=regular_user, role=sample_role)
        with pytest.raises(IdentityServiceError, match="already has an active assignment"):
            assign_role(actor=admin_user, user=regular_user, role=sample_role)
    assert AuditEvent.objects.filter(action="identity.role_assigned").count() == 1


def test_assign_role_translates_residual_integrity_error(
    admin_user,
    regular_user,
    sample_role,
    monkeypatch,
):
    def raise_integrity_error(**kwargs):
        raise IntegrityError("unique_active_user_role")

    monkeypatch.setattr(UserRoleAssignment.objects, "create", raise_integrity_error)

    with pytest.raises(IdentityServiceError) as exc_info:
        assign_role(actor=admin_user, user=regular_user, role=sample_role)

    assert exc_info.value.code == "role_already_assigned"
    assert not AuditEvent.objects.filter(action="identity.role_assigned").exists()


def test_revoke_role_requires_admin(sample_role):
    actor = ActorStub(is_staff=False)
    with pytest.raises(IdentityServiceError, match="not authorized"):
        revoke_role(actor=actor, assignment_id="does-not-matter")


def test_revoke_role_not_found(admin_user):
    with pytest.raises(IdentityServiceError, match="not found"):
        revoke_role(actor=admin_user, assignment_id=__import__("uuid").uuid4())
    assert not AuditEvent.objects.filter(action="identity.role_revoked").exists()


def test_revoke_role_already_revoked(admin_user, regular_user, sample_role):
    assignment = UserRoleAssignment.objects.create(
        user=regular_user,
        role=sample_role,
        is_active=False,
        revoked_at=__import__("django.utils.timezone", fromlist=["timezone"]).now(),
    )
    with pytest.raises(IdentityServiceError, match="already revoked"):
        revoke_role(actor=admin_user, assignment_id=assignment.id)
    assert not AuditEvent.objects.filter(action="identity.role_revoked").exists()


def test_revoke_role_system_managed_assignment_allowed(admin_user, regular_user):
    role = ApplicationRole.objects.create(name="Sys", slug="sys", is_system_managed=True)
    assignment = assign_role(actor=admin_user, user=regular_user, role=role)
    result = revoke_role(actor=admin_user, assignment_id=assignment.id)

    assert result.is_active is False


def test_revoke_role_success(
    admin_user,
    regular_user,
    sample_role,
    django_capture_on_commit_callbacks,
):
    assignment = assign_role(actor=admin_user, user=regular_user, role=sample_role)
    with django_capture_on_commit_callbacks(execute=True):
        result = revoke_role(actor=admin_user, assignment_id=assignment.id, notes="bye")
    assert result.is_active is False
    assert result.revoked_at is not None
    assert result.updated_by == admin_user
    assert "bye" in result.notes
    event = AuditEvent.objects.get(action="identity.role_revoked")
    assert event.actor == admin_user
    assert event.target_type == "user_role_assignment"
    assert event.target_id == str(assignment.id)
    assert event.metadata == {
        "user_id": regular_user.pk,
        "role_id": str(sample_role.id),
        "role_slug": sample_role.slug,
    }


@pytest.mark.django_db(transaction=True)
def test_assign_role_audit_is_not_persisted_after_rollback(django_user_model):
    admin = django_user_model.objects.create_user(username="rollback-admin", is_staff=True)
    target = django_user_model.objects.create_user(username="rollback-target")
    role = ApplicationRole.objects.create(name="Rollback", slug="rollback")

    with pytest.raises(RuntimeError, match="rollback"):
        with transaction.atomic():
            assign_role(actor=admin, user=target, role=role)
            raise RuntimeError("rollback")

    assert not AuditEvent.objects.filter(action="identity.role_assigned").exists()
    assert not UserRoleAssignment.objects.filter(user=target, role=role).exists()


@pytest.mark.django_db(transaction=True)
def test_revoke_role_audit_is_not_persisted_after_rollback(django_user_model):
    admin = django_user_model.objects.create_user(username="revoke-rollback-admin", is_staff=True)
    target = django_user_model.objects.create_user(username="revoke-rollback-target")
    role = ApplicationRole.objects.create(name="Revoke rollback", slug="revoke-rollback")
    assignment = UserRoleAssignment.objects.create(user=target, role=role)

    with pytest.raises(RuntimeError, match="rollback"):
        with transaction.atomic():
            revoke_role(actor=admin, assignment_id=assignment.id)
            raise RuntimeError("rollback")

    assignment.refresh_from_db()
    assert assignment.is_active is True
    assert not AuditEvent.objects.filter(action="identity.role_revoked").exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_first_assignment_has_one_success_and_one_business_conflict(
    django_user_model,
):
    admin = django_user_model.objects.create_user(username="concurrent-admin", is_staff=True)
    target = django_user_model.objects.create_user(username="concurrent-target")
    role = ApplicationRole.objects.create(name="Concurrent role", slug="concurrent-role")
    barrier = Barrier(2)

    def worker() -> str:
        close_old_connections()
        try:
            worker_admin = django_user_model.objects.get(pk=admin.pk)
            worker_target = django_user_model.objects.get(pk=target.pk)
            worker_role = ApplicationRole.objects.get(pk=role.pk)
            barrier.wait()
            try:
                assign_role(
                    actor=worker_admin,
                    user=worker_target,
                    role=worker_role,
                )
            except IdentityServiceError as exc:
                return exc.code
            return "success"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: worker(), range(2)))

    assert sorted(results) == ["role_already_assigned", "success"]
    assignment = UserRoleAssignment.objects.get(user=target, role=role)
    event = AuditEvent.objects.get(action="identity.role_assigned")
    assert event.target_id == str(assignment.id)
    assert event.target_type == "user_role_assignment"
