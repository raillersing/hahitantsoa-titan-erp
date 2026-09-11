import { render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import type {
  ReservationDraft,
  HahitantsoaEventDraft,
  InventoryReturnOperation,
} from "../types";
import DashboardPage from "./DashboardPage";

afterEach(() => vi.restoreAllMocks());

function reservationDraft(): ReservationDraft {
  return {
    id: "draft-1",
    public_reference: "T-001/2026",
    status: "draft",
    customer_id: "customer-1",
    customer_display_name: "Rakoto",
    start_at: "2026-09-05T08:00:00Z",
    end_at: "2026-09-05T18:00:00Z",
    notes: "",
    lines: [],
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    created_at: "2026-09-04T08:00:00Z",
    updated_at: "2026-09-04T08:00:00Z",
  };
}

function hahitantsoaDraft(): HahitantsoaEventDraft {
  return {
    id: "hah-1",
    public_reference: "H-001/2026",
    status: "confirmed",
    customer_id: "customer-2",
    customer_display_name: "Rasoa",
    event_name: "Mariage Rasoa",
    venue_name: "Grand Salon",
    location_details: "Antananarivo",
    service_notes: "",
    start_at: "2026-09-06T10:00:00Z",
    end_at: "2026-09-06T20:00:00Z",
    notes: "",
    lines: [
      {
        id: "line-1",
        inventory_item_id: "item-1",
        inventory_item_name: "Tente 50 places",
        inventory_item_kind: "material",
        quantity: 1,
        unit_rental_price: "500000",
        total_price: "500000",
        notes: "",
      },
    ],
    created_at: "2026-09-04T09:00:00Z",
    updated_at: "2026-09-04T09:00:00Z",
  };
}

function returnOperation(status: "draft" | "validated" = "draft"): InventoryReturnOperation {
  return {
    id: "ret-1",
    reservation_draft: "draft-1",
    hahitantsoa_event_draft: null,
    logistics_event: null,
    document_instance: null,
    status,
    notes: "Retour après réception",
    validated_at: status === "validated" ? "2026-09-07T12:00:00Z" : null,
    validated_by: status === "validated" ? "user-1" : null,
    lines: [],
    created_at: "2026-09-07T10:00:00Z",
    updated_at: "2026-09-07T10:00:00Z",
    created_by: "user-1",
    updated_by: "user-1",
  };
}

function mockDashboardSources() {
  vi.spyOn(api, "getReservationDrafts").mockResolvedValue([reservationDraft()]);
  vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
  vi.spyOn(api, "getInventoryItems").mockResolvedValue([]);
  vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
  vi.spyOn(api, "getNotifications").mockResolvedValue([]);
  vi.spyOn(api, "getReturnOperations").mockResolvedValue([]);
}

describe("DashboardPage", () => {
  it("keeps real data visible when one secondary source is unavailable", async () => {
    mockDashboardSources();
    vi.mocked(api.getInventoryItems).mockRejectedValueOnce(new Error("Inventaire indisponible"));

    render(<DashboardPage onNavigate={vi.fn()} />);

    expect(await screen.findByRole("status")).toHaveTextContent("l’inventaire");
    expect(screen.getByText("Réservations Titan en cours").previousElementSibling).toHaveTextContent("1");
    expect(screen.queryByText("Erreur de chargement")).not.toBeInTheDocument();
  });

  it("shows the full error state only when no dashboard source is available", async () => {
    vi.spyOn(api, "getReservationDrafts").mockRejectedValue(new Error("Indisponible"));
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockRejectedValue(new Error("Indisponible"));
    vi.spyOn(api, "getInventoryItems").mockRejectedValue(new Error("Indisponible"));
    vi.spyOn(api, "getBillingInvoices").mockRejectedValue(new Error("Indisponible"));
    vi.spyOn(api, "getNotifications").mockRejectedValue(new Error("Indisponible"));
    vi.spyOn(api, "getReturnOperations").mockRejectedValue(new Error("Indisponible"));

    render(<DashboardPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Erreur de chargement")).toBeInTheDocument();
    expect(screen.getByText("Aucune donnée du tableau de bord n’a pu être chargée.")).toBeInTheDocument();
  });

  it("renders unified recent dossiers with Titan and Hahitantsoa entries and navigates", async () => {
    mockDashboardSources();
    vi.mocked(api.getHahitantsoaEventDrafts).mockResolvedValue([hahitantsoaDraft()]);
    const onNavigate = vi.fn();

    render(<DashboardPage onNavigate={onNavigate} />);

    // Check that both dossiers appear in table with domain badges
    expect(await screen.findByText("Rakoto")).toBeInTheDocument();
    expect(screen.getByText("Rasoa")).toBeInTheDocument();
    expect(screen.getByText("T-001/2026")).toBeInTheDocument();
    expect(screen.getByText("H-001/2026")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Titan")).toBeInTheDocument();
    expect(within(table).getByText("Hahitantsoa")).toBeInTheDocument();

    // Click "Voir tous les dossiers (2) →"
    const viewAllBtn = screen.getByRole("button", { name: /Voir tous les dossiers/i });
    fireEvent.click(viewAllBtn);
    expect(onNavigate).toHaveBeenCalledWith("reservations");

    // Click on Titan row action
    const voirDossierBtns = screen.getAllByRole("button", { name: "Voir dossier →" });
    // Since Hahitantsoa was created at 09:00 and Titan at 08:00, Hahitantsoa is index 0, Titan is index 1
    fireEvent.click(voirDossierBtns[0]);
    expect(onNavigate).toHaveBeenCalledWith("reservation-detail", "hahitantsoa:hah-1");

    fireEvent.click(voirDossierBtns[1]);
    expect(onNavigate).toHaveBeenCalledWith("reservation-detail", "titan:draft-1");
  });

  it("displays pending returns indicator and links to breakage-loss", async () => {
    mockDashboardSources();
    vi.mocked(api.getReturnOperations).mockResolvedValue([returnOperation("draft")]);
    const onNavigate = vi.fn();

    render(<DashboardPage onNavigate={onNavigate} />);

    expect(await screen.findByText("1 retour(s) à traiter")).toBeInTheDocument();
    const retoursBtn = screen.getByRole("button", { name: "Retours (1) →" });
    fireEvent.click(retoursBtn);
    expect(onNavigate).toHaveBeenCalledWith("breakage-loss");
  });

  it("provides quick navigation shortcuts from KPI cards", async () => {
    mockDashboardSources();
    const onNavigate = vi.fn();

    render(<DashboardPage onNavigate={onNavigate} />);

    expect(await screen.findByText("Réservations Titan en cours")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Facturation & Échéances →" }));
    expect(onNavigate).toHaveBeenCalledWith("commercial-ops");

    fireEvent.click(screen.getByRole("button", { name: "Mouvements de stock →" }));
    expect(onNavigate).toHaveBeenCalledWith("stock-movements");

    fireEvent.click(screen.getByRole("button", { name: "Hahitantsoa →" }));
    expect(onNavigate).toHaveBeenCalledWith("hahitantsoa");
  });
});
