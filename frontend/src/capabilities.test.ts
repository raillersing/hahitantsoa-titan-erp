import { describe, expect, it } from "vitest";

import type { SessionUser } from "./api";
import {
  CANONICAL_REPORT_CATEGORIES,
  capabilitiesForUser,
  reportCategoriesForUser,
} from "./capabilities";
import type { ReportCategory } from "./types";

const baseUser: SessionUser = {
  id: "user-1",
  username: "operator",
  display_name: "Operator",
  is_staff: false,
  roles: [],
};

describe("capabilitiesForUser", () => {
  it("consumes authoritative server-provided capabilities directly", () => {
    const user: SessionUser = {
      ...baseUser,
      capabilities: {
        canManageIdentity: false,
        canViewAudit: false,
        canSensitiveWrite: false,
        canSuperAdminDelete: false,
        canManageFinance: true,
        canManageInventory: false,
        canOperateLogistics: false,
        canOperateCashbox: false,
        canSuperviseCashbox: false,
        canOverrideLogistics: false,
        canViewPayroll: true,
        canEditPayroll: false,
        canActivatePayroll: true,
      },
    };

    expect(capabilitiesForUser(user)).toEqual({
      canManageIdentity: false,
      canViewAudit: false,
      canSensitiveWrite: false,
      canSuperAdminDelete: false,
      canManageFinance: true,
      canManageInventory: false,
      canOperateLogistics: false,
      canOperateCashbox: false,
      canSuperviseCashbox: false,
      canOverrideLogistics: false,
      canViewPayroll: true,
      canEditPayroll: false,
      canActivatePayroll: true,
    });
  });

  it("distinguishes cashbox supervisor from simple operator through server capabilities", () => {
    const operatorUser: SessionUser = {
      ...baseUser,
      capabilities: {
        canOperateCashbox: true,
        canSuperviseCashbox: false,
      },
    };
    const supervisorUser: SessionUser = {
      ...baseUser,
      capabilities: {
        canOperateCashbox: true,
        canSuperviseCashbox: true,
      },
    };

    expect(capabilitiesForUser(operatorUser).canOperateCashbox).toBe(true);
    expect(capabilitiesForUser(operatorUser).canSuperviseCashbox).toBe(false);

    expect(capabilitiesForUser(supervisorUser).canOperateCashbox).toBe(true);
    expect(capabilitiesForUser(supervisorUser).canSuperviseCashbox).toBe(true);
  });

  it("strictly forbids deducing capabilities from role names (no client-side guessing)", () => {
    // Even if role names are present, absent capabilities must fail closed to false
    const accountantUser: SessionUser = {
      ...baseUser,
      roles: ["accountant"],
      capabilities: {},
    };
    const sensitiveUser: SessionUser = {
      ...baseUser,
      roles: ["reservation_sensitive_operator"],
      capabilities: {},
    };
    const identityAdminUser: SessionUser = {
      ...baseUser,
      roles: ["identity_admin"],
      capabilities: {},
    };
    const supervisorRoleUser: SessionUser = {
      ...baseUser,
      roles: ["cashbox_supervisor"],
      capabilities: {},
    };

    expect(capabilitiesForUser(accountantUser).canManageFinance).toBe(false);
    expect(capabilitiesForUser(sensitiveUser).canSensitiveWrite).toBe(false);
    expect(capabilitiesForUser(identityAdminUser).canManageIdentity).toBe(false);
    expect(capabilitiesForUser(supervisorRoleUser).canSuperviseCashbox).toBe(false);
  });

  it("does not synthesize capabilities for staff if server did not grant them", () => {
    const staffUserWithoutCaps: SessionUser = {
      ...baseUser,
      is_staff: true,
      capabilities: {},
    };

    const caps = capabilitiesForUser(staffUserWithoutCaps);
    expect(caps.canManageIdentity).toBe(false);
    expect(caps.canSensitiveWrite).toBe(false);
    expect(caps.canSuperAdminDelete).toBe(false);
    expect(caps.canManageFinance).toBe(false);
  });

  it("handles missing capabilities object gracefully by defaulting all flags to false", () => {
    const userWithoutCapabilities: SessionUser = {
      ...baseUser,
      roles: ["owner_manager", "accountant"],
      capabilities: undefined,
    };

    expect(capabilitiesForUser(userWithoutCapabilities)).toEqual({
      canManageIdentity: false,
      canViewAudit: false,
      canSensitiveWrite: false,
      canSuperAdminDelete: false,
      canManageFinance: false,
      canManageInventory: false,
      canOperateLogistics: false,
      canOperateCashbox: false,
      canSuperviseCashbox: false,
      canOverrideLogistics: false,
      canViewPayroll: false,
      canEditPayroll: false,
      canActivatePayroll: false,
    });
  });

  it("filters out unknown capability keys from the resulting FrontendCapabilities", () => {
    const userWithUnknownKeys: SessionUser = {
      ...baseUser,
      capabilities: {
        canManageFinance: true,
        arbitraryUnknownCapability: true,
        untrustedPermission: true,
      } as Record<string, boolean>,
    };

    const result = capabilitiesForUser(userWithUnknownKeys);
    expect(result.canManageFinance).toBe(true);
    expect("arbitraryUnknownCapability" in result).toBe(false);
    expect("untrustedPermission" in result).toBe(false);
  });

  it("reflects revoked capabilities immediately upon session refresh", () => {
    // Initial active session with finance access
    const initialSession: SessionUser = {
      ...baseUser,
      capabilities: { canManageFinance: true },
    };
    expect(capabilitiesForUser(initialSession).canManageFinance).toBe(true);

    // After revocation on backend, session payload returns false
    const revokedSession: SessionUser = {
      ...baseUser,
      capabilities: { canManageFinance: false },
    };
    expect(capabilitiesForUser(revokedSession).canManageFinance).toBe(false);
  });
});

describe("reportCategoriesForUser", () => {
  it("returns server-provided canonical categories directly", () => {
    const accountantUser: SessionUser = {
      ...baseUser,
      reportCategories: ["payments", "sales_billing"],
    };

    expect(reportCategoriesForUser(accountantUser)).toEqual(["payments", "sales_billing"]);
  });

  it("supports all 7 canonical report categories for owner_manager", () => {
    const ownerUser: SessionUser = {
      ...baseUser,
      reportCategories: [
        "reservations",
        "sales_billing",
        "payments",
        "prospects",
        "logistics",
        "inventory",
        "documents",
      ],
    };

    expect(reportCategoriesForUser(ownerUser)).toEqual(CANONICAL_REPORT_CATEGORIES);
  });

  it("filters out unknown or malformed category names strictly", () => {
    const userWithMalformedCategories: SessionUser = {
      ...baseUser,
      reportCategories: [
        "payments",
        "unauthorized_secret_reports" as ReportCategory,
        "sales_billing",
        "random_junk" as ReportCategory,
      ],
    };

    expect(reportCategoriesForUser(userWithMalformedCategories)).toEqual([
      "payments",
      "sales_billing",
    ]);
  });

  it("handles missing or undefined reportCategories by returning empty array", () => {
    const userWithoutCategories: SessionUser = {
      ...baseUser,
      roles: ["accountant"],
      reportCategories: undefined,
    };

    expect(reportCategoriesForUser(userWithoutCategories)).toEqual([]);
  });

  it("never deduces report categories from user role names", () => {
    const accountantUser: SessionUser = {
      ...baseUser,
      roles: ["accountant"],
      reportCategories: [],
    };

    expect(reportCategoriesForUser(accountantUser)).toEqual([]);
  });
});
