import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getDocumentTemplatePreview } from "../api";
import { DocumentPreview } from "./DocumentPreview";

vi.mock("../api", () => ({ getDocumentTemplatePreview: vi.fn() }));

describe("DocumentPreview", () => {
  it("loads the official Hahitantsoa proforma instead of composing React content", async () => {
    vi.mocked(getDocumentTemplatePreview).mockResolvedValue("<html><body>OFFICIAL PROFORMA</body></html>");

    render(<DocumentPreview type="proforma" domain="hahitantsoa" totalAmount={6_750_000} />);

    expect(await screen.findByTitle("Aperçu du modèle officiel hahitantsoa.proforma.v1")).toHaveAttribute(
      "srcdoc",
      "<html><body>OFFICIAL PROFORMA</body></html>",
    );
    expect(getDocumentTemplatePreview).toHaveBeenCalledWith(
      "hahitantsoa.proforma.v1",
      expect.any(AbortSignal),
      false,
      "individual",
    );
  });

  it("maps the Hahitantsoa contract and never renders a local contract", async () => {
    vi.mocked(getDocumentTemplatePreview).mockResolvedValue("<html><body>OFFICIAL CONTRACT</body></html>");

    render(<DocumentPreview type="contrat" domain="hahitantsoa" client={{ type: "Entreprise" }} />);

    expect(await screen.findByTitle("Aperçu du modèle officiel hahitantsoa.contract.v1")).toBeInTheDocument();
    expect(getDocumentTemplatePreview).toHaveBeenCalledWith(
      "hahitantsoa.contract.v1",
      expect.any(AbortSignal),
      false,
      "company",
    );
    expect(screen.queryByText("CONTRAT DE LOCATION « HAHITANTSOA »")).not.toBeInTheDocument();
  });
});
