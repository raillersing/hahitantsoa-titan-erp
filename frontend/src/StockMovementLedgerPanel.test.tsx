import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import StockMovementLedgerPanel from "./StockMovementLedgerPanel";
import type { InventoryStockMovement } from "./types";

const MOCK_MOVEMENT: InventoryStockMovement = {
  id: "mov-1",
  inventory_item: "item-1",
  reservation_draft: null,
  movement_type: "outbound_delivery",
  direction: "outbound",
  quantity: 5,
  source_label: "DR-2026-001",
  notes: "",
  effective_at: "2026-06-10T08:00:00Z",
  validated_at: "2026-06-10T09:00:00Z",
  validated_by: "agent-1",
  created_at: "2026-06-10T08:00:00Z",
  updated_at: "2026-06-10T08:00:00Z",
};

describe("StockMovementLedgerPanel", () => {
  beforeEach(() => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(api, "getStockMovements").mockReturnValue(new Promise(() => undefined));
    render(<StockMovementLedgerPanel />);
    expect(screen.getByText("Chargement des mouvements de stock...")).toBeInTheDocument();
  });

  it("shows error state", async () => {
    vi.spyOn(api, "getStockMovements").mockRejectedValue(new Error("Service unavailable"));
    render(<StockMovementLedgerPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
  });

  it("shows empty state", async () => {
    vi.spyOn(api, "getStockMovements").mockResolvedValue([]);
    render(<StockMovementLedgerPanel />);
    expect(await screen.findByText("Aucun mouvement de stock enregistré.")).toBeInTheDocument();
  });

  it("renders ledger detail", async () => {
    vi.spyOn(api, "getStockMovements").mockResolvedValue([MOCK_MOVEMENT]);
    render(<StockMovementLedgerPanel />);
    expect(await screen.findByText("Détail du registre")).toBeInTheDocument();
    expect(screen.getAllByText("Livraison sortante").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DR-2026-001").length).toBeGreaterThan(0);
  });

  it("shows read-only badge by default", async () => {
    vi.spyOn(api, "getStockMovements").mockResolvedValue([MOCK_MOVEMENT]);
    render(<StockMovementLedgerPanel />);
    expect(await screen.findByTestId("stock-write-denied")).toBeInTheDocument();
  });

  it("shows write badge when permission is granted", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getStockMovements").mockResolvedValue([MOCK_MOVEMENT]);
    render(<StockMovementLedgerPanel />);
    expect(await screen.findByTestId("stock-write-ok")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("stock-movement-row-mov-1"));
    expect(screen.getByText("Traçabilité")).toBeInTheDocument();
  });
});
