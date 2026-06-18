from __future__ import annotations

from enum import StrEnum


class IdentityRole(StrEnum):
    RESERVATION_SENSITIVE_OPERATOR = "reservation_sensitive_operator"


ROLE_GROUP_NAME_BY_ROLE: dict[IdentityRole, str] = {
    IdentityRole.RESERVATION_SENSITIVE_OPERATOR: "reservation_sensitive_operator",
}
