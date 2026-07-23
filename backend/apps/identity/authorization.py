from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.identity.roles import ROLE_GROUP_NAME_BY_ROLE, IdentityRole
from apps.identity.selectors import user_effective_role_slugs, user_has_application_role

User = get_user_model()

RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE = (
    "Actor is not allowed to perform a reservation-sensitive write."
)
CASHBOX_SUPERVISOR_PERMISSION_DENIED_MESSAGE = (
    "Actor is not allowed to validate or reopen a cashbox; explicit "
    "cashbox supervisor capability is required."
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
    return role_slug in user_effective_role_slugs(user=actor)


def actor_has_application_role(*, actor: object | None, role_slug: str) -> bool:
    if not is_authenticated_active_actor(actor=actor):
        return False
    if not isinstance(actor, User) or actor.pk is None:
        return False
    return user_has_application_role(user=actor, role_slug=role_slug)


def is_identity_admin_actor(*, actor: object | None) -> bool:
    if not is_authenticated_active_actor(actor=actor):
        return False
    # Staff remains the explicit platform superuser path for backwards
    # compatibility; the application role/group path is independently usable
    # for delegated identity administration.
    return getattr(actor, "is_staff", False) is True or actor_has_identity_role(
        actor=actor,
        role=IdentityRole.IDENTITY_ADMIN,
    )


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


def is_cashbox_supervisor_actor(*, actor: object | None) -> bool:
    return actor_has_identity_role(actor=actor, role=IdentityRole.CASHBOX_SUPERVISOR)


def require_cashbox_supervisor_actor(*, actor: object | None) -> None:
    if not is_cashbox_supervisor_actor(actor=actor):
        raise PermissionError(CASHBOX_SUPERVISOR_PERMISSION_DENIED_MESSAGE)
