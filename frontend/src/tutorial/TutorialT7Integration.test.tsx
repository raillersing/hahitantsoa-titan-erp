import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SessionUser } from "../api";
import { TUTORIAL_CATALOG } from "./catalog";
import { TutorialProvider } from "./TutorialProvider";
import { TutorialCenter } from "./TutorialCenter";
import { useTutorial } from "./TutorialContext";
import {
  clearAllTutorialStorage,
  loadUserTutorialProgress,
  updateModuleProgress,
} from "./progress";

const mockUser: SessionUser = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  role: "admin",
  capabilities: ["all"],
} as any;

// Test component exposing tutorial actions
function TestTutorialHarness({ initialModuleId }: { initialModuleId?: string }) {
  const {
    activeTutorial,
    currentStep,
    currentStepIndex,
    startTutorial,
    nextStep,
    previousStep,
    closeTutorial,
  } = useTutorial();

  return (
    <div>
      <div data-testid="status-module">{activeTutorial?.id || "none"}</div>
      <div data-testid="status-step">{currentStep?.id || "none"}</div>
      <div data-testid="status-step-index">{currentStepIndex}</div>
      <button data-testid="btn-start-start" onClick={() => startTutorial("START")}>
        Start START
      </button>
      <button data-testid="btn-start-contract" onClick={() => startTutorial("CONTRACT")}>
        Start CONTRACT
      </button>
      {initialModuleId && (
        <button
          data-testid="btn-start-custom"
          onClick={() => startTutorial(initialModuleId)}
        >
          Start {initialModuleId}
        </button>
      )}
      <button data-testid="btn-advance" onClick={nextStep}>
        Advance
      </button>
      <button data-testid="btn-previous" onClick={previousStep}>
        Previous
      </button>
      <button data-testid="btn-dismiss" onClick={closeTutorial}>
        Dismiss
      </button>
    </div>
  );
}

describe("Lot T7: Comprehensive Integration & Acceptance Suite", () => {
  beforeEach(() => {
    clearAllTutorialStorage();
    vi.clearAllMocks();
  });

  describe("1. Catalog Exhaustiveness & Invariants", () => {
    it("contains all 28 officially registered modules", () => {
      expect(TUTORIAL_CATALOG.length).toBeGreaterThanOrEqual(27);
      const moduleIds = TUTORIAL_CATALOG.map((m) => m.id);

      const expectedIds = [
        "START",
        "RIGHTS",
        "SUPPORT",
        "CUSTOMER",
        "CALENDAR",
        "HAH-NEW",
        "TIT-NEW",
        "CONTRACT",
        "RECOVERY",
        "AMEND",
        "STOCK",
        "SETS",
        "PREP",
        "DELIVERY",
        "RETURN",
        "CLOSE",
        "PAYMENT",
        "DOCUMENTS",
        "PRINT",
        "CASH",
        "REPORT",
        "CATALOG",
        "WELCOME",
        "IMPORT",
        "BUY",
        "HR",
        "ADMIN",
        "SETTINGS",
      ];

      for (const id of expectedIds) {
        expect(moduleIds, `Missing tutorial module: ${id}`).toContain(id);
      }
    });

    it("verifies structural integrity of all modules and steps", () => {
      const seenModuleIds = new Set<string>();

      for (const mod of TUTORIAL_CATALOG) {
        // Unique module ID
        expect(seenModuleIds.has(mod.id)).toBe(false);
        seenModuleIds.add(mod.id);

        // Required non-empty properties
        expect(mod.title.trim().length).toBeGreaterThan(0);
        expect(mod.shortDescription.trim().length).toBeGreaterThan(0);
        expect(mod.durationMinutes).toBeGreaterThan(0);
        expect(["discovery", "daily", "advanced"]).toContain(mod.category);
        expect(["titan", "hahitantsoa", "shared"]).toContain(mod.scope);
        expect(mod.steps.length).toBeGreaterThanOrEqual(3);

        const seenStepIds = new Set<string>();
        for (const step of mod.steps) {
          expect(seenStepIds.has(step.id)).toBe(false);
          seenStepIds.add(step.id);

          expect(step.title.trim().length).toBeGreaterThan(0);
          expect(step.body.trim().length).toBeGreaterThan(0);
          expect(["continue", "route-ready", "exercise-answer"]).toContain(step.completion);
          expect(["explain", "pause"]).toContain(step.missingTarget);

          if (step.exercise) {
            expect(step.exercise.question.trim().length).toBeGreaterThan(0);
            expect(step.exercise.choices.length).toBeGreaterThanOrEqual(2);

            if (step.exercise.kind === "sequence-order") {
              expect(step.exercise.correctSequenceIds?.length).toBeGreaterThanOrEqual(2);
            } else {
              const correctChoices = step.exercise.choices.filter((c) => c.isCorrect);
              expect(correctChoices.length).toBe(1);
            }

            for (const c of step.exercise.choices) {
              expect(c.label.trim().length).toBeGreaterThan(0);
              expect(c.explanation.trim().length).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  describe("2. Zero Business Write Guarantee", () => {
    it("never calls any mutative HTTP methods (POST, PUT, PATCH, DELETE) during tutorial interactions", async () => {
      const fetchSpy = vi.spyOn(window, "fetch").mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
      );

      render(
        <TutorialProvider user={mockUser} activeScope="dashboard">
          <TestTutorialHarness />
        </TutorialProvider>
      );

      // Start START tutorial
      fireEvent.click(screen.getByTestId("btn-start-start"));
      expect(screen.getByTestId("status-module")).toHaveTextContent("START");

      // Advance through all steps
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByTestId("btn-advance"));
      }

      // Switch to CONTRACT tutorial and advance
      fireEvent.click(screen.getByTestId("btn-start-contract"));
      fireEvent.click(screen.getByTestId("btn-advance"));
      fireEvent.click(screen.getByTestId("btn-previous"));
      fireEvent.click(screen.getByTestId("btn-dismiss"));

      // Check all fetch calls (if any)
      for (const call of fetchSpy.mock.calls) {
        const init = (call[1] as RequestInit) || {};
        const method = (init.method || "GET").toUpperCase();
        expect(["GET", "HEAD"]).toContain(method);
      }

      fetchSpy.mockRestore();
    });
  });

  describe("3. Multi-User Account Isolation", () => {
    it("strictly isolates tutorial progress between different user IDs", () => {
      // User Alpha completes step 0 and 1 of START
      updateModuleProgress("user-alpha", "START", 1, "start-brand-choice", 1, "in_progress");
      const alphaProgress = loadUserTutorialProgress("user-alpha");
      expect(alphaProgress.modules["START"]?.stepIndex).toBe(1);
      expect(alphaProgress.modules["START"]?.status).toBe("in_progress");

      // User Beta has no progress
      const betaProgress = loadUserTutorialProgress("user-beta");
      expect(betaProgress.modules["START"]).toBeUndefined();

      // User Beta starts and completes step 0 of STOCK
      updateModuleProgress("user-beta", "STOCK", 1, "stock-search", 0, "in_progress");
      const updatedBeta = loadUserTutorialProgress("user-beta");
      expect(updatedBeta.modules["STOCK"]?.stepIndex).toBe(0);
      expect(updatedBeta.modules["START"]).toBeUndefined();

      // User Alpha progress remains unmodified
      const recheckedAlpha = loadUserTutorialProgress("user-alpha");
      expect(recheckedAlpha.modules["STOCK"]).toBeUndefined();
      expect(recheckedAlpha.modules["START"]?.stepIndex).toBe(1);
    });
  });

  describe("4. Accessibility & Keyboard Discipline", () => {
    it("dismisses the tutorial panel when the Escape key is pressed", async () => {
      render(
        <TutorialProvider user={mockUser} activeScope="dashboard">
          <TestTutorialHarness />
        </TutorialProvider>
      );

      // Start tutorial
      fireEvent.click(screen.getByTestId("btn-start-start"));
      expect(screen.getByTestId("status-module")).toHaveTextContent("START");
      expect(screen.getByRole("complementary", { name: /Guide interactif/i })).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("complementary", { name: /Guide interactif/i })).not.toBeInTheDocument();
      });
      expect(screen.getByTestId("status-module")).toHaveTextContent("none");
    });

    it("ensures tutorial panel has ARIA complementary landmark and live region", () => {
      render(
        <TutorialProvider user={mockUser} activeScope="dashboard">
          <TestTutorialHarness />
        </TutorialProvider>
      );

      fireEvent.click(screen.getByTestId("btn-start-start"));
      const panel = screen.getByRole("complementary", { name: /Guide interactif/i });
      expect(panel).toHaveAttribute("aria-label");
      expect(panel.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    });
  });

  describe("5. Missing Target Fallback Resilience", () => {
    it("gracefully falls back to centered explain mode when target element is absent from DOM", () => {
      // Step targets "non-existent-dom-element", which is not rendered
      render(
        <TutorialProvider user={mockUser} activeScope="dashboard">
          <TestTutorialHarness initialModuleId="TIT-NEW" />
        </TutorialProvider>
      );

      // Launch TIT-NEW
      fireEvent.click(screen.getByTestId("btn-start-custom"));
      expect(screen.getByTestId("status-module")).toHaveTextContent("TIT-NEW");

      // Panel is rendered and centered without throw
      const panel = screen.getByRole("complementary", { name: /Guide interactif/i });
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveClass("erp-tutorial-panel--centered");

      // Why explanation button is visible
      expect(screen.getByText(/Pourquoi cette règle \?/i)).toBeInTheDocument();
    });
  });

  describe("6. Learning Center Integration", () => {
    it("renders TutorialCenter with category filtering and keyword search", () => {
      render(
        <TutorialProvider user={mockUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );

      // Search input is present
      const searchInput = screen.getByRole("searchbox", { name: /Rechercher un module/i });
      expect(searchInput).toBeInTheDocument();

      // Type "Caisse"
      fireEvent.change(searchInput, { target: { value: "Caisse" } });
      expect(screen.getByText(/Gestion de la caisse quotidienne/i)).toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.getByText(/Bienvenue dans votre ERP/i)).toBeInTheDocument();
    });
  });
});
