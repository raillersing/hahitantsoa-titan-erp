from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.identity.roles import (
    PROTECTED_ROLE_SLUGS,
    ROLE_GROUP_NAME_BY_ROLE,
    IdentityRole,
    capabilities_for_roles,
)
from apps.identity.selectors import user_effective_role_slugs

User = get_user_model()

RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE = (
    "Actor is not allowed to perform a reservation-sensitive write."
)
CASHBOX_SUPERVISOR_PERMISSION_DENIED_MESSAGE = (
    "Actor is not allowed to validate or reopen a cashbox; explicit "
    "cashbox supervisor capability is required."
)
LOGISTICS_OVERRIDE_PERMISSION_DENIED_MESSAGE = (
    "Actor is not allowed to perform a logistics override; explicit "
    "logistics_override capability is required."
)
SUPER_ADMIN_PERMISSION_DENIED_MESSAGE = (
    "Seul un super-administrateur peut supprimer des données métier."
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
    if actor.is_superuser:
        return True
    return role_slug in user_effective_role_slugs(user=actor)


def access_capabilities_for_actor(*, actor: object | None) -> dict[str, bool]:
    if not is_authenticated_active_actor(actor=actor):
        return capabilities_for_roles([])
    return capabilities_for_roles(
        user_effective_role_slugs(user=actor),
        is_staff=getattr(actor, "is_staff", False) is True,
        is_superuser=getattr(actor, "is_superuser", False) is True,
    )


def is_identity_admin_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canManageIdentity"]


def is_reservation_sensitive_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canSensitiveWrite"]


def require_reservation_sensitive_actor(*, actor: object | None) -> None:
    if not is_reservation_sensitive_actor(actor=actor):
        raise PermissionError(RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE)


def is_super_admin_actor(*, actor: object | None) -> bool:
    """Allow destructive test-data cleanup only through Django staff users."""
    return is_authenticated_active_actor(actor=actor) and getattr(actor, "is_staff", False) is True


def require_super_admin_actor(*, actor: object | None) -> None:
    if not is_super_admin_actor(actor=actor):
        raise PermissionError(SUPER_ADMIN_PERMISSION_DENIED_MESSAGE)


def is_cashbox_supervisor_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canSuperviseCashbox"]


def is_cashbox_operator_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canOperateCashbox"]


def require_cashbox_supervisor_actor(*, actor: object | None) -> None:
    if not is_cashbox_supervisor_actor(actor=actor):
        raise PermissionError(CASHBOX_SUPERVISOR_PERMISSION_DENIED_MESSAGE)


def is_logistics_override_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canOverrideLogistics"]


def is_management_or_finance_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canManageFinance"]


def is_inventory_management_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canManageInventory"]


def require_logistics_override_actor(*, actor: object | None) -> None:
    if not is_logistics_override_actor(actor=actor):
        raise PermissionError(LOGISTICS_OVERRIDE_PERMISSION_DENIED_MESSAGE)


def is_logistics_operator_actor(*, actor: object | None) -> bool:
    return access_capabilities_for_actor(actor=actor)["canOperateLogistics"]


def require_logistics_operator_actor(*, actor: object | None) -> None:
    if not is_logistics_operator_actor(actor=actor):
        raise PermissionError("Une autorisation logistique est requise.")


def can_assign_application_role(*, actor, role) -> bool:
    if not is_identity_admin_actor(actor=actor) or not role.is_active:
        return False
    protected = role.is_system_managed or role.slug in PROTECTED_ROLE_SLUGS
    return (
        not protected
        or getattr(actor, "is_staff", False) is True
        or actor_has_application_role(actor=actor, role_slug="owner_manager")
    )
