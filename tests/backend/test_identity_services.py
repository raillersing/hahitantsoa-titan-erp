from dataclasses import dataclass

import pytest
from django.contrib.auth import get_user_model

from apps.identity.models import ApplicationRole, UserRoleAssignment
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


def test_assign_role_success(admin_user, regular_user, sample_role):
    assignment = assign_role(actor=admin_user, user=regular_user, role=sample_role)
    assert assignment.user == regular_user
    assert assignment.role == sample_role
    assert assignment.is_active is True
    assert assignment.assigned_by == admin_user


def test_assign_role_duplicate_blocked(admin_user, regular_user, sample_role):
    assign_role(actor=admin_user, user=regular_user, role=sample_role)
    with pytest.raises(IdentityServiceError, match="already has an active assignment"):
        assign_role(actor=admin_user, user=regular_user, role=sample_role)


def test_revoke_role_requires_admin(sample_role):
    actor = ActorStub(is_staff=False)
    with pytest.raises(IdentityServiceError, match="not authorized"):
        revoke_role(actor=actor, assignment_id="does-not-matter")


def test_revoke_role_not_found(admin_user):
    with pytest.raises(IdentityServiceError, match="not found"):
        revoke_role(actor=admin_user, assignment_id=__import__("uuid").uuid4())


def test_revoke_role_already_revoked(admin_user, regular_user, sample_role):
    assignment = UserRoleAssignment.objects.create(
        user=regular_user,
        role=sample_role,
        is_active=False,
        revoked_at=__import__("django.utils.timezone", fromlist=["timezone"]).now(),
    )
    with pytest.raises(IdentityServiceError, match="already revoked"):
        revoke_role(actor=admin_user, assignment_id=assignment.id)


def test_revoke_role_system_managed_blocked(admin_user, regular_user):
    role = ApplicationRole.objects.create(name="Sys", slug="sys", is_system_managed=True)
    assignment = assign_role(actor=admin_user, user=regular_user, role=role)
    with pytest.raises(IdentityServiceError, match="System-managed"):
        revoke_role(actor=admin_user, assignment_id=assignment.id)


def test_revoke_role_success(admin_user, regular_user, sample_role):
    assignment = assign_role(actor=admin_user, user=regular_user, role=sample_role)
    result = revoke_role(actor=admin_user, assignment_id=assignment.id, notes="bye")
    assert result.is_active is False
    assert result.revoked_at is not None
    assert "bye" in result.notes
