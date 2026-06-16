import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HahitantsoaCommercialOpsPanel from "./HahitantsoaCommercialOpsPanel";

describe("HahitantsoaCommercialOpsPanel", () => {
  it("renders all 7 commercial operations cards", () => {
    render(<HahitantsoaCommercialOpsPanel />);

    // Check heading and eyebrow
    expect(screen.getByText("Commercial Operations")).toBeInTheDocument();
    expect(screen.getByText("Enterprise Commercials")).toBeInTheDocument();

    // Check all categories are present
    expect(screen.getByText("Documents & Contracts")).toBeInTheDocument();
    expect(screen.getByText("Billing & Invoices")).toBeInTheDocument();
    expect(screen.getByText("Payments & Receipts")).toBeInTheDocument();
    expect(screen.getByText("Logistics & Delivery")).toBeInTheDocument();
    expect(screen.getByText("Returns Handling")).toBeInTheDocument();
    expect(screen.getByText("Breakage & Loss")).toBeInTheDocument();
    expect(screen.getByText("Stock Movement Ledger")).toBeInTheDocument();
  });

  it("indicates correct integration statuses across cards", () => {
    render(<HahitantsoaCommercialOpsPanel />);

    // Documents is partially connected because we mount DocumentArtifactPreviewPanel
    expect(screen.getByTestId("card-documents")).toHaveTextContent("Partially Connected");

    // Other categories are pending backend contracts integration
    expect(screen.getByTestId("card-billing")).toHaveTextContent("Pending Backend Integration");
    expect(screen.getByTestId("card-payments")).toHaveTextContent("Pending Backend Integration");
    expect(screen.getByTestId("card-logistics")).toHaveTextContent("Pending Backend Integration");
    expect(screen.getByTestId("card-returns")).toHaveTextContent("Pending Backend Integration");
    expect(screen.getByTestId("card-breakage")).toHaveTextContent("Pending Backend Integration");
    expect(screen.getByTestId("card-stock")).toHaveTextContent("Pending Backend Integration");
  });

  it("embeds the document artifact preview panel", () => {
    render(<HahitantsoaCommercialOpsPanel />);

    // Verify the document artifact preview form exists
    expect(screen.getByLabelText(/Document instance ID/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Load artifact preview/i })).toBeInTheDocument();
  });
});
