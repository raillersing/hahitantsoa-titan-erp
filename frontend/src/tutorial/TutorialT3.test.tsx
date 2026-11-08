import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  CUSTOMER_TUTORIAL,
  CALENDAR_TUTORIAL,
  HAH_NEW_TUTORIAL,
  TIT_NEW_TUTORIAL,
  AMEND_TUTORIAL,
} from "./content/commercial";
import { getTutorialById, getTutorialsForScope } from "./catalog";
import { TutorialExercise } from "./TutorialExercise";
import { clearAllTutorialStorage } from "./progress";

describe("Lot T3: Commercial Domain Tutorials", () => {
  beforeEach(() => {
    clearAllTutorialStorage();
    vi.clearAllMocks();
  });

  describe("Module definitions & scopes", () => {
    it("defines CUSTOMER module with anti-doublon exercise", () => {
      const tut = getTutorialById("CUSTOMER");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Fiches Clients & Prospects");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("customers-search-input");
      expect(tut?.steps[1].target).toBe("customers-type-filter");
      expect(tut?.steps[2].target).toBe("customers-table");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("defines CALENDAR module with indicative availability exercise", () => {
      const tut = getTutorialById("CALENDAR");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Planning et Disponibilités");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("planning-brand-filter");
      expect(tut?.steps[1].target).toBe("planning-calendar-grid");
      expect(tut?.steps[2].target).toBe("planning-desired-dates-btn");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("defines HAH-NEW module strictly for Hahitantsoa event creation", () => {
      const tut = getTutorialById("HAH-NEW");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("hahitantsoa");
      expect(tut?.steps).toHaveLength(5);
      expect(tut?.steps[0].target).toBe("reservation-new-type-select");
      expect(tut?.steps[1].target).toBe("reservation-new-client-step");
      expect(tut?.steps[2].target).toBe("reservation-new-dates-step");
      expect(tut?.steps[3].target).toBe("reservation-new-items-step");
      expect(tut?.steps[4].target).toBe("reservation-new-summary-step");
    });

    it("defines TIT-NEW module with strict pure-rental boundary enforcement", () => {
      const tut = getTutorialById("TIT-NEW");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("titan");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[1].title).toContain("aucun lieu ni service");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("defines AMEND module for immutable contracts and official amendments", () => {
      const tut = getTutorialById("AMEND");
      expect(tut).toBeDefined();
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("reservation-detail-contract-section");
      expect(tut?.steps[1].target).toBe("reservation-detail-amend-btn");
      expect(tut?.steps[2].target).toBe("reservation-detail-items-section");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("associates commercial scopes with getTutorialsForScope", () => {
      expect(getTutorialsForScope("customers").map((t) => t.id)).toContain("CUSTOMER");
      expect(getTutorialsForScope("planning").map((t) => t.id)).toContain("CALENDAR");
      expect(getTutorialsForScope("reservation-new").map((t) => t.id)).toContain("HAH-NEW");
      expect(getTutorialsForScope("reservation-new").map((t) => t.id)).toContain("TIT-NEW");
      expect(getTutorialsForScope("reservation-detail").map((t) => t.id)).toContain("AMEND");
    });
  });

  describe("Interactive educational exercises", () => {
    it("validates CUSTOMER anti-doublon exercise feedback", () => {
      const exercise = CUSTOMER_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      // Question is visible
      expect(screen.getByText(exercise.question)).toBeInTheDocument();

      // Click incorrect choice first
      const wrongBtn = screen.getByRole("radio", {
        name: /Créer immédiatement une nouvelle fiche/i,
      });
      fireEvent.click(wrongBtn);
      expect(onComplete).not.toHaveBeenCalled();
      expect(screen.getByText(/Non, cela génère un doublon/i)).toBeInTheDocument();

      // Click correct choice
      const correctBtn = screen.getByRole("radio", {
        name: /Saisir le nom dans le moteur de recherche/i,
      });
      fireEvent.click(correctBtn);
      expect(screen.getByText(/Exact ! S'il existe déjà/i)).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates TIT-NEW boundary exercise (refusing venues in Titan)", () => {
      const exercise = TIT_NEW_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      // Click correct choice
      const correctBtn = screen.getByRole("radio", {
        name: /Non, jamais. Titan est 100% matériel seul/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exactement ! Titan est pure location de matériel et n'expose aucun lieu/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates AMEND official process exercise", () => {
      const exercise = AMEND_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Établir un devis modificatif d'avenant/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Parfait ! L'avenant garantit la traçabilité légale/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
