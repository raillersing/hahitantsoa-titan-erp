import type { SessionUser } from "./api";
import type { ReportCategory } from "./types";

/**
 * Capabilities are a presentation hint derived strictly from the backend session.
 * The backend remains authoritative for every read/write request.
 * No capabilities are deduced from role names in the frontend.
 */
export type FrontendCapabilities = {
  canManageIdentity: boolean;
  canViewAudit: boolean;
  canSensitiveWrite: boolean;
  canSuperAdminDelete: boolean;
  canManageFinance: boolean;
  canManageInventory: boolean;
  canOperateLogistics: boolean;
  canOperateCashbox: boolean;
  canSuperviseCashbox: boolean;
  canOverrideLogistics?: boolean;
  canViewPayroll?: boolean;
  canEditPayroll?: boolean;
  canActivatePayroll?: boolean;
};

export const CANONICAL_REPORT_CATEGORIES: readonly ReportCategory[] = [
  "reservations",
  "sales_billing",
  "payments",
  "prospects",
  "logistics",
  "inventory",
  "documents",
] as const;

export function capabilitiesForUser(user: SessionUser): FrontendCapabilities {
  const caps = user.capabilities ?? {};

  return {
    canManageIdentity: caps.canManageIdentity === true,
    canViewAudit: caps.canViewAudit === true,
    canSensitiveWrite: caps.canSensitiveWrite === true,
    canSuperAdminDelete: caps.canSuperAdminDelete === true,
    canManageFinance: caps.canManageFinance === true,
    canManageInventory: caps.canManageInventory === true,
    canOperateLogistics: caps.canOperateLogistics === true,
    canOperateCashbox: caps.canOperateCashbox === true,
    canSuperviseCashbox: caps.canSuperviseCashbox === true,
    canOverrideLogistics: caps.canOverrideLogistics === true,
    canViewPayroll: caps.canViewPayroll === true,
    canEditPayroll: caps.canEditPayroll === true,
    canActivatePayroll: caps.canActivatePayroll === true,
  };
}

export function reportCategoriesForUser(user: SessionUser): ReportCategory[] {
  if (!Array.isArray(user.reportCategories)) {
    return [];
  }
  return user.reportCategories.filter((category): category is ReportCategory =>
    (CANONICAL_REPORT_CATEGORIES as readonly string[]).includes(category)
  );
}
