import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  PaymentRegistrationModal,
  numberToFrenchWords,
  formatMoney,
} from "./PaymentRegistrationModal";
import * as api from "../api";
import * as docViewer from "./DocumentCanvasViewer";

vi.mock("../api", () => ({
  recordConfirmedDeposit: vi.fn(),
  getCashboxSessions: vi.fn().mockResolvedValue([]),
  createCashboxMovement: vi.fn().mockResolvedValue({ id: "mov-auto-1" }),
}));

vi.mock("./DocumentCanvasViewer", () => ({
  printDocumentHtml: vi.fn(),
}));

describe("PaymentRegistrationModal", () => {
  const mockOnClose = vi.fn();
  const mockOnPaymentRecorded = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    domain: "titan" as const,
    draftId: "draft-titan-123",
    draftReference: "TITAN-2026-0089",
    proformaReference: "PRO-TITAN-2026-0089",
    customerName: "Jean Dupont",
    customerPhone: "+261 34 00 000 00",
    eventDateLabel: "15/09/2026",
    totalAmount: 2000000,
    paidAmount: 500000,
    requiredDepositAmount: 1000000,
    cautionAmount: 300000,
    existingPayments: [
      {
        id: "pay-1",
        date: "2026-09-01T10:00:00Z",
        method: "cash",
        amount: 500000,
        note: "Premier acompte",
        reference: "REC-001",
      },
    ],
    onPaymentRecorded: mockOnPaymentRecorded,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("numberToFrenchWords", () => {
    it("converts numbers to French words in Ariary correctly", () => {
      expect(numberToFrenchWords(0)).toBe("Zéro Ariary");
      expect(numberToFrenchWords(1)).toBe("Un Ariary");
      expect(numberToFrenchWords(21)).toBe("Vingt et un Ariary");
      expect(numberToFrenchWords(80)).toBe("Quatre-vingts Ariary");
      expect(numberToFrenchWords(100)).toBe("Cent Ariary");
      expect(numberToFrenchWords(200)).toBe("Deux cents Ariary");
      expect(numberToFrenchWords(1000)).toBe("Mille Ariary");
      expect(numberToFrenchWords(500000)).toBe("Cinq cent mille Ariary");
      expect(numberToFrenchWords(1500000)).toBe("Un million cinq cent mille Ariary");
    });
  });

  it("renders modal with correct accounting details and KPIs", () => {
    render(<PaymentRegistrationModal {...defaultProps} />);

    expect(screen.getByText("Enregistrement d'un Versement & Reçu Officiel")).toBeInTheDocument();
    expect(screen.getByText("Titan Rental")).toBeInTheDocument();
    expect(screen.getByText(/TITAN-2026-0089/)).toBeInTheDocument();
    expect(screen.getByText(/Jean Dupont/)).toBeInTheDocument();

    // Financial KPIs
    expect(screen.getByText("Total Devis TTC")).toBeInTheDocument();
    expect(screen.getAllByText("2 000 000 Ar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Déjà Réglé")).toBeInTheDocument();
    expect(screen.getAllByText("500 000 Ar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Reste Dû Actuel")).toBeInTheDocument();
    expect(screen.getByText("1 500 000 Ar")).toBeInTheDocument();
    expect(screen.getByText("1 000 000 Ar")).toBeInTheDocument(); // Acompte (50%)
  });

  it("updates projected calculations and French words in real time upon amount input", () => {
    render(<PaymentRegistrationModal {...defaultProps} />);

    const amountInput = screen.getByPlaceholderText("Ex: 500000");
    fireEvent.change(amountInput, { target: { value: "500000" } });

    // French words display
    expect(screen.getByText(/Cinq cent mille Ariary/i)).toBeInTheDocument();

    // Real-time projection badge: 500k + 500k = 1M (covers required deposit)
    expect(screen.getByText(/L'acompte légal de 50% est couvert/)).toBeInTheDocument();
    expect(screen.getByText(/Nouveau solde : 1 000 000 Ar/)).toBeInTheDocument();
  });

  it("handles quick fill buttons for remaining deposit and full balance", () => {
    render(<PaymentRegistrationModal {...defaultProps} />);

    // Click "Acompte restant (500 000 Ar)"
    const depositBtn = screen.getByText(/Acompte restant/);
    fireEvent.click(depositBtn);

    const amountInput = screen.getByPlaceholderText("Ex: 500000") as HTMLInputElement;
    expect(amountInput.value).toBe("500000");

    // Click "Tout solder (1 500 000 Ar)"
    const balanceBtn = screen.getByText(/Tout solder/);
    fireEvent.click(balanceBtn);
    expect(amountInput.value).toBe("1500000");

    // Check full settlement projection
    expect(screen.getByText(/Ce versement solde intégralement le dossier/)).toBeInTheDocument();
    expect(screen.getByText(/Nouveau solde : 0 Ar/)).toBeInTheDocument();
  });

  it("switches to the history tab and allows viewing and switching past receipts", () => {
    render(<PaymentRegistrationModal {...defaultProps} />);

    // Switch to history tab
    const historyTabBtn = screen.getByText(/Historique des reçus/);
    fireEvent.click(historyTabBtn);

    expect(screen.getByText("REC-001")).toBeInTheDocument();
    expect(screen.getByText("Premier acompte")).toBeInTheDocument();

    // Click "Voir le reçu"
    const viewReceiptBtn = screen.getByText("Voir le reçu");
    fireEvent.click(viewReceiptBtn);

    expect(screen.getByText(/Aperçu du reçu de versement du/)).toBeInTheDocument();

    // Click "← Reçu en direct"
    const livePreviewBtn = screen.getByText("← Reçu en direct");
    fireEvent.click(livePreviewBtn);

    expect(screen.queryByText(/Aperçu du reçu de versement du/)).not.toBeInTheDocument();
  });

  it("calls printDocumentHtml when clicking the print button", () => {
    render(<PaymentRegistrationModal {...defaultProps} />);

    const printBtn = screen.getByText("Imprimer");
    fireEvent.click(printBtn);

    expect(docViewer.printDocumentHtml).toHaveBeenCalled();
  });

  it("submits payment successfully with recordConfirmedDeposit and calls onPaymentRecorded", async () => {
    vi.mocked(api.recordConfirmedDeposit).mockResolvedValueOnce({
      payment: {
        id: "pay-new-2",
        reservation_draft: "draft-titan-123",
        hahitantsoa_event_draft: null,
        receipt_document: null,
        refund_obligation: null,
        billing_refund_obligation: null,
        payment_kind: "deposit",
        payment_method: "mobile_money",
        payment_status: "confirmed",
        amount: "500000.00",
        paid_at: "2026-09-07T12:00:00Z",
        external_reference: "MVOLA-889911",
        source_label: "",
        notes: "Acompte par MVola",
        confirmed_at: "2026-09-07T12:00:00Z",
        confirmed_by: null,
        created_at: "2026-09-07T12:00:00Z",
        updated_at: "2026-09-07T12:00:00Z",
      },
      replayed: false,
      reservation_draft_id: "draft-titan-123",
      reservation_draft_status: "deposit_received",
    });

    render(<PaymentRegistrationModal {...defaultProps} />);

    // Fill form
    const amountInput = screen.getByPlaceholderText("Ex: 500000");
    fireEvent.change(amountInput, { target: { value: "500000" } });

    const methodSelect = screen.getByLabelText("Mode de règlement");
    fireEvent.change(methodSelect, { target: { value: "mobile_money" } });

    const refInput = screen.getByPlaceholderText(/Ex: MVOLA/);
    fireEvent.change(refInput, { target: { value: "MVOLA-889911" } });

    const notesInput = screen.getByPlaceholderText(/Ex: Remis en main propre/);
    fireEvent.change(notesInput, { target: { value: "Acompte par MVola" } });

    // Submit
    const submitBtn = screen.getByText("Enregistrer & Valider le versement");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.recordConfirmedDeposit).toHaveBeenCalledWith(
        expect.objectContaining({
          reservation_draft: "draft-titan-123",
          hahitantsoa_event_draft: null,
          payment_method: "mobile_money",
          amount: "500000.00",
          external_reference: "MVOLA-889911",
          notes: "Acompte par MVola",
          idempotency_key: expect.any(String),
        }),
      );
      expect(mockOnPaymentRecorded).toHaveBeenCalled();
    });
  });

  it("detects active open cashbox session and registers linked cash movement when paying in cash", async () => {
    vi.mocked(api.getCashboxSessions).mockResolvedValueOnce([
      {
        id: "session-active-99",
        operator: "user-1",
        opening_amount: 50000,
        status: "open",
        opened_at: "2026-09-07T08:00:00Z",
        opened_by: "user-1",
        closed_at: null,
        closed_by: null,
        opening_note: "",
        closing_note: "",
        net_amount: 0,
        theoretical_amount: 50000,
        movements: [],
        created_at: "2026-09-07T08:00:00Z",
        updated_at: "2026-09-07T08:00:00Z",
      },
    ]);

    vi.mocked(api.recordConfirmedDeposit).mockResolvedValueOnce({
      payment: {
        id: "pay-cash-99",
        reservation_draft: "draft-titan-123",
        hahitantsoa_event_draft: null,
        receipt_document: null,
        refund_obligation: null,
        billing_refund_obligation: null,
        payment_kind: "deposit",
        payment_method: "cash",
        payment_status: "confirmed",
        amount: "500000.00",
        paid_at: "2026-09-07T12:00:00Z",
        external_reference: "",
        source_label: "",
        notes: "Acompte en espèces",
        confirmed_at: "2026-09-07T12:00:00Z",
        confirmed_by: null,
        created_at: "2026-09-07T12:00:00Z",
        updated_at: "2026-09-07T12:00:00Z",
      },
      replayed: false,
      reservation_draft_id: "draft-titan-123",
      reservation_draft_status: "deposit_received",
    });

    render(<PaymentRegistrationModal {...defaultProps} />);

    // Check cashbox badge
    expect(await screen.findByText(/Caisse active détectée/)).toBeInTheDocument();

    const amountInput = screen.getByPlaceholderText("Ex: 500000");
    fireEvent.change(amountInput, { target: { value: "500000" } });

    const submitBtn = screen.getByText("Enregistrer & Valider le versement");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.recordConfirmedDeposit).toHaveBeenCalled();
      expect(api.createCashboxMovement).toHaveBeenCalledWith(
        "session-active-99",
        expect.objectContaining({
          direction: "cash_in",
          amount: 500000,
          payment: "pay-cash-99",
        }),
      );
    });
  });
});
