from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.identity.roles import ROLE_GROUP_NAME_BY_ROLE, IdentityRole
from apps.identity.selectors import user_has_application_role

User = get_user_model()

RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE = (
    "Actor is not allowed to perform a reservation-sensitive write."
)


def is_authenticated_active_actor(*, actor: object | None) -> bool:
    if actor is None:
        return False

    is_authenticated = getattr(actor, "is_authenticated", False)
    if is_authenticated is not True:
        return False

    is_active = getattr(actor, "is_active", None)
    if is_active is False:
        return False

    return True


def actor_has_identity_role(*, actor: object | None, role: IdentityRole) -> bool:
    if not is_authenticated_active_actor(actor=actor):
        return False

    role_slug = ROLE_GROUP_NAME_BY_ROLE[role]
    if actor_has_application_role(actor=actor, role_slug=role_slug):
        return True

    group_manager = getattr(actor, "groups", None)
    if group_manager is None:
        return False

    filter_method = getattr(group_manager, "filter", None)
    if callable(filter_method):
        return filter_method(name=role_slug).exists()

    groups_iterable = getattr(group_manager, "all", None)
    if callable(groups_iterable):
        return any(getattr(group, "name", None) == role_slug for group in groups_iterable())

    return any(getattr(group, "name", None) == role_slug for group in group_manager)


def actor_has_application_role(*, actor: object | None, role_slug: str) -> bool:
    if not is_authenticated_active_actor(actor=actor):
        return False
    if not isinstance(actor, User) or actor.pk is None:
        return False
    return user_has_application_role(user=actor, role_slug=role_slug)


def is_identity_admin_actor(*, actor: object | None) -> bool:
    return is_authenticated_active_actor(actor=actor) and getattr(actor, "is_staff", False) is True


def is_reservation_sensitive_actor(*, actor: object | None) -> bool:
    if not is_authenticated_active_actor(actor=actor):
        return False

    if getattr(actor, "is_staff", False) is True:
        return True

    return actor_has_identity_role(
        actor=actor,
        role=IdentityRole.RESERVATION_SENSITIVE_OPERATOR,
    )


def require_reservation_sensitive_actor(*, actor: object | None) -> None:
    if not is_reservation_sensitive_actor(actor=actor):
        raise PermissionError(RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE)
