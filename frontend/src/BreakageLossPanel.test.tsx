import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import BreakageLossPanel from "./BreakageLossPanel";
import type { InventoryDamageLossSettlement } from "./types";

const MOCK_SETTLEMENT: InventoryDamageLossSettlement = {
  id: "stl-1",
  return_operation: "ret-1111",
  document_instance: null,
  settlement_status: "draft",
  damage_loss_total: 150000,
  caution_available: 200000,
  caution_applied: 150000,
  refund_due: 50000,
  excess_due: 0,
  notes: "",
  validated_at: null,
  validated_by: null,
  lines: [
    {
      id: "line-1",
      return_operation_line: null,
      manual_label: "Broken speaker",
      settlement_line_kind: "damage",
      quantity: 2,
      unit_amount: 75000,
      amount_source: "manual",
      total_amount: 150000,
      notes: "",
      created_at: "",
      updated_at: "",
      created_by: null,
      updated_by: null,
    },
  ],
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
};

describe("BreakageLossPanel", () => {
  beforeEach(() => {
    vi.spyOn(api, "checkDamageLossWritePermission").mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(api, "getDamageLossSettlements").mockReturnValue(new Promise(() => undefined));
    render(<BreakageLossPanel />);
    expect(screen.getByText("Chargement de l'évaluation des dommages...")).toBeInTheDocument();
  });

  it("renders list and detail", async () => {
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([MOCK_SETTLEMENT]);
    render(<BreakageLossPanel />);
    expect(await screen.findByText("Détail du règlement")).toBeInTheDocument();
    expect(screen.getAllByText("150 000,00 MGA").length).toBeGreaterThan(0);
    expect(screen.getByText("Broken speaker")).toBeInTheDocument();
  });

  it("shows error state and retry button", async () => {
    const spy = vi.spyOn(api, "getDamageLossSettlements");
    spy.mockRejectedValue(new Error("Network error"));
    render(<BreakageLossPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
    spy.mockResolvedValue([MOCK_SETTLEMENT]);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer le chargement des règlements" }));
    expect(await screen.findByText("Détail du règlement")).toBeInTheDocument();
  });

  it("shows read-only badge when write permission is absent", async () => {
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([MOCK_SETTLEMENT]);
    render(<BreakageLossPanel />);
    expect(await screen.findByTestId("breakage-write-denied")).toBeInTheDocument();
  });

  it("validates settlement when write permission is granted", async () => {
    vi.spyOn(api, "checkDamageLossWritePermission").mockResolvedValue(true);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([MOCK_SETTLEMENT]);
    const validateSpy = vi.spyOn(api, "validateDamageLossSettlement").mockResolvedValue({
      ...MOCK_SETTLEMENT,
      settlement_status: "validated",
      validated_at: "2026-06-20T10:00:00Z",
    });
    render(<BreakageLossPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Valider le règlement" }));
    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith("stl-1");
    });
    expect((await screen.findAllByText("Validé")).length).toBeGreaterThan(0);
  });
});
