import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DraftConflictResolutionModal } from "./DraftConflictResolutionModal";
import * as api from "../api";
import type { UnifiedPlanningEvent } from "./PlanningPage";

vi.mock("../api", async () => {
  const actual = await vi.importActual("../api");
  return {
    ...actual,
    updateHahitantsoaEventDraft: vi.fn(),
    deleteHahitantsoaEventDraft: vi.fn(),
    updateReservationDraft: vi.fn(),
  };
});

describe("DraftConflictResolutionModal", () => {
  const mockEvent: UnifiedPlanningEvent = {
    id: "draft-123",
    category: "hahitantsoa",
    title: "Mariage civil - H-003/2026",
    subtitle: "Salle des fêtes + jardin",
    customerName: "Ramila Jeany",
    customerId: "cust-1",
    startAt: new Date("2026-09-12T08:00:00Z"),
    endAt: new Date("2026-09-12T20:00:00Z"),
    status: "En conflit de date",
    statusKind: "conflict",
    location: "Salle des fêtes + jardin",
    reference: "H-003/2026",
    isConflicted: true,
    conflictingWith: "H-002/2026",
    conflictingWithEventName: "Événement Hahitantsoa",
    raw: {
      id: "draft-123",
      public_reference: "H-003/2026",
      notes: "Demande initiale",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders conflict information and blocking reference properly", () => {
    render(
      <DraftConflictResolutionModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
      />
    );

    expect(screen.getByText(/Conflit de disponibilité/i)).toBeInTheDocument();
    expect(screen.getByText(/Ramila Jeany/i)).toBeInTheDocument();
    expect(screen.getByText(/H-002\/2026/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Relocaliser/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Mettre en attente/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Annuler le devis/i)).toBeInTheDocument();
  });

  it("handles date rescheduling and calls updateHahitantsoaEventDraft", async () => {
    const onResolved = vi.fn();
    const onClose = vi.fn();
    vi.mocked(api.updateHahitantsoaEventDraft).mockResolvedValue({} as any);

    render(
      <DraftConflictResolutionModal
        isOpen={true}
        onClose={onClose}
        event={mockEvent}
        onResolved={onResolved}
      />
    );

    // Select shortcut "+7j"
    const shortcutBtn = screen.getByText(/Samedi suivant/i);
    fireEvent.click(shortcutBtn);

    // Click apply
    const applyBtn = screen.getByText(/Appliquer la nouvelle date/i);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(api.updateHahitantsoaEventDraft).toHaveBeenCalledWith(
        "draft-123",
        expect.objectContaining({
          start_at: expect.stringContaining("2026-09-19"),
        })
      );
    });
  });

  it("handles waitlist option submission", async () => {
    const onResolved = vi.fn();
    vi.mocked(api.updateHahitantsoaEventDraft).mockResolvedValue({} as any);

    render(
      <DraftConflictResolutionModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
        onResolved={onResolved}
      />
    );

    // Switch to waitlist tab
    fireEvent.click(screen.getByText(/2\. Mettre en attente/i));

    const submitBtn = screen.getByText(/Enregistrer en liste d'attente/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.updateHahitantsoaEventDraft).toHaveBeenCalledWith(
        "draft-123",
        expect.objectContaining({
          notes: expect.stringContaining("LISTE D'ATTENTE"),
        })
      );
    });
  });

  it("handles draft cancellation and deletion", async () => {
    const onResolved = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api.deleteHahitantsoaEventDraft).mockResolvedValue(undefined);

    render(
      <DraftConflictResolutionModal
        isOpen={true}
        onClose={vi.fn()}
        event={mockEvent}
        onResolved={onResolved}
      />
    );

    // Switch to cancel tab
    fireEvent.click(screen.getByText(/3\. Annuler le devis/i));

    const confirmDeleteBtn = screen.getByText(/Confirmer la suppression/i);
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(api.deleteHahitantsoaEventDraft).toHaveBeenCalledWith("draft-123");
    });
  });
});
