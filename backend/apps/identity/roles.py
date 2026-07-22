from __future__ import annotations

from enum import StrEnum


class IdentityRole(StrEnum):
    IDENTITY_ADMIN = "identity_admin"
    RESERVATION_SENSITIVE_OPERATOR = "reservation_sensitive_operator"


class CompanyRole(StrEnum):
    OWNER_MANAGER = "owner_manager"
    MANAGER = "manager"
    STOREKEEPER = "storekeeper"
    DELIVERY_DRIVER = "delivery_driver"
    CLEANER = "cleaner"
    LOGISTICS_MANAGER = "logistics_manager"
    ACCOUNTANT = "accountant"


ROLE_GROUP_NAME_BY_ROLE: dict[IdentityRole, str] = {
    IdentityRole.IDENTITY_ADMIN: "identity_admin",
    IdentityRole.RESERVATION_SENSITIVE_OPERATOR: "reservation_sensitive_operator",
}

# Django groups are the legacy identity source for these platform capabilities.
# Custom ApplicationRole slugs must use UserRoleAssignment instead, so arbitrary
# group names cannot become session capabilities.
APPROVED_GROUP_ROLE_SLUGS = frozenset(ROLE_GROUP_NAME_BY_ROLE.values())

# These describe a company's operational responsibilities.  They are ordinary
# ApplicationRole records rather than platform capabilities: assignment alone
# must never grant identity-administration or reservation-sensitive access.
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
}
