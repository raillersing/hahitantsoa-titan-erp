import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DocumentsPage from "./DocumentsPage";
import { DocumentTemplateDefinition } from "../types";

const getTemplates = vi.fn();
const createTemplate = vi.fn();
const deleteTemplate = vi.fn();
const getVersions = vi.fn();
const getTemplatePreview = vi.fn();

vi.mock("../api", () => ({
  getDocumentTemplates: (...args: unknown[]) => getTemplates(...args),
  createDocumentTemplate: (...args: unknown[]) => createTemplate(...args),
  deleteDocumentTemplate: (...args: unknown[]) => deleteTemplate(...args),
  getDocumentTemplateVersions: (...args: unknown[]) => getVersions(...args),
  getDocumentTemplatePreview: (...args: unknown[]) => getTemplatePreview(...args),
}));

const definitions: DocumentTemplateDefinition[] = [
  { key: "titan.material_contract.v1", business_scope: "titan", document_type: "Contrat", label: "Contrat Titan", version: "1", status: "active", source_kind: "workflow", source_reference: "contrat-titan.pdf", template_path: "", preview_path: "", validated_by_client: true, notes: "Réplique validée" },
  { key: "hahitantsoa.contract.v1", business_scope: "hahitantsoa", document_type: "Contrat", label: "Contrat Hahitantsoa", version: "2", status: "active", source_kind: "workflow", source_reference: "contrat-hahitantsoa.pdf", template_path: "", preview_path: "", validated_by_client: true, notes: "" },
  { key: "titan.delivery.v1", business_scope: "titan", document_type: "Bon de livraison", label: "Bon Titan", version: "1", status: "active", source_kind: "source_pdf", source_reference: "source.pdf", template_path: "", preview_path: "", validated_by_client: true, notes: "Source" },
];

describe("DocumentsPage refonte", () => {
  beforeEach(() => { vi.clearAllMocks(); getTemplates.mockResolvedValue(definitions); getVersions.mockResolvedValue([]); getTemplatePreview.mockResolvedValue("<!doctype html><html><body><h1>BON DE LIVRAISON</h1></body></html>"); });

  it("charge le catalogue et filtre sans données fictives", async () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Contrat Titan")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Rechercher un modèle"), { target: { value: "hahitantsoa" } });
    expect(screen.getByText("Contrat Hahitantsoa")).toBeInTheDocument();
    expect(screen.queryByText("Contrat Titan")).not.toBeInTheDocument();
    expect(screen.queryByText(/Importer/i)).not.toBeInTheDocument();
  });

  it("ouvre la fiche de référence et conserve l’aperçu du workflow", async () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Contrat Titan")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le modèle Contrat Titan" }));
    expect(screen.getByText("Modèle de référence.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aperçu" })).toBeInTheDocument();
    expect(screen.getAllByAltText("titan logo").length).toBeGreaterThan(0);
    const preview = screen.getByRole("region", { name: "Aperçu" });
    expect(within(preview).queryByText("{{client.name}}", { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Afficher les variables" }));
    expect(within(preview).getAllByText("{{client.name}}", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/import/i)).not.toBeInTheDocument();
  });

  it("utilise le rendu HTML source pour un document source-backed", async () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Bon Titan")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le modèle Bon Titan" }));
    expect(await screen.findByTitle("Aperçu source de Bon Titan")).toHaveAttribute("sandbox", "");
    expect(getTemplatePreview).toHaveBeenCalledWith("titan.delivery.v1", expect.any(AbortSignal));
  });

  it("affiche un accès honnête aux documents générés", async () => {
    const onNavigate = vi.fn();
    render(<DocumentsPage onNavigate={onNavigate} />);
    await waitFor(() => expect(screen.getByText("Contrat Titan")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Documents générés/i }));
    expect(screen.getByText("Accès depuis les dossiers métier")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir les réservations/i }));
    expect(onNavigate).toHaveBeenCalledWith("reservations");
  });

  it("gère l’état vide et l’erreur de chargement", async () => {
    getTemplates.mockResolvedValueOnce([]);
    render(<DocumentsPage onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Aucun modèle trouvé")).toBeInTheDocument());
    getTemplates.mockRejectedValueOnce(new Error("network"));
    cleanup();
    render(<DocumentsPage onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger"));
  });
});
