import { describe, expect, it } from "vitest";
import { getInventoryStock, normalizeInventorySearch, validateStockChange } from "./inventoryStockUtils";
import type { InventoryItem } from "../types";

const item: InventoryItem = { id: "i", name: "Chaise", kind: "material", description: "", reported_inventory_quantity: 10 };
describe("stock physique et disponibilité distincts", () => {
  it("ne transforme pas une réservation de la référence en rupture physique", () => {
    const stock = getInventoryStock({ ...item, stock_summary: { reported_inventory_quantity: 10, reported_damaged_quantity: 0, current_stock: 10, healthy_stock: 10, available_stock: 0, reserved_stock: 10, out_stock: 0, return_stock: 0, damaged_lost_stock: 0, physical_status: "in_stock", availability_blocked: true } });
    expect(stock).toMatchObject({ label: "OK", blocked: true, available: 0, healthy: 10 });
  });
  it("garde Inactif distinct de Rupture malgré le stock présent", () => {
    expect(getInventoryStock({ ...item, is_active: false })).toMatchObject({ label: "Inactif", available: 0, current: 10 });
  });
  it("n'invente pas de seuil à cinq unités", () => {
    expect(getInventoryStock({ ...item, reported_inventory_quantity: 2 }).label).toBe("OK");
    expect(getInventoryStock({ ...item, reported_inventory_quantity: 2, low_stock_threshold: 3 }).label).toBe("Bas");
  });
  it("ne soustrait plus deux fois le matériel déjà sorti du stock présent", () => {
    expect(validateStockChange(2)).toMatchObject({ isValid: true, newAvailable: 2 });
    expect(validateStockChange(12, 2, true)).toMatchObject({ isValid: true, newAvailable: 0 });
    expect(validateStockChange(12, 2)).toMatchObject({ isValid: true, newAvailable: 10 });
  });
  it.each([-1, 1.5, NaN, Infinity])("rejette un comptage non entier positif ou nul : %s", (value) => {
    expect(validateStockChange(value).isValid).toBe(false);
  });
  it("normalise casse et accents et conserve les codes métier", () => {
    expect(normalizeInventorySearch("  CHÂISE   bleue ")).toBe("chaise bleue");
    expect(normalizeInventorySearch("CH-NAP")).toContain("ch");
  });
});
