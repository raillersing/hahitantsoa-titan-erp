import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import DocumentsHubPage from "./DocumentsHubPage";
import * as api from "../api";

describe("DocumentsHubPage", () => {
  it("renders without crashing", () => {
    render(<DocumentsHubPage onNavigate={vi.fn()} />);
    expect(screen.getByText("Hub Documentaire")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<DocumentsHubPage onNavigate={vi.fn()} />);
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });

  it("opens a wide accessible preview with document information", async () => {
    vi.spyOn(api, "getDocumentInstances").mockResolvedValue([
      {
        id: "doc-1",
        document_type: "proforma",
        business_scope: "titan",
        template_key: "titan.proforma.v1",
        template_label: "Proforma Titan",
        reservation_public_reference: "RES-001",
        reservation_status: "draft",
        customer_display_name: "Client Test",
        customer_email: "client@example.com",
        customer_phone: "",
        status: "generated",
        created_at: "2026-08-11T10:00:00Z",
        updated_at: "2026-08-11T10:00:00Z",
        reservation_draft_id: null,
        hahitantsoa_event_draft_id: null,
        customer_id: null,
      },
    ]);
    vi.spyOn(api, "getDocumentArtifactHtml").mockResolvedValue("<main>Proforma</main>");

    render(<DocumentsHubPage onNavigate={vi.fn()} />);
    const previewButton = (await screen.findAllByRole("button", { name: /Aperçu de RES-001/i }))[0];
    fireEvent.click(previewButton);

    const dialog = await screen.findByRole("dialog", { name: "Aperçu du document" });
    expect(dialog).toHaveClass("lg:inset-8");
    expect(within(dialog).getByText("Client Test")).toBeInTheDocument();
    expect(within(dialog).getByText("Volet")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Fermer l’aperçu" })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(previewButton).toHaveFocus();
  });
});
