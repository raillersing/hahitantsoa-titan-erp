from rest_framework.permissions import BasePermission

from apps.identity.authorization import actor_has_application_role, is_authenticated_active_actor

PAYROLL_RULES_VIEW_ROLES = {"hr_manager", "accountant", "owner_manager"}
PAYROLL_RULES_EDIT_ROLES = {"hr_manager", "owner_manager"}
PAYROLL_RULES_ACTIVATE_ROLES = {"accountant", "owner_manager"}
PAYROLL_RECORDS_VIEW_ROLES = {"hr_manager", "accountant", "owner_manager"}
PAYROLL_RECORDS_EDIT_ROLES = {"hr_manager", "owner_manager"}


def _has_any_role(actor: object, roles: set[str]) -> bool:
    return getattr(actor, "is_staff", False) is True or any(
        actor_has_application_role(actor=actor, role_slug=role) for role in roles
    )


class HasPayrollRulesViewAccess(BasePermission):
    message = "Un rôle RH ou financier est requis pour consulter les règles de paie."

    def has_permission(self, request, view) -> bool:
        return is_authenticated_active_actor(actor=request.user) and _has_any_role(
            request.user, PAYROLL_RULES_VIEW_ROLES
        )


class HasPayrollRulesEditAccess(BasePermission):
    message = "Seule la DRH ou la direction peut modifier un brouillon de règles de paie."

    def has_permission(self, request, view) -> bool:
        return is_authenticated_active_actor(actor=request.user) and _has_any_role(
            request.user, PAYROLL_RULES_EDIT_ROLES
        )


class HasPayrollRulesActivationAccess(BasePermission):
    message = "Une autorisation comptable ou de direction est requise pour activer les règles."

    def has_permission(self, request, view) -> bool:
        return is_authenticated_active_actor(actor=request.user) and _has_any_role(
            request.user, PAYROLL_RULES_ACTIVATE_ROLES
        )


class HasPayrollRecordsViewAccess(BasePermission):
    message = "Un rôle RH, comptable ou de direction est requis pour consulter ces données."

    def has_permission(self, request, view) -> bool:
        return is_authenticated_active_actor(actor=request.user) and _has_any_role(
            request.user, PAYROLL_RECORDS_VIEW_ROLES
        )


class HasPayrollRecordsEditAccess(BasePermission):
    message = "Seule la DRH ou la direction peut modifier ces données RH."

    def has_permission(self, request, view) -> bool:
        return is_authenticated_active_actor(actor=request.user) and _has_any_role(
            request.user, PAYROLL_RECORDS_EDIT_ROLES
        )
