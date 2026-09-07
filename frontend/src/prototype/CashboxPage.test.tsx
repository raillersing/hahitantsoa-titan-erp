import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import CashboxPage from "./CashboxPage";
import type { CashboxSession, CashboxMovement, User } from "../types";

const MOCK_USER: User = {
  id: "user-1",
  username: "caissier_principal",
  email: "caissier@hahitantsoa.mg",
  first_name: "Jean",
  last_name: "Rakoto",
  display_name: "Jean Rakoto",
  is_active: true,
  is_staff: true,
  role_names: ["Administrateur"],
  last_login: "2026-09-07T08:00:00Z",
  date_joined: "2026-01-01T00:00:00Z",
};

const OPEN_SESSION: CashboxSession = {
  id: "session-101",
  operator: "user-1",
  opening_amount: 100000,
  status: "open",
  opened_at: "2026-09-07T08:00:00Z",
  opened_by: "user-1",
  closed_at: null,
  closed_by: null,
  opening_note: "Fond de caisse 100 000 Ar",
  closing_note: "",
  net_amount: 150000,
  theoretical_amount: 250000,
  movements: [
    {
      id: "mov-1",
      session: "session-101",
      direction: "cash_in",
      amount: 200000,
      payment: null,
      billing_invoice: null,
      billing_refund_obligation: null,
      moved_at: "2026-09-07T09:30:00Z",
      moved_by: "user-1",
      note: "[APPORT_CAISSE] Fond de roulement supplémentaire",
      created_at: "2026-09-07T09:30:00Z",
      updated_at: "2026-09-07T09:30:00Z",
    },
    {
      id: "mov-2",
      session: "session-101",
      direction: "cash_out",
      amount: 50000,
      payment: null,
      billing_invoice: null,
      billing_refund_obligation: null,
      moved_at: "2026-09-07T11:15:00Z",
      moved_by: "user-1",
      note: "[MENUE_DEPENSE] [Tiers: Papeterie] Achat rames de papier",
      created_at: "2026-09-07T11:15:00Z",
      updated_at: "2026-09-07T11:15:00Z",
    },
  ],
  created_at: "2026-09-07T08:00:00Z",
  updated_at: "2026-09-07T11:15:00Z",
};

const SUBMITTED_SESSION: CashboxSession = {
  ...OPEN_SESSION,
  id: "session-102",
  status: "count_submitted",
  closure_attempts: [
    {
      id: "att-1",
      theoretical_amount: 250000,
      actual_amount: 248000,
      variance_amount: -2000,
      variance_justification: "Erreur de rendu de monnaie sur petite monnaie",
      submitted_at: "2026-09-07T17:00:00Z",
      submitted_by: "user-1",
      submission_idempotency_key: "key-1",
    },
  ],
};

describe("CashboxPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "getCashboxSessions").mockResolvedValue([OPEN_SESSION]);
    vi.spyOn(api, "getCashboxMovements").mockResolvedValue(OPEN_SESSION.movements);
    vi.spyOn(api, "getUsers").mockResolvedValue([MOCK_USER]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders cashbox header, live KPIs, and movements table", async () => {
    render(<CashboxPage onNavigate={vi.fn()} />);

    expect(await screen.findByText("Gestion de Caisse")).toBeInTheDocument();
    expect(screen.getByText("Session Ouverte (En cours)")).toBeInTheDocument();
    expect(screen.getByText("Fond Initial de Caisse")).toBeInTheDocument();

    // Check movements present
    expect(screen.getByText("Fond de roulement supplémentaire")).toBeInTheDocument();
    expect(screen.getByText("[Tiers: Papeterie] Achat rames de papier")).toBeInTheDocument();
    expect(screen.getByText("+ 200 000")).toBeInTheDocument();
    expect(screen.getByText("− 50 000")).toBeInTheDocument();
  });

  it("opens modal to create a categorized cash-in movement", async () => {
    const createSpy = vi.spyOn(api, "createCashboxMovement").mockResolvedValue({
      id: "mov-new",
      session: "session-101",
      direction: "cash_in",
      amount: 80000,
      payment: null,
      billing_invoice: null,
      billing_refund_obligation: null,
      moved_at: "2026-09-07T14:00:00Z",
      moved_by: "user-1",
      note: "[ENCAISSEMENT_DIRECT] Prestation photobooth",
      created_at: "2026-09-07T14:00:00Z",
      updated_at: "2026-09-07T14:00:00Z",
    });

    render(<CashboxPage onNavigate={vi.fn()} />);
    await screen.findByText("Gestion de Caisse");

    // Click "Ajouter (Entrée)"
    const addInBtn = screen.getByRole("button", { name: /Ajouter \(Entrée\)/i });
    fireEvent.click(addInBtn);

    expect(await screen.findByText("Nouvelle Entrée de Caisse")).toBeInTheDocument();

    // Fill amount and note
    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "80000" } });

    const submitBtn = screen.getByRole("button", { name: /Enregistrer l'opération/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        "session-101",
        expect.objectContaining({
          direction: "cash_in",
          amount: 80000,
        }),
      );
    });
  });

  it("opens modal to create a categorized cash-out movement (menue dépense / carburant)", async () => {
    const createSpy = vi.spyOn(api, "createCashboxMovement").mockResolvedValue({
      id: "mov-out",
      session: "session-101",
      direction: "cash_out",
      amount: 30000,
      payment: null,
      billing_invoice: null,
      billing_refund_obligation: null,
      moved_at: "2026-09-07T15:00:00Z",
      moved_by: "user-1",
      note: "[TRANSPORT_CARBURANT] [Tiers: Total] Plein essence camion",
      created_at: "2026-09-07T15:00:00Z",
      updated_at: "2026-09-07T15:00:00Z",
    });

    render(<CashboxPage onNavigate={vi.fn()} />);
    await screen.findByText("Gestion de Caisse");

    // Click "Retirer (Sortie)"
    const addOutBtn = screen.getByRole("button", { name: /Retirer \(Sortie\)/i });
    fireEvent.click(addOutBtn);

    expect(await screen.findByText("Nouvelle Sortie de Caisse")).toBeInTheDocument();

    // Select category Transport & Carburant
    const transportCard = screen.getByText("Frais de déplacement, taxi, carburant livraison ou logistique");
    fireEvent.click(transportCard);

    // Fill amount and beneficiary
    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "30000" } });

    const beneficiaryInput = screen.getByPlaceholderText(/Station Total/i);
    fireEvent.change(beneficiaryInput, { target: { value: "Total" } });

    const submitBtn = screen.getByRole("button", { name: /Enregistrer l'opération/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        "session-101",
        expect.objectContaining({
          direction: "cash_out",
          amount: 30000,
        }),
      );
    });
  });

  it("opens the billetage modal and submits counted cash", async () => {
    const submitCountSpy = vi.spyOn(api, "submitCashboxCount").mockResolvedValue(SUBMITTED_SESSION);

    render(<CashboxPage onNavigate={vi.fn()} />);
    await screen.findByText("Gestion de Caisse");

    const closeBtn = screen.getByRole("button", { name: /Billetage & Clôture/i });
    fireEvent.click(closeBtn);

    expect(await screen.findByText("Billetage & Clôture de Caisse")).toBeInTheDocument();
    expect(screen.getByText("Solde Théorique attendu")).toBeInTheDocument();

    // Switch to direct input for easy test
    const switchModeBtn = screen.getByText(/Saisie directe rapide/i);
    fireEvent.click(switchModeBtn);

    const directInput = screen.getByPlaceholderText("0");
    fireEvent.change(directInput, { target: { value: "250000" } });

    expect(screen.getByText("Comptage Parfait — Aucun Écart de Caisse")).toBeInTheDocument();

    const submitCountBtn = screen.getByRole("button", { name: /Soumettre le comptage du soir/i });
    fireEvent.click(submitCountBtn);

    await waitFor(() => {
      expect(submitCountSpy).toHaveBeenCalledWith(
        "session-101",
        expect.objectContaining({
          actual_amount: 250000,
        }),
      );
    });
  });

  it("displays supervisor validation modal and validates closure", async () => {
    vi.spyOn(api, "getCashboxSessions").mockResolvedValue([SUBMITTED_SESSION]);
    const validateSpy = vi.spyOn(api, "validateCashboxCount").mockResolvedValue({
      ...SUBMITTED_SESSION,
      status: "validated_closed",
      closed_at: "2026-09-07T17:30:00Z",
    });

    render(<CashboxPage onNavigate={vi.fn()} />);
    await screen.findByText("Gestion de Caisse");

    const valBtn = screen.getByRole("button", { name: /Valider la clôture/i });
    fireEvent.click(valBtn);

    expect(await screen.findByText("Validation Superviseur de Caisse")).toBeInTheDocument();
    expect(screen.getByText("Erreur de rendu de monnaie sur petite monnaie")).toBeInTheDocument();

    const confirmValBtn = screen.getByRole("button", { name: /Apposer le Visa & Clôturer/i });
    fireEvent.click(confirmValBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith(
        "session-102",
        expect.objectContaining({
          idempotency_key: expect.any(String),
        }),
      );
    });
  });

  it("opens printable Ticket Z and receipt dialogs", async () => {
    render(<CashboxPage onNavigate={vi.fn()} />);
    await screen.findByText("Gestion de Caisse");

    const journalZBtn = screen.getByRole("button", { name: /Journal Z \(80mm \/ A4\)/i });
    fireEvent.click(journalZBtn);

    expect(await screen.findByText("Journal Z de Caisse (Clôture)")).toBeInTheDocument();
    expect(screen.getByText("JOURNAL Z DE CAISSE")).toBeInTheDocument();

    // Switch to A4 format
    const a4Btn = screen.getByRole("button", { name: /Format A4/i });
    fireEvent.click(a4Btn);

    expect(screen.getByText("Détail chronologique des opérations")).toBeInTheDocument();
  });
});
