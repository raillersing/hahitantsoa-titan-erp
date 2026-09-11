import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AvailabilityInspectorModal } from "./AvailabilityInspectorModal";

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AvailabilityInspectorModal Component", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupMockApis = (options?: {
    venueOccupancy?: any[];
    titanDrafts?: any[];
    hahDrafts?: any[];
    inventoryItems?: any[];
    availablePreviews?: any[];
  }) => {
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("venue-occupancy") || url.includes("occupancy")) {
        return Promise.resolve(
          jsonResponse({
            items: options?.venueOccupancy ?? [
              {
                id: "occ-1",
                start_at: "2026-10-15T08:00:00.000Z",
                end_at: "2026-10-15T23:00:00.000Z",
                occupancy_status: "reserved",
                source: "hahitantsoa",
                title: "Mariage Rasoanaivo",
              },
            ],
          }),
        );
      }

      if (url.includes("closed-days")) {
        return Promise.resolve(jsonResponse([]));
      }

      if (url.includes("/inventory/items/")) {
        return Promise.resolve(
          jsonResponse(
            options?.inventoryItems ?? [
              {
                id: "item-1",
                name: "Chaise Napoléon Blanche",
                kind: "material",
                code: "MAT-CH-01",
                is_active: true,
                is_deleted: false,
                reported_inventory_quantity: 200,
              },
              {
                id: "item-2",
                name: "Table Ronde 180cm",
                kind: "material",
                code: "MAT-TB-02",
                is_active: true,
                is_deleted: false,
                reported_inventory_quantity: 30,
              },
            ],
          ),
        );
      }

      if (url.includes("/reservations/drafts/")) {
        return Promise.resolve(
          jsonResponse(
            options?.titanDrafts ?? [
              {
                id: "titan-1",
                public_reference: "RES-TITAN-001",
                customer_display_name: "Client Alpha",
                start_at: "2026-10-15T00:00:00.000Z",
                end_at: "2026-10-16T00:00:00.000Z",
              },
              {
                id: "titan-2",
                public_reference: "RES-TITAN-002",
                customer_display_name: "Société Beta",
                start_at: "2026-10-15T00:00:00.000Z",
                end_at: "2026-10-16T00:00:00.000Z",
              },
            ],
          ),
        );
      }

      if (url.includes("event-drafts")) {
        return Promise.resolve(
          jsonResponse(
            options?.hahDrafts ?? [
              {
                id: "hah-1",
                public_reference: "DEV-HAH-001",
                event_name: "Mariage Rasoanaivo",
                customer_display_name: "M. et Mme Rasoanaivo",
                start_at: "2026-10-15T08:00:00.000Z",
                end_at: "2026-10-15T23:00:00.000Z",
              },
            ],
          ),
        );
      }

      if (url.includes("available-item-previews")) {
        return Promise.resolve(
          jsonResponse(
            options?.availablePreviews ?? [
              {
                inventory_item_id: "item-1",
                inventory_item_name: "Chaise Napoléon Blanche",
              },
            ],
          ),
        );
      }

      return Promise.resolve(jsonResponse([]));
    });
  };

  it("does not render when isOpen is false", () => {
    setupMockApis();
    render(
      <AvailabilityInspectorModal
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders when isOpen is true with title and explanation banner", async () => {
    setupMockApis();
    render(
      <AvailabilityInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        initialDate="2026-10-15"
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Inspecteur de Disponibilité & Stocks")).toBeInTheDocument();
    expect(screen.getByText(/Vue Croisée Hahitantsoa & Titan/i)).toBeInTheDocument();
    expect(screen.getByText(/La salle \(Hahitantsoa\) est/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked or Escape key is pressed", () => {
    setupMockApis();
    const onClose = vi.fn();
    render(
      <AvailabilityInspectorModal
        isOpen={true}
        onClose={onClose}
        initialDate="2026-10-15"
      />,
    );

    const closeBtn = screen.getByRole("button", { name: "Fermer l'inspecteur" });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("displays Hahitantsoa venue occupancy details for reserved date and disables Hahitantsoa devis button", async () => {
    setupMockApis();
    const onSelect = vi.fn();

    render(
      <AvailabilityInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        initialDate="2026-10-15"
        onSelectDateAndNavigate={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Mariage Rasoanaivo/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/🔴 Réservée \/ Indisponible/i)).toBeInTheDocument();
    expect(screen.getByText(/Client : M. et Mme Rasoanaivo/i)).toBeInTheDocument();

    const hahDevisBtn = screen.getByRole("button", { name: /Nouveau devis Hahitantsoa/i });
    expect(hahDevisBtn).toBeDisabled();

    // Titan devis button remains enabled because materials are shareable
    const titanDevisBtn = screen.getByRole("button", { name: /Nouveau devis Titan/i });
    expect(titanDevisBtn).not.toBeDisabled();
  });

  it("displays Titan multi-client active reservations on the same date", async () => {
    setupMockApis();

    render(
      <AvailabilityInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        initialDate="2026-10-15"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/2 dossiers actifs/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/RES-TITAN-001 \(Client Alpha\)/i)).toBeInTheDocument();
    expect(screen.getByText(/RES-TITAN-002 \(Société Beta\)/i)).toBeInTheDocument();
  });

  it("filters material inventory list by tabs (Tous, Disponibles, Déjà loués) and search query", async () => {
    setupMockApis();

    render(
      <AvailabilityInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        initialDate="2026-10-15"
      />,
    );

    // Initial load: item-1 is in availablePreviews, item-2 is not
    await waitFor(() => {
      expect(screen.getByText(/Chaise Napoléon Blanche/i)).toBeInTheDocument();
      expect(screen.getByText(/Table Ronde 180cm/i)).toBeInTheDocument();
    });

    expect(screen.getByText("✓ Disponibles (1)")).toBeInTheDocument();
    expect(screen.getByText("En usage (1)")).toBeInTheDocument();
    expect(screen.getByText(/Stock disponible : 200/i)).toBeInTheDocument();
    expect(screen.queryByText(/⛔ Déjà réservé/i)).not.toBeInTheDocument();

    // Click "✓ Disponibles" tab
    fireEvent.click(screen.getByText("✓ Disponibles (1)"));
    expect(screen.getByText(/Chaise Napoléon Blanche/i)).toBeInTheDocument();
    expect(screen.queryByText(/Table Ronde 180cm/i)).not.toBeInTheDocument();

    // Click "En usage" tab
    fireEvent.click(screen.getByText("En usage (1)"));
    expect(screen.queryByText(/Chaise Napoléon Blanche/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Table Ronde 180cm/i)).toBeInTheDocument();
    expect(screen.getByText(/En location/i)).toBeInTheDocument();

    // Click "Tous" tab
    fireEvent.click(screen.getByText("Tous (2)"));
    expect(screen.getByText(/Chaise Napoléon Blanche/i)).toBeInTheDocument();
    expect(screen.getByText(/Table Ronde 180cm/i)).toBeInTheDocument();

    // Search query filter
    const searchInput = screen.getByPlaceholderText(/Rechercher un matériel/i);
    fireEvent.change(searchInput, { target: { value: "Napoléon" } });
    expect(screen.getByText(/Chaise Napoléon Blanche/i)).toBeInTheDocument();
    expect(screen.queryByText(/Table Ronde 180cm/i)).not.toBeInTheDocument();
  });

  it("navigates with selected date and domain on Titan action button click", async () => {
    setupMockApis();
    const onSelectDateAndNavigate = vi.fn();
    const onClose = vi.fn();

    render(
      <AvailabilityInspectorModal
        isOpen={true}
        onClose={onClose}
        initialDate="2026-10-15"
        onSelectDateAndNavigate={onSelectDateAndNavigate}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Nouveau devis Titan/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Nouveau devis Titan/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSelectDateAndNavigate).toHaveBeenCalledWith("2026-10-15", "titan");
  });

  it("affiche le stock disponible par article et les codes couleur en location et événementiel sans badge déjà réservé", async () => {
    setupMockApis({
      inventoryItems: [
        {
          id: "item-10",
          name: "Projecteur LED 50W",
          kind: "material",
          code: "MAT-LED-10",
          is_active: true,
          is_deleted: false,
          reported_inventory_quantity: 50,
        },
      ],
      titanDrafts: [
        {
          id: "titan-10",
          public_reference: "RES-TITAN-010",
          customer_display_name: "Client Alpha",
          start_at: "2026-10-15T00:00:00.000Z",
          end_at: "2026-10-16T00:00:00.000Z",
          lines: [{ inventory_item_id: "item-10", quantity: 15 }],
        },
      ],
      hahDrafts: [
        {
          id: "hah-10",
          public_reference: "DEV-HAH-010",
          event_name: "Gala Annuel",
          customer_display_name: "Entreprise Beta",
          start_at: "2026-10-15T08:00:00.000Z",
          end_at: "2026-10-15T23:00:00.000Z",
          lines: [{ inventory_item_id: "item-10", quantity: 10 }],
        },
      ],
      availablePreviews: [
        {
          inventory_item_id: "item-10",
          inventory_item_name: "Projecteur LED 50W",
        },
      ],
    });

    render(
      <AvailabilityInspectorModal
        isOpen={true}
        onClose={vi.fn()}
        initialDate="2026-10-15"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Projecteur LED 50W/i)).toBeInTheDocument();
    });

    // Affiche le stock disponible (50 - 15 - 10 = 25) au lieu du stock total
    expect(screen.getByText("Stock disponible : 25")).toBeInTheDocument();

    // Vérifie le code couleur location (15 en location)
    expect(screen.getByText("15 en location")).toBeInTheDocument();

    // Vérifie le code couleur événementiel (10 en événementiel)
    expect(screen.getByText("10 en événementiel")).toBeInTheDocument();

    // Vérifie l'indication de stock disponible restant
    expect(screen.getByText("✓ 25 dispo")).toBeInTheDocument();

    // Vérifie l'absence absolue du badge "⛔ Déjà réservé"
    expect(screen.queryByText(/⛔ Déjà réservé/i)).not.toBeInTheDocument();
  });
});
