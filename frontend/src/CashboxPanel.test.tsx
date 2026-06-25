import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import CashboxPanel from "./CashboxPanel";
import type { CashboxSession } from "./types";

const OPEN_SESSION: CashboxSession = {
  id: "cash-1",
  operator: "op-1",
  opened_at: "2026-06-25T08:00:00Z",
  opened_by: "user-1",
  closed_at: null,
  closed_by: null,
  opening_note: "Morning shift",
  closing_note: "",
  net_amount: "145000.00",
  movements: [
    {
      id: "mov-1",
      session: "cash-1",
      direction: "cash_in",
      amount: "200000.00",
      payment: null,
      billing_invoice: null,
      billing_refund_obligation: null,
      moved_at: "2026-06-25T08:10:00Z",
      moved_by: "user-1",
      note: "Client payment",
      created_at: "2026-06-25T08:10:00Z",
      updated_at: "2026-06-25T08:10:00Z",
    },
  ],
  created_at: "2026-06-25T08:00:00Z",
  updated_at: "2026-06-25T08:10:00Z",
};

const CLOSED_SESSION: CashboxSession = {
  id: "cash-2",
  operator: "op-2",
  opened_at: "2026-06-24T08:00:00Z",
  opened_by: "user-2",
  closed_at: "2026-06-24T18:00:00Z",
  closed_by: "user-3",
  opening_note: "Yesterday shift",
  closing_note: "Balanced",
  net_amount: "0.00",
  movements: [],
  created_at: "2026-06-24T08:00:00Z",
  updated_at: "2026-06-24T18:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CashboxPanel", () => {
  it("renders session summaries and records a movement when permitted", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getCashboxSessions").mockResolvedValue([OPEN_SESSION, CLOSED_SESSION]);
    vi.spyOn(api, "getCashboxMovements").mockResolvedValue(OPEN_SESSION.movements);
    const openSpy = vi.spyOn(api, "openCashboxSession").mockResolvedValue(OPEN_SESSION);
    const closeSpy = vi.spyOn(api, "closeCashboxSession").mockResolvedValue(OPEN_SESSION);
    const createSpy = vi.spyOn(api, "createCashboxMovement").mockResolvedValue(OPEN_SESSION.movements[0]);

    render(<CashboxPanel />);

    expect(await screen.findByText("Caisse")).toBeInTheDocument();
    expect(screen.getByText("Sessions ouvertes")).toBeInTheDocument();
    expect(screen.getByTestId("cashbox-session-row-cash-1")).toBeInTheDocument();
    expect(await screen.findByTestId("cashbox-movement-row-mov-1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Opérateur"), {
      target: { value: "op-3" },
    });
    fireEvent.change(screen.getByLabelText("Note d'ouverture"), {
      target: { value: "Evening shift" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith({
        operator: "op-3",
        opening_note: "Evening shift",
      });
    });

    fireEvent.change(screen.getByLabelText("Montant"), {
      target: { value: "5000.00" },
    });
    fireEvent.change(screen.getByLabelText("Note de mouvement"), {
      target: { value: "Petty cash purchase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("cash-1", {
        direction: "cash_in",
        amount: "5000.00",
        payment: null,
        billing_invoice: null,
        billing_refund_obligation: null,
        note: "Petty cash purchase",
      });
    });

    fireEvent.change(screen.getByLabelText("Note de clôture"), {
      target: { value: "Balanced at end of day" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clôturer la session" }));

    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalledWith("cash-1", {
        closing_note: "Balanced at end of day",
      });
    });
  });

  it("shows a read-only notice when permission is denied", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getCashboxSessions").mockResolvedValue([]);
    vi.spyOn(api, "getCashboxMovements").mockResolvedValue([]);

    render(<CashboxPanel />);

    expect(await screen.findByText("Cashbox access unavailable")).toBeInTheDocument();
    expect(screen.getByText("Read-only users cannot open, close, or record cashbox sessions.")).toBeInTheDocument();
  });

  it("shows an empty state when no sessions are returned", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getCashboxSessions").mockResolvedValue([]);
    vi.spyOn(api, "getCashboxMovements").mockResolvedValue([]);

    render(<CashboxPanel />);

    expect(await screen.findByText("Aucune session de caisse n'est visible.")).toBeInTheDocument();
    expect(screen.getByText("Aucune session sélectionnée.")).toBeInTheDocument();
  });
});
