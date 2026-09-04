import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import type { ReservationDraft } from "../types";
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

function mockDashboardSources() {
  vi.spyOn(api, "getReservationDrafts").mockResolvedValue([reservationDraft()]);
  vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
  vi.spyOn(api, "getInventoryItems").mockResolvedValue([]);
  vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
  vi.spyOn(api, "getNotifications").mockResolvedValue([]);
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

    render(<DashboardPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Erreur de chargement")).toBeInTheDocument();
    expect(screen.getByText("Aucune donnée du tableau de bord n’a pu être chargée.")).toBeInTheDocument();
  });
});
