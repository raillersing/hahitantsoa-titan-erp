from __future__ import annotations

from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import APPROVED_GROUP_ROLE_SLUGS


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

    effective_slugs: set[str] = set()
    # Lightweight actor stubs are used by authorization unit tests. Do not
    # pass arbitrary non-model objects into a relational filter.
    if getattr(user, "_meta", None) is not None and getattr(user, "pk", None) is not None:
        assignment_slugs = UserRoleAssignment.objects.filter(
            user=user,
            role__is_active=True,
            is_active=True,
        ).values_list("role__slug", flat=True)
        effective_slugs.update(assignment_slugs)

    # Groups are a supported Django identity source. Keep this selector as the
    # single effective-role authority so session payloads and endpoint checks
    # cannot silently disagree about a user's capabilities.
    groups = getattr(user, "groups", None)
    if groups is not None:
        values_list = getattr(groups, "values_list", None)
        if callable(values_list):
            group_slugs = set(values_list("name", flat=True)) & APPROVED_GROUP_ROLE_SLUGS
        else:
            all_groups = getattr(groups, "all", None)
            iterable = all_groups() if callable(all_groups) else groups
            group_slugs = {
                name for name in (getattr(group, "name", None) for group in iterable) if name
            } & APPROVED_GROUP_ROLE_SLUGS

        # A legacy group grant remains effective only while a corresponding
        # ApplicationRole is absent or active. Deactivating a seeded role must
        # therefore revoke both DB assignments and group-backed capability.
        inactive_group_slugs = set(
            ApplicationRole.objects.filter(
                slug__in=group_slugs,
                is_active=False,
            ).values_list("slug", flat=True)
        )
        effective_slugs.update(group_slugs - inactive_group_slugs)

    return effective_slugs
