import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import HahitantsoaCommercialOpsPanel from "./HahitantsoaCommercialOpsPanel";
import * as api from "./api";
import type { ReservationDraft, HahitantsoaEventDraft, DocumentTemplateDefinition, DocumentInstance } from "./types";

const MOCK_RESERVATION_DRAFTS: ReservationDraft[] = [
  {
    id: "draft-1",
    public_reference: "TR-1001",
    status: "draft",
    customer_id: "cust-1",
    customer_display_name: "Customer One",
    start_at: "2026-06-06T10:00:00Z",
    end_at: "2026-06-06T12:00:00Z",
    notes: "Notes 1",
    lines: [],
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  },
];

const MOCK_EVENT_DRAFTS: HahitantsoaEventDraft[] = [
  {
    id: "edraft-1",
    public_reference: "HE-2001",
    status: "draft",
    customer_id: "cust-1",
    customer_display_name: "Customer One",
    event_name: "Wedding",
    venue_name: "Grand Hall",
    location_details: "Downtown",
    service_notes: "Full service",
    start_at: "2026-06-06T10:00:00Z",
    end_at: "2026-06-06T12:00:00Z",
    notes: "Notes",
    lines: [],
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  },
];

const MOCK_TEMPLATES: DocumentTemplateDefinition[] = [
  {
    key: "hahitantsoa.contract.v1",
    business_scope: "hahitantsoa",
    document_type: "contract",
    label: "Hahitantsoa Contract",
    version: "1.0",
    status: "active",
    source_kind: "standard",
    source_reference: "Ref A",
    template_path: "/templates/contract.html",
    preview_path: "/preview/contract.html",
    validated_by_client: true,
    notes: "",
  },
  {
    key: "titan.proforma.v1",
    business_scope: "titan",
    document_type: "proforma",
    label: "Titan Proforma",
    version: "1.0",
    status: "active",
    source_kind: "standard",
    source_reference: "Ref B",
    template_path: "/templates/proforma.html",
    preview_path: "/preview/proforma.html",
    validated_by_client: true,
    notes: "",
  },
];

const MOCK_INSTANCES: DocumentInstance[] = [
  {
    id: "inst-1",
    reservation_draft: "draft-1",
    hahitantsoa_event_draft: null,
    customer: "cust-1",
    template_key: "hahitantsoa.contract.v1",
    template_version: "1.0",
    template_label: "Hahitantsoa Contract",
    business_scope: "hahitantsoa",
    document_type: "contract",
    template_status: "active",
    template_source_kind: "standard",
    template_source_reference: "Ref A",
    template_path: "/templates/contract.html",
    template_preview_path: "/preview/contract.html",
    template_validated_by_client: true,
    template_notes: "",
    reservation_public_reference: "TR-1001",
    reservation_status: "draft",
    customer_display_name: "Customer One",
    customer_email: "cust@one.com",
    customer_phone: "123",
    customer_address: "Address 1",
    status: "prepared",
    prepared_at: "2026-06-01T12:00:00Z",
    prepared_by: "agent",
    voided_at: null,
    voided_by: null,
    void_reason: "",
    content_checksum: "",
    storage_path: "",
    generated_content_size_bytes: 0,
    notes: "Pre-notes",
    created_at: "2026-06-01T12:00:00Z",
    updated_at: "2026-06-01T12:00:00Z",
  },
];

function mockAllApis() {
  vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_RESERVATION_DRAFTS);
  vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_EVENT_DRAFTS);
  vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
  vi.spyOn(api, "getPayments").mockResolvedValue([]);
  vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
  vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
  vi.spyOn(api, "getReturnOperations").mockResolvedValue([]);
  vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([]);
  vi.spyOn(api, "getStockMovements").mockResolvedValue([]);
  vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
  vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue(MOCK_INSTANCES);
  vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);
}

describe("HahitantsoaCommercialOpsPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all 7 commercial operations cards", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([]);
    vi.spyOn(api, "getStockMovements").mockResolvedValue([]);
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentArtifactHtml").mockRejectedValue(new Error("No artifact"));

    render(<HahitantsoaCommercialOpsPanel />);

    expect(screen.getByText("Commercial Operations")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Commercials")).toBeInTheDocument();

    expect(screen.getByText("Documents & Contracts")).toBeInTheDocument();
    expect(screen.getByText("Billing & Invoices")).toBeInTheDocument();
    expect(screen.getByText("Payments & Receipts")).toBeInTheDocument();
    expect(screen.getByText("Logistics & Delivery")).toBeInTheDocument();
    expect(screen.getByText("Returns Handling")).toBeInTheDocument();
    expect(screen.getByText("Breakage & Loss")).toBeInTheDocument();
    expect(screen.getByText("Stock Movement Ledger")).toBeInTheDocument();
  });

  it("indicates correct integration statuses across cards", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([]);
    vi.spyOn(api, "getStockMovements").mockResolvedValue([]);
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentArtifactHtml").mockRejectedValue(new Error("No artifact"));

    render(<HahitantsoaCommercialOpsPanel />);

    expect(screen.getByTestId("card-documents")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-billing")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-payments")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-logistics")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-returns")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-breakage")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-stock")).toHaveTextContent("Partially Connected");
  });

  it("renders document tab bar and switches between Titan and Hahitantsoa tabs", async () => {
    mockAllApis();
    vi.spyOn(api, "getDocumentArtifactHtml").mockRejectedValue(new Error("No artifact"));

    render(<HahitantsoaCommercialOpsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Titan Documents")).toBeInTheDocument();
      expect(screen.getByText("Hahitantsoa Documents")).toBeInTheDocument();
    });

    expect(screen.getByTestId("titan-documents-panel")).toBeInTheDocument();
    expect(screen.getByText("Titan Reservation Draft Documents")).toBeInTheDocument();

    const hahitantsoaTab = screen.getByText("Hahitantsoa Documents");
    fireEvent.click(hahitantsoaTab);

    await waitFor(() => {
      expect(screen.getByText("Hahitantsoa Event Draft Documents")).toBeInTheDocument();
    });
  });

  it("manages preparing and generating Titan document instances from draft selectors", async () => {
    mockAllApis();
    vi.spyOn(api, "getDocumentArtifactHtml").mockRejectedValue(new Error("No artifact"));
    const createSpy = vi.spyOn(api, "createReservationDraftDocumentInstance").mockResolvedValue(MOCK_INSTANCES[0]);
    const generateSpy = vi.spyOn(api, "generateReservationDraftDocumentInstance").mockResolvedValue({
      ...MOCK_INSTANCES[0],
      status: "generated",
    });

    render(<HahitantsoaCommercialOpsPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("titan-documents-panel")).toBeInTheDocument();
    });

    const draftSelect = screen.getByLabelText(/Select Reservation Draft:/i) as HTMLSelectElement;
    fireEvent.change(draftSelect, { target: { value: "draft-1" } });

    await waitFor(() => {
      expect(screen.getByText("Hahitantsoa Contract")).toBeInTheDocument();
    });

    const templateSelect = screen.getByLabelText(/Choose Template/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: "hahitantsoa.contract.v1" } });

    const notesInput = screen.getByPlaceholderText("Instance Notes") as HTMLInputElement;
    fireEvent.change(notesInput, { target: { value: "New Notes" } });

    const prepareBtn = screen.getByRole("button", { name: "Prepare Instance" });
    fireEvent.click(prepareBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("draft-1", {
        template_key: "hahitantsoa.contract.v1",
        notes: "New Notes",
      });
    });

    const generateBtn = screen.getByRole("button", { name: "Generate HTML" });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith("draft-1", "inst-1");
    });
  });
});
