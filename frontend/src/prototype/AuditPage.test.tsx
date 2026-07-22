import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuditPage from "./AuditPage";

vi.mock("../api", () => ({
  getAuditEvents: vi.fn(),
}));

import { getAuditEvents } from "../api";

const mockGetAuditEvents = vi.mocked(getAuditEvents);

describe("AuditPage", () => {
  it("presents action, author, result and severity with understandable labels", async () => {
    mockGetAuditEvents.mockResolvedValue([
      {
        id: "audit-1",
        actor_id: null,
        action: "document.instance_pdf_generated",
        target_type: "document_instance",
        target_id: "document-1",
        metadata: { outcome: "Succès", severity: "high" },
        created_at: "2026-07-22T08:00:00Z",
      },
    ]);

    render(<AuditPage onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("PDF généré")).toBeInTheDocument());

    expect(screen.getByText("Système")).toBeInTheDocument();
    expect(screen.getByText("Succès")).toBeInTheDocument();
    expect(screen.getByText("Élevée")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Événements du journal d'audit" })).toBeInTheDocument();
  });

  it("keeps the loading state announced to assistive technologies", () => {
    mockGetAuditEvents.mockReturnValue(new Promise(() => {}));

    render(<AuditPage onNavigate={vi.fn()} />);

    expect(screen.getByText("Chargement des événements d'audit...")).toBeInTheDocument();
  });
});
