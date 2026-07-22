from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.identity.authorization import is_identity_admin_actor
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import COMPANY_ROLE_CATALOG, ROLE_GROUP_NAME_BY_ROLE, IdentityRole

UNAUTHORIZED_ROLE_ASSIGNMENT = "unauthorized_role_assignment"
ROLE_ASSIGNMENT_NOT_FOUND = "role_assignment_not_found"
ROLE_ALREADY_REVOKED = "role_already_revoked"
ROLE_ALREADY_ASSIGNED = "role_already_assigned"
ROLE_INACTIVE = "role_inactive"
UNAUTHORIZED_PLATFORM_ROLE = "unauthorized_platform_role"
COMPANY_ROLE_NAME_CONFLICT = "company_role_name_conflict"

User = get_user_model()


class IdentityServiceError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


def _require_identity_admin(*, actor: object | None) -> None:
    if not is_identity_admin_actor(actor=actor):
        raise IdentityServiceError(
            "Actor is not authorized to manage role assignments.",
            code=UNAUTHORIZED_ROLE_ASSIGNMENT,
        )


def _require_platform_identity_admin(*, actor: object | None) -> None:
    _require_identity_admin(actor=actor)
    if not getattr(actor, "is_staff", False):
        raise IdentityServiceError(
            "Only a platform administrator may manage system roles.",
            code=UNAUTHORIZED_PLATFORM_ROLE,
        )


def sync_system_roles(*, actor: object | None) -> list[ApplicationRole]:
    _require_platform_identity_admin(actor=actor)
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


def sync_company_role_catalog() -> list[ApplicationRole]:
    """Create missing operational roles without changing existing records.

    The catalogue deliberately uses regular application roles.  It is not a
    platform capability registry and therefore does not affect endpoint
    permissions; identity administrators can assign and revoke these roles
    through the existing assignment lifecycle.
    """

    roles: list[ApplicationRole] = []
    with transaction.atomic():
        for role, definition in COMPANY_ROLE_CATALOG.items():
            if (
                ApplicationRole.objects.filter(name=definition["name"])
                .exclude(slug=role.value)
                .exists()
            ):
                raise IdentityServiceError(
                    f"Company role name is already used by another slug: {definition['name']}.",
                    code=COMPANY_ROLE_NAME_CONFLICT,
                )
            role_obj, _ = ApplicationRole.objects.get_or_create(
                slug=role.value,
                defaults={
                    **definition,
                    "is_system_managed": False,
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

    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        locked_role = ApplicationRole.objects.select_for_update().get(pk=role.pk)
        if not locked_user.is_active:
            raise IdentityServiceError(
                "Cannot assign a role to an inactive user.",
                code=UNAUTHORIZED_ROLE_ASSIGNMENT,
            )
        if not locked_role.is_active:
            raise IdentityServiceError(
                "Cannot assign an inactive role.",
                code=ROLE_INACTIVE,
            )
        if locked_role.is_system_managed or locked_role.slug in ROLE_GROUP_NAME_BY_ROLE.values():
            _require_platform_identity_admin(actor=actor)

        existing = (
            UserRoleAssignment.objects.filter(
                user=locked_user,
                role=locked_role,
                is_active=True,
            )
            .select_for_update()
            .first()
        )
        if existing is not None:
            raise IdentityServiceError(
                "User already has an active assignment for this role.",
                code=ROLE_ALREADY_ASSIGNED,
            )

        try:
            with transaction.atomic():
                assignment = UserRoleAssignment.objects.create(
                    user=locked_user,
                    role=locked_role,
                    assigned_by=actor if actor else None,
                    created_by=actor if actor else None,
                    updated_by=actor if actor else None,
                    notes=notes,
                )
        except IntegrityError as exc:
            raise IdentityServiceError(
                "User already has an active assignment for this role.",
                code=ROLE_ALREADY_ASSIGNED,
            ) from exc
        record_audit_event_on_commit(
            actor=actor,
            action="identity.role_assigned",
            target_type="user_role_assignment",
            target_id=str(assignment.id),
            metadata={
                "user_id": locked_user.pk,
                "role_id": str(locked_role.id),
                "role_slug": locked_role.slug,
            },
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
        if assignment.role.is_system_managed or assignment.role.slug in (
            ROLE_GROUP_NAME_BY_ROLE.values()
        ):
            _require_platform_identity_admin(actor=actor)

        assignment.is_active = False
        assignment.revoked_at = timezone.now()
        if notes:
            assignment.notes = f"{assignment.notes}\nRevoked: {notes}".strip()
        assignment.updated_by = actor if actor else None
        assignment.save(
            update_fields=["is_active", "revoked_at", "updated_at", "updated_by", "notes"]
        )
        record_audit_event_on_commit(
            actor=actor,
            action="identity.role_revoked",
            target_type="user_role_assignment",
            target_id=str(assignment.id),
            metadata={
                "user_id": assignment.user_id,
                "role_id": str(assignment.role_id),
                "role_slug": assignment.role.slug,
            },
        )

    return assignment
