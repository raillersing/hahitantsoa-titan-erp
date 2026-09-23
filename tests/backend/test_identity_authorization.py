from dataclasses import dataclass

import pytest
from django.contrib.auth.models import Group

from apps.identity.authorization import (
    actor_has_application_role,
    actor_has_identity_role,
    is_cashbox_supervisor_actor,
    is_identity_admin_actor,
    is_logistics_override_actor,
    is_reservation_sensitive_actor,
    require_reservation_sensitive_actor,
)
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db


@dataclass
class ActorStub:
    is_authenticated: bool
    is_staff: bool
    is_active: bool | None = True
    is_superuser: bool = False
    groups: object | None = None
    pk: int | None = None


def test_anonymous_actor_has_no_identity_role() -> None:
    assert (
        actor_has_identity_role(
            actor=None,
            role=IdentityRole.RESERVATION_SENSITIVE_OPERATOR,
        )
        is False
    )


def test_authenticated_staff_actor_is_reservation_sensitive_without_group() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True)

    assert is_reservation_sensitive_actor(actor=actor) is True


def test_active_staff_actor_is_identity_admin() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True, is_active=True)

    assert is_identity_admin_actor(actor=actor) is True


def test_identity_admin_group_actor_is_identity_admin(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="delegated-identity-admin",
        password="test-pass",
        is_staff=False,
    )
    group = Group.objects.create(name=IdentityRole.IDENTITY_ADMIN.value)
    actor.groups.add(group)

    assert is_identity_admin_actor(actor=actor) is True


def test_reservation_operator_is_not_identity_admin(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="reservation-only-operator",
        password="test-pass",
        is_staff=False,
    )
    group = Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value)
    actor.groups.add(group)

    assert is_identity_admin_actor(actor=actor) is False


def test_inactive_staff_actor_is_not_identity_admin() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True, is_active=False)

    assert is_identity_admin_actor(actor=actor) is False


def test_authenticated_non_staff_actor_without_group_is_denied() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=False)

    assert is_reservation_sensitive_actor(actor=actor) is False


def test_non_user_actor_with_numeric_pk_is_denied_without_orm_error() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=False, pk=1)

    assert is_reservation_sensitive_actor(actor=actor) is False


def test_group_mapped_actor_is_reservation_sensitive(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="identity-group-user",
        password="test-pass",
        is_staff=False,
    )
    group = Group.objects.create(
        name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value,
    )
    actor.groups.add(group)

    assert (
        actor_has_identity_role(
            actor=actor,
            role=IdentityRole.RESERVATION_SENSITIVE_OPERATOR,
        )
        is True
    )
    assert is_reservation_sensitive_actor(actor=actor) is True


def test_active_application_role_assignment_is_reservation_sensitive(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="identity-assignment-user",
        password="test-pass",
        is_staff=False,
    )
    role = ApplicationRole.objects.create(
        name="Reservation operator",
        slug=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value,
    )
    UserRoleAssignment.objects.create(user=actor, role=role)

    assert is_reservation_sensitive_actor(actor=actor) is True


@pytest.mark.parametrize("inactive_object", ["role", "assignment"])
def test_inactive_application_role_assignment_is_denied(django_user_model, inactive_object) -> None:
    actor = django_user_model.objects.create_user(
        username=f"identity-inactive-{inactive_object}",
        password="test-pass",
        is_staff=False,
    )
    role = ApplicationRole.objects.create(
        name=f"Inactive {inactive_object}",
        slug=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value,
        is_active=inactive_object != "role",
    )
    assignment = UserRoleAssignment.objects.create(user=actor, role=role)
    if inactive_object == "assignment":
        UserRoleAssignment.objects.filter(pk=assignment.pk).update(is_active=False)

    assert is_reservation_sensitive_actor(actor=actor) is False


def test_inactive_group_mapped_actor_is_denied(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="identity-inactive-group-user",
        password="test-pass",
        is_staff=False,
        is_active=False,
    )
    group = Group.objects.create(
        name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value,
    )
    actor.groups.add(group)

    assert is_reservation_sensitive_actor(actor=actor) is False


def test_require_reservation_sensitive_actor_raises_for_denied_actor() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=False)

    with pytest.raises(PermissionError, match="reservation-sensitive write"):
        require_reservation_sensitive_actor(actor=actor)


@pytest.mark.parametrize(
    "role_slug",
    [IdentityRole.CASHBOX_SUPERVISOR.value, "logistics_override", "owner_manager"],
)
def test_active_superuser_has_application_capabilities_without_role_assignments(
    django_user_model, role_slug
) -> None:
    admin = django_user_model.objects.create_superuser(
        username=f"admin-{role_slug}", password="test-pass"
    )

    assert actor_has_application_role(actor=admin, role_slug=role_slug) is True
    assert is_cashbox_supervisor_actor(actor=admin) is True
    assert is_logistics_override_actor(actor=admin) is True


@pytest.mark.parametrize("is_active", [True, False])
def test_staff_without_superuser_flag_does_not_bypass_explicit_capabilities(
    django_user_model, is_active
) -> None:
    staff = django_user_model.objects.create_user(
        username=f"staff-{is_active}", password="test-pass", is_staff=True, is_active=is_active
    )

    assert actor_has_application_role(actor=staff, role_slug="cashbox_supervisor") is False
    assert is_cashbox_supervisor_actor(actor=staff) is False
    assert is_logistics_override_actor(actor=staff) is False


def test_inactive_superuser_does_not_bypass_explicit_capabilities(django_user_model) -> None:
    admin = django_user_model.objects.create_superuser(
        username="inactive-admin", password="test-pass", is_active=False
    )

    assert actor_has_application_role(actor=admin, role_slug="owner_manager") is False


def test_non_user_superuser_stub_cannot_bypass_explicit_capabilities() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True, is_superuser=True, pk=1)

    assert actor_has_application_role(actor=actor, role_slug="owner_manager") is False
