import { describe, expect, it } from "vitest";

import { capabilitiesForUser } from "./capabilities";

const baseUser = {
  id: "user-1",
  username: "operator",
  display_name: "Operator",
  is_staff: false,
};

describe("capabilitiesForUser", () => {
  it("maps the backend reservation-sensitive role to sensitive actions and audit", () => {
    expect(capabilitiesForUser({ ...baseUser, roles: ["reservation_sensitive_operator"] })).toEqual({
      canManageIdentity: false,
      canViewAudit: true,
      canSensitiveWrite: true,
    });
  });

  it("maps the backend identity-admin role without granting sensitive operations", () => {
    expect(capabilitiesForUser({ ...baseUser, roles: ["identity_admin"] })).toEqual({
      canManageIdentity: true,
      canViewAudit: false,
      canSensitiveWrite: false,
    });
  });

  it("keeps staff aligned with the backend platform capability", () => {
    expect(capabilitiesForUser({ ...baseUser, is_staff: true, roles: [] })).toEqual({
      canManageIdentity: true,
      canViewAudit: true,
      canSensitiveWrite: true,
    });
  });

  it("denies unknown roles instead of treating arbitrary role names as capabilities", () => {
    expect(capabilitiesForUser({ ...baseUser, roles: ["commercial", "direction", "made_up_admin"] })).toEqual({
      canManageIdentity: false,
      canViewAudit: false,
      canSensitiveWrite: false,
    });
  });
});
