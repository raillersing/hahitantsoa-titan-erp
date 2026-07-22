import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import AgendaVisitorsPage from "./AgendaVisitorsPage";
import type { Customer, VisitAppointment, VisitResponsible } from "../types";

const customer: Customer = { id: "customer-1", display_name: "Rasoa", email: "", phone: "", address: "", notes: "", is_active: true, is_deleted: false, deleted_at: null, created_by: null, updated_by: null, created_at: "", updated_at: "" };
const responsible: VisitResponsible = { id: "staff-1", display_name: "Réception" };
const visit: VisitAppointment = { id: "visit-1", customer_id: customer.id, customer_display_name: customer.display_name, reason: "prospect", scheduled_at: "2026-07-23T09:00:00Z", responsible_id: responsible.id, responsible_username: "reception", location: "Local de l'entreprise", notes: "", status: "scheduled", reminder_at: "2026-07-22T09:00:00Z", reminder_sent_at: null, completed_at: null, cancelled_at: null, created_at: "", updated_at: "" };

function mockLoad(visits: VisitAppointment[] = [visit]) {
  vi.spyOn(api, "getVisitAppointments").mockResolvedValue(visits);
  vi.spyOn(api, "getCustomers").mockResolvedValue([customer]);
  vi.spyOn(api, "getVisitResponsibles").mockResolvedValue([responsible]);
}

afterEach(() => vi.restoreAllMocks());

describe("AgendaVisitorsPage", () => {
  it("renders persisted visits and completes a scheduled visit", async () => {
    mockLoad();
    vi.spyOn(api, "completeVisitAppointment").mockResolvedValue({ ...visit, status: "completed", completed_at: "2026-07-23T10:00:00Z" });
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    expect((await screen.findAllByText("Rasoa")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Confirmer la finalisation");
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText("Terminée")).toBeInTheDocument();
  });

  it("shows an empty state without inventing a visitor", async () => {
    mockLoad([]);
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    expect(await screen.findByText("Aucune visite")).toBeInTheDocument();
  });

  it("shows a retry affordance when loading fails", async () => {
    vi.spyOn(api, "getVisitAppointments").mockRejectedValueOnce(new Error("Indisponible")).mockResolvedValue([]);
    vi.spyOn(api, "getCustomers").mockResolvedValue([customer]);
    vi.spyOn(api, "getVisitResponsibles").mockResolvedValue([responsible]);
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Indisponible");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(screen.getByText("Aucune visite")).toBeInTheDocument());
  });

  it("preserves the commercial visitor register from real customer data", async () => {
    mockLoad();
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    expect(await screen.findByText("Registre des visites, réunions commerciales et prestataires.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clients" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prospects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prestataires" })).toBeInTheDocument();
    expect(screen.getByText("Dernière activité")).toBeInTheDocument();
  });

  it("asks for explicit confirmation before completing a visit", async () => {
    mockLoad();
    const complete = vi.spyOn(api, "completeVisitAppointment").mockResolvedValue({ ...visit, status: "completed", completed_at: "2026-07-23T10:00:00Z" });
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    await screen.findAllByText("Rasoa");
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Confirmer la finalisation");
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith("visit-1"));
  });

  it("omits the existing reminder from an edit unless it is explicitly changed", async () => {
    mockLoad();
    const update = vi.spyOn(api, "updateVisitAppointment").mockResolvedValue(visit);
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    await screen.findAllByText("Rasoa");
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.change(screen.getByLabelText(/Date et heure/), { target: { value: "2026-07-24T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).not.toHaveProperty("reminder_at");
  });

  it("keeps the commercial filters usable when a customer has no last activity", async () => {
    mockLoad();
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    await screen.findAllByText("Rasoa");
    fireEvent.click(screen.getByRole("button", { name: "Aujourd'hui" }));
    expect(screen.getByText("Aucun visiteur")).toBeInTheDocument();
  });

  it("closes the destructive confirmation with Escape and restores its trigger focus", async () => {
    mockLoad();
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    await screen.findAllByText("Rasoa");
    const complete = screen.getByRole("button", { name: "Terminer" });
    fireEvent.click(complete);
    const confirmation = screen.getByRole("alertdialog");
    fireEvent.keyDown(confirmation, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(complete).toHaveFocus();
  });

  it("traps Shift+Tab from the confirmation dialog initial focus", async () => {
    mockLoad();
    render(<AgendaVisitorsPage onNavigate={vi.fn()} />);
    await screen.findAllByText("Rasoa");
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    const confirmation = screen.getByRole("alertdialog");
    await waitFor(() => expect(confirmation).toHaveFocus());
    fireEvent.keyDown(confirmation, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Confirmer" })).toHaveFocus();
  });
});
