import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../api";
import { TutorialCenter } from "./TutorialCenter";
import { useTutorial } from "./TutorialContext";
import { TutorialProvider } from "./TutorialProvider";

const mockUser: SessionUser = {
  id: "test-user-42",
  username: "testoperator",
  display_name: "Opérateur Test",
  is_staff: false,
  roles: ["operator"],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
});

function TestHarness({
  activeScope = "dashboard",
  onNavigate = vi.fn(),
}: {
  activeScope?: any;
  onNavigate?: any;
}) {
  const { startTutorial, isOpen, activeTutorial, currentStepIndex } = useTutorial();

  return (
    <div>
      <div data-tutorial="dashboard-kpi-summary">Tableau de bord Synthèse</div>
      <div data-tutorial="dashboard-upcoming-events">Événements à venir</div>

      <button
        type="button"
        onClick={() => startTutorial("START")}
      >
        Lancer START
      </button>

      <button
        type="button"
        onClick={() => startTutorial("CONTRACT")}
      >
        Lancer CONTRACT
      </button>

      {isOpen && (
        <div data-testid="status-indicator">
          Active: {activeTutorial?.id} (Step {currentStepIndex})
        </div>
      )}

      <TutorialCenter />
    </div>
  );
}

describe("TutorialEngine", () => {
  it("mounts cleanly and provides tutorial state", async () => {
    render(
      <TutorialProvider user={mockUser} activeScope="dashboard">
        <TestHarness />
      </TutorialProvider>,
    );

    expect(screen.getByText("Apprendre à utiliser l’ERP")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Rechercher un module de tutoriel" })).toBeInTheDocument();
  });

  it("starts START tutorial and advances steps", async () => {
    const onNavigate = vi.fn();
    render(
      <TutorialProvider user={mockUser} activeScope="dashboard" onNavigate={onNavigate}>
        <TestHarness onNavigate={onNavigate} />
      </TutorialProvider>,
    );

    fireEvent.click(screen.getByText("Lancer START"));

    // Check panel appears
    expect(await screen.findByRole("complementary", { name: /Guide interactif : Bienvenue dans votre ERP/i })).toBeInTheDocument();
    expect(screen.getByText("Étape 1 sur 6")).toBeInTheDocument();

    // Advance to step 2
    fireEvent.click(screen.getByRole("button", { name: "Étape suivante" }));
    expect(await screen.findByText("Étape 2 sur 6")).toBeInTheDocument();
    expect(screen.getByText("Choisissez la bonne activité")).toBeInTheDocument();

    // Previous step works
    fireEvent.click(screen.getByRole("button", { name: "Étape précédente" }));
    expect(await screen.findByText("Étape 1 sur 6")).toBeInTheDocument();

    // Close button works
    fireEvent.click(screen.getByRole("button", { name: "Fermer le guide" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("renders and validates interactive exercises in CONTRACT tutorial", async () => {
    render(
      <TutorialProvider user={mockUser} activeScope="help">
        <TestHarness />
      </TutorialProvider>,
    );

    fireEvent.click(screen.getByText("Lancer CONTRACT"));

    expect(await screen.findByRole("complementary", { name: /Guide interactif : Du Proforma à la Confirmation/i })).toBeInTheDocument();
    expect(screen.getByText("Exercice — aucune donnée enregistrée dans vos dossiers")).toBeInTheDocument();

    // Continue button should be disabled initially until correct answer is chosen
    const continueBtn = screen.getByRole("button", { name: "Étape suivante" });
    expect(continueBtn).toBeDisabled();

    // Select incorrect answer
    fireEvent.click(screen.getByText("Oui, la date est désormais bloquée pour ce client."));
    expect(screen.getByText("Incorrect. Le proforma est un devis chiffré sans engagement ferme.")).toBeInTheDocument();
    expect(continueBtn).toBeDisabled();

    // Select correct answer
    fireEvent.click(screen.getByText("Non, le proforma est une simple estimation sans engagement ferme."));
    expect(screen.getByText("Exact ! Les créneaux restent libres tant que le contrat n'a pas été signé et consolidé.")).toBeInTheDocument();

    // Now button should be enabled
    expect(continueBtn).not.toBeDisabled();
    fireEvent.click(continueBtn);

    // Verify moved to step 2
    expect(await screen.findByText("Étape 2 sur 6")).toBeInTheDocument();
    expect(screen.getByText("Vérifiez la durée de validité")).toBeInTheDocument();
  });

  it("filters modules in TutorialCenter by keyword and category", async () => {
    render(
      <TutorialProvider user={mockUser} activeScope="help">
        <TestHarness />
      </TutorialProvider>,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Rechercher un module de tutoriel" });
    fireEvent.change(searchInput, { target: { value: "proforma" } });

    expect(screen.getByText("Du Proforma à la Confirmation")).toBeInTheDocument();
    expect(screen.queryByText("Bienvenue dans votre ERP")).not.toBeInTheDocument();

    // Reset search
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Bienvenue dans votre ERP")).toBeInTheDocument();

    // Filter category
    fireEvent.click(screen.getByRole("button", { name: "Découverte" }));
    expect(screen.getByText("Bienvenue dans votre ERP")).toBeInTheDocument();
    expect(screen.queryByText("Du Proforma à la Confirmation")).not.toBeInTheDocument();
  });

  it("supports resetting progress from TutorialCenter", async () => {
    render(
      <TutorialProvider user={mockUser} activeScope="help">
        <TestHarness />
      </TutorialProvider>,
    );

    fireEvent.click(screen.getByText("Réinitialiser ma progression"));
    expect(screen.getByRole("button", { name: "Confirmer la réinitialisation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmer la réinitialisation" }));
    expect(screen.queryByRole("button", { name: "Confirmer la réinitialisation" })).not.toBeInTheDocument();
  });
});
