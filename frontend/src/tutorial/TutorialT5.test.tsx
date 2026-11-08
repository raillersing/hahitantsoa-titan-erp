import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PAYMENT_TUTORIAL,
  DOCUMENTS_TUTORIAL,
  PRINT_TUTORIAL,
  CASH_TUTORIAL,
  REPORT_TUTORIAL,
} from "./content/finance";
import { getTutorialById, getTutorialsForScope } from "./catalog";
import { TutorialExercise } from "./TutorialExercise";
import { clearAllTutorialStorage } from "./progress";

describe("Lot T5: Finance, Documents & Cashbox Tutorials", () => {
  beforeEach(() => {
    clearAllTutorialStorage();
    vi.clearAllMocks();
  });

  describe("Module definitions & scopes", () => {
    it("defines PAYMENT module with schedule, journal and proof verification exercise", () => {
      const tut = getTutorialById("PAYMENT");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Paiements, encaissements et règlements");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("commercial-ops-kpis");
      expect(tut?.steps[1].target).toBe("commercial-ops-tabs");
      expect(tut?.steps[2].target).toBe("commercial-ops-payments");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("defines DOCUMENTS module with template vs instance and immutability exercise", () => {
      const tut = getTutorialById("DOCUMENTS");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Génération et cycle de vie des documents");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("documents-list");
      expect(tut?.steps[1].target).toBe("documents-tabs");
      expect(tut?.steps[2].target).toBe("documents-list");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("defines PRINT module with thermal 80x104mm format and ESC/POS exercise", () => {
      const tut = getTutorialById("PRINT");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Impression thermique 80x104mm et documents opérationnels");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("documents-list");
      expect(tut?.steps[1].target).toBe("documents-list");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("documents-list");
    });

    it("defines CASH module with daily session lifecycle and physical count exercise", () => {
      const tut = getTutorialById("CASH");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Gestion de la caisse quotidienne");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("cashbox-status-card");
      expect(tut?.steps[1].target).toBe("cashbox-session-actions");
      expect(tut?.steps[2].target).toBe("cashbox-count-table");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });

    it("defines REPORT module with KPI indicators, CSV export and occupancy rate exercise", () => {
      const tut = getTutorialById("REPORT");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Rapports d'activité et indicateurs de performance");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("reports-filter-date");
      expect(tut?.steps[1].target).toBe("reports-kpi-grid");
      expect(tut?.steps[2].target).toBe("reports-export-btn");
      expect(tut?.steps[3].exercise?.kind).toBe("multiple-choice");
    });
  });

  describe("Scope mapping & retrieval", () => {
    it("returns PAYMENT for commercial-ops", () => {
      const tutorials = getTutorialsForScope("commercial-ops");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("PAYMENT");
    });

    it("returns DOCUMENTS and PRINT for documents", () => {
      const tutorials = getTutorialsForScope("documents");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("DOCUMENTS");
      expect(ids).toContain("PRINT");
    });

    it("returns CASH for cashbox", () => {
      const tutorials = getTutorialsForScope("cashbox");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("CASH");
    });

    it("returns REPORT for reports", () => {
      const tutorials = getTutorialsForScope("reports");
      const ids = tutorials.map((t) => t.id);
      expect(ids).toContain("REPORT");
    });
  });

  describe("Interactive educational exercises", () => {
    it("validates PAYMENT bank transfer verification exercise", () => {
      const exercise = PAYMENT_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      expect(screen.getByText(exercise.question)).toBeInTheDocument();

      // Click wrong answer
      const wrongBtn = screen.getByRole("radio", {
        name: /Enregistrer immédiatement le paiement en faisant confiance/i,
      });
      fireEvent.click(wrongBtn);
      expect(onComplete).not.toHaveBeenCalled();
      expect(screen.getByText(/Non, une allégation verbale ne constitue pas une preuve/i)).toBeInTheDocument();

      // Click correct answer
      const correctBtn = screen.getByRole("radio", {
        name: /Vérifier la réception effective sur le relevé bancaire de l'entreprise/i,
      });
      fireEvent.click(correctBtn);
      expect(screen.getByText(/Exact ! Le paiement n'est inscrit dans l'ERP qu'après constatation réelle/i)).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates DOCUMENTS signed contract immutability exercise", () => {
      const exercise = DOCUMENTS_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Le contrat signé reste strictement inaltérable avec les tarifs convenus/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Parfait ! La force obligatoire du contrat préserve les conditions convenues/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates PRINT thermal format 80x104mm constraints exercise", () => {
      const exercise = PRINT_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Utiliser le gabarit thermique dédié avec marges resserrées/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exact ! Le canevas thermique 80x104mm est spécialement typé/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates CASH mandatory physical count moments exercise", () => {
      const exercise = CASH_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /À l'ouverture de la session \(pour vérifier le fond de caisse remis\) et à la clôture/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exact ! Le comptage physique est obligatoire à l'ouverture/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates REPORT material occupancy rate interpretation exercise", () => {
      const exercise = REPORT_TUTORIAL.steps[3].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Le ratio entre le volume de matériel loué sur des dossiers confirmés/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exact ! Le taux d'occupation exprime la rentabilité du parc/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
