from dataclasses import FrozenInstanceError, dataclass

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone

from apps.identity.roles import IdentityRole
from apps.reservations.attribution import (
    ReservationSensitiveActorAttribution,
    capture_reservation_sensitive_actor_attribution,
)


@dataclass
class ActorStub:
    pk: object | None
    is_authenticated: bool
    is_staff: bool
    is_active: bool | None = True


def test_anonymous_actor_attribution_is_denied() -> None:
    with pytest.raises(PermissionError):
        capture_reservation_sensitive_actor_attribution(actor=None)


def test_unauthenticated_actor_attribution_is_denied() -> None:
    actor = ActorStub(pk=1, is_authenticated=False, is_staff=True)

    with pytest.raises(PermissionError):
        capture_reservation_sensitive_actor_attribution(actor=actor)


def test_inactive_staff_actor_attribution_is_denied() -> None:
    actor = ActorStub(pk=1, is_authenticated=True, is_staff=True, is_active=False)

    with pytest.raises(PermissionError):
        capture_reservation_sensitive_actor_attribution(actor=actor)


def test_non_staff_actor_attribution_is_denied() -> None:
    actor = ActorStub(pk=1, is_authenticated=True, is_staff=False)

    with pytest.raises(PermissionError):
        capture_reservation_sensitive_actor_attribution(actor=actor)


def test_actor_without_persistent_identifier_is_denied() -> None:
    actor = ActorStub(pk=None, is_authenticated=True, is_staff=True)

    with pytest.raises(ValueError, match="persistent identifier"):
        capture_reservation_sensitive_actor_attribution(actor=actor)


def test_valid_actor_identity_and_time_are_captured() -> None:
    actor = ActorStub(pk="actor-123", is_authenticated=True, is_staff=True)

    attribution = capture_reservation_sensitive_actor_attribution(actor=actor)

    assert attribution.actor_id == "actor-123"
    assert timezone.is_aware(attribution.attributed_at)


def test_attribution_is_immutable() -> None:
    attribution = ReservationSensitiveActorAttribution(
        actor_id="actor-123",
        attributed_at=timezone.now(),
    )

    with pytest.raises(FrozenInstanceError):
        attribution.actor_id = "other-actor"


def test_attribution_capture_does_not_require_reservation_object() -> None:
    actor = ActorStub(pk=1, is_authenticated=True, is_staff=True)

    attribution = capture_reservation_sensitive_actor_attribution(actor=actor)

    assert attribution.actor_id == 1


@pytest.mark.django_db
def test_group_mapped_actor_attribution_is_allowed(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="attribution-group-user",
        password="test-pass",
        is_staff=False,
    )
    actor.groups.add(Group.objects.create(name=IdentityRole.RESERVATION_SENSITIVE_OPERATOR.value))

    attribution = capture_reservation_sensitive_actor_attribution(actor=actor)

    assert attribution.actor_id == actor.pk
