import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import TitanDocumentsPanel from "./TitanDocumentsPanel";
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
    notes: "Notes",
    lines: [],
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
  },
  {
    id: "draft-2",
    public_reference: "TR-1002",
    status: "draft",
    customer_id: "cust-2",
    customer_display_name: "Customer Two",
    start_at: "2026-06-07T10:00:00Z",
    end_at: "2026-06-07T12:00:00Z",
    notes: "",
    lines: [],
    created_at: "2026-06-02T10:00:00Z",
    updated_at: "2026-06-02T10:00:00Z",
  },
];

const MOCK_TEMPLATES: DocumentTemplateDefinition[] = [
  {
    key: "titan.proforma.v1",
    business_scope: "titan",
    document_type: "proforma",
    label: "Titan Proforma",
    version: "1.0",
    status: "active",
    source_kind: "standard",
    source_reference: "Ref A",
    template_path: "/templates/proforma.html",
    preview_path: "/preview/proforma.html",
    validated_by_client: true,
    notes: "",
  },
  {
    key: "titan.contract.v1",
    business_scope: "titan",
    document_type: "contract",
    label: "Titan Contract",
    version: "1.0",
    status: "active",
    source_kind: "standard",
    source_reference: "Ref B",
    template_path: "/templates/contract.html",
    preview_path: "/preview/contract.html",
    validated_by_client: true,
    notes: "",
  },
];

const MOCK_INSTANCES: DocumentInstance[] = [
  {
    id: "inst-1",
    reservation_draft: "draft-1",
    customer: "cust-1",
    template_key: "titan.proforma.v1",
    template_version: "1.0",
    template_label: "Titan Proforma",
    business_scope: "titan",
    document_type: "proforma",
    template_status: "active",
    template_source_kind: "standard",
    template_source_reference: "Ref A",
    template_path: "/templates/proforma.html",
    template_preview_path: "/preview/proforma.html",
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
  {
    id: "inst-2",
    reservation_draft: "draft-1",
    customer: "cust-1",
    template_key: "titan.contract.v1",
    template_version: "1.0",
    template_label: "Titan Contract",
    business_scope: "titan",
    document_type: "contract",
    template_status: "active",
    template_source_kind: "standard",
    template_source_reference: "Ref B",
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
    status: "generated",
    prepared_at: "2026-06-01T12:00:00Z",
    prepared_by: "agent",
    voided_at: null,
    voided_by: null,
    void_reason: "",
    content_checksum: "",
    storage_path: "",
    generated_content_size_bytes: 0,
    notes: "",
    created_at: "2026-06-02T12:00:00Z",
    updated_at: "2026-06-02T12:00:00Z",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(api, 'checkEndpointPermission').mockResolvedValue(true);
});

describe("TitanDocumentsPanel", () => {
  it("renders the panel shell with section helper", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);

    render(<TitanDocumentsPanel />);

    expect(screen.getByTestId("titan-documents-panel")).toBeInTheDocument();
    expect(screen.getByText("Titan Reservation Draft Documents")).toBeInTheDocument();
    expect(
      screen.getByText(/Manage document instances for Titan reservation drafts/),
    ).toBeInTheDocument();
  });

  it("shows empty state when no drafts exist", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Select Reservation Draft/i)).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Select Reservation Draft/i) as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(select.options.length).toBe(1);
    expect(select.options[0].text).toContain("Choose Reservation Draft");
  });

  it("loads and displays drafts in the selector", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      const opt = screen.getByRole("option", { name: /TR-1001/ });
      expect(opt).toBeInTheDocument();
    });

    expect(screen.getByRole("option", { name: /TR-1002/ })).toBeInTheDocument();
  });

  it("auto-selects the first draft and loads instances", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    const instancesSpy = vi
      .spyOn(api, "getReservationDraftDocumentInstances")
      .mockResolvedValue(MOCK_INSTANCES);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      const select = screen.getByLabelText(/Select Reservation Draft/i) as HTMLSelectElement;
      expect(select.value).toBe("draft-1");
    });

    await waitFor(() => {
      expect(instancesSpy).toHaveBeenCalledWith("draft-1");
    });

    await waitFor(() => {
      expect(screen.getByText("Titan Proforma")).toBeInTheDocument();
      expect(screen.getByText("Titan Contract")).toBeInTheDocument();
    });
  });

  it("shows empty instances hint when selected draft has no instances", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("No document instances prepared for this draft."),
      ).toBeInTheDocument();
    });
  });

  it("shows error notice when initial data load fails", async () => {
    vi.spyOn(api, "getReservationDrafts").mockRejectedValue(new Error("Network error"));
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Failed to load initial data.");
    });
  });

  it("shows error notice when instance loading fails", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockRejectedValue(
      new Error("Server error"),
    );

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load document instances.",
      );
    });
  });

  it("prepares a document instance via create API", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);
    const createSpy = vi
      .spyOn(api, "createReservationDraftDocumentInstance")
      .mockResolvedValue(MOCK_INSTANCES[0]);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      const select = screen.getByLabelText(/Select Reservation Draft/i) as HTMLSelectElement;
      expect(select.value).toBe("draft-1");
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Choose Template/i)).toBeInTheDocument();
    });

    const templateSelect = screen.getByLabelText(/Choose Template/i) as HTMLSelectElement;
    fireEvent.change(templateSelect, { target: { value: "titan.proforma.v1" } });

    const notesInput = screen.getByPlaceholderText("Instance Notes") as HTMLInputElement;
    fireEvent.change(notesInput, { target: { value: "New Notes" } });

    const prepareBtn = screen.getByRole("button", { name: "Prepare Instance" });
    fireEvent.click(prepareBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("draft-1", {
        template_key: "titan.proforma.v1",
        notes: "New Notes",
      });
    });
  });

  it("generates a prepared document instance via generate API", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue(MOCK_INSTANCES);
    const generateSpy = vi
      .spyOn(api, "generateReservationDraftDocumentInstance")
      .mockResolvedValue({ ...MOCK_INSTANCES[0], status: "generated" });

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Ready (ID: inst-2)")).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole("button", { name: "Generate HTML" });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith("draft-1", "inst-1");
    });
  });

  it("shows error when generate API fails", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue(MOCK_INSTANCES);
    vi.spyOn(api, "generateReservationDraftDocumentInstance").mockRejectedValue(
      new Error("Generation failed"),
    );

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Titan Proforma")).toBeInTheDocument();
    });

    const generateBtn = screen.getByRole("button", { name: "Generate HTML" });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Generation failed");
    });
  });

  it("disables controls while loading", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockImplementation(
      () => new Promise(() => {}),
    );

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      const draftSelect = screen.getByLabelText(/Select Reservation Draft/i) as HTMLSelectElement;
      expect(draftSelect.disabled).toBe(true);
    });
  });

  it("hides prepare form and shows permission message when user lacks write permission", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Select Reservation Draft/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Prepare Instance" })).not.toBeInTheDocument();
    expect(screen.getByText(/Write access is required/i)).toBeInTheDocument();
  });

  it("hides generate button and shows permission note when user lacks write permission", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(MOCK_DRAFTS);
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(MOCK_TEMPLATES);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue(MOCK_INSTANCES);

    render(<TitanDocumentsPanel />);

    await waitFor(() => {
      expect(screen.getByText("Titan Proforma")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Generate HTML" })).not.toBeInTheDocument();
    expect(screen.getByText(/Write access required/i)).toBeInTheDocument();
  });
});
