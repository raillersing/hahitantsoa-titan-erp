from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.identity.authorization import is_reservation_sensitive_actor
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import ROLE_GROUP_NAME_BY_ROLE, IdentityRole

UNAUTHORIZED_ROLE_ASSIGNMENT = "unauthorized_role_assignment"
ROLE_ASSIGNMENT_NOT_FOUND = "role_assignment_not_found"
ROLE_ALREADY_REVOKED = "role_already_revoked"
SYSTEM_ROLE_REMOVAL_FORBIDDEN = "system_role_removal_forbidden"


class IdentityServiceError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


def _require_identity_admin(*, actor: object | None) -> None:
    if not is_reservation_sensitive_actor(actor=actor):
        raise IdentityServiceError(
            "Actor is not authorized to manage role assignments.",
            code=UNAUTHORIZED_ROLE_ASSIGNMENT,
        )


def sync_system_roles(*, actor: object | None) -> list[ApplicationRole]:
    _require_identity_admin(actor=actor)
    roles: list[ApplicationRole] = []
    with transaction.atomic():
        for role in IdentityRole:
            group_name = ROLE_GROUP_NAME_BY_ROLE[role]
            role_obj, _ = ApplicationRole.objects.get_or_create(
                slug=group_name,
                defaults={
                    "name": group_name,
                    "description": f"System-managed role for {role.value}.",
                    "is_system_managed": True,
                    "is_active": True,
                },
            )
            roles.append(role_obj)
    return roles


def assign_role(
    *,
    actor: object | None,
    user: object,
    role: ApplicationRole,
    notes: str = "",
) -> UserRoleAssignment:
    _require_identity_admin(actor=actor)

    if not getattr(user, "is_active", True):
        raise IdentityServiceError(
            "Cannot assign a role to an inactive user.",
            code=UNAUTHORIZED_ROLE_ASSIGNMENT,
        )

    with transaction.atomic():
        existing = (
            UserRoleAssignment.objects.filter(user=user, role=role, is_active=True)
            .select_for_update()
            .first()
        )
        if existing is not None:
            raise IdentityServiceError(
                "User already has an active assignment for this role.",
                code=UNAUTHORIZED_ROLE_ASSIGNMENT,
            )

        assignment = UserRoleAssignment.objects.create(
            user=user,
            role=role,
            assigned_by=actor if actor else None,
            notes=notes,
        )

    return assignment


def revoke_role(
    *,
    actor: object | None,
    assignment_id: str,
    notes: str = "",
) -> UserRoleAssignment:
    _require_identity_admin(actor=actor)

    with transaction.atomic():
        assignment = UserRoleAssignment.objects.select_for_update().filter(pk=assignment_id).first()
        if assignment is None:
            raise IdentityServiceError(
                "Role assignment not found.",
                code=ROLE_ASSIGNMENT_NOT_FOUND,
            )

        if not assignment.is_active:
            raise IdentityServiceError(
                "Role assignment is already revoked.",
                code=ROLE_ALREADY_REVOKED,
            )

        if assignment.role.is_system_managed:
            raise IdentityServiceError(
                "System-managed role assignments cannot be revoked.",
                code=SYSTEM_ROLE_REMOVAL_FORBIDDEN,
            )

        assignment.is_active = False
        assignment.revoked_at = timezone.now()
        if notes:
            assignment.notes = f"{assignment.notes}\nRevoked: {notes}".strip()
        assignment.save(update_fields=["is_active", "revoked_at", "updated_at", "notes"])

    return assignment
