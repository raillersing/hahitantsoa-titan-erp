import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentPreviewDispatcher } from "./document-preview-dispatcher";

const client = {
  name: "Client de référence",
  phone: "034 00 000 00",
  type: "Particulier",
  status: "Client",
};

describe("DocumentPreviewDispatcher", () => {
  it("préserve le contrat Titan validé du parcours", () => {
    const { container } = render(
      <DocumentPreviewDispatcher
        templateKey="titan.material_contract.v1"
        businessScope="titan"
        documentType="material_contract"
        client={client}
        materials={[]}
      />,
    );

    expect(screen.getByText("CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »")).toBeInTheDocument();
    expect(container.querySelectorAll(".contract-a4-page")).toHaveLength(3);
  });

  it("préserve le contrat Hahitantsoa validé du parcours", () => {
    const { container } = render(
      <DocumentPreviewDispatcher
        templateKey="hahitantsoa.contract.v1"
        businessScope="hahitantsoa"
        documentType="contract"
        client={client}
        materials={[]}
      />,
    );

    expect(screen.getByText("CONTRAT DE LOCATION « HAHITANTSOA »")).toBeInTheDocument();
    expect(container.querySelectorAll(".contract-a4-page").length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["titan.proforma.v1", "titan"],
    ["hahitantsoa.proforma.v1", "hahitantsoa"],
  ] as const)("préserve le proforma %s du parcours", (templateKey, businessScope) => {
    render(
      <DocumentPreviewDispatcher
        templateKey={templateKey}
        businessScope={businessScope}
        documentType="proforma"
        client={client}
        materials={[]}
      />,
    );

    expect(screen.getByText("P R O F O R M A")).toBeInTheDocument();
  });
});
