from __future__ import annotations

from rest_framework.permissions import BasePermission

from apps.identity.authorization import (
    LOGISTICS_OVERRIDE_PERMISSION_DENIED_MESSAGE,
    RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE,
    is_identity_admin_actor,
    is_inventory_management_actor,
    is_logistics_override_actor,
    is_management_or_finance_actor,
    is_reservation_sensitive_actor,
    is_super_admin_actor,
)

IDENTITY_ADMIN_PERMISSION_DENIED_MESSAGE = "Actor is not allowed to manage identity roles."


class HasIdentityAdminAccess(BasePermission):
    message = IDENTITY_ADMIN_PERMISSION_DENIED_MESSAGE

    def has_permission(self, request, view) -> bool:
        return is_identity_admin_actor(actor=request.user)


class HasReservationSensitiveAccess(BasePermission):
    message = RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE

    def has_permission(self, request, view) -> bool:
        return is_reservation_sensitive_actor(actor=request.user)


class HasLogisticsOverrideAccess(BasePermission):
    message = LOGISTICS_OVERRIDE_PERMISSION_DENIED_MESSAGE

    def has_permission(self, request, view) -> bool:
        return is_logistics_override_actor(actor=request.user)


class HasManagementOrFinanceAccess(BasePermission):
    message = "Une capacité de gestion ou de comptabilité est requise."

    def has_permission(self, request, view) -> bool:
        return is_management_or_finance_actor(actor=request.user)


class HasInventoryManagementAccess(BasePermission):
    message = "Une capacité de gestion du stock est requise."

    def has_permission(self, request, view) -> bool:
        return is_inventory_management_actor(actor=request.user)


class HasSuperAdminAccess(BasePermission):
    message = "Seul un super-administrateur peut supprimer des données métier."

    def has_permission(self, request, view) -> bool:
        return is_super_admin_actor(actor=request.user)
