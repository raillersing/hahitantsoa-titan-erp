from __future__ import annotations

from enum import StrEnum


class IdentityRole(StrEnum):
    IDENTITY_ADMIN = "identity_admin"
    RESERVATION_SENSITIVE_OPERATOR = "reservation_sensitive_operator"


ROLE_GROUP_NAME_BY_ROLE: dict[IdentityRole, str] = {
    IdentityRole.IDENTITY_ADMIN: "identity_admin",
    IdentityRole.RESERVATION_SENSITIVE_OPERATOR: "reservation_sensitive_operator",
}

# Django groups are the legacy identity source for these platform capabilities.
# Custom ApplicationRole slugs must use UserRoleAssignment instead, so arbitrary
# group names cannot become session capabilities.
APPROVED_GROUP_ROLE_SLUGS = frozenset(ROLE_GROUP_NAME_BY_ROLE.values())
