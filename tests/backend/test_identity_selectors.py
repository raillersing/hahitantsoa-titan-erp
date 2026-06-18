import pytest
from django.contrib.auth import get_user_model

from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.selectors import (
    active_roles,
    user_active_assignments,
    user_effective_role_slugs,
    user_has_application_role,
)

pytestmark = pytest.mark.django_db

User = get_user_model()


def test_active_roles_excludes_inactive():
    ApplicationRole.objects.create(name="Active", slug="active", is_active=True)
    ApplicationRole.objects.create(name="Inactive", slug="inactive", is_active=False)
    roles = active_roles()
    assert len(roles) == 1
    assert roles[0].slug == "active"


def test_user_active_assignments():
    user = User.objects.create_user(username="u", password="p")
    role = ApplicationRole.objects.create(name="R", slug="r")
    UserRoleAssignment.objects.create(user=user, role=role, is_active=True)
    assignments = user_active_assignments(user=user)
    assert len(assignments) == 1
    assert assignments[0].role.slug == "r"


def test_user_has_application_role_true():
    user = User.objects.create_user(username="u2", password="p")
    role = ApplicationRole.objects.create(name="R2", slug="r2")
    UserRoleAssignment.objects.create(user=user, role=role, is_active=True)
    assert user_has_application_role(user=user, role_slug="r2") is True


def test_user_has_application_role_false():
    user = User.objects.create_user(username="u3", password="p")
    assert user_has_application_role(user=user, role_slug="missing") is False


def test_user_effective_role_slugs():
    user = User.objects.create_user(username="u4", password="p")
    role_a = ApplicationRole.objects.create(name="A", slug="a")
    role_b = ApplicationRole.objects.create(name="B", slug="b")
    UserRoleAssignment.objects.create(user=user, role=role_a, is_active=True)
    UserRoleAssignment.objects.create(user=user, role=role_b, is_active=True)
    slugs = user_effective_role_slugs(user=user)
    assert slugs == {"a", "b"}
