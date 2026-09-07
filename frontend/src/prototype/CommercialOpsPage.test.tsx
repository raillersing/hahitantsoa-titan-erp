import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CommercialOpsPage from "./CommercialOpsPage";
import * as api from "../api";
import type {
  BillingInvoice,
  Payment,
  ReservationDraft,
  HahitantsoaEventDraft,
} from "../types";

const MOCK_INVOICES: BillingInvoice[] = [
  {
    id: "inv-001-aaaa-bbbb",
    amount: "3000000.00",
    invoice_status: "open",
    issued_at: "2026-09-01T10:00:00Z",
    document_instance: {
      id: "doc-inst-1",
      reservation_draft: "hahi-draft-1",
      hahitantsoa_event_draft: "hahi-draft-1",
      customer: "cust-2",
      template_key: "tmpl-1",
      template_version: "1.0",
      template_label: "Facture Domaine Hahitantsoa",
      business_scope: "hahitantsoa",
      document_type: "facture",
      template_status: "active",
      template_source_kind: "file",
      template_source_reference: "H-012/2026",
      template_path: "",
      template_preview_path: "",
      template_validated_by_client: true,
      template_notes: "",
      reservation_public_reference: "H-012/2026",
      reservation_status: "draft",
      customer_display_name: "Marie Rasoa",
      customer_email: "marie@example.com",
      customer_phone: "+261 34 11 222 33",
      customer_address: "Antananarivo",
    } as any,
    settlement: null,
    refund_obligation: null,
    installments: [],
    excess_receivable: null,
    reservation_draft: null,
    hahitantsoa_event_draft: "hahi-draft-1",
    source_kind: "manual",
    settled_at: null,
    settled_by: null,
    notes: "",
    installment_lifecycle: "none",
    suggested_due_dates: null,
    closeout_status: "open",
    amount_settled: "0",
    amount_refunded: "0",
    remaining_balance: "3000000.00",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  },
  {
    id: "inv-002-cccc-dddd",
    amount: "1500000.00",
    invoice_status: "settled",
    issued_at: "2026-09-02T14:00:00Z",
    document_instance: {
      id: "doc-inst-2",
      reservation_draft: "draft-titan-1",
      customer: "cust-1",
      template_key: "tmpl-2",
      template_version: "1.0",
      template_label: "Contrat Titan Rental",
      business_scope: "titan",
      document_type: "contrat",
      template_status: "active",
      template_source_kind: "file",
      template_source_reference: "TITAN-2026-0089",
      template_path: "",
      template_preview_path: "",
      template_validated_by_client: true,
      template_notes: "",
      reservation_public_reference: "TITAN-2026-0089",
      reservation_status: "draft",
      customer_display_name: "Jean Dupont",
      customer_email: "jean@example.com",
      customer_phone: "+261 34 00 000 00",
      customer_address: "Antananarivo",
    } as any,
    settlement: {
      id: "settle-1",
      payment: {
        id: "pay-1",
        reservation_draft: "draft-titan-1",
        hahitantsoa_event_draft: null,
        receipt_document: null,
        refund_obligation: null,
        billing_refund_obligation: null,
        payment_kind: "deposit",
        payment_method: "cash",
        payment_status: "confirmed",
        amount: "1500000.00",
        paid_at: "2026-09-03T10:00:00Z",
        external_reference: "POS-CASH-001",
        source_label: "TITAN-2026-0089",
        notes: "Acompte espèces",
        confirmed_at: "2026-09-03T10:00:00Z",
        confirmed_by: null,
        created_at: "2026-09-03T10:00:00Z",
        updated_at: "2026-09-03T10:00:00Z",
      },
      amount: "1500000.00",
      settled_at: "2026-09-03T10:00:00Z",
      settled_by: "user-1",
      notes: "Réglé par virement",
      created_at: "2026-09-03T10:00:00Z",
      updated_at: "2026-09-03T10:00:00Z",
    },
    refund_obligation: null,
    installments: [],
    excess_receivable: null,
    reservation_draft: "draft-titan-1",
    hahitantsoa_event_draft: null,
    source_kind: "manual",
    settled_at: "2026-09-03T10:00:00Z",
    settled_by: "user-1",
    notes: "Réglé par virement",
    installment_lifecycle: "none",
    suggested_due_dates: null,
    closeout_status: "settled",
    amount_settled: "1500000.00",
    amount_refunded: "0",
    remaining_balance: "0",
    created_at: "2026-09-02T14:00:00Z",
    updated_at: "2026-09-03T10:00:00Z",
  },
];

const MOCK_PAYMENTS: Payment[] = [
  {
    id: "pay-1",
    reservation_draft: "draft-titan-1",
    hahitantsoa_event_draft: null,
    receipt_document: null,
    refund_obligation: null,
    billing_refund_obligation: null,
    payment_kind: "deposit",
    payment_method: "cash",
    payment_status: "confirmed",
    amount: "1500000.00",
    paid_at: "2026-09-03T10:00:00Z",
    external_reference: "POS-CASH-001",
    source_label: "TITAN-2026-0089",
    notes: "Acompte espèces",
    confirmed_at: "2026-09-03T10:00:00Z",
    confirmed_by: null,
    created_at: "2026-09-03T10:00:00Z",
    updated_at: "2026-09-03T10:00:00Z",
  },
  {
    id: "pay-2",
    reservation_draft: null,
    hahitantsoa_event_draft: "hahi-draft-1",
    receipt_document: null,
    refund_obligation: null,
    billing_refund_obligation: null,
    payment_kind: "deposit",
    payment_method: "mobile_money",
    payment_status: "confirmed",
    amount: "1000000.00",
    paid_at: "2026-09-05T11:00:00Z",
    external_reference: "MVOLA-8899",
    source_label: "H-012/2026",
    notes: "Acompte MVola",
    confirmed_at: "2026-09-05T11:00:00Z",
    confirmed_by: null,
    created_at: "2026-09-05T11:00:00Z",
    updated_at: "2026-09-05T11:00:00Z",
  },
];

const MOCK_TITAN_DRAFTS: ReservationDraft[] = [
  {
    id: "draft-titan-1",
    public_reference: "TITAN-2026-0089",
    status: "draft",
    customer_id: "cust-1",
    customer_display_name: "Jean Dupont",
    start_at: "2026-09-20T08:00:00Z",
    end_at: "2026-09-21T18:00:00Z",
    notes: "Location tentes et chaises",
    total_amount: "1500000.00",
    required_deposit_amount: "750000.00",
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: "2026-09-03T10:00:00Z",
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    lines: [],
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-03T10:00:00Z",
  },
];

const MOCK_HAHITANTSOA_DRAFTS: HahitantsoaEventDraft[] = [
  {
    id: "hahi-draft-1",
    public_reference: "H-012/2026",
    status: "draft",
    customer_id: "cust-2",
    customer_display_name: "Marie Rasoa",
    event_name: "Mariage Marie & Paul",
    venue_name: "Grand Domaine",
    location_details: "Antananarivo",
    service_notes: "",
    start_at: "2026-09-12T10:00:00Z", // < 7 days away from Sep 7
    end_at: "2026-09-12T23:00:00Z",
    notes: "Prestation complète",
    space_rental_amount: "3000000.00",
    required_deposit_amount: "1500000.00",
    lines: [],
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-05T11:00:00Z",
  },
];

describe("CommercialOpsPage", () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue(MOCK_INVOICES);
    vi.spyOn(api, "getPayments").mockResolvedValue(MOCK_PAYMENTS);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_TITAN_DRAFTS);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_HAHITANTSOA_DRAFTS);
    vi.spyOn(api, "getCashboxSessions").mockResolvedValue([]);
  });

  it("renders header, dynamic KPIs, and invoices table", async () => {
    render(<CommercialOpsPage onNavigate={mockNavigate} />);

    expect(await screen.findByText("Opérations Commerciales & Facturation")).toBeInTheDocument();
    expect(screen.getByText("Hub Financier & Recouvrement")).toBeInTheDocument();

    // KPIs: Total Invoiced: 3M + 1.5M = 4.5M
    expect(screen.getByText("Total Facturé TTC")).toBeInTheDocument();
    expect(screen.getByText(/4 500 000/)).toBeInTheDocument();

    // Total Collected: 1.5M + 1M = 2.5M
    expect(screen.getByText("Total Encaissé")).toBeInTheDocument();
    expect(screen.getByText(/\+2 500 000/)).toBeInTheDocument();

    // Invoices in table
    expect(screen.getByText("Marie Rasoa")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getByText("H-012/2026")).toBeInTheDocument();
    expect(screen.getByText("TITAN-2026-0089")).toBeInTheDocument();
  });

  it("filters invoices by domain (Hahitantsoa vs Titan)", async () => {
    render(<CommercialOpsPage onNavigate={mockNavigate} />);
    await screen.findByText("Opérations Commerciales & Facturation");

    const domainSelect = screen.getByRole("combobox");
    fireEvent.change(domainSelect, { target: { value: "hahitantsoa" } });

    expect(screen.getByText("H-012/2026")).toBeInTheDocument();
    expect(screen.queryByText("TITAN-2026-0089")).not.toBeInTheDocument();

    fireEvent.change(domainSelect, { target: { value: "titan" } });
    expect(screen.queryByText("H-012/2026")).not.toBeInTheDocument();
    expect(screen.getByText("TITAN-2026-0089")).toBeInTheDocument();
  });

  it("switches to Échéancier tab and allows opening customer relance modal", async () => {
    render(<CommercialOpsPage onNavigate={mockNavigate} />);
    await screen.findByText("Opérations Commerciales & Facturation");

    // Switch to Échéancier
    const scheduleTabBtn = screen.getByRole("button", { name: /Échéancier & Relances/i });
    fireEvent.click(scheduleTabBtn);

    expect(screen.getByText("Échéancier opérationnel basé sur les réservations réelles")).toBeInTheDocument();
    expect(screen.getByText("Mariage Marie & Paul")).toBeInTheDocument();

    // Click "Relancer" on H-012/2026
    const relanceBtns = screen.getAllByRole("button", { name: /Relancer/i });
    expect(relanceBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(relanceBtns[0]);

    expect(await screen.findByText("Relance Règlement Client")).toBeInTheDocument();
    expect(screen.getByText("Message de relance suggéré (prêt à être copié / envoyé) :")).toBeInTheDocument();

    // Click "Copier le message"
    const copyBtn = screen.getByRole("button", { name: /Copier le message/i });
    fireEvent.click(copyBtn);

    expect(screen.queryByText("Relance Règlement Client")).not.toBeInTheDocument();
  });

  it("switches to Journal des Règlements tab and displays payments with method badges", async () => {
    render(<CommercialOpsPage onNavigate={mockNavigate} />);
    await screen.findByText("Opérations Commerciales & Facturation");

    const paymentsTabBtn = screen.getByRole("button", { name: /Journal des Règlements/i });
    fireEvent.click(paymentsTabBtn);

    expect(screen.getByText("Mode de paiement :")).toBeInTheDocument();
    expect(screen.getByText("Acompte espèces")).toBeInTheDocument();
    expect(screen.getByText("Acompte MVola")).toBeInTheDocument();
    expect(screen.getByText("POS-CASH-001")).toBeInTheDocument();
    expect(screen.getByText("MVOLA-8899")).toBeInTheDocument();
  });

  it("opens document preview modal when clicking Aperçu", async () => {
    render(<CommercialOpsPage onNavigate={mockNavigate} />);
    await screen.findByText("Opérations Commerciales & Facturation");

    const viewBtns = screen.getAllByTitle("Aperçu & Impression du document officiel");
    expect(viewBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(viewBtns[0]);

    expect(await screen.findByText(/Facture #inv-001/i)).toBeInTheDocument();
  });

  it("settles open invoice using settleBillingInvoice", async () => {
    const settleSpy = vi.spyOn(api, "settleBillingInvoice").mockResolvedValue({
      ...MOCK_INVOICES[0],
      invoice_status: "settled",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<CommercialOpsPage onNavigate={mockNavigate} />);
    await screen.findByText("Opérations Commerciales & Facturation");

    const settleBtn = screen.getByRole("button", { name: /Régler/i });
    fireEvent.click(settleBtn);

    await waitFor(() => {
      expect(settleSpy).toHaveBeenCalledWith(
        "inv-001-aaaa-bbbb",
        expect.objectContaining({
          notes: expect.any(String),
        }),
      );
    });
  });
});
