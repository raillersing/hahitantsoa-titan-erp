import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HahitantsoaEventDraftDetailPage, { parseHahitantsoaServiceNotes } from "./HahitantsoaEventDraftDetailPage";
import type {
  Customer,
  DocumentInstance,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftConfirmationPreflight,
  Payment,
} from "../types";

const mockGetDraft = vi.fn();
const mockGetDrafts = vi.fn();
const mockUpdateDraft = vi.fn();
const mockGetCustomer = vi.fn();
const mockGetPreflight = vi.fn();
const mockGetDocuments = vi.fn();
const mockGetPayments = vi.fn();
const mockGetAmendments = vi.fn();
const mockCreateAmendment = vi.fn();
const mockCreateAmendmentLine = vi.fn();
const mockApplyAmendment = vi.fn();
const mockGetInventoryItems = vi.fn();
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
const mockGetVenues = vi.fn();
const mockGetServices = vi.fn();
const mockGetCommercialTerms = vi.fn();
const mockGetPackages = vi.fn();
const mockUpdateHahitantsoaEventDraftPublicReference = vi.fn();

vi.mock("../api", () => ({
  getHahitantsoaEventDraft: (...args: unknown[]) => mockGetDraft(...args),
  getHahitantsoaEventDrafts: (...args: unknown[]) => mockGetDrafts(...args) ?? Promise.resolve([]),
  updateHahitantsoaEventDraft: (...args: unknown[]) => mockUpdateDraft(...args) ?? Promise.resolve({}),
  updateHahitantsoaEventDraftPublicReference: (...args: unknown[]) => mockUpdateHahitantsoaEventDraftPublicReference(...args),
  getCustomer: (...args: unknown[]) => mockGetCustomer(...args),
  getHahitantsoaEventDraftConfirmationPreflight: (...args: unknown[]) => mockGetPreflight(...args),
  getHahitantsoaEventDraftDocumentInstances: (...args: unknown[]) => mockGetDocuments(...args),
  getHahitantsoaEventDraftPayments: (...args: unknown[]) => mockGetPayments(...args),
  getHahitantsoaEventDraftAmendmentRequests: (...args: unknown[]) => mockGetAmendments(...args),
  createHahitantsoaEventDraftAmendmentRequest: (...args: unknown[]) => mockCreateAmendment(...args),
  createHahitantsoaEventDraftAmendmentRequestLine: (...args: unknown[]) => mockCreateAmendmentLine(...args),
  applyHahitantsoaEventDraftAmendmentRequest: (...args: unknown[]) => mockApplyAmendment(...args),
  getInventoryItems: (...args: unknown[]) => mockGetInventoryItems(...args) ?? Promise.resolve([]),
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
  getHahitantsoaVenues: (...args: unknown[]) => mockGetVenues(...args) ?? Promise.resolve([]),
  getHahitantsoaServices: (...args: unknown[]) => mockGetServices(...args) ?? Promise.resolve([]),
  getHahitantsoaCommercialTerms: (...args: unknown[]) => mockGetCommercialTerms(...args) ?? Promise.resolve(null),
  getMaterialPackages: (...args: unknown[]) => mockGetPackages(...args) ?? Promise.resolve([]),
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
  duration_option: "day",
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
      notes: "Pack complet comprenant housses et nœuds",
    },
  ],
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
};

const CUSTOMER: Customer = {
  id: "customer-1",
  display_name: "Rakoto Andry",
  lifecycle_status: "client",
  party_type: "individual",
  address: "Lot II M 34 Antananarivo",
  phone: "+261 34 00 123 45",
  email: "andry@example.mg",
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
    mockGetDrafts.mockImplementation(() => Promise.resolve([]));
    mockGetCustomer.mockResolvedValue(CUSTOMER);
    mockGetPreflight.mockImplementation(() => Promise.resolve(currentPreflight));
    mockGetDocuments.mockImplementation(() => Promise.resolve(currentDocuments));
    mockGetPayments.mockImplementation(() => Promise.resolve(currentPayments));
    mockGetAmendments.mockResolvedValue([]);
    mockUpdateDraft.mockResolvedValue({ ...DRAFT });
    mockCreateDocumentInstance.mockResolvedValue({ id: "doc-gen-1", template_key: "hahitantsoa.contract.v1" });
    mockGenerateDocumentInstance.mockResolvedValue({ id: "doc-gen-1" });
    mockGenerateDocumentInstancePdf.mockResolvedValue({ id: "doc-gen-1" });
    mockGetCommercialTerms.mockResolvedValue({
      base_space_rental_amount: "1500000.00",
      included_guest_count: 250,
      excess_guest_amount: "5000.00",
      bare_deposit_amount: "1000000.00",
      logistics_deposit_amount: "1500000.00",
      night_option_1_amount: "300000.00",
      night_option_2_amount: "500000.00",
      night_security_amount: "120000.00",
      caution_amount: "1000000.00",
      updated_at: "2026-08-01T00:00:00Z",
    });
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

    expect(await screen.findByText("Contrat Officiel")).toBeInTheDocument();
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

    const confirmBtns = await screen.findAllByRole("button", { name: /confirmer la réservation/i });
    expect(confirmBtns.length).toBeGreaterThan(0);
    fireEvent.click(confirmBtns[0]);
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

  it("displays conflict notification banner with direct action buttons when draft is in conflict", async () => {
    const conflictingEvent: HahitantsoaEventDraft = {
      ...DRAFT,
      id: "event-conf-2",
      public_reference: "HAH-2026-0002",
      status: "confirmed",
      event_name: "Gala d'Entreprise",
      customer_display_name: "Société ABC",
      start_at: "2026-09-01T08:00:00Z",
      end_at: "2026-09-01T22:00:00Z",
      venue_name: "Grande Salle Hahitantsoa",
    };

    mockGetDrafts.mockResolvedValueOnce([DRAFT, conflictingEvent]);

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    expect(await screen.findByText(/Conflit de disponibilité bloquant/i)).toBeInTheDocument();
    expect(screen.getByText(/Créneau déjà réservé et confirmé/i)).toBeInTheDocument();
    expect(screen.getByText(/HAH-2026-0002/i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Relocaliser \/ Reporter la date/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mettre en attente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Supprimer le devis/i })).toBeInTheDocument();

    // Click reschedule button to trigger modal
    fireEvent.click(screen.getByRole("button", { name: /Relocaliser \/ Reporter la date/i }));
    expect(await screen.findByText(/Arbitrage & Relocalisation/i)).toBeInTheDocument();
  });

  it("displays competing drafts info banner when current event is confirmed and drafts exist on same venue/date", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };

    const competingDraft: HahitantsoaEventDraft = {
      ...DRAFT,
      id: "draft-comp-3",
      public_reference: "HAH-2026-0003",
      status: "draft",
      event_name: "Fête Familiale",
      customer_display_name: "Famille Dupont",
      start_at: "2026-09-01T10:00:00Z",
      end_at: "2026-09-01T18:00:00Z",
      venue_name: "Grande Salle Hahitantsoa",
    };

    mockGetDrafts.mockResolvedValueOnce([currentDraft, competingDraft]);

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    expect(await screen.findByText(/Devis concurrent\(s\) non confirmés/i)).toBeInTheDocument();
    expect(screen.getByText(/HAH-2026-0003 — Fête Familiale/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Arbitrer \/ Relocaliser/i })).toBeInTheDocument();
  });

  it("generates a new document instance when clicking on generate button", async () => {
    currentDocuments = [];
    mockGenerateDocumentInstance.mockResolvedValue({ id: "doc-gen-1" });
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    const genBtn = await screen.findByRole("button", { name: /générer le contrat officiel/i });
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(mockCreateDocumentInstance).toHaveBeenCalledWith(DRAFT.id, { template_key: "hahitantsoa.contract.v1" });
      expect(mockGenerateDocumentInstance).toHaveBeenCalledWith(DRAFT.id, "doc-gen-1");
    });
  });

  it("marks contract as signed when clicking the button", async () => {
    currentDocuments = [
      { id: "doc-1", template_key: "hahitantsoa.contract.v1", status: "generated", template_label: "Contrat" } as unknown as DocumentInstance,
    ];
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    const signBtn = await screen.findByRole("button", { name: /marquer le contrat signé/i });
    fireEvent.click(signBtn);

    await waitFor(() => {
      expect(mockMarkContractSigned).toHaveBeenCalledWith(DRAFT.id);
    });
  });

  it("switches tabs correctly across the multi-view interface", async () => {
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Switch to Prep tab
    fireEvent.click(await screen.findByRole("button", { name: /^Préparation$/i }));
    expect(screen.getAllByText(/fiche de préparation/i).length).toBeGreaterThan(0);

    // Switch to Sortie tab
    fireEvent.click(screen.getByRole("button", { name: /Sortie \/ Livraison/i }));
    expect(screen.getAllByText(/bon de livraison/i).length).toBeGreaterThan(0);

    // Switch to Retour tab
    fireEvent.click(screen.getByRole("button", { name: /Retour \/ Restitution/i }));
    expect(screen.getAllByText(/bon de retour/i).length).toBeGreaterThan(0);

    // Switch to Casse tab
    fireEvent.click(screen.getByRole("button", { name: /Casse & Pertes/i }));
    expect(screen.getAllByText(/grille tarifaire/i).length).toBeGreaterThan(0);

    // Switch to Caution & Solde tab
    fireEvent.click(screen.getByRole("button", { name: /Caution & Solde/i }));
    expect(screen.getAllByText(/clôture opérationnelle/i).length).toBeGreaterThan(0);

    // Switch to Avenants tab
    fireEvent.click(screen.getByRole("button", { name: /^Avenants$/i }));
    expect(screen.getAllByText(/demandes d'avenant/i).length).toBeGreaterThan(0);
  });

  it("opens the document preview modal when clicking on aperçu", async () => {
    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    const previewButtons = await screen.findAllByRole("button", { name: /aperçu/i });
    fireEvent.click(previewButtons[0]);

    expect(screen.getByTestId("artifact-preview")).toBeInTheDocument();
  });

  it("closes a confirmed event through the backend and displays the persisted result", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Switch to closeout tab (caution & solde)
    fireEvent.click(await screen.findByRole("button", { name: /caution & solde/i }));

    fireEvent.click(await screen.findByRole("button", { name: /clôturer le dossier/i }));
    await waitFor(() => expect(mockCloseDraft).toHaveBeenCalledWith(DRAFT.id, expect.any(String), ""));
    expect(await screen.findByText("Dossier Clôturé")).toBeInTheDocument();
  });

  it("requires a signature exception reason before requesting closeout", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    mockGetCloseoutSummary.mockImplementation(() =>
      Promise.resolve(closeoutSummary({ signature_exception_required: true }))
    );

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: /caution & solde/i }));

    const closeBtn = await screen.findByRole("button", { name: /clôturer le dossier/i });
    fireEvent.click(closeBtn);
    expect(await screen.findByRole("alert")).toHaveTextContent("motif durable");
    expect(mockCloseDraft).not.toHaveBeenCalled();
  });

  it("opens the 5-step studio d'avenant, navigates wizard, selects night option 1, and submits", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    mockCreateAmendment.mockResolvedValue({
      amendment_request: { id: "amend-1", status: "draft" },
    });
    mockApplyAmendment.mockResolvedValue({
      amendment_request: { id: "amend-1", status: "applied" },
    });
    mockGetInventoryItems.mockResolvedValue([
      { id: "item-3", name: "Projecteur LED RGB", kind: "material", rental_price: "25000" },
    ]);

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Click on amendment button
    const amendBtn = await screen.findByRole("button", { name: /demander un avenant/i });
    fireEvent.click(amendBtn);

    // Studio modal is opened on Step 1
    expect(screen.getByText("Studio d'Avenant Événementiel")).toBeInTheDocument();
    expect(screen.getByText("1. Motif & Traçabilité")).toBeInTheDocument();

    const reasonInput = screen.getByPlaceholderText(/Ex: Rajout de 50 convives/i);
    fireEvent.change(reasonInput, { target: { value: "Avenant soirée nocturne et sono" } });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 2: Formule & Local
    expect(screen.getByText("2. Formule & Local")).toBeInTheDocument();
    const nightOpt1Card = screen.getByText(/Nuit Option 1/i);
    fireEvent.click(nightOpt1Card);

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 3: Prestations & Services
    expect(screen.getByText("3. Prestations & Services")).toBeInTheDocument();

    // Step 3 -> Step 4
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 4: Articles
    expect(screen.getByText("4. Matériel & Articles")).toBeInTheDocument();

    // Step 4 -> Step 5
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 5: Bilan Comparatif Financier
    expect(screen.getByText("5. Bilan & Validation")).toBeInTheDocument();
    expect(screen.getByText(/Bilan Comparatif Financier de l'Avenant/i)).toBeInTheDocument();

    // Submit
    const submitBtn = screen.getByRole("button", { name: /valider et créer l'avenant/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateAmendment).toHaveBeenCalledWith(
        DRAFT.id,
        expect.objectContaining({
          reason: "Avenant soirée nocturne et sono",
          changed_event_type: "wedding",
          changed_duration_option: "night_1",
        }),
      );
      expect(mockCreateAmendment.mock.calls[0][1]).not.toHaveProperty("changed_guest_count");
      expect(mockApplyAmendment).toHaveBeenCalledWith(DRAFT.id, "amend-1");
    });
  });

  it("keeps a non-applied amendment pending without regenerating documents or changing the dossier", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    mockCreateAmendment.mockResolvedValue({
      amendment_request: { id: "amend-pending", status: "draft" },
    });

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: /demander un avenant/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Rajout de 50 convives/i), {
      target: { value: "Demande à valider" },
    });
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByLabelText(/appliquer directement l'avenant/i));
    fireEvent.click(screen.getByRole("button", { name: /valider et créer l'avenant/i }));

    expect(await screen.findByText(/en attente d'application/i)).toBeInTheDocument();
    expect(mockApplyAmendment).not.toHaveBeenCalled();
    expect(mockCreateDocumentInstance).not.toHaveBeenCalled();
    expect(mockUpdateDraft).not.toHaveBeenCalled();
    expect(mockGetDraft).toHaveBeenCalledTimes(2);
  });

  it("reports document regeneration failure without presenting the applied amendment as failed", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    mockCreateAmendment.mockResolvedValue({
      amendment_request: { id: "amend-applied", status: "draft" },
    });
    mockApplyAmendment.mockResolvedValue({
      amendment_request: { id: "amend-applied", status: "applied" },
    });
    mockCreateDocumentInstance.mockRejectedValueOnce(new Error("PDF indisponible"));

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    fireEvent.click(await screen.findByRole("button", { name: /demander un avenant/i }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Rajout de 50 convives/i), {
      target: { value: "Modification appliquée" },
    });
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /valider et créer l'avenant/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /avenant a bien été appliqué, mais le proforma n'a pas pu être régénéré/i,
    );
    expect(mockApplyAmendment).toHaveBeenCalledWith(DRAFT.id, "amend-applied");
    expect(screen.queryByText(/Impossible de valider et créer l'avenant/i)).not.toBeInTheDocument();
  });

  it("calculates real-time financial KPIs accurately even when payment_schedule is absent", async () => {
    // Draft with space_rental_amount and lines without payment_schedule
    currentDraft = {
      ...DRAFT,
      space_rental_amount: "1000000.00",
      payment_schedule: null as any,
    };
    currentPayments = [
      { id: "pay-1", payment_kind: "deposit", payment_status: "confirmed", amount: "500000.00", created_at: "2026-08-01T10:00:00Z" } as any,
    ];

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Total should be calculated (1 000 000 space)
    expect(await screen.findByText("Synthèse Financière & Échéancier")).toBeInTheDocument();
    expect(screen.getByText(/Total Devis/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Perçu Loyers/i)).toBeInTheDocument();
    expect(screen.getAllByText(/500 000 Ar/).length).toBeGreaterThan(0);
  });

  it("correctly parses formatted services and free-text notes with parseHahitantsoaServiceNotes", () => {
    const rawNotes = `Piste de Danse Lumineuse LED 5x5m (x1) - 450000 Ar\nCiels Étoilés LED (x2) - 600000 Ar\nNotes particulières: disposition spéciale`;
    const mockServices = [
      { id: "srv-led", name: "Piste de Danse Lumineuse LED 5x5m", price: "450000", category: "scenography" },
      { id: "srv-sky", name: "Ciels Étoilés LED", price: "300000", category: "starry_sky" },
    ] as any;

    const result = parseHahitantsoaServiceNotes(rawNotes, mockServices);
    expect(result.selectedServices).toHaveLength(2);
    expect(result.selectedServices[0]).toEqual(
      expect.objectContaining({
        name: "Piste de Danse Lumineuse LED 5x5m",
        quantity: 1,
        price: 450000,
      }),
    );
    expect(result.selectedServices[1]).toEqual(
      expect.objectContaining({
        name: "Ciels Étoilés LED",
        quantity: 2,
        price: 300000,
      }),
    );
    expect(result.remainingNotes).toContain("Notes particulières: disposition spéciale");
  });

  it("preserves the guest count while supporting custom services and item quantities in amendment studio", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    mockCreateAmendment.mockResolvedValue({
      amendment_request: { id: "amend-308", status: "applied", amendment_sequence: 2 },
    });
    mockApplyAmendment.mockResolvedValue({
      amendment_request: { id: "amend-308", status: "applied" },
    });
    mockGetInventoryItems.mockResolvedValue([
      { id: "item-napoleon", name: "Chaise Napoléon Blanche", kind: "material", rental_price: "4500", section: "furniture" },
    ]);

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Click on amendment button
    const amendBtn = await screen.findByRole("button", { name: /demander un avenant/i });
    fireEvent.click(amendBtn);

    // Step 1: Motif
    const reasonInput = screen.getByPlaceholderText(/Ex: Rajout de 50 convives/i);
    fireEvent.change(reasonInput, { target: { value: "Avenant N°2: 308 convives et gazon synthétique" } });
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 2: guest count is preserved and the rental type remains modifiable.
    expect(screen.getByText("2. Formule & Local")).toBeInTheDocument();
    expect(screen.getByDisplayValue("250")).toHaveAttribute("readonly");

    const logisticsRadio = screen.getByLabelText("Location + logistique");
    fireEvent.click(logisticsRadio);

    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 3: Add custom service "Sol en gazon synthétique"
    expect(screen.getByText("3. Prestations & Services")).toBeInTheDocument();
    const customSrvBtn = screen.getByRole("button", { name: /\+ prestation sur-mesure/i });
    fireEvent.click(customSrvBtn);

    const customNameInput = screen.getByPlaceholderText(/Ex: Sol en gazon/i);
    fireEvent.change(customNameInput, { target: { value: "Sol en gazon synthétique" } });

    const addCustomBtn = screen.getByRole("button", { name: /ajouter cette prestation/i });
    fireEvent.click(addCustomBtn);

    expect(screen.getAllByText("Sol en gazon synthétique").length).toBeGreaterThan(0);
    expect(screen.getByText("Sur-mesure")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 4: Add and set quantities to 308
    expect(screen.getByText("4. Matériel & Articles")).toBeInTheDocument();

    // Add Chaise Napoléon Blanche from catalog
    const addChaiseBtn = await screen.findByRole("button", { name: /\+ ajouter/i });
    fireEvent.click(addChaiseBtn);

    // Change added line quantity to 308
    const addedQtyInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(addedQtyInputs[addedQtyInputs.length - 1], { target: { value: "308" } });

    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 5: Bilan Financier
    expect(screen.getByText("5. Bilan & Validation")).toBeInTheDocument();
    expect(screen.getByText(/Bilan Comparatif Financier de l'Avenant/i)).toBeInTheDocument();

    // Submit
    const submitBtn = screen.getByRole("button", { name: /valider et créer l'avenant/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateAmendment).toHaveBeenCalledWith(
        DRAFT.id,
        expect.objectContaining({
          reason: "Avenant N°2: 308 convives et gazon synthétique",
          changed_rental_type: "logistics",
          changed_service_notes: expect.stringContaining("Sol en gazon synthétique"),
        }),
      );
      expect(mockCreateAmendment.mock.calls[0][1]).not.toHaveProperty("changed_guest_count");
      expect(mockCreateAmendmentLine).toHaveBeenCalledWith(
        DRAFT.id,
        "amend-308",
        expect.objectContaining({
          inventory_item_id: "item-napoleon",
          quantity: 308,
        }),
      );
      expect(mockApplyAmendment).toHaveBeenCalledWith(DRAFT.id, "amend-308");
    });
  });

  it("renders sequential multiple amendments in Avenants tab with their sequence numbers and details", async () => {
    mockGetAmendments.mockResolvedValue([
      {
        id: "amend-1",
        event_draft_id: DRAFT.id,
        status: "applied",
        amendment_sequence: 1,
        reason: "Ajustement horaires",
        notes: "Formule nuit jusqu'à 03h30",
        changed_guest_count: 250,
        changed_space_rental_amount: "7120000.00",
        lines: [],
        created_at: "2026-08-05T14:00:00Z",
      },
      {
        id: "amend-2",
        event_draft_id: DRAFT.id,
        status: "applied",
        amendment_sequence: 2,
        reason: "Rajout 58 convives et sol gazon",
        notes: "Total 308 invités",
        changed_guest_count: 308,
        changed_space_rental_amount: "7410000.00",
        lines: [{ id: "l-1", inventory_item_id: "item-napoleon", quantity: 308 }],
        created_at: "2026-08-10T11:00:00Z",
      },
    ]);

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    // Switch to Avenants tab
    const avenantsTabBtn = await screen.findByRole("button", { name: /^Avenants/i });
    fireEvent.click(avenantsTabBtn);

    expect(await screen.findByText(/Avenant N°1 — Ajustement horaires/i)).toBeInTheDocument();
    expect(screen.getByText(/Avenant N°2 — Rajout 58 convives et sol gazon/i)).toBeInTheDocument();
    expect(screen.getAllByText(/308 invités/i).length).toBeGreaterThan(0);
  });
  it("updates unconfirmed draft directly and regenerates proforma document", async () => {
    currentDraft = { ...DRAFT, status: "draft" };
    mockCreateAmendment.mockRejectedValue(new Error("Hahitantsoa event draft amendment request preflight failed: draft_not_confirmed_for_amendment"));
    mockUpdateDraft.mockResolvedValue({ ...DRAFT, guest_count: 280 });
    mockCreateDocumentInstance.mockResolvedValue({ id: "doc-prof-2", template_key: "hahitantsoa.proforma.v1" });
    mockGenerateDocumentInstance.mockResolvedValue({});
    mockGenerateDocumentInstancePdf.mockResolvedValue({});

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    const amendBtn = await screen.findByRole("button", { name: /demander un avenant/i });
    fireEvent.click(amendBtn);

    const reasonInput = screen.getByPlaceholderText(/Ex: Rajout de 50 convives/i);
    fireEvent.change(reasonInput, { target: { value: "Modification préalable convives" } });
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    // Step 2 -> Step 3 -> Step 4 -> Step 5
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    const submitBtn = screen.getByRole("button", { name: /valider et créer l'avenant/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockUpdateDraft).toHaveBeenCalledWith(
        DRAFT.id,
        expect.objectContaining({
          duration_option: "day",
          venue_name: "Grande Salle Hahitantsoa",
        }),
      );
      expect(mockUpdateDraft.mock.calls[0][1]).not.toHaveProperty("guest_count");
      expect(mockCreateDocumentInstance).toHaveBeenCalledWith(
        DRAFT.id,
        expect.objectContaining({ template_key: "hahitantsoa.proforma.v1" }),
      );
    });
  });

  it("displays error message inside the modal when an amendment error occurs", async () => {
    currentDraft = { ...DRAFT, status: "confirmed" };
    mockCreateAmendment.mockRejectedValue(new Error("Erreur de validation de date"));
    mockUpdateDraft.mockRejectedValue(new Error("Erreur de validation de date"));

    render(<HahitantsoaEventDraftDetailPage onNavigate={vi.fn()} param={DRAFT.id} />);

    const amendBtn = await screen.findByRole("button", { name: /demander un avenant/i });
    fireEvent.click(amendBtn);

    const reasonInput = screen.getByPlaceholderText(/Ex: Rajout de 50 convives/i);
    fireEvent.change(reasonInput, { target: { value: "Avenant erroné" } });
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));
    fireEvent.click(screen.getByRole("button", { name: /suivant →/i }));

    const submitBtn = screen.getByRole("button", { name: /valider et créer l'avenant/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Erreur de validation de date/i).length).toBeGreaterThan(0);
    });
  });

  it("renders the unconfirmed highlight banner and dedicated caution escrow card on draft reservations", async () => {
    mockGetDraft.mockResolvedValue(DRAFT);
    mockGetCustomer.mockResolvedValue(CUSTOMER);
    mockGetDocuments.mockResolvedValue([]);
    mockGetPayments.mockResolvedValue([]);
    mockGetPreflight.mockResolvedValue(preflight());
    mockGetLifecycle.mockResolvedValue(null);

    render(<HahitantsoaEventDraftDetailPage param="event-1" onNavigate={vi.fn()} />);

    expect(await screen.findByText("HAH-2026-0001")).toBeInTheDocument();

    // Check unconfirmed highlight banner
    const banner = screen.getByTestId("unconfirmed-highlight-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Réservation non confirmée");
    expect(banner).toHaveTextContent("En attente de l'acompte obligatoire de confirmation");

    // Check caution escrow card
    const cautionCard = screen.getByTestId("caution-escrow-card");
    expect(cautionCard).toBeInTheDocument();
    expect(cautionCard).toHaveTextContent("Dépôt de Garantie (Caution)");
    expect(cautionCard).toHaveTextContent("500 000 Ar");
  });

  it("permet de modifier la référence du dossier Hahitantsoa via la modale", async () => {
    mockGetDraft.mockResolvedValue(DRAFT);
    mockGetCustomer.mockResolvedValue(CUSTOMER);
    mockGetDocuments.mockResolvedValue([]);
    mockGetPayments.mockResolvedValue([]);
    mockGetPreflight.mockResolvedValue(preflight());
    mockGetLifecycle.mockResolvedValue(null);
    mockUpdateHahitantsoaEventDraftPublicReference.mockResolvedValue({
      ...DRAFT,
      public_reference: "H-500/2026",
    });

    render(<HahitantsoaEventDraftDetailPage param="event-1" onNavigate={vi.fn()} />);

    expect(await screen.findByText("HAH-2026-0001")).toBeInTheDocument();

    const editBtn = screen.getByRole("button", { name: /Modifier/i });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    expect(screen.getByText("Modifier la référence du dossier")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("ex: H-050/2026");
    fireEvent.change(input, { target: { value: "H-500/2026" } });

    const saveBtn = screen.getByRole("button", { name: /Enregistrer la référence/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateHahitantsoaEventDraftPublicReference).toHaveBeenCalledWith("event-1", "H-500/2026");
    });
  });
});
