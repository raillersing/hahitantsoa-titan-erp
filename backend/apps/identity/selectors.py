from __future__ import annotations

from apps.identity.models import ApplicationRole, UserRoleAssignment


def active_roles() -> list[ApplicationRole]:
    return list(ApplicationRole.objects.filter(is_active=True).order_by("name"))


def user_active_assignments(*, user: object) -> list[UserRoleAssignment]:
    return list(
        UserRoleAssignment.objects.filter(user=user, is_active=True)
        .select_related("role")
        .order_by("-assigned_at")
    )


def user_has_application_role(*, user: object, role_slug: str) -> bool:
    if not getattr(user, "is_active", True):
        return False
    return UserRoleAssignment.objects.filter(
        user=user,
        role__slug=role_slug,
        role__is_active=True,
        is_active=True,
    ).exists()


def user_effective_role_slugs(*, user: object) -> set[str]:
    if not getattr(user, "is_active", True):
        return set()
    qs = UserRoleAssignment.objects.filter(
        user=user,
        role__is_active=True,
        is_active=True,
    ).values_list("role__slug", flat=True)
    return set(qs)
