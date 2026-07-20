export const APP_SCOPES = [
  "dashboard", "planning", "customers", "hahitantsoa", "titan", "commercial-ops",
  "cashbox", "caution", "audit", "reports", "help", "reservation-new",
  "reservation-detail", "reservations", "customer", "login", "packages", "services",
  "blacklist-intervenants", "inventory", "inventory-management", "inventory-item",
  "stock-movements", "stock-preparation", "logistics-dispatch", "logistics-returns",
  "breakage-loss", "venues", "agenda-visitors", "import-excel", "documents",
  "hr-payroll", "hr", "purchasing", "procurement", "notifications", "admin", "mobile-tablet", "profile",
] as const;

export type AppScope = (typeof APP_SCOPES)[number];

export type AppRoute =
  | { kind: "known"; scope: AppScope; param?: string }
  | { kind: "not-found"; requestedHash: string };

const APP_SCOPE_SET = new Set<string>(APP_SCOPES);

export function isAppScope(value: unknown): value is AppScope {
  return typeof value === "string" && APP_SCOPE_SET.has(value);
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseHash(hash: string): AppRoute {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!normalized) return { kind: "known", scope: "dashboard" };

  const separatorIndex = normalized.indexOf("/");
  const rawScope = separatorIndex === -1 ? normalized : normalized.slice(0, separatorIndex);
  if (!APP_SCOPE_SET.has(rawScope)) {
    return { kind: "not-found", requestedHash: hash.startsWith("#") ? hash : `#${hash}` };
  }

  const rawParam = separatorIndex === -1 ? "" : normalized.slice(separatorIndex + 1);
  return {
    kind: "known",
    scope: rawScope as AppScope,
    ...(rawParam ? { param: decodeParam(rawParam) } : {}),
  };
}

export function formatHash(scope: AppScope, param?: string): string {
  return param ? `#${scope}/${encodeURIComponent(param)}` : `#${scope}`;
}
