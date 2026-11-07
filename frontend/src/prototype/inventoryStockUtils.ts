import type { InventoryItem } from "../types";

export type PhysicalStockLabel = "OK" | "Bas" | "Rupture" | "Inactif";

export function getInventoryStock(item: InventoryItem) {
  const stock = item.stock_summary;
  const current = stock?.current_stock ?? item.reported_inventory_quantity ?? 0;
  const healthy = stock?.healthy_stock ?? Math.max(current - (stock?.reported_damaged_quantity ?? item.reported_damaged_quantity ?? 0), 0);
  const threshold = stock?.low_stock_threshold ?? item.low_stock_threshold ?? 0;
  const active = item.is_active !== false && stock?.physical_status !== "inactive";
  const status = !active ? "inactive" : stock?.physical_status ?? (healthy <= 0 ? "out_of_stock" : threshold > 0 && healthy <= threshold ? "low" : "in_stock");
  const label: PhysicalStockLabel = status === "inactive" ? "Inactif" : status === "out_of_stock" ? "Rupture" : status === "low" ? "Bas" : "OK";
  const blocked = stock?.availability_blocked ?? false;
  return {
    current, healthy, threshold, active, status, label, blocked,
    available: active ? stock?.available_stock ?? healthy : 0,
    unavailablePhysical: Math.max(current - healthy, 0),
  };
}

export function normalizeInventorySearch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Outbound/expected returns and historical damage are already reflected in the
// on-hand ledger. Subtracting them again would reject legitimate stock counts.
export const validateStockChange = (newTotalStock: number, unavailablePhysicalStock = 0, availabilityBlocked = false) => {
  const newAvailable = availabilityBlocked ? 0 : Math.max(newTotalStock - unavailablePhysicalStock, 0);
  if (!Number.isSafeInteger(newTotalStock) || newTotalStock < 0) {
    return { isValid: false, newAvailable, quantiteEngagee: unavailablePhysicalStock, error: "Le stock doit être un entier positif ou nul." };
  }
  return { isValid: true, newAvailable, quantiteEngagee: unavailablePhysicalStock };
};
