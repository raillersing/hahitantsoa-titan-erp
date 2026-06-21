import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import HahitantsoaDocumentsPanel from "./HahitantsoaDocumentsPanel";
import * as api from "./api";
import type { HahitantsoaEventDraft, DocumentTemplateDefinition, DocumentInstance } from "./types";

const MOCK_DRAFTS: HahitantsoaEventDraft[] = [
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
    notes: "",
    lines: [],
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  },
  {
    id: "edraft-2",
    public_reference: "HE-2002",
    status: "draft",
    customer_id: "cust-2",
    customer_display_name: "Customer Two",
    event_name: "Conference",
    venue_name: "Convention Center",
    location_details: "Uptown",
    service_notes: "AV setup",
    start_at: "2026-06-08T10:00:00Z",
    end_at: "2026-06-08T18:00:00Z",
    notes: "",
    lines: [],
    created_at: "2026-06-02T10:00:00Z",
    updated_at: "2026-06-02T10:00:00Z",
  },
];

const MOCK_TEMPLATES_ALL: DocumentTemplateDefinition[] = [
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
    key: "shared.delivery-note.v1",
    business_scope: "shared",
    document_type: "delivery_note",
    label: "Shared Delivery Note",
    version: "1.0",
    status: "active",
    source_kind: "standard",
    source_reference: "Ref B",
    template_path: "/templates/delivery.html",
    preview_path: "/preview/delivery.html",
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
    source_reference: "Ref C",
    template_path: "/templates/proforma.html",
    preview_path: "/preview/proforma.html",
    validated_by_client: true,
    notes: "",
  },
];

const MOCK_INSTANCES: DocumentInstance[] = [
  {
    id: "inst-1",
    hahitantsoa_event_draft: "edraft-1",
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
  {
    id: "inst-2",
    hahitantsoa_event_draft: "edraft-1",
    customer: "cust-1",
    template_key: "shared.delivery-note.v1",
    template_version: "1.0",
    template_label: "Shared Delivery Note",
    business_scope: "shared",
    document_type: "delivery_note",
    template_status: "active",
    template_source_kind: "standard",
    template_source_reference: "Ref B",
    template_path: "/templates/delivery.html",
    template_preview_path: "/preview/delivery.html",
    template_validated_by_client: true,
    template_notes: "",
    customer_display_name: "Customer One",
    customer_email: "cust@one.com",
    customer_phone: "123",
    customer_address: "Address 1",
    status: "generated",
    prepared_at: "2026-06-01T13:00:00Z",
    prepared_by: "agent",
    voided_at: null,
    voided_by: null,
    void_reason: "",
    content_checksum: "",
    storage_path: "",
    generated_content_size_bytes: 0,
    notes: "",
    created_at: "2026-06-02T13:00:00Z",
    updated_at: "2026-06-02T13:00:00Z",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HahitantsoaDocumentsPanel", () => {
  it("renders the panel shell with section helper", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);

    render(<HahitantsoaDocumentsPanel />);

    expect(screen.getByTestId("hahitantsoa-documents-panel")).toBeInTheDocument();
    expect(screen.getByText("Hahitantsoa Event Draft Documents")).toBeInTheDocument();
    expect(
      screen.getByText(/Manage document instances for Hahitantsoa event drafts/),
    ).toBeInTheDocument();
  });

  it("shows empty state when no event drafts exist", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Select Event Draft/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Select Event Draft/i) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.options.length).toBe(1);
    expect(select.options[0].text).toContain("Choose Event Draft");
  });

  it("loads and displays event drafts in the selector", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      const opt = screen.getByRole("option", { name: /HE-2001/ });
      expect(opt).toBeInTheDocument();
    });

    expect(screen.getByRole("option", { name: /HE-2002/ })).toBeInTheDocument();
  });

  it("filters templates to hahitantsoa and shared only", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      const templateSelect = screen.getByLabelText(/Choose Template/i) as HTMLSelectElement;
      expect(templateSelect).toBeInTheDocument();
      const optionTexts = Array.from(templateSelect.options).map((o) => o.text);
      expect(optionTexts.some((t) => t.includes("Hahitantsoa Contract"))).toBe(true);
      expect(optionTexts.some((t) => t.includes("Shared Delivery Note"))).toBe(true);
      expect(optionTexts.some((t) => t.includes("Titan Proforma"))).toBe(false);
    });
  });

  it("auto-selects the first draft and loads instances", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    const instancesSpy = vi
      .spyOn(api, "getHahitantsoaEventDraftDocumentInstances")
      .mockResolvedValue(MOCK_INSTANCES);

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      const select = screen.getByLabelText(/Select Event Draft/i) as HTMLSelectElement;
      expect(select.value).toBe("edraft-1");
    });

    expect(instancesSpy).toHaveBeenCalledWith("edraft-1");

    await waitFor(() => {
      expect(screen.getByText("Hahitantsoa Contract")).toBeInTheDocument();
      expect(screen.getByText("Shared Delivery Note")).toBeInTheDocument();
    });
  });

  it("shows empty instances hint when selected draft has no instances", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("No document instances prepared for this draft."),
      ).toBeInTheDocument();
    });
  });

  it("shows error notice when initial data load fails", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockRejectedValue(
      new Error("Network error"),
    );
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Failed to load initial data.");
    });
  });

  it("shows error notice when instance loading fails", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockRejectedValue(
      new Error("Server error"),
    );

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load document instances.",
      );
    });
  });

  it("prepares a document instance via create API", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue([]);
    const createSpy = vi
      .spyOn(api, "createHahitantsoaEventDraftDocumentInstance")
      .mockResolvedValue(MOCK_INSTANCES[0]);

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      const select = screen.getByLabelText(/Select Event Draft/i) as HTMLSelectElement;
      expect(select.value).toBe("edraft-1");
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Choose Template/i)).toBeInTheDocument();
    });

    const templateSelect = screen.getByLabelText(/Choose Template/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: "hahitantsoa.contract.v1" } });

    const notesInput = screen.getByPlaceholderText("Instance Notes") as HTMLInputElement;
    fireEvent.change(notesInput, { target: { value: "New Notes" } });

    const prepareBtn = screen.getByRole("button", { name: "Prepare Instance" });
    fireEvent.click(prepareBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("edraft-1", {
        template_key: "hahitantsoa.contract.v1",
        notes: "New Notes",
      });
    });
  });

  it("generates a prepared document instance via generate API", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue(MOCK_INSTANCES);
    const generateSpy = vi
      .spyOn(api, "generateHahitantsoaEventDraftDocumentInstance")
      .mockResolvedValue({ ...MOCK_INSTANCES[0], status: "generated" });

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Ready (ID: inst-2)")).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole("button", { name: "Generate HTML" });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith("edraft-1", "inst-1");
    });
  });

  it("shows error when generate API fails", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockResolvedValue(MOCK_INSTANCES);
    vi.spyOn(api, "generateHahitantsoaEventDraftDocumentInstance").mockRejectedValue(
      new Error("Generation failed"),
    );

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Generate HTML" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Generate HTML" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Generation failed");
    });
  });

  it("disables controls while loading", async () => {
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES_ALL);
    vi.spyOn(api, "getHahitantsoaEventDraftDocumentInstances").mockImplementation(
      () => new Promise(() => {}),
    );

    render(<HahitantsoaDocumentsPanel />);

    await waitFor(() => {
      const draftSelect = screen.getByLabelText(/Select Event Draft/i) as HTMLSelectElement;
      expect(draftSelect.disabled).toBe(true);
    });
  });
});
