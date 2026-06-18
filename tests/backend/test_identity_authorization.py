from dataclasses import dataclass

import pytest
from django.contrib.auth.models import Group

from apps.identity.authorization import (
    actor_has_identity_role,
    is_reservation_sensitive_actor,
    require_reservation_sensitive_actor,
)
from apps.identity.roles import IdentityRole

pytestmark = pytest.mark.django_db


@dataclass
class ActorStub:
    is_authenticated: bool
    is_staff: bool
    is_active: bool | None = True
    groups: object | None = None


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


def test_authenticated_non_staff_actor_without_group_is_denied() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=False)

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
