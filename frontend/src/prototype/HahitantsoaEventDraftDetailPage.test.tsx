import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HahitantsoaEventDraftDetailPage from "./HahitantsoaEventDraftDetailPage";
import type {
  HahitantsoaEventDraft,
  HahitantsoaEventDraftConfirmationPreflight,
  Payment,
} from "../types";

const mockGetDraft = vi.fn();
const mockGetPreflight = vi.fn();
const mockGetDocuments = vi.fn();
const mockGetPayments = vi.fn();
const mockMarkContractSigned = vi.fn();
const mockMarkDepositReceived = vi.fn();
const mockRecordConfirmedDeposit = vi.fn();
const mockConfirmDraft = vi.fn();

vi.mock("../api", () => ({
  getHahitantsoaEventDraft: (...args: unknown[]) => mockGetDraft(...args),
  getHahitantsoaEventDraftConfirmationPreflight: (...args: unknown[]) => mockGetPreflight(...args),
  getHahitantsoaEventDraftDocumentInstances: (...args: unknown[]) => mockGetDocuments(...args),
  getHahitantsoaEventDraftPayments: (...args: unknown[]) => mockGetPayments(...args),
  markHahitantsoaEventDraftContractSigned: (...args: unknown[]) => mockMarkContractSigned(...args),
  markHahitantsoaEventDraftRequiredDepositReceived: (...args: unknown[]) => mockMarkDepositReceived(...args),
  recordConfirmedDeposit: (...args: unknown[]) => mockRecordConfirmedDeposit(...args),
  confirmHahitantsoaEventDraft: (...args: unknown[]) => mockConfirmDraft(...args),
}));

vi.mock("../PaymentWhatsAppReminderButton", () => ({ default: () => null }));

const DRAFT: HahitantsoaEventDraft = {
  id: "event-1",
  public_reference: "HAH-2026-0001",
  status: "draft",
  customer_id: "customer-1",
  customer_display_name: "Rakoto Andry",
  event_name: "Mariage Rakoto",
  venue_name: "Salle principale",
  location_details: "",
  service_notes: "",
  start_at: "2026-09-01T10:00:00Z",
  end_at: "2026-09-01T20:00:00Z",
  notes: "",
  required_deposit_amount: "5000.00",
  lines: [],
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
};

function preflight(overrides: Partial<HahitantsoaEventDraftConfirmationPreflight> = {}): HahitantsoaEventDraftConfirmationPreflight {
  return {
    event_draft_id: DRAFT.id,
    public_reference: DRAFT.public_reference,
    status: "draft",
    can_confirm: false,
    blockers: ["missing_contract"],
    active_line_count: 0,
    unavailable_line_count: 0,
    prerequisite_status: {
      contract: { status: "missing", label: "Contrat à signer", truth_present: false, marker_present: false, source_id: null, recorded_at: null },
      deposit: { status: "missing", label: "Acompte à confirmer", truth_present: false, marker_present: false, source_id: null, recorded_at: null },
      ready_for_confirmation: false,
    },
    ...overrides,
  };
}

describe("HahitantsoaEventDraftDetailPage", () => {
  let currentDraft: HahitantsoaEventDraft;
  let currentPreflight: HahitantsoaEventDraftConfirmationPreflight;
  let currentPayments: Payment[];

  beforeEach(() => {
    vi.resetAllMocks();
    currentDraft = { ...DRAFT };
    currentPreflight = preflight();
    currentPayments = [];
    mockGetDraft.mockImplementation(() => Promise.resolve(currentDraft));
    mockGetPreflight.mockImplementation(() => Promise.resolve(currentPreflight));
    mockGetDocuments.mockResolvedValue([{ template_key: "hahitantsoa.contract.v1", status: "generated" }]);
    mockGetPayments.mockImplementation(() => Promise.resolve(currentPayments));
    mockMarkDepositReceived.mockResolvedValue({});
    mockConfirmDraft.mockResolvedValue({});
  });

  afterEach(() => vi.restoreAllMocks());

  it("signs the contract, records a deposit atomically, and reuses the key after a failed response", async () => {
    mockMarkContractSigned.mockImplementation(() => {
      currentPreflight = preflight({
        blockers: ["missing_required_deposit"],
        prerequisite_status: {
          ...preflight().prerequisite_status,
          contract: { status: "satisfied", label: "Contrat signé", truth_present: true, marker_present: true, source_id: "contract-1", recorded_at: "2026-08-01T10:00:00Z" },
        },
      });
      return Promise.resolve({});
    });
    mockRecordConfirmedDeposit
      .mockRejectedValueOnce(new Error("Réseau interrompu"))
      .mockImplementationOnce(() => {
        currentDraft = { ...currentDraft, status: "confirmed" };
        currentPreflight = preflight({
          status: "confirmed",
          can_confirm: false,
          blockers: [],
          prerequisite_status: {
            contract: { status: "satisfied", label: "Contrat signé", truth_present: true, marker_present: true, source_id: "contract-1", recorded_at: "2026-08-01T10:00:00Z" },
            deposit: { status: "satisfied", label: "Acompte confirmé", truth_present: true, marker_present: true, source_id: "payment-1", recorded_at: "2026-08-01T10:10:00Z" },
            ready_for_confirmation: true,
          },
        });
        return Promise.resolve({ payment: { id: "payment-1" }, replayed: true });
      });

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    expect(await screen.findByText("✓ Contrat généré")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /marquer le contrat signé/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /enregistrer et confirmer l'acompte/i })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/montant de l'acompte/i), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: /enregistrer et confirmer l'acompte/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Réseau interrompu");

    fireEvent.click(screen.getByRole("button", { name: /enregistrer et confirmer l'acompte/i }));
    await waitFor(() => expect(screen.getByText("Confirmée")).toBeInTheDocument());

    expect(mockMarkContractSigned).toHaveBeenCalledWith(DRAFT.id);
    expect(mockRecordConfirmedDeposit).toHaveBeenCalledTimes(2);
    expect(mockRecordConfirmedDeposit.mock.calls[0][0]).toEqual(expect.objectContaining({
      hahitantsoa_event_draft: DRAFT.id,
      amount: "5000.00",
    }));
    expect(mockRecordConfirmedDeposit.mock.calls[1][0].idempotency_key).toBe(mockRecordConfirmedDeposit.mock.calls[0][0].idempotency_key);
  });

  it("exposes the final confirmation action only when the backend preflight authorizes it", async () => {
    currentPreflight = preflight({
      can_confirm: true,
      blockers: [],
      prerequisite_status: {
        contract: { status: "satisfied", label: "Contrat signé", truth_present: true, marker_present: true, source_id: "contract-1", recorded_at: "2026-08-01T10:00:00Z" },
        deposit: { status: "satisfied", label: "Acompte confirmé", truth_present: true, marker_present: true, source_id: "payment-1", recorded_at: "2026-08-01T10:10:00Z" },
        ready_for_confirmation: true,
      },
    });

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: /confirmer la réservation/i }));
    await waitFor(() => expect(mockConfirmDraft).toHaveBeenCalledWith(DRAFT.id));
  });

  it("marks an already confirmed deposit instead of creating a duplicate payment", async () => {
    currentPayments = [{ payment_kind: "deposit", payment_status: "confirmed", amount: "5000.00" } as Payment];

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: /valider l'acompte déjà confirmé/i }));
    await waitFor(() => expect(mockMarkDepositReceived).toHaveBeenCalledWith(DRAFT.id));
    expect(mockRecordConfirmedDeposit).not.toHaveBeenCalled();
  });
});
