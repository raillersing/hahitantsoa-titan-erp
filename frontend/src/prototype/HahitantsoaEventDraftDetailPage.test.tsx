import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HahitantsoaEventDraftDetailPage from "./HahitantsoaEventDraftDetailPage";
import type {
  Customer,
  DocumentInstance,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftConfirmationPreflight,
  Payment,
} from "../types";

const mockGetDraft = vi.fn();
const mockGetCustomer = vi.fn();
const mockGetPreflight = vi.fn();
const mockGetDocuments = vi.fn();
const mockGetPayments = vi.fn();
const mockGetAmendments = vi.fn();
const mockCreateAmendment = vi.fn();
const mockMarkContractSigned = vi.fn();
const mockMarkDepositReceived = vi.fn();
const mockRecordConfirmedDeposit = vi.fn();
const mockConfirmDraft = vi.fn();
const mockGetCloseoutSummary = vi.fn();
const mockCloseDraft = vi.fn();
const mockGetLifecycle = vi.fn();
const mockCreateDocumentInstance = vi.fn();
const mockGenerateDocumentInstance = vi.fn();
const mockGenerateDocumentInstancePdf = vi.fn();

vi.mock("../api", () => ({
  getHahitantsoaEventDraft: (...args: unknown[]) => mockGetDraft(...args),
  getCustomer: (...args: unknown[]) => mockGetCustomer(...args),
  getHahitantsoaEventDraftConfirmationPreflight: (...args: unknown[]) => mockGetPreflight(...args),
  getHahitantsoaEventDraftDocumentInstances: (...args: unknown[]) => mockGetDocuments(...args),
  getHahitantsoaEventDraftPayments: (...args: unknown[]) => mockGetPayments(...args),
  getHahitantsoaEventDraftAmendmentRequests: (...args: unknown[]) => mockGetAmendments(...args),
  createHahitantsoaEventDraftAmendmentRequest: (...args: unknown[]) => mockCreateAmendment(...args),
  markHahitantsoaEventDraftContractSigned: (...args: unknown[]) => mockMarkContractSigned(...args),
  markHahitantsoaEventDraftRequiredDepositReceived: (...args: unknown[]) => mockMarkDepositReceived(...args),
  recordConfirmedDeposit: (...args: unknown[]) => mockRecordConfirmedDeposit(...args),
  confirmHahitantsoaEventDraft: (...args: unknown[]) => mockConfirmDraft(...args),
  getHahitantsoaEventDraftCloseoutSummary: (...args: unknown[]) => mockGetCloseoutSummary(...args),
  closeHahitantsoaEventDraft: (...args: unknown[]) => mockCloseDraft(...args),
  getHahitantsoaEventDraftLifecycle: (...args: unknown[]) => mockGetLifecycle(...args),
  createHahitantsoaEventDraftDocumentInstance: (...args: unknown[]) => mockCreateDocumentInstance(...args),
  generateHahitantsoaEventDraftDocumentInstance: (...args: unknown[]) => mockGenerateDocumentInstance(...args),
  generateHahitantsoaEventDraftDocumentInstancePdf: (...args: unknown[]) => mockGenerateDocumentInstancePdf(...args),
}));

vi.mock("../PaymentWhatsAppReminderButton", () => ({ default: () => null }));
vi.mock("../DocumentArtifactPreviewPanel", () => ({
  default: ({ documentInstanceId }: { documentInstanceId?: string }) => (
    <div data-testid="artifact-preview">Preview for {documentInstanceId}</div>
  ),
}));

const DRAFT: HahitantsoaEventDraft = {
  id: "event-1",
  public_reference: "HAH-2026-0001",
  status: "draft",
  customer_id: "customer-1",
  customer_display_name: "Rakoto Andry",
  event_name: "Mariage Rakoto",
  event_type: "wedding",
  rental_type: "bare",
  guest_count: 250,
  space_rental_amount: "1500000.00",
  venue_name: "Grande Salle Hahitantsoa",
  location_details: "Accès parking nord",
  service_notes: "Service traiteur à partir de 12h",
  start_at: "2026-09-01T10:00:00Z",
  end_at: "2026-09-01T20:00:00Z",
  notes: "Décoration florale personnalisée",
  required_deposit_amount: "5000.00",
  payment_schedule: {
    space_rental_amount: "1500000.00",
    logistics_amount: "500000.00",
    total_amount: "2000000.00",
    deposit_amount: "5000.00",
    first_installment_amount: "1000000.00",
    first_installment_due_on: "2026-08-15",
    second_installment_amount: "995000.00",
    second_installment_due_on: "2026-08-25",
    remaining_after_deposit: "1995000.00",
  },
  lines: [
    {
      id: "line-1",
      inventory_item_id: "item-1",
      inventory_item_name: "Table Ronde 8 Personnes",
      inventory_item_kind: "material",
      quantity: 30,
      notes: "Disposition en étoile",
    },
    {
      id: "line-2",
      inventory_item_id: "item-2",
      inventory_item_name: "Pack Décoration V.I.P",
      inventory_item_kind: "material_pack",
      quantity: 1,
      notes: "Estrade mariés",
    },
  ],
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
};

const CUSTOMER: Customer = {
  id: "customer-1",
  display_name: "Rakoto Andry",
  phone: "+261 34 00 123 45",
  email: "andry.rakoto@example.mg",
  address: "Lot II M 45 Ambohijatovo, Antananarivo",
  representative_name: "Rakoto Events",
  notes: "Client VIP",
  is_active: true,
  is_deleted: false,
  deleted_at: null,
  created_by: null,
  updated_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function preflight(overrides: Partial<HahitantsoaEventDraftConfirmationPreflight> = {}): HahitantsoaEventDraftConfirmationPreflight {
  return {
    event_draft_id: DRAFT.id,
    public_reference: DRAFT.public_reference,
    status: "draft",
    can_confirm: false,
    blockers: ["missing_contract"],
    active_line_count: 2,
    unavailable_line_count: 0,
    prerequisite_status: {
      contract: { status: "missing", label: "Contrat à signer", truth_present: false, marker_present: false, source_id: null, recorded_at: null },
      deposit: { status: "missing", label: "Acompte à confirmer", truth_present: false, marker_present: false, source_id: null, recorded_at: null },
      ready_for_confirmation: false,
    },
    ...overrides,
  };
}

function closeoutSummary(overrides = {}) {
  return {
    event_draft_id: DRAFT.id,
    status: "confirmed",
    confirmed: true,
    billing_invoice_count: 0,
    open_invoice_count: 0,
    payment_count: 1,
    unreconciled_external_payment_count: 0,
    logistics_event_count: 0,
    incomplete_logistics_event_count: 0,
    return_count: 0,
    unresolved_return_count: 0,
    signature_exception_required: false,
    signature_exception_reason: "",
    closeout_id: null,
    closeout_status: "open" as const,
    closed_at: null,
    replayed: false,
    ...overrides,
  };
}

describe("HahitantsoaEventDraftDetailPage", () => {
  let currentDraft: HahitantsoaEventDraft;
  let currentPreflight: HahitantsoaEventDraftConfirmationPreflight;
  let currentPayments: Payment[];
  let currentDocuments: DocumentInstance[];

  beforeEach(() => {
    vi.resetAllMocks();
    currentDraft = { ...DRAFT };
    currentPreflight = preflight();
    currentPayments = [];
    currentDocuments = [
      { id: "doc-1", template_key: "hahitantsoa.contract.v1", status: "generated", template_label: "Contrat" } as unknown as DocumentInstance,
      { id: "doc-2", template_key: "hahitantsoa.proforma.v1", status: "issued", template_label: "Proforma" } as unknown as DocumentInstance,
      { id: "doc-3", template_key: "hahitantsoa.liability_release.v1", status: "generated", template_label: "Décharge" } as unknown as DocumentInstance,
    ];
    mockGetDraft.mockImplementation(() => Promise.resolve(currentDraft));
    mockGetCustomer.mockResolvedValue(CUSTOMER);
    mockGetPreflight.mockImplementation(() => Promise.resolve(currentPreflight));
    mockGetDocuments.mockImplementation(() => Promise.resolve(currentDocuments));
    mockGetPayments.mockImplementation(() => Promise.resolve(currentPayments));
    mockGetAmendments.mockResolvedValue([]);
    mockMarkDepositReceived.mockResolvedValue({});
    mockConfirmDraft.mockResolvedValue({});
    mockGetCloseoutSummary.mockImplementation(() => Promise.resolve(closeoutSummary()));
    mockCloseDraft.mockImplementation(() => {
      const closed = closeoutSummary({
        closeout_id: "closeout-1",
        closeout_status: "closed" as const,
        closed_at: "2026-09-02T10:00:00Z",
        replayed: false,
      });
      mockGetCloseoutSummary.mockImplementation(() => Promise.resolve(closed));
      return Promise.resolve(closed);
    });
    mockGetLifecycle.mockResolvedValue({
      domain: "hahitantsoa",
      dossier_id: DRAFT.id,
      public_reference: DRAFT.public_reference,
      status: "draft",
      next_action: "sign_contract",
      blockers: ["contract_signature_required"],
      owner_id: null,
      steps: [{ key: "contract", label: "Contrat signé", status: "pending", occurred_at: null }],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders customer card, venue info, and itemized lines table", async () => {
    const onNavigate = vi.fn();
    render(<HahitantsoaEventDraftDetailPage onNavigate={onNavigate} param={DRAFT.id} />);

    expect(await screen.findByText(DRAFT.public_reference)).toBeInTheDocument();
    expect(screen.getByText(DRAFT.event_name)).toBeInTheDocument();
    expect(screen.getAllByText("Grande Salle Hahitantsoa").length).toBeGreaterThan(0);
    expect(screen.getByText("+261 34 00 123 45")).toBeInTheDocument();
    expect(screen.getByText("Table Ronde 8 Personnes")).toBeInTheDocument();
    expect(screen.getByText("Pack Décoration V.I.P")).toBeInTheDocument();

    const customerBtn = screen.getByRole("button", { name: /voir fiche/i });
    fireEvent.click(customerBtn);
    expect(onNavigate).toHaveBeenCalledWith("customer", DRAFT.customer_id);
  });

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

    expect(await screen.findByText("Contrat officiel généré")).toBeInTheDocument();
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

  it("shows the persisted lifecycle and its recommended next action", async () => {
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    expect(await screen.findByRole("heading", { name: /parcours opérationnel/i })).toBeInTheDocument();
    expect(screen.getByText(/faire signer le contrat/i)).toBeInTheDocument();
    expect(screen.getAllByText(/signature du contrat requise/i)).not.toHaveLength(0);
    expect(mockGetLifecycle).toHaveBeenCalledWith(DRAFT.id);
  });

  it("keeps the dossier visible when the lifecycle read model is unavailable", async () => {
    mockGetLifecycle.mockRejectedValueOnce(new Error("Accès refusé"));
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    expect(await screen.findByText(/parcours opérationnel indisponible/i)).toBeInTheDocument();
    expect(screen.getByText(DRAFT.event_name)).toBeInTheDocument();
  });

  it("marks an already confirmed deposit instead of creating a duplicate payment", async () => {
    currentPayments = [{ payment_kind: "deposit", payment_status: "confirmed", amount: "5000.00" } as Payment];

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: /valider l'acompte déjà confirmé/i }));
    await waitFor(() => expect(mockMarkDepositReceived).toHaveBeenCalledWith(DRAFT.id));
    expect(mockRecordConfirmedDeposit).not.toHaveBeenCalled();
  });

  it("navigates across tabs and displays operational contents", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    currentPayments = [
      { id: "p-1", paid_at: "2026-08-05T10:00:00Z", created_at: "2026-08-05T10:00:00Z", payment_kind: "deposit", payment_method: "cash", amount: "5000.00", payment_status: "confirmed", notes: "Reçu #45" } as unknown as Payment,
    ];
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Documents tab (active by default)
    expect(await screen.findByText("Documents contractuels et officiels")).toBeInTheDocument();

    // Switch to Payments tab
    fireEvent.click(screen.getByRole("button", { name: /règlements & reçus/i }));
    expect(screen.getByText("Reçu #45")).toBeInTheDocument();

    // Switch to Logistics tab
    fireEvent.click(screen.getByRole("button", { name: /logistique & salle/i }));
    expect(screen.getByText(/coordination logistique/i)).toBeInTheDocument();

    // Switch to Closeout tab
    fireEvent.click(screen.getByRole("button", { name: /restitution & clôture r7/i }));
    expect(screen.getByText(/clôture opérationnelle du dossier/i)).toBeInTheDocument();
  });

  it("opens the document preview modal when clicking on aperçu", async () => {
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    const previewButtons = await screen.findAllByRole("button", { name: /aperçu/i });
    fireEvent.click(previewButtons[0]);

    expect(screen.getByTestId("artifact-preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /aperçu du document/i })).toBeInTheDocument();
  });

  it("closes a confirmed event through the backend and displays the persisted result", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Switch to closeout tab
    fireEvent.click(await screen.findByRole("button", { name: /restitution & clôture r7/i }));

    fireEvent.click(await screen.findByRole("button", { name: /clôturer le dossier/i }));
    await waitFor(() => expect(mockCloseDraft).toHaveBeenCalledWith(DRAFT.id, expect.any(String), ""));
    expect(await screen.findByText("Dossier Clôturé")).toBeInTheDocument();
  });

  it("requires a signature exception reason before requesting closeout", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    mockGetCloseoutSummary.mockImplementationOnce(() =>
      Promise.resolve(closeoutSummary({ signature_exception_required: true }))
    );

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: /restitution & clôture r7/i }));

    const closeBtn = await screen.findByRole("button", { name: /clôturer le dossier/i });
    fireEvent.click(closeBtn);
    expect(await screen.findByRole("alert")).toHaveTextContent("motif durable");
    expect(mockCloseDraft).not.toHaveBeenCalled();
  });
});
