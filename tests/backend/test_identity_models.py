import pytest
from django.core.exceptions import ValidationError

from apps.identity.models import ApplicationRole, UserRoleAssignment

pytestmark = pytest.mark.django_db


def test_application_role_str():
    role = ApplicationRole.objects.create(name="Test Role", slug="test-role")
    assert str(role) == "Test Role"


def test_application_role_is_system_managed_cannot_be_deactivated():
    role = ApplicationRole.objects.create(
        name="Sys Role",
        slug="sys-role",
        is_system_managed=True,
    )
    role.is_active = False
    with pytest.raises(ValidationError, match="cannot be deactivated"):
        role.full_clean()


def test_user_role_assignment_active_with_revoked_at_fails():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(username="u1", password="p")
    role = ApplicationRole.objects.create(name="R", slug="r")
    assignment = UserRoleAssignment.objects.create(user=user, role=role, is_active=True)
    assignment.revoked_at = __import__("django.utils.timezone", fromlist=["timezone"]).now()
    with pytest.raises(ValidationError, match="cannot have a revocation date"):
        assignment.full_clean()


def test_user_role_assignment_revoked_without_revoked_at_fails():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(username="u2", password="p")
    role = ApplicationRole.objects.create(name="R2", slug="r2")
    assignment = UserRoleAssignment.objects.create(user=user, role=role, is_active=False)
    with pytest.raises(ValidationError, match="must have a revocation date"):
        assignment.full_clean()


def test_duplicate_active_assignment_blocked_by_constraint():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(username="u3", password="p")
    role = ApplicationRole.objects.create(name="R3", slug="r3")
    UserRoleAssignment.objects.create(user=user, role=role, is_active=True)
    with pytest.raises(Exception):
        UserRoleAssignment.objects.create(user=user, role=role, is_active=True)
