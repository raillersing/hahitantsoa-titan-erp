import type { SessionUser } from "./api";

/**
 * Capabilities are a presentation hint derived from the backend session.
 * The backend remains authoritative for every read/write request.
 */
export type FrontendCapabilities = {
  canManageIdentity: boolean;
  canViewAudit: boolean;
  canSensitiveWrite: boolean;
};

const RESERVATION_SENSITIVE_ROLE = "reservation_sensitive_operator";
const IDENTITY_ADMIN_ROLE = "identity_admin";

function hasRole(user: SessionUser, role: string): boolean {
  return user.roles.includes(role);
}

export function capabilitiesForUser(user: SessionUser): FrontendCapabilities {
  const canSensitiveWrite = user.is_staff || hasRole(user, RESERVATION_SENSITIVE_ROLE);

  return {
    canManageIdentity: user.is_staff || hasRole(user, IDENTITY_ADMIN_ROLE),
    canViewAudit: canSensitiveWrite,
    canSensitiveWrite,
  };
}
