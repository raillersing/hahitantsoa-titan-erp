import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import InventoryManagementPage from "./InventoryManagementPage";
import * as api from "../api";
import type { InventoryItem } from "../types";

const mockItems: InventoryItem[] = [
  {
    id: "item-mat-1",
    name: "Chaise Napoléon Blanche",
    kind: "material",
    description: "Chaise de réception",
    code: "CH-NAP",
    section: "Mobilier",
    rental_price: "5000.00",
    purchase_price: "25000.00",
    breakage_price: "30000.00",
    reported_inventory_quantity: 100,
    reported_damaged_quantity: 2,
    image_url: "https://example.test/chaise.jpg",
    is_active: true,
    stock_summary: {
      reported_inventory_quantity: 100,
      reported_damaged_quantity: 2,
      current_stock: 100,
      available_stock: 98,
      reserved_stock: 0,
      out_stock: 0,
      return_stock: 0,
      damaged_lost_stock: 2,
    },
  },
  {
    id: "item-art-2",
    name: "Serviette de table en lin",
    kind: "article",
    description: "Linge de table lavable",
    code: "SERV-LIN",
    section: "Linge",
    rental_price: "1500.00",
    purchase_price: "4000.00",
    breakage_price: "5000.00",
    reported_inventory_quantity: 200,
    reported_damaged_quantity: 0,
    image_url: "",
    is_active: true,
    stock_summary: {
      reported_inventory_quantity: 200,
      reported_damaged_quantity: 0,
      current_stock: 200,
      available_stock: 200,
      reserved_stock: 0,
      out_stock: 0,
      return_stock: 0,
      damaged_lost_stock: 0,
    },
  },
  {
    id: "item-pack-3",
    name: "Pack Cérémonie Champêtre",
    kind: "material_pack",
    description: "Ensemble complet cérémonie",
    code: "PCK-CHAMP",
    section: "Packs",
    rental_price: "450000.00",
    purchase_price: "0.00",
    breakage_price: "100000.00",
    reported_inventory_quantity: 5,
    reported_damaged_quantity: 0,
    image_url: "/brand/packages/ceremonie.webp",
    is_active: true,
    stock_summary: {
      reported_inventory_quantity: 5,
      reported_damaged_quantity: 0,
      current_stock: 5,
      available_stock: 5,
      reserved_stock: 0,
      out_stock: 0,
      return_stock: 0,
      damaged_lost_stock: 0,
    },
  },
];

describe("InventoryManagementPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getInventoryItems").mockResolvedValue(mockItems);
    vi.spyOn(api, "updateInventoryItem").mockImplementation(async (id, payload) => {
      const found = mockItems.find((i) => i.id === id);
      return {
        ...(found || mockItems[0]),
        ...payload,
        name: payload.name ?? found?.name ?? "",
        kind: (payload.kind as any) ?? found?.kind ?? "material",
        image_url: payload.image_url ?? found?.image_url ?? "",
      };
    });
    vi.spyOn(api, "createInventoryItem").mockImplementation(async (payload) => ({
      id: "new-item-id",
      name: payload.name || "New Item",
      kind: payload.kind || "material",
      description: payload.description || "",
      image_url: payload.image_url || "",
      is_active: true,
    }));
  });

  it("renders inventory items with image_url displayed in photo column (F28)", async () => {
    render(<InventoryManagementPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Chaise Napoléon Blanche")).toBeInTheDocument();
    expect(screen.getByText("Serviette de table en lin")).toBeInTheDocument();
    expect(screen.getByText("Pack Cérémonie Champêtre")).toBeInTheDocument();

    // Chaise Napoléon has image_url: https://example.test/chaise.jpg
    const imgElement = screen.getByAltText("Chaise Napoléon Blanche") as HTMLImageElement;
    expect(imgElement).toBeInTheDocument();
    expect(imgElement.src).toContain("example.test/chaise.jpg");
  });

  it("preserves kind 'article' when modifying an article (F13)", async () => {
    render(<InventoryManagementPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Serviette de table en lin")).toBeInTheDocument();

    // Click modifier button for "Serviette de table en lin"
    const editButtons = screen.getAllByTitle("Modifier");
    // 2nd item is the article
    fireEvent.click(editButtons[1]);

    expect(screen.getByDisplayValue("Serviette de table en lin")).toBeInTheDocument();

    // Modify the description or name
    const nameInput = screen.getByDisplayValue("Serviette de table en lin");
    fireEvent.change(nameInput, { target: { value: "Serviette en lin lavé" } });

    // Submit form
    const saveButton = screen.getByRole("button", { name: /Mettre à jour|Enregistrer/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateInventoryItem).toHaveBeenCalledWith(
        "item-art-2",
        expect.objectContaining({
          kind: "article",
          name: "Serviette en lin lavé",
        }),
      );
    });
  });

  it("preserves kind 'material_pack' when modifying a package item (F13)", async () => {
    render(<InventoryManagementPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Pack Cérémonie Champêtre")).toBeInTheDocument();

    // Click modifier button for "Pack Cérémonie Champêtre"
    const editButtons = screen.getAllByTitle("Modifier");
    // 3rd item is the material_pack
    fireEvent.click(editButtons[2]);

    expect(screen.getByDisplayValue("Pack Cérémonie Champêtre")).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue("Pack Cérémonie Champêtre");
    fireEvent.change(nameInput, { target: { value: "Pack Cérémonie Prestige" } });

    const saveButton = screen.getByRole("button", { name: /Mettre à jour|Enregistrer/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateInventoryItem).toHaveBeenCalledWith(
        "item-pack-3",
        expect.objectContaining({
          kind: "material_pack",
          name: "Pack Cérémonie Prestige",
        }),
      );
    });
  });

  it("persists image_url in payload when provided (F28)", async () => {
    render(<InventoryManagementPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Serviette de table en lin")).toBeInTheDocument();

    const editButtons = screen.getAllByTitle("Modifier");
    fireEvent.click(editButtons[1]);

    const photoInput = screen.getByPlaceholderText("https://... (URL externe)");
    fireEvent.change(photoInput, { target: { value: "https://example.test/serviette.webp" } });

    const saveButton = screen.getByRole("button", { name: /Mettre à jour|Enregistrer/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.updateInventoryItem).toHaveBeenCalledWith(
        "item-art-2",
        expect.objectContaining({
          image_url: "https://example.test/serviette.webp",
        }),
      );
    });
  });
});
