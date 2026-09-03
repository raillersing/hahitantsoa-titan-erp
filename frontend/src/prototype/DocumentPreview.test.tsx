import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getDocumentTemplatePreview,
  getHahitantsoaEventDraftDocumentPreview,
} from "../api";
import { DocumentPreview } from "./DocumentPreview";

vi.mock("../api", () => ({
  getDocumentTemplatePreview: vi.fn(),
  getHahitantsoaEventDraftDocumentPreview: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("DocumentPreview", () => {
  it("loads the official Hahitantsoa proforma instead of composing React content", async () => {
    vi.mocked(getHahitantsoaEventDraftDocumentPreview).mockResolvedValue(
      "<html><body>OFFICIAL PROFORMA</body></html>",
    );

    render(
      <DocumentPreview
        type="proforma"
        domain="hahitantsoa"
        hahitantsoaEventDraftId="event-draft-1"
        totalAmount={6_750_000}
      />,
    );

    expect(await screen.findByTitle("Aperçu du modèle officiel hahitantsoa.proforma.v1")).toHaveAttribute(
      "srcdoc",
      "<html><body>OFFICIAL PROFORMA</body></html>",
    );
    expect(getHahitantsoaEventDraftDocumentPreview).toHaveBeenCalledWith(
      "event-draft-1",
      "hahitantsoa.proforma.v1",
      expect.any(AbortSignal),
    );
    expect(getDocumentTemplatePreview).not.toHaveBeenCalled();
  });

  it("maps the Hahitantsoa contract and never renders a local contract", async () => {
    vi.mocked(getHahitantsoaEventDraftDocumentPreview).mockResolvedValue(
      "<html><body>OFFICIAL CONTRACT</body></html>",
    );

    render(
      <DocumentPreview
        type="contrat"
        domain="hahitantsoa"
        client={{ type: "Entreprise" }}
        hahitantsoaEventDraftId="event-draft-2"
      />,
    );

    expect(await screen.findByTitle("Aperçu du modèle officiel hahitantsoa.contract.v1")).toBeInTheDocument();
    expect(getHahitantsoaEventDraftDocumentPreview).toHaveBeenCalledWith(
      "event-draft-2",
      "hahitantsoa.contract.v1",
      expect.any(AbortSignal),
    );
    expect(screen.queryByText("CONTRAT DE LOCATION « HAHITANTSOA »")).not.toBeInTheDocument();
  });

  it("does not fall back to the generic preview before the Hahitantsoa draft exists", async () => {
    render(<DocumentPreview type="proforma" domain="hahitantsoa" />);

    expect(
      await screen.findByText("Enregistrez le brouillon Hahitantsoa pour afficher le document avec ses données réelles."),
    ).toBeInTheDocument();
    expect(getDocumentTemplatePreview).not.toHaveBeenCalled();
    expect(getHahitantsoaEventDraftDocumentPreview).not.toHaveBeenCalled();
  });
});
