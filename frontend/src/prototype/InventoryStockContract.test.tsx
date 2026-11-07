import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InventoryManagementPage from "./InventoryManagementPage";
import type { InventoryItem } from "../types";
const getItems = vi.fn();
vi.mock("../api", async () => ({ ...await vi.importActual<typeof import("../api")>("../api"), getInventoryItems: (...args: unknown[]) => getItems(...args) }));
const stock = { reported_inventory_quantity: 10, reported_damaged_quantity: 0, current_stock: 10, healthy_stock: 10, available_stock: 10, reserved_stock: 0, out_stock: 0, return_stock: 0, damaged_lost_stock: 0 };
const items: InventoryItem[] = [
  { id: "chair", name: "Chaise réception", kind: "material", description: "", code: "MOB-CH", is_active: true, stock_summary: { ...stock, physical_status: "in_stock" } },
  { id: "fork", name: "Fourchette", kind: "article", description: "", code: "COUV-01", is_active: true, stock_summary: { ...stock, physical_status: "in_stock" } },
  { id: "old", name: "Ancienne table", kind: "material", description: "", code: "ARCHIVE-9", is_active: false, stock_summary: { ...stock, available_stock: 0, physical_status: "inactive" } },
  { id: "blocked", name: "Table réservée", kind: "material", description: "", is_active: true, stock_summary: { ...stock, available_stock: 0, reserved_stock: 10, availability_blocked: true, physical_status: "in_stock" } },
];
afterEach(cleanup);
beforeEach(() => { localStorage.clear(); getItems.mockReset().mockResolvedValue(items); });
describe("inventaire : recherche et états serveur", () => {
  it("trouve chaise et fourchette pour ch, respecte les codes et explicite le filtre", async () => {
    render(<InventoryManagementPage onNavigate={vi.fn()} />);
    await screen.findByText("Chaise réception");
    const search = screen.getByRole("searchbox", { name: "Rechercher un article" });
    fireEvent.change(search, { target: { value: "CH" } });
    expect(screen.getByText("Chaise réception")).toBeInTheDocument();
    expect(screen.getByText("Fourchette")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "MOB-CH" } });
    expect(screen.getByText("Chaise réception")).toBeInTheDocument();
    expect(screen.queryByText("Fourchette")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Effacer les filtres" }));
    expect(search).toHaveValue("");
    expect(screen.getByText("Fourchette")).toBeInTheDocument();
  });
  it("sépare article inactif et blocage périodique d'une rupture", async () => {
    render(<InventoryManagementPage onNavigate={vi.fn()} />);
    const inactiveRow = (await screen.findByText("Ancienne table")).closest("tr")!;
    expect(within(inactiveRow).getByText("Inactif")).toBeInTheDocument();
    expect(within(inactiveRow).queryByText("Rupture")).not.toBeInTheDocument();
    const blockedRow = screen.getByText("Table réservée").closest("tr")!;
    expect(within(blockedRow).getByText("Indisponible sur la période")).toBeInTheDocument();
    expect(within(blockedRow).queryByText("Rupture")).not.toBeInTheDocument();
  });
});
