import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import DocumentsTemplatesPage from "./DocumentsTemplatesPage";
import * as api from "../api";
import type { DocumentTemplateDefinition } from "../types";

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
    const previewSpy = vi.spyOn(api, "getDocumentTemplatePreview").mockResolvedValue(
      "<!doctype html><html><head><style>body{font-family:serif}</style></head><body><main>Avenant</main></body></html>",
    );

    render(<DocumentsTemplatesPage />);
    await waitFor(() => expect(screen.getByText("Avenant de contrat Hahitantsoa")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Avenant de contrat Hahitantsoa"));

    await waitFor(() => expect(screen.getByTestId("document-template-preview")).toBeInTheDocument());
    expect(screen.getByTitle("Aperçu du modèle de document : Avenant de contrat Hahitantsoa")).toHaveAttribute("srcdoc");

    fireEvent.change(screen.getByRole("combobox", { name: "Variante client" }), {
      target: { value: "company" },
    });
    await waitFor(() => expect(previewSpy).toHaveBeenLastCalledWith(
      "hahitantsoa.contract_amendment.v1",
      expect.anything(),
      false,
      "company",
    ));
  });

  it("uses the protected workflow renderer for contracts instead of catalog HTML", async () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([
      {
        key: "hahitantsoa.contract.v1",
        business_scope: "hahitantsoa",
        document_type: "contract",
        label: "Contrat Hahitantsoa",
        version: "v1",
        status: "generated_draft_template",
        source_kind: "source_pdf",
        source_reference: "source.pdf",
        template_path: "template.html",
        preview_path: "preview.pdf",
        validated_by_client: false,
        notes: "",
      },
    ]);
    const previewSpy = vi.spyOn(api, "getDocumentTemplatePreview");

    const { container } = render(<DocumentsTemplatesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Contrat Hahitantsoa/ }));
    previewSpy.mockClear();

    expect(await screen.findByText("CONTRAT DE LOCATION « HAHITANTSOA »")).toBeInTheDocument();
    expect(container.querySelectorAll(".contract-a4-page")).toHaveLength(8);
    expect(screen.getByTestId("document-template-preview")).toHaveClass("overflow-visible");
    expect(screen.queryByTitle(/Aperçu du modèle de document/)).not.toBeInTheDocument();
    expect(previewSpy).not.toHaveBeenCalled();
  });

  it("uses the protected workflow renderer for proformas", async () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([
      {
        key: "titan.proforma.v1",
        business_scope: "titan",
        document_type: "proforma",
        label: "Proforma Titan",
        version: "v1",
        status: "validated_source_template",
        source_kind: "source_pdf",
        source_reference: "source.pdf",
        template_path: "template.html",
        preview_path: "preview.pdf",
        validated_by_client: true,
        notes: "",
      },
    ]);
    const previewSpy = vi.spyOn(api, "getDocumentTemplatePreview");

    render(<DocumentsTemplatesPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Proforma Titan/ }));
    previewSpy.mockClear();

    expect(await screen.findByText("P R O F O R M A")).toBeInTheDocument();
    expect(screen.getByTestId("document-template-preview")).toHaveClass("overflow-visible");
    expect(screen.getByAltText("Watermark")).toHaveClass("commercial-proforma-watermark");
    expect(screen.queryByTitle(/Aperçu du modèle de document/)).not.toBeInTheDocument();
    expect(previewSpy).not.toHaveBeenCalled();
  });

  it("navigates between document slides with buttons and keeps variables visible", async () => {
    const templates: DocumentTemplateDefinition[] = [
      {
        key: "hahitantsoa.contract_amendment.v1",
        business_scope: "hahitantsoa",
        document_type: "contract_amendment",
        label: "Avenant de contrat Hahitantsoa",
        version: "v1",
        status: "generated_draft_template",
        source_kind: "source_pdf",
        source_reference: "source-a.pdf",
        template_path: "template-a.html",
        preview_path: "preview-a.pdf",
        validated_by_client: false,
        notes: "",
      },
      {
        key: "titan.invoice.v1",
        business_scope: "titan",
        document_type: "invoice",
        label: "Facture Titan",
        version: "v1",
        status: "generated_draft_template",
        source_kind: "source_pdf",
        source_reference: "source-b.pdf",
        template_path: "template-b.html",
        preview_path: "preview-b.pdf",
        validated_by_client: false,
        notes: "",
      },
    ];
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue(templates);
    vi.spyOn(api, "getDocumentTemplatePreview").mockImplementation(async (key) =>
      key === "titan.invoice.v1"
        ? "<style>@page { size: A5 portrait; }</style><main>{{ client.name }}</main>"
        : "<main>Avenant {{ client.name }}</main>",
    );

    render(<DocumentsTemplatesPage />);
    const firstCard = await screen.findByRole("button", { name: /Avenant de contrat Hahitantsoa/ });
    firstCard.click();

    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Document précédent" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Voir variables" }));
    expect(await screen.findByText("Nom du client")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Document suivant" }));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: "Facture Titan" })).toBeInTheDocument();
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByTestId("document-template-preview")).toHaveAttribute("data-paper-size", "A4");
    expect(screen.getByRole("button", { name: "Masquer variables" })).toHaveAttribute("aria-pressed", "true");
  });

  it("closes with Escape and restores focus to the document card", async () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([
      {
        key: "shared.preparation_sheet.v1",
        business_scope: "shared",
        document_type: "preparation_sheet",
        label: "Bon de préparation interne",
        version: "v1",
        status: "generated_draft_template",
        source_kind: "source_pdf",
        source_reference: "source.pdf",
        template_path: "template.html",
        preview_path: "preview.pdf",
        validated_by_client: false,
        notes: "",
      },
    ]);
    vi.spyOn(api, "getDocumentTemplatePreview").mockResolvedValue("<main>Checking</main>");

    render(<DocumentsTemplatesPage />);
    const card = await screen.findByRole("button", { name: /Bon de préparation interne/ });
    fireEvent.click(card);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(card);
  });

  it("does not expose the excluded house-rules template in the catalog", async () => {
    vi.spyOn(api, "getDocumentTemplates").mockResolvedValue([
      {
        key: "hahitantsoa.house_rules.v1",
        business_scope: "hahitantsoa",
        document_type: "house_rules",
        label: "Reglement interieur Hahitantsoa",
        version: "v1",
        status: "generated_draft_template",
        source_kind: "generated_from_brand_style",
        source_reference: "source.pdf",
        template_path: "template.html",
        preview_path: "preview.pdf",
        validated_by_client: false,
        notes: "",
      },
    ]);

    render(<DocumentsTemplatesPage />);
    await waitFor(() => expect(screen.queryByText("Chargement des modeles...")).not.toBeInTheDocument());
    expect(screen.queryByText("Reglement interieur Hahitantsoa")).not.toBeInTheDocument();
  });
});
