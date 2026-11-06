from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.identity.authorization import (
    actor_has_application_role,
    can_assign_application_role,
    is_identity_admin_actor,
)
from apps.identity.models import ApplicationRole, UserRoleAssignment
from apps.identity.roles import (
    COMPANY_ROLE_CATALOG,
    PROTECTED_ROLE_SLUGS,
    ROLE_GROUP_NAME_BY_ROLE,
    IdentityRole,
)

UNAUTHORIZED_ROLE_ASSIGNMENT = "unauthorized_role_assignment"
ROLE_ASSIGNMENT_NOT_FOUND = "role_assignment_not_found"
ROLE_ALREADY_REVOKED = "role_already_revoked"
ROLE_ALREADY_ASSIGNED = "role_already_assigned"
ROLE_INACTIVE = "role_inactive"
UNAUTHORIZED_PLATFORM_ROLE = "unauthorized_platform_role"
COMPANY_ROLE_NAME_CONFLICT = "company_role_name_conflict"
COMPANY_ROLE_DEFINITION_CONFLICT = "company_role_definition_conflict"
COMPANY_ROLE_CATALOG_SYSTEM_ACTOR = "sync_company_role_catalog"
USER_ALREADY_EXISTS = "user_already_exists"
USER_NOT_FOUND = "user_not_found"
CANNOT_DEACTIVATE_SELF = "cannot_deactivate_self"
INVALID_PASSWORD = "invalid_password"
ROLE_NOT_FOUND = "role_not_found"

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


def _lock_managed_user(*, actor: object | None, user_id: int | str) -> User:
    # Lock administrators in one order so competing suspensions cannot remove
    # each other's authority using stale request.user objects.
    users = list(
        User.objects.select_for_update()
        .filter(Q(pk=user_id) | Q(pk=getattr(actor, "pk", None)) | Q(is_active=True, is_staff=True))
        .order_by("pk")
    )
    current_actor = next((u for u in users if u.pk == getattr(actor, "pk", None)), None)
    _require_identity_admin(actor=current_actor)
    target = next((u for u in users if str(u.pk) == str(user_id)), None)
    if target is None:
        raise IdentityServiceError("Utilisateur introuvable.", code=USER_NOT_FOUND)
    if target.is_superuser and not current_actor.is_superuser:
        raise IdentityServiceError(
            "Seul un super-utilisateur peut modifier ce compte protégé.",
            code=UNAUTHORIZED_PLATFORM_ROLE,
        )
    if target.is_staff and not current_actor.is_staff:
        raise IdentityServiceError("Compte technique protégé.", code=UNAUTHORIZED_PLATFORM_ROLE)
    if (
        target.pk != current_actor.pk
        and is_identity_admin_actor(actor=target)
        and not current_actor.is_staff
        and not actor_has_application_role(actor=current_actor, role_slug="owner_manager")
    ):
        raise IdentityServiceError(
            "Seul un administrateur de plateforme peut modifier ce compte protégé.",
            code=UNAUTHORIZED_PLATFORM_ROLE,
        )
    return target


def _invalidate_user_sessions(*, user: User) -> None:
    # The application uses Django database sessions. Delete only this user's
    # sessions inside the same transaction as suspension; never log session data.
    keys = [
        session.session_key
        for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator()
        if str(session.get_decoded().get("_auth_user_id", "")) == str(user.pk)
    ]
    Session.objects.filter(session_key__in=keys).delete()


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
    platform capability registry. Their business capabilities are declared in
    roles.py; protected business grants use the existing audited assignment
    lifecycle and never promote a Django platform account.  Catalog seeding has no human
    actor, so audit events intentionally use ``actor=None`` and identify the
    system executor through the ``system_actor`` metadata field.
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
            try:
                with transaction.atomic():
                    role_obj, created = ApplicationRole.objects.get_or_create(
                        slug=role.value,
                        defaults={
                            **definition,
                            "is_system_managed": False,
                            "is_active": True,
                        },
                    )
            except IntegrityError as exc:
                raise IdentityServiceError(
                    f"Company role name is already used by another slug: {definition['name']}.",
                    code=COMPANY_ROLE_NAME_CONFLICT,
                ) from exc
            if not created and (
                role_obj.name != definition["name"]
                or role_obj.description != definition["description"]
                or role_obj.is_system_managed
                or not role_obj.is_active
            ):
                raise IdentityServiceError(
                    f"Company role slug has a conflicting definition: {role.value}.",
                    code=COMPANY_ROLE_DEFINITION_CONFLICT,
                )
            if created:
                record_audit_event_on_commit(
                    actor=None,
                    action="identity.company_role_catalog_created",
                    target_type="application_role",
                    target_id=str(role_obj.id),
                    metadata={
                        "system_actor": COMPANY_ROLE_CATALOG_SYSTEM_ACTOR,
                        "role_slug": role_obj.slug,
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
        locked_user = _lock_managed_user(actor=actor, user_id=user.pk)
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
        if not can_assign_application_role(actor=actor, role=locked_role):
            raise IdentityServiceError(
                "Only a platform administrator or owner may assign this protected role.",
                code=UNAUTHORIZED_PLATFORM_ROLE,
            )

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
        user_id = (
            UserRoleAssignment.objects.filter(pk=assignment_id)
            .values_list("user_id", flat=True)
            .first()
        )
        if user_id is not None:
            _lock_managed_user(actor=actor, user_id=user_id)
        assignment = UserRoleAssignment.objects.select_for_update().filter(pk=assignment_id).first()
        if assignment is None:
            raise IdentityServiceError(
                "Role assignment not found.",
                code=ROLE_ASSIGNMENT_NOT_FOUND,
            )

        if (
            assignment.user_id == getattr(actor, "pk", None)
            and assignment.role.slug in {"identity_admin", "owner_manager"}
            and not getattr(actor, "is_staff", False)
        ):
            raise IdentityServiceError(
                "Vous ne pouvez pas retirer votre propre accès d’administration.",
                code="cannot_remove_own_admin_access",
            )

        if not assignment.is_active:
            raise IdentityServiceError(
                "Role assignment is already revoked.",
                code=ROLE_ALREADY_REVOKED,
            )
        if assignment.role.is_system_managed or assignment.role.slug in PROTECTED_ROLE_SLUGS:
            if not actor_has_application_role(actor=actor, role_slug="owner_manager"):
                _require_platform_identity_admin(actor=actor)

        assignment.user.groups.remove(
            *assignment.user.groups.filter(
                name=assignment.role.slug,
                name__in=ROLE_GROUP_NAME_BY_ROLE.values(),
            )
        )
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


def create_user(
    *,
    actor: object | None,
    username: str,
    email: str = "",
    first_name: str = "",
    last_name: str = "",
    password: str,
    role_slugs: list[str] | None = None,
) -> User:
    _require_identity_admin(actor=actor)

    clean_username = username.strip()
    if not clean_username:
        raise IdentityServiceError("Le nom d'utilisateur est obligatoire.", code="invalid_username")

    if User.objects.filter(username__iexact=clean_username).exists():
        raise IdentityServiceError(
            f"Un utilisateur avec le nom d'utilisateur '{clean_username}' existe déjà.",
            code=USER_ALREADY_EXISTS,
        )

    clean_email = email.strip()
    if clean_email and User.objects.filter(email__iexact=clean_email).exists():
        raise IdentityServiceError(
            f"Un utilisateur avec l'adresse e-mail '{clean_email}' existe déjà.",
            code="email_already_exists",
        )

    temp_user = User(
        username=clean_username,
        email=clean_email,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
    )
    try:
        validate_password(password, user=temp_user)
    except DjangoValidationError as exc:
        raise IdentityServiceError(
            "; ".join(exc.messages),
            code=INVALID_PASSWORD,
        ) from exc

    with transaction.atomic():
        user = User.objects.create_user(
            username=clean_username,
            email=clean_email,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            password=password,
            is_active=True,
        )

        assigned_roles: list[str] = []
        if role_slugs:
            for slug in role_slugs:
                slug_clean = slug.strip()
                if not slug_clean:
                    continue
                try:
                    role_obj = ApplicationRole.objects.get(slug=slug_clean)
                except ApplicationRole.DoesNotExist as exc:
                    raise IdentityServiceError(
                        f"Rôle introuvable : {slug_clean}.",
                        code=ROLE_NOT_FOUND,
                    ) from exc
                assign_role(actor=actor, user=user, role=role_obj)
                assigned_roles.append(slug_clean)

        record_audit_event_on_commit(
            actor=actor,
            action="identity.user_created",
            target_type="user",
            target_id=str(user.pk),
            metadata={
                "username": user.username,
                "email": user.email,
                "role_slugs": assigned_roles,
            },
        )

    return user


def update_user(
    *,
    actor: object | None,
    user_id: int | str,
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
    is_active: bool | None = None,
    role_slugs: list[str] | None = None,
) -> User:
    _require_identity_admin(actor=actor)

    with transaction.atomic():
        target_user = _lock_managed_user(actor=actor, user_id=user_id)

        actor_pk = getattr(actor, "pk", None)
        if is_active is False and actor_pk is not None and str(actor_pk) == str(target_user.pk):
            raise IdentityServiceError(
                "Vous ne pouvez pas désactiver votre propre compte utilisateur.",
                code=CANNOT_DEACTIVATE_SELF,
            )

        update_fields: list[str] = []
        if first_name is not None:
            target_user.first_name = first_name.strip()
            update_fields.append("first_name")

        if last_name is not None:
            target_user.last_name = last_name.strip()
            update_fields.append("last_name")

        if email is not None:
            clean_email = email.strip()
            if clean_email and (
                User.objects.filter(email__iexact=clean_email).exclude(pk=target_user.pk).exists()
            ):
                raise IdentityServiceError(
                    f"Un utilisateur avec l'adresse e-mail '{clean_email}' existe déjà.",
                    code="email_already_exists",
                )
            target_user.email = clean_email
            update_fields.append("email")

        if is_active is not None:
            target_user.is_active = is_active
            update_fields.append("is_active")

        if update_fields:
            target_user.save(update_fields=update_fields)
        if is_active is False:
            _invalidate_user_sessions(user=target_user)

        if role_slugs is not None:
            target_slugs = {s.strip() for s in role_slugs if s.strip()}
            if (
                target_user.pk == getattr(actor, "pk", None)
                and not target_user.is_staff
                and not target_slugs.intersection({"identity_admin", "owner_manager"})
            ):
                raise IdentityServiceError(
                    "Vous ne pouvez pas retirer votre propre accès d’administration.",
                    code="cannot_remove_own_admin_access",
                )
            current_assignments = {
                a.role.slug: a
                for a in UserRoleAssignment.objects.filter(
                    user=target_user,
                    is_active=True,
                ).select_related("role")
            }

            group_slugs = set(target_user.groups.values_list("name", flat=True)) & set(
                ROLE_GROUP_NAME_BY_ROLE.values()
            )
            removed_groups = group_slugs - target_slugs
            if removed_groups:
                if not actor_has_application_role(actor=actor, role_slug="owner_manager"):
                    _require_platform_identity_admin(actor=actor)
                target_user.groups.remove(*target_user.groups.filter(name__in=removed_groups))
                record_audit_event_on_commit(
                    actor=actor,
                    action="identity.legacy_group_roles_revoked",
                    target_type="user",
                    target_id=str(target_user.pk),
                    metadata={"role_slugs": sorted(removed_groups)},
                )

            # Revoke unselected roles
            for slug, assignment in current_assignments.items():
                if slug not in target_slugs:
                    revoke_role(
                        actor=actor,
                        assignment_id=str(assignment.id),
                        notes="Rôle retiré lors de la mise à jour du profil collaborateur",
                    )

            # Assign newly selected roles
            for slug in target_slugs:
                if slug not in current_assignments and slug not in group_slugs:
                    try:
                        role_obj = ApplicationRole.objects.get(slug=slug)
                    except ApplicationRole.DoesNotExist as exc:
                        raise IdentityServiceError(
                            f"Rôle introuvable : {slug}.",
                            code=ROLE_NOT_FOUND,
                        ) from exc
                    assign_role(actor=actor, user=target_user, role=role_obj)

        record_audit_event_on_commit(
            actor=actor,
            action="identity.user_updated",
            target_type="user",
            target_id=str(target_user.pk),
            metadata={
                "username": target_user.username,
                "is_active": target_user.is_active,
                "role_slugs": role_slugs,
            },
        )

    return target_user


def reset_user_password(
    *,
    actor: object | None,
    user_id: int | str,
    new_password: str,
) -> User:
    _require_identity_admin(actor=actor)

    with transaction.atomic():
        target_user = _lock_managed_user(actor=actor, user_id=user_id)

        try:
            validate_password(new_password, user=target_user)
        except DjangoValidationError as exc:
            raise IdentityServiceError(
                "; ".join(exc.messages),
                code=INVALID_PASSWORD,
            ) from exc

        target_user.set_password(new_password)
        target_user.save(update_fields=["password"])

        record_audit_event_on_commit(
            actor=actor,
            action="identity.user_password_reset",
            target_type="user",
            target_id=str(target_user.pk),
            metadata={
                "username": target_user.username,
            },
        )

    return target_user
