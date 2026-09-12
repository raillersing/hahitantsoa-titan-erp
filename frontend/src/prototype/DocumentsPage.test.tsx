import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DocumentsPage from "./DocumentsPage";

vi.mock("./DocumentsHubPage", () => ({
  default: () => <div data-testid="documents-hub">Hub Documentaire Mock</div>,
}));

vi.mock("./DocumentsTemplatesPage", () => ({
  default: () => <div data-testid="documents-templates">Templates Mock</div>,
}));

describe("DocumentsPage", () => {
  it("affiche par défaut le hub documentaire", () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    expect(screen.getByTestId("documents-hub")).toBeInTheDocument();
  });

  it("bascule vers les modèles officiels lors du clic sur l'onglet Modèles", () => {
    const onNavigate = vi.fn();
    render(<DocumentsPage onNavigate={onNavigate} />);

    const templatesTab = screen.getByRole("tab", { name: /Modeles/i });
    fireEvent.click(templatesTab);

    expect(screen.getByTestId("documents-templates")).toBeInTheDocument();
    expect(onNavigate).toHaveBeenCalledWith("documents", "templates");
  });

  it("affiche les raccourcis de génération dans l'onglet Générer et permet la navigation", () => {
    const onNavigate = vi.fn();
    render(<DocumentsPage onNavigate={onNavigate} />);

    const generateTab = screen.getByRole("tab", { name: /Generer/i });
    fireEvent.click(generateTab);

    expect(screen.getByText("Génération de documents officiels")).toBeInTheDocument();

    // Titan dossier button
    const titanBtn = screen.getByRole("button", { name: /Dossier Titan/i });
    fireEvent.click(titanBtn);
    expect(onNavigate).toHaveBeenCalledWith("reservation-new", "domain:Titan");

    // Hahitantsoa dossier button
    const hahitantsoaBtn = screen.getByRole("button", { name: /Dossier Hahitantsoa/i });
    fireEvent.click(hahitantsoaBtn);
    expect(onNavigate).toHaveBeenCalledWith("reservation-new", "domain:Hahitantsoa");

    // Preview link button
    const previewBtn = screen.getByRole("button", { name: /Prévisualiser les modèles officiels →/i });
    fireEvent.click(previewBtn);
    expect(screen.getByTestId("documents-templates")).toBeInTheDocument();
  });
});
