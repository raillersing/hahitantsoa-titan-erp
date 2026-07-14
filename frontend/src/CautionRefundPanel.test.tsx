import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import CautionRefundPanel from "./CautionRefundPanel";
import * as api from "./api";
import type { InventoryDamageLossSettlement, Payment } from "./types";

const MOCK_CAUTION_PAYMENTS: Payment[] = [
  {
    id: "caution-1",
    reservation_draft: null,
    hahitantsoa_event_draft: null,
    receipt_document: null,
    refund_obligation: null,
    billing_refund_obligation: null,
    payment_kind: "caution",
    payment_method: "cash",
    payment_status: "confirmed",
    amount: "500000",
    paid_at: "2026-03-01T10:00:00Z",
    external_reference: "",
    source_label: "Wedding deposit",
    notes: "",
    confirmed_at: "2026-03-01T10:00:00Z",
    confirmed_by: null,
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "caution-2",
    reservation_draft: null,
    hahitantsoa_event_draft: null,
    receipt_document: null,
    refund_obligation: null,
    billing_refund_obligation: null,
    payment_kind: "caution",
    payment_method: "bank_transfer",
    payment_status: "pending",
    amount: "250000",
    paid_at: null,
    external_reference: "",
    source_label: "Event deposit",
    notes: "",
    confirmed_at: null,
    confirmed_by: null,
    created_at: "2026-03-15T10:00:00Z",
    updated_at: "2026-03-15T10:00:00Z",
  },
];

const MOCK_NON_CAUTION_PAYMENTS: Payment[] = [
  {
    id: "payment-deposit",
    reservation_draft: null,
    hahitantsoa_event_draft: null,
    receipt_document: null,
    refund_obligation: null,
    billing_refund_obligation: null,
    payment_kind: "deposit",
    payment_method: "cash",
    payment_status: "confirmed",
    amount: "100000",
    paid_at: "2026-03-01T10:00:00Z",
    external_reference: "",
    source_label: "Booking deposit",
    notes: "",
    confirmed_at: "2026-03-01T10:00:00Z",
    confirmed_by: null,
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:00:00Z",
  },
];

const MOCK_SETTLEMENTS: InventoryDamageLossSettlement[] = [
  {
    id: "settle-1",
    return_operation: "ret-op-1",
    document_instance: null,
    settlement_status: "draft",
    damage_loss_total: 350000,
    caution_available: 500000,
    caution_applied: 350000,
    refund_due: 150000,
    excess_due: 0,
    notes: "",
    validated_at: null,
    validated_by: null,
    lines: [],
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    created_by: null,
    updated_by: null,
  },
];

describe("CautionRefundPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders heading and tab bar", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([]);

    render(<CautionRefundPanel />);

    expect(screen.getByText("Dépôts de caution & Remboursements")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Dépôts de caution" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Règlements" })).toBeInTheDocument();
  });

  it("shows empty state when no caution deposits exist", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(screen.getByText("Aucun dépôt de caution enregistré.")).toBeInTheDocument();
    });
  });

  it("shows loading state for deposits initially", async () => {
    vi.spyOn(api, "getPayments").mockImplementation(
      () => new Promise(() => {}),
    );

    render(<CautionRefundPanel />);

    expect(screen.getByText("Chargement des dépôts...")).toBeInTheDocument();
  });

  it("filters to only caution payment kinds", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([
      ...MOCK_CAUTION_PAYMENTS,
      ...MOCK_NON_CAUTION_PAYMENTS,
    ]);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("caution-row-caution-1")).toBeInTheDocument();
      expect(screen.getByTestId("caution-row-caution-2")).toBeInTheDocument();
    });

    expect(screen.queryByText("Booking deposit")).not.toBeInTheDocument();
  });

  it("shows error state with retry when payments API fails", async () => {
    vi.spyOn(api, "getPayments").mockRejectedValue(new Error("Server error"));

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Réessayer le chargement" }),
    ).toBeInTheDocument();
  });

  it("switches to settlements tab and loads settlements", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue(MOCK_SETTLEMENTS);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("caution-deposits-panel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Règlements" }));

    await waitFor(() => {
      expect(screen.getByTestId("caution-settlements-panel")).toBeInTheDocument();
    });

    expect(screen.getByTestId("settlement-row-settle-1")).toBeInTheDocument();
    expect(screen.getByTestId("settlement-row-settle-1")).toHaveTextContent(/150/);
  });

  it("shows new caution deposit button when canWrite is true", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Nouveau dépôt de caution"),
      ).toBeInTheDocument();
    });
  });

  it("hides new caution deposit button when canWrite is false", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("caution-deposits-panel")).toBeInTheDocument();
    });

    expect(
      screen.queryByLabelText("Nouveau dépôt de caution"),
    ).not.toBeInTheDocument();
  });

  it("opens and submits the create caution deposit form", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    const createSpy = vi
      .spyOn(api, "createPayment")
      .mockResolvedValue(MOCK_CAUTION_PAYMENTS[0]);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(
        screen.getByLabelText("Nouveau dépôt de caution"),
      ).toBeInTheDocument();
    });

    const toggleBtn = screen.getByLabelText("Nouveau dépôt de caution");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Nouveau dépôt de caution")).toBeInTheDocument();

    const amountInput = screen.getByLabelText("Montant (MGA)");
    fireEvent.change(amountInput, { target: { value: "500000" } });

    const submitBtn = screen.getByRole("button", {
      name: "Soumettre le dépôt",
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalled();
    });
  });

  it("shows retry and recovers on retry for settlements error", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    const settlementsSpy = vi
      .spyOn(api, "getDamageLossSettlements")
      .mockRejectedValueOnce(new Error("Settlements unavailable"))
      .mockResolvedValueOnce(MOCK_SETTLEMENTS);

    render(<CautionRefundPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Règlements" }));

    await waitFor(() => {
      expect(
        screen.getByText("Settlements unavailable"),
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", {
      name: "Réessayer le chargement",
    });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId("settlement-row-settle-1")).toBeInTheDocument();
    });

    expect(settlementsSpy).toHaveBeenCalledTimes(2);
  });
});
