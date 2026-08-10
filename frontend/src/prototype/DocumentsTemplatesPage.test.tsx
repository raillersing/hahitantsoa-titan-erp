import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import DocumentsTemplatesPage from "./DocumentsTemplatesPage";
import * as api from "../api";

describe("DocumentsTemplatesPage", () => {
  it("renders without crashing", async () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    render(<DocumentsTemplatesPage />);
    expect(screen.getByText("Modeles de documents")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument());
  });

  it("shows loading state initially", () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([]);
    render(<DocumentsTemplatesPage />);
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });

  it("renders a complete document preview in an isolated A4 frame", async () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([
      {
        key: "hahitantsoa.contract_amendment.v1",
        business_scope: "hahitantsoa",
        document_type: "contract_amendment",
        label: "Avenant de contrat Hahitantsoa",
        version: "v1",
        status: "generated_draft_template",
        source_kind: "source_pdf",
        source_reference: "source.pdf",
        template_path: "template.html",
        preview_path: "preview.pdf",
        validated_by_client: false,
        notes: "Source-backed preview",
      },
    ]);
    vi.spyOn(api, "getDocumentTemplatePreview").mockResolvedValue(
      "<!doctype html><html><head><style>body{font-family:serif}</style></head><body><main>Avenant</main></body></html>",
    );

    render(<DocumentsTemplatesPage />);
    await waitFor(() => expect(screen.getByText("Avenant de contrat Hahitantsoa")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Avenant de contrat Hahitantsoa"));

    await waitFor(() => expect(screen.getByTestId("document-template-preview")).toBeInTheDocument());
    expect(screen.getByTitle("Aperçu du modèle de document")).toHaveAttribute("srcdoc");
  });
});
