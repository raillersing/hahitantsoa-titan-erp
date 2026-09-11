import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProformaVersionHistoryModal } from "./ProformaVersionHistoryModal";
import type { ProformaHistorySummary, ProformaVersionItem } from "../proformaVersionHistory";

function makeItem(overrides: Partial<ProformaVersionItem> = {}): ProformaVersionItem {
  return {
    id: "item-1",
    versionNumber: 1,
    versionLabel: "v1",
    reference: "TITAN-2026-001-PF",
    statusCode: "official_contract",
    statusLabel: "Officiel (Contrat initial)",
    isOfficial: true,
    createdAt: "2026-06-01T10:00:00Z",
    notes: "Validation contrat",
    instance: { id: "item-1" } as any,
    ...overrides,
  };
}

describe("ProformaVersionHistoryModal", () => {
  it("ne s'affiche pas lorsque isOpen est false", () => {
    const summary: ProformaHistorySummary = {
      reference: "TITAN-2026-001-PF",
      versions: [],
      currentOfficialVersion: null,
      latestVersion: null,
      hasPendingAmendment: false,
      totalVersionsCount: 0,
    };

    const { container } = render(
      <ProformaVersionHistoryModal
        isOpen={false}
        onClose={vi.fn()}
        summary={summary}
        onPreviewVersion={vi.fn()}
        isConfirmed={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("affiche les versions, les badges et permet d'ouvrir l'aperçu de chaque version", () => {
    const v1 = makeItem({
      id: "doc-v1",
      versionNumber: 1,
      versionLabel: "v1",
      statusCode: "archived",
      statusLabel: "Archivé (Remplacé par Avenant N°1)",
      isOfficial: false,
    });
    const v2 = makeItem({
      id: "doc-v2",
      versionNumber: 2,
      versionLabel: "v2",
      statusCode: "official_amendment",
      statusLabel: "Officiel (Avenant N°1)",
      isOfficial: true,
    });

    const summary: ProformaHistorySummary = {
      reference: "TITAN-2026-001-PF",
      versions: [v1, v2],
      currentOfficialVersion: v2,
      latestVersion: v2,
      hasPendingAmendment: false,
      totalVersionsCount: 2,
    };

    const mockPreview = vi.fn();
    const mockNewRevision = vi.fn();
    const mockClose = vi.fn();

    render(
      <ProformaVersionHistoryModal
        isOpen={true}
        onClose={mockClose}
        summary={summary}
        onPreviewVersion={mockPreview}
        onCreateNewRevision={mockNewRevision}
        isConfirmed={true}
      />
    );

    // Titre et référence
    expect(screen.getByText(/Historique des versions du Proforma/i)).toBeInTheDocument();
    expect(screen.getAllByText("TITAN-2026-001-PF").length).toBeGreaterThan(0);
    expect(screen.getByText(/Active : v2/i)).toBeInTheDocument();

    // Badges de statut
    expect(screen.getByText(/Archivé \(Remplacé par Avenant N°1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Officiel \(Avenant N°1\)/i)).toBeInTheDocument();

    // Boutons d'aperçu par version
    const previewV2Btn = screen.getByRole("button", { name: /Aperçu v2/i });
    expect(previewV2Btn).toBeInTheDocument();
    fireEvent.click(previewV2Btn);
    expect(mockPreview).toHaveBeenCalledWith(v2);

    const previewV1Btn = screen.getByRole("button", { name: /Aperçu v1/i });
    expect(previewV1Btn).toBeInTheDocument();
    fireEvent.click(previewV1Btn);
    expect(mockPreview).toHaveBeenCalledWith(v1);

    // Bouton de nouvelle révision
    const newRevBtn = screen.getByRole("button", { name: /Nouvelle révision/i });
    expect(newRevBtn).toBeInTheDocument();
    fireEvent.click(newRevBtn);
    expect(mockNewRevision).toHaveBeenCalled();

    // Fermeture
    const closeBtns = screen.getAllByRole("button", { name: /Fermer/i });
    expect(closeBtns.length).toBeGreaterThan(0);
    fireEvent.click(closeBtns[0]);
    expect(mockClose).toHaveBeenCalled();
  });
});
