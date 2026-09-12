import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import StockMovementsPage from "./StockMovementsPage";
import type { InventoryStockMovement, InventoryItem } from "../types";

const mockItems: InventoryItem[] = [
  {
    id: "item-1",
    name: "Chaise Napoléon Blanche",
    code: "NAP-WHT",
    category: "Mobilier",
    total_quantity: 100,
    available_quantity: 80,
    deposit_rate: 5000,
    daily_rate: 2000,
  } as unknown as InventoryItem,
  {
    id: "item-2",
    name: "Table Ronde 180cm",
    code: "TAB-RND",
    category: "Mobilier",
    total_quantity: 20,
    available_quantity: 15,
    deposit_rate: 15000,
    daily_rate: 8000,
  } as unknown as InventoryItem,
];

const mockMovements: InventoryStockMovement[] = [
  {
    id: "mov-1",
    inventory_item: "item-1",
    inventory_item_name: "Chaise Napoléon Blanche",
    movement_type: "outbound_delivery",
    direction: "outbound",
    quantity: 10,
    movement_date: "2026-06-01T10:00:00Z",
    created_at: "2026-06-01T10:00:00Z",
    validated_by: "Magasinier Chief",
    notes: "Sortie événement Titan",
  } as unknown as InventoryStockMovement,
];

const mockGetStockMovements = vi.fn();
const mockGetInventoryItems = vi.fn();
const mockCreateStockMovement = vi.fn();

vi.mock("../api", () => ({
  getStockMovements: (...args: any[]) => mockGetStockMovements(...args),
  getInventoryItems: (...args: any[]) => mockGetInventoryItems(...args),
  createStockMovement: (...args: any[]) => mockCreateStockMovement(...args),
}));

describe("StockMovementsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStockMovements.mockResolvedValue(mockMovements);
    mockGetInventoryItems.mockResolvedValue(mockItems);
    mockCreateStockMovement.mockResolvedValue({
      id: "mov-2",
      inventory_item: "item-1",
      movement_type: "adjustment_in",
      direction: "inbound",
      quantity: 5,
      movement_date: "2026-06-02T10:00:00Z",
      notes: "Réapprovisionnement test",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche la liste des mouvements de stock et les filtres", async () => {
    render(<StockMovementsPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Chaise Napoléon Blanche")).toBeInTheDocument();
    expect(screen.getByText("Sortie événement Titan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nouveau Mouvement/i })).toBeInTheDocument();
  });

  it("permet d'enregistrer un nouveau mouvement de stock via la modale", async () => {
    render(<StockMovementsPage onNavigate={vi.fn()} />);

    await screen.findByText("Chaise Napoléon Blanche");

    const newBtn = screen.getByRole("button", { name: /Nouveau Mouvement/i });
    fireEvent.click(newBtn);

    expect(await screen.findByRole("heading", { name: /Enregistrer un mouvement de stock/i })).toBeInTheDocument();

    const quantityInput = screen.getByRole("spinbutton");
    fireEvent.change(quantityInput, { target: { value: "5" } });

    const notesInput = screen.getByPlaceholderText(/Justification de l'ajustement/i);
    fireEvent.change(notesInput, { target: { value: "Réapprovisionnement test" } });

    const submitBtn = screen.getByRole("button", { name: /Enregistrer/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          inventory_item: "item-1",
          movement_type: "adjustment_in",
          quantity: 5,
          notes: "Réapprovisionnement test",
        })
      );
    });

    expect(await screen.findByText("Mouvement de stock enregistré avec succès.")).toBeInTheDocument();
  });

  it("ouvre la modale de compensation pré-remplie lors du clic sur le bouton d'ajustement", async () => {
    render(<StockMovementsPage onNavigate={vi.fn()} />);

    await screen.findByText("Chaise Napoléon Blanche");

    const undoBtn = screen.getByTitle("Compenser / ajuster ce mouvement");
    fireEvent.click(undoBtn);

    expect(await screen.findByRole("heading", { name: /Enregistrer un mouvement de stock/i })).toBeInTheDocument();

    // Since original movement was outbound, compensating movement is adjustment_in
    const submitBtn = screen.getByRole("button", { name: /Enregistrer/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          inventory_item: "item-1",
          movement_type: "adjustment_in",
          quantity: 10,
        })
      );
    });
  });
});
