from __future__ import annotations

from enum import StrEnum


class IdentityRole(StrEnum):
    IDENTITY_ADMIN = "identity_admin"
    RESERVATION_SENSITIVE_OPERATOR = "reservation_sensitive_operator"
    CASHBOX_SUPERVISOR = "cashbox_supervisor"
    CASHBOX_OPERATOR = "cashbox_operator"


class CompanyRole(StrEnum):
    OWNER_MANAGER = "owner_manager"
    MANAGER = "manager"
    STOREKEEPER = "storekeeper"
    DELIVERY_DRIVER = "delivery_driver"
    CLEANER = "cleaner"
    LOGISTICS_MANAGER = "logistics_manager"
    ACCOUNTANT = "accountant"
    HR_MANAGER = "hr_manager"


ROLE_GROUP_NAME_BY_ROLE: dict[IdentityRole, str] = {
    IdentityRole.IDENTITY_ADMIN: "identity_admin",
    IdentityRole.RESERVATION_SENSITIVE_OPERATOR: "reservation_sensitive_operator",
    IdentityRole.CASHBOX_SUPERVISOR: "cashbox_supervisor",
    IdentityRole.CASHBOX_OPERATOR: "cashbox_operator",
}

# Django groups are the legacy identity source for these platform capabilities.
# Custom ApplicationRole slugs must use UserRoleAssignment instead, so arbitrary
# group names cannot become session capabilities.
APPROVED_GROUP_ROLE_SLUGS = frozenset(ROLE_GROUP_NAME_BY_ROLE.values())

# These describe a company's operational responsibilities.  They are ordinary
# ApplicationRole records. Their business capabilities are declared explicitly
# below; no assignment promotes a user to Django staff/superuser.
COMPANY_ROLE_CATALOG: dict[CompanyRole, dict[str, str]] = {
    CompanyRole.OWNER_MANAGER: {
        "name": "Gérant / propriétaire",
        "description": "Responsable propriétaire de l'entreprise.",
    },
    CompanyRole.MANAGER: {
        "name": "Manager",
        "description": "Responsable opérationnel de l'entreprise.",
    },
    CompanyRole.STOREKEEPER: {
        "name": "Magasinier",
        "description": "Responsable du magasin et des articles.",
    },
    CompanyRole.DELIVERY_DRIVER: {
        "name": "Livreur",
        "description": "Responsable des livraisons.",
    },
    CompanyRole.CLEANER: {
        "name": "Femme de ménage",
        "description": "Responsable de l'entretien.",
    },
    CompanyRole.LOGISTICS_MANAGER: {
        "name": "Responsable logistique",
        "description": "Responsable de la coordination logistique.",
    },
    CompanyRole.ACCOUNTANT: {
        "name": "Comptable",
        "description": "Responsable de la comptabilité.",
    },
    CompanyRole.HR_MANAGER: {
        "name": "Responsable RH / DRH",
        "description": (
            "Responsable des ressources humaines et de la préparation des règles de paie."
        ),
    },
}


# Client-approved access audit, 2026-11-06: business capabilities are distinct
# from Django staff and from attribution of a named role.
ROLE_CAPABILITIES = {
    "identity_admin": {"canManageIdentity"},
    "reservation_sensitive_operator": {
        "canSensitiveWrite",
        "canViewAudit",
        "canOperateLogistics",
        "canOperateCashbox",
    },
    "owner_manager": {
        "canManageIdentity",
        "canViewPayroll",
        "canEditPayroll",
        "canActivatePayroll",
        "canSensitiveWrite",
        "canViewAudit",
        "canManageInventory",
        "canManageFinance",
        "canOperateLogistics",
        "canOperateCashbox",
        "canSuperviseCashbox",
        "canOverrideLogistics",
    },
    "manager": {
        "canSensitiveWrite",
        "canViewAudit",
        "canManageInventory",
        "canManageFinance",
        "canOperateLogistics",
        "canOperateCashbox",
    },
    "storekeeper": {"canManageInventory", "canOperateLogistics"},
    "logistics_manager": {"canManageInventory", "canOperateLogistics"},
    "accountant": {"canManageFinance", "canViewPayroll", "canActivatePayroll"},
    "hr_manager": {"canViewPayroll", "canEditPayroll"},
    "cashbox_operator": {"canOperateCashbox"},
    "cashbox_supervisor": {"canOperateCashbox", "canSuperviseCashbox"},
    "logistics_override": {"canOverrideLogistics"},
}


def capabilities_for_roles(role_slugs, *, is_staff=False, is_superuser=False):
    granted = set().union(*(ROLE_CAPABILITIES.get(slug, set()) for slug in role_slugs))
    if is_staff:
        granted.update(
            {
                "canManageIdentity",
                "canViewPayroll",
                "canEditPayroll",
                "canActivatePayroll",
                "canSensitiveWrite",
                "canViewAudit",
                "canManageInventory",
                "canManageFinance",
                "canOperateLogistics",
                "canOperateCashbox",
                "canSuperAdminDelete",
            }
        )
    if is_superuser:
        granted.update(set().union(*ROLE_CAPABILITIES.values()))
    keys = set().union(*ROLE_CAPABILITIES.values()) | {"canSuperAdminDelete"}
    return {key: key in granted for key in sorted(keys)}


PROTECTED_ROLE_SLUGS = frozenset(ROLE_GROUP_NAME_BY_ROLE.values()) | {
    "owner_manager",
    "manager",
    "logistics_override",
}
