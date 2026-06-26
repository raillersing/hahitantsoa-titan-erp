import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";

import AuditPanel from "./AuditPanel";
import * as api from "./api";
import type { AuditEvent } from "./types";

const MOCK_EVENTS: AuditEvent[] = [
  {
    id: "audit-1",
    actor_id: "user-1",
    action: "document.instance_pdf_generated",
    target_type: "document_instance",
    target_id: "doc-1",
    metadata: { template_key: "titan.proforma.v1", pdf_content_checksum: "abc" },
    created_at: "2026-06-25T07:00:00Z",
  },
  {
    id: "audit-2",
    actor_id: null,
    action: "identity.role_assigned",
    target_type: "role_assignment",
    target_id: "assign-1",
    metadata: { is_active: true },
    created_at: "2026-06-25T07:05:00Z",
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
});

describe("AuditPanel", () => {
  it("renders audit events and filters", async () => {
    const auditSpy = vi.spyOn(api, "getAuditEvents").mockResolvedValue(MOCK_EVENTS);

    render(<AuditPanel />);

    await waitFor(() => {
      expect(screen.getByText("Journal d'audit")).toBeInTheDocument();
    });

    expect(await screen.findByTestId("audit-row-audit-1")).toBeInTheDocument();
    expect(screen.getByTestId("audit-row-audit-2")).toBeInTheDocument();
    expect(screen.getByText("document.instance_pdf_generated")).toBeInTheDocument();
    expect(screen.getByText("identity.role_assigned")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "billing.invoice_settled" },
    });

    await waitFor(() => {
      expect(auditSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "billing.invoice_settled" }),
        expect.any(AbortSignal),
      );
    });
  });

  it("shows empty state when no audit events exist", async () => {
    vi.spyOn(api, "getAuditEvents").mockResolvedValue([]);

    render(<AuditPanel />);

    await waitFor(() => {
      expect(screen.getByText("Aucun événement d'audit ne correspond aux filtres actuels.")).toBeInTheDocument();
    });
  });

  it("shows access denied notice when backend permission is unavailable", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);

    render(<AuditPanel />);

    await waitFor(() => {
      expect(screen.getByText("Accès audit indisponible")).toBeInTheDocument();
    });
    expect(screen.getByText("La session actuelle ne peut pas lire les endpoints d'audit.")).toBeInTheDocument();
  });
});
