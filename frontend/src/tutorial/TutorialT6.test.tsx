import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  CATALOG_TUTORIAL,
  WELCOME_TUTORIAL,
  IMPORT_TUTORIAL,
  BUY_TUTORIAL,
  HR_TUTORIAL,
  ADMIN_TUTORIAL,
  SETTINGS_TUTORIAL,
} from "./content/advanced";
import { getTutorialById, getTutorialsForScope } from "./catalog";
import { TutorialExercise } from "./TutorialExercise";
import { clearAllTutorialStorage } from "./progress";

describe("Lot T6: Advanced Domain Tutorials", () => {
  beforeEach(() => {
    clearAllTutorialStorage();
    vi.clearAllMocks();
  });

  describe("Module definitions & scopes", () => {
    it("defines CATALOG module strictly for Hahitantsoa with boundary exercise", () => {
      const tut = getTutorialById("CATALOG");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Catalogue Hahitantsoa : prestations, salles et locaux");
      expect(tut?.scope).toBe("hahitantsoa");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("services-list");
      expect(tut?.steps[1].target).toBe("venues-list");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("services-list");
    });

    it("defines WELCOME module with visitor agenda and blacklist exercise", () => {
      const tut = getTutorialById("WELCOME");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Accueil, registre des visiteurs et liste noire");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("agenda-visitors-calendar");
      expect(tut?.steps[1].target).toBe("blacklist-table");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("agenda-visitors-calendar");
    });

    it("defines IMPORT module with dropzone and column mapping exercise", () => {
      const tut = getTutorialById("IMPORT");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Importation Excel et migration de données");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("excel-import-dropzone");
      expect(tut?.steps[1].target).toBe("excel-import-mapping");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("excel-import-mapping");
    });

    it("defines BUY module with purchase orders and stock entry exercise", () => {
      const tut = getTutorialById("BUY");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Achats, approvisionnements et réassort");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("purchasing-orders-list");
      expect(tut?.steps[1].target).toBe("supplier-select");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("purchasing-orders-list");
    });

    it("defines HR module with staff registry and qualification exercise", () => {
      const tut = getTutorialById("HR");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Personnel, intervenants et paie événementielle");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("hr-staff-table");
      expect(tut?.steps[1].target).toBe("hr-payroll-rules");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("hr-staff-table");
    });

    it("defines ADMIN module with accounts, roles and least-privilege exercise", () => {
      const tut = getTutorialById("ADMIN");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Administration, habilitations et sécurité");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("admin-users-table");
      expect(tut?.steps[1].target).toBe("admin-roles-matrix");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("admin-users-table");
    });

    it("defines SETTINGS module with bank profiles and commercial terms exercise", () => {
      const tut = getTutorialById("SETTINGS");
      expect(tut).toBeDefined();
      expect(tut?.title).toBe("Paramètres généraux, banques et conditions");
      expect(tut?.scope).toBe("shared");
      expect(tut?.steps).toHaveLength(4);
      expect(tut?.steps[0].target).toBe("bank-settings-form");
      expect(tut?.steps[1].target).toBe("commercial-terms-editor");
      expect(tut?.steps[2].exercise?.kind).toBe("multiple-choice");
      expect(tut?.steps[3].target).toBe("bank-settings-form");
    });
  });

  describe("Scope mapping & retrieval", () => {
    it("returns CATALOG for services and venues", () => {
      const servicesTuts = getTutorialsForScope("services").map((t) => t.id);
      expect(servicesTuts).toContain("CATALOG");

      const venuesTuts = getTutorialsForScope("venues").map((t) => t.id);
      expect(venuesTuts).toContain("CATALOG");
    });

    it("returns WELCOME for agenda-visitors and blacklist-intervenants", () => {
      const agendaTuts = getTutorialsForScope("agenda-visitors").map((t) => t.id);
      expect(agendaTuts).toContain("WELCOME");

      const blacklistTuts = getTutorialsForScope("blacklist-intervenants").map((t) => t.id);
      expect(blacklistTuts).toContain("WELCOME");
    });

    it("returns IMPORT for import-excel", () => {
      const importTuts = getTutorialsForScope("import-excel").map((t) => t.id);
      expect(importTuts).toContain("IMPORT");
    });

    it("returns BUY for purchasing", () => {
      const buyTuts = getTutorialsForScope("purchasing").map((t) => t.id);
      expect(buyTuts).toContain("BUY");
    });

    it("returns HR for hr", () => {
      const hrTuts = getTutorialsForScope("hr").map((t) => t.id);
      expect(hrTuts).toContain("HR");
    });

    it("returns ADMIN for admin", () => {
      const adminTuts = getTutorialsForScope("admin").map((t) => t.id);
      expect(adminTuts).toContain("ADMIN");
    });

    it("returns SETTINGS for bank-settings and hahitantsoa-settings", () => {
      const bankTuts = getTutorialsForScope("bank-settings").map((t) => t.id);
      expect(bankTuts).toContain("SETTINGS");

      const termsTuts = getTutorialsForScope("hahitantsoa-settings").map((t) => t.id);
      expect(termsTuts).toContain("SETTINGS");
    });
  });

  describe("Interactive educational exercises", () => {
    it("validates CATALOG strict Titan boundary exercise", () => {
      const exercise = CATALOG_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      expect(screen.getByText(exercise.question)).toBeInTheDocument();

      // Click wrong answer
      const wrongBtn = screen.getByRole("radio", {
        name: /Oui, tous les modules peuvent se mélanger/i,
      });
      fireEvent.click(wrongBtn);
      expect(onComplete).not.toHaveBeenCalled();
      expect(screen.getByText(/Non, la règle métier absolue interdit formellement d'exposer des lieux/i)).toBeInTheDocument();

      // Click correct answer
      const correctBtn = screen.getByRole("radio", {
        name: /Non, jamais. Titan est strictement limité au matériel seul/i,
      });
      fireEvent.click(correctBtn);
      expect(screen.getByText(/Exactement ! La frontière Titan\/Hahitantsoa est infranchissable/i)).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates WELCOME blacklist procedure exercise", () => {
      const exercise = WELCOME_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Informer immédiatement le client du refus d'accès de ce prestataire/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Consultez la personne responsable pour appliquer la procédure/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates IMPORT column mapping necessity exercise", () => {
      const exercise = IMPORT_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Pour s'assurer que les prix, stocks et identifiants ne sont pas inversés/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exact ! Une inversion de colonnes .* corromprait gravement l'inventaire/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates BUY physical reception timing exercise", () => {
      const exercise = BUY_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Après réception physique et contrôle/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Parfait ! Le stock physique ne peut intégrer que ce qui est réellement présent/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates HR qualification and compliance exercise", () => {
      const exercise = HR_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Pour garantir la bonne affectation des compétences qualifiées/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exact ! Une gestion RH rigoureuse protège l'entreprise/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates ADMIN least-privilege principle exercise", () => {
      const exercise = ADMIN_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Uniquement les rôles logistiques stricts \(préparation, mouvements\) nécessaires/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Parfait ! C'est le principe du moindre privilège/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });

    it("validates SETTINGS official bank profile verification exercise", () => {
      const exercise = SETTINGS_TUTORIAL.steps[2].exercise!;
      const onComplete = vi.fn();
      render(<TutorialExercise data={exercise} onSuccess={onComplete} />);

      const correctBtn = screen.getByRole("radio", {
        name: /Pour garantir que les règlements par virement parviennent sans erreur/i,
      });
      fireEvent.click(correctBtn);
      expect(
        screen.getByText(/Exact ! Un RIB erroné sur une facture bloque le virement client/i),
      ).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
