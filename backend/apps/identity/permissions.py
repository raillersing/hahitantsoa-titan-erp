from __future__ import annotations

from rest_framework.permissions import BasePermission

from apps.identity.authorization import (
    RESERVATION_SENSITIVE_PERMISSION_DENIED_MESSAGE,
    is_identity_admin_actor,
    is_reservation_sensitive_actor,
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
