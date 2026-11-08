import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  STOCK_TUTORIAL,
  SETS_TUTORIAL,
  PREP_TUTORIAL,
  DELIVERY_TUTORIAL,
  RETURN_TUTORIAL,
  CLOSE_TUTORIAL,
} from "./content/logistics";
import { getTutorialById, getTutorialsForScope } from "./catalog";
import { TutorialExercise } from "./TutorialExercise";
import { clearAllTutorialStorage } from "./progress";

describe("Lot T4: Logistics Domain Tutorials", () => {
  beforeEach(() => {
    clearAllTutorialStorage();
    vi.clearAllMocks();
  });

  describe("Module definitions & scopes", () => {
    it("defines STOCK module with 3-tier stock level targets and calculation exercise", () => {
      const tut = getTutorialById("STOCK");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Consultation du stock et disponibilités");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("inventory-search-input");
      expect(tut?.steps[1].target).toBe("inventory-stock-levels");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("inventory-stock-levels");
    });

    it("defines SETS module with package composition and component deduction exercise", () => {
      const tut = getTutorialById("SETS");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("titan");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("packages-list");
      expect(tut?.steps[1].target).toBe("packages-items-table");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("packages-items-table");
    });

    it("defines PREP module with logistics pick list and readiness validation exercise", () => {
      const tut = getTutorialById("PREP");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("stock-prep-list");
      expect(tut?.steps[1].target).toBe("stock-prep-list");
      expect(tut?.steps[2].target).toBe("stock-prep-actions");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("defines DELIVERY module with delivery note (BL) and legal handover exercise", () => {
      const tut = getTutorialById("DELIVERY");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("titan");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("dispatch-list");
      expect(tut?.steps[1].target).toBe("dispatch-handover-btn");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("dispatch-handover-btn");
    });

    it("defines RETURN module with missing item qualification exercise", () => {
      const tut = getTutorialById("RETURN");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("returns-list");
      expect(tut?.steps[1].target).toBe("returns-list");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("returns-validation-btn");
    });

    it("defines CLOSE module with caution settlement and refund conditions exercise", () => {
      const tut = getTutorialById("CLOSE");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("breakage-deduction-form");
      expect(tut?.steps[1].target).toBe("breakage-list");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("breakage-list");
    });
  });

  describe("Scope mapping & retrieval", () => {
    it("returns STOCK for inventory-management", () => {
      const tutorials = getTutorialsForScope("inventory-management");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("STOCK");
      expect(ids).toContain("SETS");
    });

    it("returns SETS for packages", () => {
      const tutorials = getTutorialsForScope("packages");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("SETS");
    });

    it("returns PREP for stock-preparation", () => {
      const tutorials = getTutorialsForScope("stock-preparation");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("PREP");
    });

    it("returns DELIVERY for logistics-dispatch", () => {
      const tutorials = getTutorialsForScope("logistics-dispatch");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("DELIVERY");
    });

    it("returns RETURN for logistics-returns", () => {
      const tutorials = getTutorialsForScope("logistics-returns");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("RETURN");
    });

    it("returns CLOSE for breakage-loss", () => {
      const tutorials = getTutorialsForScope("breakage-loss");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("CLOSE");
    });
  });

  describe("Interactive educational exercises", () => {
    it("validates STOCK available calculation exercise", () => {
      const exercise = STOCK_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      expect(screen.getByText(exercise.question)).toBeInTheDocument();

      // Click wrong answer
      const wrongBtn = screen.getByRole("radio", {
        name: /50 chaises \(le stock physique total présent\)/i,
      });
      fireEvent.click(wrongBtn);
      expect(onComplete).not.toHaveBeenCalled();
      expect(screen.getByText(/Non, car 20 chaises sont déjà contractuellement réservées/i)).toBeInTheDocument();

      // Click correct answer
      const correctBtn = screen.getByRole("radio", {
        name: /30 chaises \(50 en stock actuel - 20 réservées\)/i,
      });
      fireEvent.click(correctBtn);
      expect(screen.getByText(/Exact ! La formule est « Disponible = Stock actuel - Réservé »/i)).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates SETS component deduction exercise", () => {
      const exercise = SETS_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /5 Arches et 20 Projecteurs LED décrémentés du stock disponible individuel/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exact ! Un pack décompose toujours ses besoins/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates PREP completion condition exercise", () => {
      const exercise = PREP_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Tous les articles du dossier ont été physiquement prélevés/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Parfait ! Le statut « Prêt » est un jalon strictement logistique/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates DELIVERY legal handover exercise", () => {
      const exercise = DELIVERY_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Elle constate contradictoirement la remise et l'état du matériel/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exactement ! La signature du BL prouve contradictoirement/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates RETURN missing items protocol exercise", () => {
      const exercise = RETURN_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Qualifier les lignes concernées en « Manquant »/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/C'est la règle d'or ! Seuls les articles intacts reviennent en stock disponible/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates CLOSE caution refund condition exercise", () => {
      const exercise = CLOSE_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Uniquement après validation définitive du retour physique et régularisation complète/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Parfait ! La caution constitue la garantie contre les pertes et dégradations/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
