import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import type { Customer, DesiredDateWaitlistEntry } from "../types";
import DesiredDatesPage from "./DesiredDatesPage";

const customer: Customer = {
  id: "customer-1",
  display_name: "Rasoa",
  lifecycle_status: "prospect",
  party_type: "individual",
  email: "rasoa@example.test",
  phone: "",
  address: "",
  notes: "",
  is_active: true,
  is_deleted: false,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-07-23T00:00:00Z",
  updated_at: "2026-07-23T00:00:00Z",
};

const entry: DesiredDateWaitlistEntry = {
  id: "desired-date-1",
  customer_id: customer.id,
  business_scope: "titan",
  preferred_dates: ["2026-08-01"],
  flexible_start: null,
  flexible_end: null,
  interest_kind: "material",
  quantity: 2,
  responsible_id: "staff-1",
  status: "new",
  created_at: "2026-07-23T00:00:00Z",
  updated_at: "2026-07-23T00:00:00Z",
};

function mockLoad(entries: DesiredDateWaitlistEntry[] = [entry]) {
  vi.spyOn(api, "getCustomers").mockResolvedValue([customer]);
  vi.spyOn(api, "getDesiredDateWaitlistEntries").mockResolvedValue(entries);
}

afterEach(() => vi.restoreAllMocks());

describe("DesiredDatesPage", () => {
  it("loads the real customer-scoped waitlist and explains that conversion does not create a reservation", async () => {
    mockLoad();
    render(<DesiredDatesPage canSensitiveWrite currentUserId="staff-1" onNavigate={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText("Client ou prospect"), { target: { value: customer.id } });

    expect(await screen.findByText("1 août 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marquer comme perdue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Annuler" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voir le détail" }));
    expect(screen.getByText("Détail de la demande")).toBeInTheDocument();
    expect(screen.getByText(/ne crée pas de réservation, de proforma, de contrat ni de paiement/i)).toBeInTheDocument();
  });

  it("uses explicit confirmation before the terminal conversion transition", async () => {
    mockLoad();
    const transition = vi.spyOn(api, "transitionDesiredDateWaitlistEntry")
      .mockImplementation(async (_customerId, _entryId, action) => ({
        ...entry,
        status: action === "contact" ? "contacted" : "converted",
      }));
    render(<DesiredDatesPage canSensitiveWrite currentUserId="staff-1" onNavigate={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText("Client ou prospect"), { target: { value: customer.id } });
    await screen.findByText("1 août 2026");
    fireEvent.click(screen.getByRole("button", { name: "Marquer comme contactée" }));
    await waitFor(() => expect(transition).toHaveBeenCalledWith(customer.id, entry.id, "contact"));
    expect((await screen.findAllByText("Contactée")).length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Convertir" }));

    expect(transition).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Confirmer la conversion");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Convertir" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer la conversion" }));
    await waitFor(() => expect(transition).toHaveBeenCalledWith(customer.id, entry.id, "convert"));
    expect((await screen.findAllByText("Convertie")).length).toBeGreaterThan(1);
  });

  it("creates a customer-scoped entry only for a user with sensitive write access", async () => {
    mockLoad([]);
    const create = vi.spyOn(api, "createDesiredDateWaitlistEntry").mockResolvedValue(entry);
    render(<DesiredDatesPage canSensitiveWrite currentUserId="staff-1" onNavigate={vi.fn()} />);

    fireEvent.change(await screen.findByLabelText("Client ou prospect"), { target: { value: customer.id } });
    expect(screen.getByRole("button", { name: "Nouvelle demande" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Nouvelle demande" }));
    fireEvent.change(screen.getByLabelText("Date souhaitée 1"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("Quantité"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer la demande" }));

    await waitFor(() => expect(create).toHaveBeenCalledWith(customer.id, expect.objectContaining({
      business_scope: "titan",
      preferred_dates: ["2026-08-01"],
      interest_kind: "material",
      quantity: 2,
      responsible_id: "staff-1",
    })));
  });

  it("keeps the page read-only without sensitive write access", async () => {
    mockLoad([]);
    render(<DesiredDatesPage canSensitiveWrite={false} currentUserId="staff-1" onNavigate={vi.fn()} />);

    expect(await screen.findByText("Lecture seule")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nouvelle demande" })).not.toBeInTheDocument();
  });
});
