import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import PlanningPage from "./PlanningPage";

function currentMonday(): Date {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

describe("PlanningPage (Modern Enterprise Agenda)", () => {
  beforeEach(() => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getVisitAppointments").mockResolvedValue([]);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getTitanClosedDays").mockResolvedValue([]);
    vi.spyOn(api, "getCustomers").mockResolvedValue([
      { id: "cust-1", display_name: "Client Test Alpha", first_name: "Jean", last_name: "Dupont" } as any,
    ]);
    vi.spyOn(api, "getVisitResponsibles").mockResolvedValue([
      { id: "resp-1", username: "admin_logistic" } as any,
    ]);
    vi.spyOn(api, "createVisitAppointment").mockResolvedValue({ id: "new-visit-1" } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an ongoing Titan reservation during the visible week", async () => {
    const monday = currentMonday();
    const startAt = new Date(monday);
    startAt.setDate(startAt.getDate() - 1);
    const endAt = new Date(monday);
    endAt.setDate(endAt.getDate() + 2);

    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([
      {
        id: "titan-ongoing",
        public_reference: "T-010/2026",
        status: "confirmed",
        customer_display_name: "Client Titan",
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        lines: [{ id: "l1" }],
      } as any,
    ]);

    render(<PlanningPage />);

    const matchingTitles = await screen.findAllByText("T-010/2026");
    expect(matchingTitles.length).toBeGreaterThan(0);

    const ongoingBadges = screen.getAllByText(/En cours/i);
    expect(ongoingBadges.length).toBeGreaterThan(0);
  });

  it("opens a Hahitantsoa event through its domain-specific dossier route", async () => {
    const monday = currentMonday();
    const endAt = new Date(monday);
    endAt.setHours(endAt.getHours() + 4);

    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([
      {
        id: "hah-event-123",
        event_name: "Mariage Royal",
        venue_name: "Grande Salle + Jardin",
        customer_display_name: "Famille Rakoto",
        start_at: monday.toISOString(),
        end_at: endAt.toISOString(),
        status: "confirmed",
        lines: [],
      } as any,
    ]);

    const onNavigate = vi.fn();
    render(<PlanningPage onNavigate={onNavigate} />);

    const eventButtons = await screen.findAllByRole("button", { name: /Mariage Royal/i });
    expect(eventButtons.length).toBeGreaterThan(0);

    fireEvent.click(eventButtons[0]);
    await waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith("reservation-detail", "hahitantsoa:hah-event-123");
    });
  });

  it("switches views between Week, Month, Day, and Agenda", async () => {
    const today = new Date();
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([
      {
        id: "titan-res-1",
        public_reference: "T-001/2026",
        status: "confirmed",
        customer_display_name: "Client Test",
        start_at: today.toISOString(),
        end_at: today.toISOString(),
        lines: [],
      } as any,
    ]);

    render(<PlanningPage />);

    // Default is week view
    expect((await screen.findAllByText("T-001/2026")).length).toBeGreaterThan(0);

    // Switch to Month view
    const monthButton = screen.getByRole("button", { name: /^Mois$/i });
    fireEvent.click(monthButton);
    expect((await screen.findAllByText("T-001/2026")).length).toBeGreaterThan(0);

    // Switch to Day view
    const dayButton = screen.getByRole("button", { name: /^Jour$/i });
    fireEvent.click(dayButton);
    expect((await screen.findAllByText("T-001/2026")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Ajouter un RDV à cette date/i)).toBeInTheDocument();

    // Switch to Agenda view
    const agendaButton = screen.getByRole("button", { name: /Flux \/ Agenda/i });
    fireEvent.click(agendaButton);
    expect((await screen.findAllByText("T-001/2026")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Flux & Événements chronologiques/i)).toBeInTheDocument();
  });

  it("filters events by category pills", async () => {
    const monday = currentMonday();
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([
      {
        id: "titan-item",
        public_reference: "T-TITAN-ITEM",
        status: "confirmed",
        customer_display_name: "Client Titan",
        start_at: monday.toISOString(),
        end_at: monday.toISOString(),
        lines: [],
      } as any,
    ]);
    vi.spyOn(api, "getVisitAppointments").mockResolvedValue([
      {
        id: "visit-item",
        reason: "simple_visit",
        customer_display_name: "Visiteur Prospect",
        location: "Siège",
        scheduled_at: monday.toISOString(),
        status: "scheduled",
      } as any,
    ]);

    render(<PlanningPage />);

    expect(await screen.findByText("T-TITAN-ITEM")).toBeInTheDocument();
    expect(screen.getByText("Visiteur Prospect")).toBeInTheDocument();

    // Filter by Titan only
    const titanPill = screen.getByRole("button", { name: /📦 Titan/i });
    fireEvent.click(titanPill);

    expect(screen.getByText("T-TITAN-ITEM")).toBeInTheDocument();
    expect(screen.queryByText("Visiteur Prospect")).not.toBeInTheDocument();

    // Filter by Visits only
    const visitPill = screen.getByRole("button", { name: /🤝 Visites/i });
    fireEvent.click(visitPill);

    expect(screen.queryByText("T-TITAN-ITEM")).not.toBeInTheDocument();
    expect(screen.getByText("Visiteur Prospect")).toBeInTheDocument();
  });

  it("opens the quick visit creation modal and handles submission", async () => {
    render(<PlanningPage />);

    const newRdvBtn = await screen.findByRole("button", { name: /\+ Nouveau RDV \/ Visite/i });
    fireEvent.click(newRdvBtn);

    expect(await screen.findByText("Nouveau Rendez-vous / Visite")).toBeInTheDocument();

    // Select customer
    const customerSelect = screen.getByLabelText(/Client \/ Prospect/i);
    fireEvent.change(customerSelect, { target: { value: "cust-1" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Créer le RDV/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createVisitAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: "cust-1",
          reason: "simple_visit",
        }),
      );
    });
  });
});
