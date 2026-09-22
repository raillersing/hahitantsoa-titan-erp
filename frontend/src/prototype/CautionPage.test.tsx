import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CautionPage from "./CautionPage";
import * as api from "../api";
import type { InventoryDamageLossSettlement, InventoryDamageLossSettlementExecution, InventoryReturnOperation } from "../types";

vi.mock("../api");

describe("CautionPage (F18 classification and execution visibility)", () => {
  const mockSettlements: InventoryDamageLossSettlement[] = [
    {
      id: "settlement-1",
      return_operation: "ret-1",
      settlement_status: "validated",
      damage_loss_total: 0,
      caution_available: 500000,
      caution_applied: 0,
      refund_due: 500000,
      excess_due: 0,
      document_instance: null,
      notes: "Conforming return",
      validated_at: "2026-03-01T10:00:00Z",
      validated_by: "user-1",
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:00:00Z",
      created_by: null,
      updated_by: null,
      lines: [],
    },
    {
      id: "settlement-2",
      return_operation: "ret-2",
      settlement_status: "validated",
      damage_loss_total: 100000,
      caution_available: 500000,
      caution_applied: 100000,
      refund_due: 400000,
      excess_due: 0,
      document_instance: null,
      notes: "Pending refund",
      validated_at: "2026-03-01T10:00:00Z",
      validated_by: "user-1",
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:00:00Z",
      created_by: null,
      updated_by: null,
      lines: [],
    },
    {
      id: "settlement-3",
      return_operation: "ret-3",
      settlement_status: "draft",
      damage_loss_total: 50000,
      caution_available: 500000,
      caution_applied: 50000,
      refund_due: 450000,
      excess_due: 0,
      document_instance: null,
      notes: "Draft settlement",
      validated_at: null,
      validated_by: null,
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-01T10:00:00Z",
      created_by: null,
      updated_by: null,
      lines: [],
    },
  ];

  const mockExecutions: InventoryDamageLossSettlementExecution[] = [
    {
      id: "exec-1",
      settlement: "settlement-1",
      status: "executed",
      executed_at: "2026-03-01T11:00:00Z",
      executed_by: "user-1",
      damage_loss_total_snapshot: 0,
      caution_available_snapshot: 500000,
      caution_applied_snapshot: 0,
      refund_due_snapshot: 500000,
      excess_due_snapshot: 0,
      notes: "",
      created_at: "2026-03-01T11:00:00Z",
      updated_at: "2026-03-01T11:00:00Z",
      created_by: null,
      updated_by: null,
      excess_receivable: null,
      refund_obligation: {
        id: "ro-1",
        amount: 500000,
        status: "settled",
        receipt_document_id: "doc-receipt-1",
      },
    },
    {
      id: "exec-2",
      settlement: "settlement-2",
      status: "executed",
      executed_at: "2026-03-01T11:00:00Z",
      executed_by: "user-1",
      damage_loss_total_snapshot: 100000,
      caution_available_snapshot: 500000,
      caution_applied_snapshot: 100000,
      refund_due_snapshot: 400000,
      excess_due_snapshot: 0,
      notes: "",
      created_at: "2026-03-01T11:00:00Z",
      updated_at: "2026-03-01T11:00:00Z",
      created_by: null,
      updated_by: null,
      excess_receivable: null,
      refund_obligation: {
        id: "ro-2",
        amount: 400000,
        status: "pending",
        receipt_document_id: null,
      },
    },
  ];

  const mockReturnOperations: InventoryReturnOperation[] = [
    {
      id: "ret-1",
      reservation_draft: "draft-1",
      hahitantsoa_event_draft: null,
      logistics_event: "log-1",
      document_instance: null,
      notes: "",
      status: "validated",
      validated_at: "2026-03-01T09:00:00Z",
      validated_by: "user-1",
      created_at: "2026-03-01T09:00:00Z",
      updated_at: "2026-03-01T09:00:00Z",
      created_by: null,
      updated_by: null,
      lines: [],
    },
    {
      id: "ret-2",
      reservation_draft: "draft-2",
      hahitantsoa_event_draft: null,
      logistics_event: "log-2",
      document_instance: null,
      notes: "",
      status: "validated",
      validated_at: "2026-03-01T09:00:00Z",
      validated_by: "user-1",
      created_at: "2026-03-01T09:00:00Z",
      updated_at: "2026-03-01T09:00:00Z",
      created_by: null,
      updated_by: null,
      lines: [],
    },
    {
      id: "ret-3",
      reservation_draft: "draft-3",
      hahitantsoa_event_draft: null,
      logistics_event: "log-3",
      document_instance: null,
      notes: "",
      status: "validated",
      validated_at: "2026-03-01T09:00:00Z",
      validated_by: "user-1",
      created_at: "2026-03-01T09:00:00Z",
      updated_at: "2026-03-01T09:00:00Z",
      created_by: null,
      updated_by: null,
      lines: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getDamageLossSettlements).mockResolvedValue(mockSettlements);
    vi.mocked(api.getReturnOperations).mockResolvedValue(mockReturnOperations);
    vi.mocked(api.getDamageLossSettlementExecutions).mockResolvedValue(mockExecutions);
  });

  it("accurately classifies settled caution refund as Clôturées instead of Restitution due", async () => {
    const onNavigate = vi.fn();
    render(<CautionPage onNavigate={onNavigate} />);

    await waitFor(() => {
      expect(screen.getByText("Dossier retour ret-1")).toBeInTheDocument();
    });

    // ret-1 has refund_obligation settled -> must be labeled "Clôturées"
    // ret-2 has refund_obligation pending -> must be labeled "Restitution due"
    // ret-3 has settlement_status draft -> must be labeled "À traiter"
    expect(screen.getByText("Restitution effectuée")).toBeInTheDocument();
    expect(screen.getByText("Restitution en attente")).toBeInTheDocument();
    expect(screen.getByText("Voir le reçu de restitution")).toBeInTheDocument();

    // Clicking "Clôturées" tab should only show settlement-1
    const clotureeTab = screen.getByRole("tab", { name: "Clôturées" });
    fireEvent.click(clotureeTab);

    expect(screen.getByText("Dossier retour ret-1")).toBeInTheDocument();
    expect(screen.queryByText("Dossier retour ret-2")).not.toBeInTheDocument();
    expect(screen.queryByText("Dossier retour ret-3")).not.toBeInTheDocument();

    // Clicking "Restitution due" tab should only show settlement-2
    const restitutionTab = screen.getByRole("tab", { name: "Restitution due" });
    fireEvent.click(restitutionTab);

    expect(screen.queryByText("Dossier retour ret-1")).not.toBeInTheDocument();
    expect(screen.getByText("Dossier retour ret-2")).toBeInTheDocument();
    expect(screen.queryByText("Dossier retour ret-3")).not.toBeInTheDocument();
  });
});
