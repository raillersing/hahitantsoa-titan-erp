from dataclasses import dataclass

import pytest

from apps.reservations.authorization import (
    is_reservation_sensitive_staff_actor,
    require_reservation_sensitive_staff_actor,
)


@dataclass
class ActorStub:
    is_authenticated: bool
    is_staff: bool
    is_active: bool | None = True


def test_anonymous_actor_is_denied() -> None:
    assert is_reservation_sensitive_staff_actor(actor=None) is False


def test_unauthenticated_actor_object_is_denied() -> None:
    actor = ActorStub(is_authenticated=False, is_staff=True, is_active=True)

    assert is_reservation_sensitive_staff_actor(actor=actor) is False


def test_inactive_authenticated_staff_actor_is_denied() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True, is_active=False)

    assert is_reservation_sensitive_staff_actor(actor=actor) is False


def test_authenticated_non_staff_actor_is_denied() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=False, is_active=True)

    assert is_reservation_sensitive_staff_actor(actor=actor) is False


def test_authenticated_active_staff_actor_is_allowed() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True, is_active=True)

    assert is_reservation_sensitive_staff_actor(actor=actor) is True


def test_authenticated_staff_actor_without_is_active_attribute_is_allowed() -> None:
    class AuthenticatedStaffWithoutIsActive:
        is_authenticated = True
        is_staff = True

    actor = AuthenticatedStaffWithoutIsActive()

    assert is_reservation_sensitive_staff_actor(actor=actor) is True


def test_helper_does_not_require_reservation_object() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True, is_active=True)

    assert is_reservation_sensitive_staff_actor(actor=actor) is True


def test_require_helper_raises_for_denied_actor() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=False, is_active=True)

    with pytest.raises(PermissionError):
        require_reservation_sensitive_staff_actor(actor=actor)


def test_require_helper_allows_reservation_sensitive_staff_actor() -> None:
    actor = ActorStub(is_authenticated=True, is_staff=True, is_active=True)

    require_reservation_sensitive_staff_actor(actor=actor)
