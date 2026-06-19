import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import HahitantsoaCommercialOpsPanel from "./HahitantsoaCommercialOpsPanel";
import * as api from "./api";
import type { ReservationDraft, DocumentTemplateDefinition, DocumentInstance } from "./types";

const MOCK_DRAFTS: ReservationDraft[] = [
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

const MOCK_TEMPLATES: DocumentTemplateDefinition[] = [
  {
    key: "hahitantsoa-delivery-note",
    business_scope: "hahitantsoa",
    document_type: "delivery_note",
    label: "Delivery Note",
    version: "1.0",
    status: "active",
    source_kind: "standard",
    source_reference: "Ref A",
    template_path: "/templates/deliv.html",
    preview_path: "/preview/deliv.html",
    validated_by_client: true,
    notes: "Notes",
  },
];

const MOCK_INSTANCES: DocumentInstance[] = [
  {
    id: "inst-1",
    reservation_draft: "draft-1",
    customer: "cust-1",
    template_key: "hahitantsoa-delivery-note",
    template_version: "1.0",
    template_label: "Delivery Note",
    business_scope: "hahitantsoa",
    document_type: "delivery_note",
    template_status: "active",
    template_source_kind: "standard",
    template_source_reference: "Ref A",
    template_path: "/templates/deliv.html",
    template_preview_path: "/preview/deliv.html",
    template_validated_by_client: true,
    template_notes: "Notes",
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

describe("HahitantsoaCommercialOpsPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all 7 commercial operations cards", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([]);
    vi.spyOn(api, "getStockMovements").mockResolvedValue([]);

    render(<HahitantsoaCommercialOpsPanel />);

    // Check heading and eyebrow
    expect(screen.getByText("Commercial Operations")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Commercials")).toBeInTheDocument();

    // Check all categories are present
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
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([]);
    vi.spyOn(api, "getStockMovements").mockResolvedValue([]);

    render(<HahitantsoaCommercialOpsPanel />);

    // Documents is partially connected because we mount DocumentArtifactPreviewPanel
    expect(screen.getByTestId("card-documents")).toHaveTextContent("Partially Connected");

    // Billing is now partially connected with the live backend endpoint
    expect(screen.getByTestId("card-billing")).toHaveTextContent("Partially Connected");
    // Payments is partially connected: PaymentWorkflowPanel embeds live backend payment endpoints
    expect(screen.getByTestId("card-payments")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-logistics")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-returns")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-breakage")).toHaveTextContent("Partially Connected");
    expect(screen.getByTestId("card-stock")).toHaveTextContent("Partially Connected");

  });

  it("manages preparing and generating document instances from active draft selectors", async () => {
    const draftsSpy = vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    const templatesSpy = vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getBillingInvoices").mockResolvedValue([]);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([]);
    vi.spyOn(api, "getDamageLossSettlements").mockResolvedValue([]);
    vi.spyOn(api, "getStockMovements").mockResolvedValue([]);
    const instancesSpy = vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue(MOCK_INSTANCES);
    const createSpy = vi.spyOn(api, "createReservationDraftDocumentInstance").mockResolvedValue(MOCK_INSTANCES[0]);
    const generateSpy = vi.spyOn(api, "generateReservationDraftDocumentInstance").mockResolvedValue({
      ...MOCK_INSTANCES[0],
      status: "generated",
    });

    render(<HahitantsoaCommercialOpsPanel />);

    await waitFor(() => {
      expect(draftsSpy).toHaveBeenCalled();
      expect(templatesSpy).toHaveBeenCalled();
    });

    // Select reservation draft in documents section
    const draftSelect = screen.getByLabelText(/Select Reservation Draft:/i) as HTMLSelectElement;
    fireEvent.change(draftSelect, { target: { value: "draft-1" } });

    await waitFor(() => {
      expect(instancesSpy).toHaveBeenCalledWith("draft-1");
      expect(screen.getByText("Delivery Note")).toBeInTheDocument();
    });

    // Prepare a new instance
    const templateSelect = screen.getByLabelText(/Choose Template/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: "hahitantsoa-delivery-note" } });
    
    const notesInput = screen.getByPlaceholderText("Instance Notes") as HTMLInputElement;
    fireEvent.change(notesInput, { target: { value: "New Notes" } });

    const prepareBtn = screen.getByRole("button", { name: "Prepare Instance" });
    fireEvent.click(prepareBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("draft-1", {
        template_key: "hahitantsoa-delivery-note",
        notes: "New Notes",
      });
    });

    // Click Generate HTML
    const generateBtn = screen.getByRole("button", { name: "Generate HTML" });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith("draft-1", "inst-1");
    });
  });
});
