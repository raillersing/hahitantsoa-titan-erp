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

  it("opens the quick visit creation modal, searches for a customer, and handles submission", async () => {
    render(<PlanningPage />);

    const newRdvBtn = await screen.findByRole("button", { name: /\+ Nouveau RDV \/ Visite/i });
    fireEvent.click(newRdvBtn);

    expect(await screen.findByText("Nouveau Rendez-vous / Visite")).toBeInTheDocument();

    // Search and select existing customer after initial load
    const searchInput = await screen.findByPlaceholderText(/Rechercher par nom, téléphone, e-mail/i);
    fireEvent.change(searchInput, { target: { value: "Client Test" } });

    const customerItem = await screen.findByText("Client Test Alpha");
    fireEvent.click(customerItem);

    // Selected customer badge is now visible
    expect(screen.getByText("Client Test Alpha")).toBeInTheDocument();

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

  it("creates a new prospect on the fly and schedules a visit in the same modal", async () => {
    const createCustomerSpy = vi.spyOn(api, "createCustomer").mockResolvedValue({
      id: "new-prospect-99",
      display_name: "Famille Dupont Express",
      phone: "0340011223",
      lifecycle_status: "prospect",
    } as any);

    render(<PlanningPage />);

    const newRdvBtn = await screen.findByRole("button", { name: /\+ Nouveau RDV \/ Visite/i });
    fireEvent.click(newRdvBtn);

    expect(await screen.findByText("Nouveau Rendez-vous / Visite")).toBeInTheDocument();

    // Switch to Nouveau Prospect mode after initial load
    const newProspectTab = await screen.findByRole("button", { name: /\+ Nouveau Prospect/i });
    fireEvent.click(newProspectTab);

    // Fill in prospect info
    const nameInput = await screen.findByLabelText(/Nom complet \/ Raison sociale/i);
    fireEvent.change(nameInput, { target: { value: "Famille Dupont Express" } });

    const phoneInput = screen.getByLabelText(/Téléphone mobile/i);
    fireEvent.change(phoneInput, { target: { value: "0340011223" } });

    const emailInput = screen.getByLabelText(/Email \(optionnel\)/i);
    fireEvent.change(emailInput, { target: { value: "dupont@test.mg" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /Créer prospect & RDV/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createCustomerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: "Famille Dupont Express",
          phone: "0340011223",
          email: "dupont@test.mg",
          lifecycle_status: "prospect",
        }),
      );
    });

    await waitFor(() => {
      expect(api.createVisitAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: "new-prospect-99",
          reason: "simple_visit",
        }),
      );
    });
  });

  it("completes a scheduled visit appointment from the drawer", async () => {
    const monday = currentMonday();
    vi.spyOn(api, "getVisitAppointments").mockResolvedValue([
      {
        id: "visit-123",
        reason: "simple_visit",
        customer_display_name: "Prospect Martin",
        customer_id: "cust-1",
        location: "Local de l'entreprise",
        scheduled_at: monday.toISOString(),
        status: "scheduled",
      } as any,
    ]);
    const completeSpy = vi.spyOn(api, "completeVisitAppointment").mockResolvedValue({ id: "visit-123", status: "completed" } as any);

    render(<PlanningPage />);

    // In week view or agenda, find the visit card and click it to open drawer
    const visitCards = await screen.findAllByText("Prospect Martin");
    expect(visitCards.length).toBeGreaterThan(0);
    fireEvent.click(visitCards[0]);

    // Drawer should open with actions
    expect(await screen.findByText(/Actions sur le rendez-vous/i)).toBeInTheDocument();
    const completeBtn = screen.getByRole("button", { name: /Marquer comme terminée/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith("visit-123");
    });
  });

  it("cancels a scheduled visit appointment from the drawer", async () => {
    const monday = currentMonday();
    vi.spyOn(api, "getVisitAppointments").mockResolvedValue([
      {
        id: "visit-456",
        reason: "prospect",
        customer_display_name: "Prospect Dupont",
        customer_id: "cust-1",
        location: "Local de l'entreprise",
        scheduled_at: monday.toISOString(),
        status: "scheduled",
      } as any,
    ]);
    const cancelSpy = vi.spyOn(api, "cancelVisitAppointment").mockResolvedValue({ id: "visit-456", status: "cancelled" } as any);

    render(<PlanningPage />);

    const visitCards = await screen.findAllByText("Prospect Dupont");
    expect(visitCards.length).toBeGreaterThan(0);
    fireEvent.click(visitCards[0]);

    expect(await screen.findByText(/Actions sur le rendez-vous/i)).toBeInTheDocument();
    const cancelBtn = screen.getByRole("button", { name: /Annuler RDV/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith("visit-456");
    });
  });

  it("identifies conflicting event drafts when a confirmed event overlaps on the same venue and date", async () => {
    const monday = currentMonday();
    const endAt = new Date(monday);
    endAt.setHours(endAt.getHours() + 8);

    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([
      {
        id: "hah-confirmed",
        public_reference: "H-002/2026",
        event_name: "Mariage Ramila Confirme",
        venue_name: "Salle des fêtes + jardin",
        customer_display_name: "Ramila Jeany",
        start_at: monday.toISOString(),
        end_at: endAt.toISOString(),
        status: "confirmed",
        lines: [],
      } as any,
      {
        id: "hah-draft-conflict",
        public_reference: "H-003/2026",
        event_name: "Devis Conflit Faly",
        venue_name: "Salle des fêtes + jardin",
        customer_display_name: "Faly Ranaivo",
        start_at: monday.toISOString(),
        end_at: endAt.toISOString(),
        status: "draft",
        lines: [],
      } as any,
    ]);

    render(<PlanningPage />);

    // Should display both
    expect(await screen.findByText(/Mariage Ramila Confirme/i)).toBeInTheDocument();
    expect(await screen.findByText(/Devis Conflit Faly/i)).toBeInTheDocument();

    // Should show conflict indicator and badge
    const conflictElements = await screen.findAllByText(/En conflit/i);
    expect(conflictElements.length).toBeGreaterThan(0);

    // Clicking the conflicted event should open drawer with conflict banner and resolve button
    fireEvent.click(screen.getByText(/Devis Conflit Faly/i));
    const arbitrerBtns = await screen.findAllByText(/Arbitrer \/ Relocaliser/i);
    expect(arbitrerBtns.length).toBeGreaterThan(0);

    // Clicking Arbitrer opens the conflict resolution modal
    fireEvent.click(arbitrerBtns[0]);
    expect(await screen.findByText(/Arbitrage & Relocalisation/i)).toBeInTheDocument();
  });

  it("filters planning events by status (Confirmés, Devis, Conflits)", async () => {
    const monday = currentMonday();
    const endAt = new Date(monday);
    endAt.setHours(endAt.getHours() + 4);

    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([
      {
        id: "hah-1",
        public_reference: "H-001",
        event_name: "Evt Confirme",
        venue_name: "Salle A",
        customer_display_name: "Client 1",
        start_at: monday.toISOString(),
        end_at: endAt.toISOString(),
        status: "confirmed",
        lines: [],
      } as any,
      {
        id: "hah-2",
        public_reference: "H-002",
        event_name: "Evt Libre Devis",
        venue_name: "Salle B",
        customer_display_name: "Client 2",
        start_at: monday.toISOString(),
        end_at: endAt.toISOString(),
        status: "draft",
        lines: [],
      } as any,
    ]);

    render(<PlanningPage />);

    expect(await screen.findByText(/Evt Confirme/i)).toBeInTheDocument();
    expect(await screen.findByText(/Evt Libre Devis/i)).toBeInTheDocument();

    // Filter by Confirmed only
    const confirmedFilterBtn = screen.getByRole("button", { name: /Confirmés fermes/i });
    fireEvent.click(confirmedFilterBtn);

    expect(screen.getByText(/Evt Confirme/i)).toBeInTheDocument();
    expect(screen.queryByText(/Evt Libre Devis/i)).not.toBeInTheDocument();

    // Filter by Devis & Options only
    const draftFilterBtn = screen.getByRole("button", { name: /Devis \/ Options/i });
    fireEvent.click(draftFilterBtn);

    expect(screen.queryByText(/Evt Confirme/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Evt Libre Devis/i)).toBeInTheDocument();
  });
});
