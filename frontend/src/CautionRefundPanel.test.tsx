import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import CautionRefundPanel from "./CautionRefundPanel";
import * as api from "./api";
import type { InventoryDamageLossSettlement, Payment } from "./types";

const MOCK_CAUTION_PAYMENTS: Payment[] = [
  {
    id: "caution-1",
    reservation_draft: null,
    receipt_document: null,
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
    receipt_document: null,
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
    receipt_document: null,
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

    expect(screen.getByText("Caution Deposits & Refunds")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Caution Deposits" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settlements" })).toBeInTheDocument();
  });

  it("shows empty state when no caution deposits exist", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(screen.getByText("No caution deposits recorded.")).toBeInTheDocument();
    });
  });

  it("shows loading state for deposits initially", async () => {
    vi.spyOn(api, "getPayments").mockImplementation(
      () => new Promise(() => {}),
    );

    render(<CautionRefundPanel />);

    expect(screen.getByText("Loading caution deposits...")).toBeInTheDocument();
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
      screen.getByRole("button", { name: "Retry loading caution deposits" }),
    ).toBeInTheDocument();
  });

  it("switches to settlements tab and loads settlements", async () => {
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue(MOCK_SETTLEMENTS);

    render(<CautionRefundPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("caution-deposits-panel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Settlements" }));

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
        screen.getByLabelText("New caution deposit"),
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
      screen.queryByLabelText("New caution deposit"),
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
        screen.getByLabelText("New caution deposit"),
      ).toBeInTheDocument();
    });

    const toggleBtn = screen.getByLabelText("New caution deposit");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("New Caution Deposit")).toBeInTheDocument();

    const amountInput = screen.getByLabelText("Amount (MGA)");
    fireEvent.change(amountInput, { target: { value: "500000" } });

    const submitBtn = screen.getByRole("button", {
      name: "Submit caution deposit",
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

    fireEvent.click(screen.getByRole("tab", { name: "Settlements" }));

    await waitFor(() => {
      expect(
        screen.getByText("Settlements unavailable"),
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", {
      name: "Retry loading settlements",
    });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId("settlement-row-settle-1")).toBeInTheDocument();
    });

    expect(settlementsSpy).toHaveBeenCalledTimes(2);
  });
});
