import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import BillingInvoicePanel from "./BillingInvoicePanel";
import type { BillingCreditNote, BillingInvoice } from "./types";

const MOCK_INVOICE: BillingInvoice = {
  id: "inv-0001",
  excess_receivable: "er-0001",
  document_instance: null,
  reservation_draft: null,
  source_kind: "commercial_closeout",
  invoice_status: "open",
  amount: "150000.00",
  issued_at: "2026-06-18T10:00:00Z",
  settled_at: null,
  settled_by: null,
  notes: "",
  settlement: null,
  refund_obligation: {
    id: "ro-1",
    invoice: "inv-0001",
    refund_amount: "5000.00",
    document_instance: null,
    refund_payment: null,
    status: "pending",
    executed_at: null,
    executed_by: null,
    notes: "Awaiting execution",
    created_at: "2026-06-18T10:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  installments: [
    {
      id: "inst-1",
      invoice: "inv-0001",
      amount: "50000.00",
      paid_amount: "10000.00",
      due_at: "2026-06-25T10:00:00Z",
      status: "partially_paid",
      notes: "First tranche",
      allocations: [],
      is_overdue: false,
      created_at: "2026-06-18T10:00:00Z",
      updated_at: "2026-06-18T10:00:00Z",
    },
  ],
  installment_lifecycle: "partial",
  suggested_due_dates: null,
  closeout_status: "open",
  amount_settled: "0.00",
  amount_refunded: "0.00",
  remaining_balance: "150000.00",
  created_at: "2026-06-18T10:00:00Z",
  updated_at: "2026-06-18T10:00:00Z",
};

const MOCK_CREDIT_NOTE: BillingCreditNote = {
  id: "cn-1",
  invoice: "inv-0001",
  invoice_detail: MOCK_INVOICE,
  amount: "5000.00",
  reason: "Manual correction",
  status: "issued",
  issued_at: "2026-06-18T11:00:00Z",
  applied_at: null,
  applied_by: null,
  notes: "",
  created_at: "2026-06-18T11:00:00Z",
  updated_at: "2026-06-18T11:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BillingInvoicePanel", () => {
  it("renders invoices and a detailed operator view", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([MOCK_INVOICE]);
    vi.spyOn(api, "getBillingCreditNotes").mockResolvedValue([]);

    render(<BillingInvoicePanel />);

    expect(await screen.findByTestId("billing-write-denied")).toBeInTheDocument();
    const invoiceRow = await screen.findByTestId("billing-row-inv-0001");
    expect(invoiceRow).toBeInTheDocument();
    expect(screen.getByText("Invoice detail")).toBeInTheDocument();
    expect(invoiceRow).toHaveTextContent(/remaining/);
    expect(screen.getByText("No credit notes issued for this invoice.")).toBeInTheDocument();
  });

  it("settles an open invoice through the payment link", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([MOCK_INVOICE]);
    vi.spyOn(api, "getBillingCreditNotes").mockResolvedValue([]);
    const settleSpy = vi.spyOn(api, "settleBillingInvoice").mockResolvedValue({
      ...MOCK_INVOICE,
      invoice_status: "settled",
      settled_at: "2026-06-18T12:00:00Z",
      settled_by: "agent",
      settlement: {
        id: "set-1",
        payment: {
          id: "pay-1",
          reservation_draft: null,
          receipt_document: null,
          payment_kind: "deposit",
          payment_method: "cash",
          payment_status: "confirmed",
          amount: "150000.00",
          paid_at: "2026-06-18T12:00:00Z",
          external_reference: "",
          source_label: "Invoice settlement",
          notes: "",
          confirmed_at: "2026-06-18T12:00:00Z",
          confirmed_by: null,
          created_at: "2026-06-18T12:00:00Z",
          updated_at: "2026-06-18T12:00:00Z",
        },
        amount: "150000.00",
        settled_at: "2026-06-18T12:00:00Z",
        settled_by: null,
        notes: "",
        created_at: "2026-06-18T12:00:00Z",
        updated_at: "2026-06-18T12:00:00Z",
      },
    });

    render(<BillingInvoicePanel />);

    fireEvent.change(await screen.findByLabelText("Payment ID"), {
      target: { value: "pay-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Settle invoice" }));

    await waitFor(() => {
      expect(settleSpy).toHaveBeenCalledWith("inv-0001", {
        payment: "pay-1",
        notes: "",
      });
    });

    expect(await screen.findByText("Invoice settled successfully.")).toBeInTheDocument();
  });

  it("issues and cancels a credit note", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([MOCK_INVOICE]);
    vi.spyOn(api, "getBillingCreditNotes").mockResolvedValue([]);
    const issueSpy = vi.spyOn(api, "issueBillingCreditNote").mockResolvedValue(MOCK_CREDIT_NOTE);
    const cancelSpy = vi.spyOn(api, "cancelBillingCreditNote").mockResolvedValue({
      ...MOCK_CREDIT_NOTE,
      status: "cancelled",
    });

    render(<BillingInvoicePanel />);

    fireEvent.change((await screen.findAllByPlaceholderText("0.00"))[1], {
      target: { value: "5000.00" },
    });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Manual correction" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Issue credit note" }));

    await waitFor(() => {
      expect(issueSpy).toHaveBeenCalledWith("inv-0001", {
        amount: "5000.00",
        reason: "Manual correction",
        notes: "",
      });
    });

    fireEvent.click(await screen.findByRole("button", { name: "Cancel note" }));

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith("inv-0001", "cn-1", "Cancelled from FE-C.");
    });
  });

  it("shows create controls as read-only when permission is denied", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([MOCK_INVOICE]);
    vi.spyOn(api, "getBillingCreditNotes").mockResolvedValue([]);

    render(<BillingInvoicePanel />);

    expect(await screen.findByTestId("billing-write-denied")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settle invoice" })).toBeNull();
    expect(screen.getByRole("button", { name: "Issue credit note" })).toBeDisabled();
  });
});
