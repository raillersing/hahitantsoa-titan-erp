import { useEffect, useState } from "react";
import { useTutorial } from "./TutorialContext";
import { TutorialExercise } from "./TutorialExercise";

export function TutorialPanel() {
  const {
    isOpen,
    activeTutorial,
    currentStepIndex,
    currentStep,
    targetElement,
    missingTargetMessage,
    nextStep,
    previousStep,
    closeTutorial,
  } = useTutorial();

  const [isWhyOpen, setIsWhyOpen] = useState(false);
  const [isExercisePassed, setIsExercisePassed] = useState(false);

  // Close tutorial on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeTutorial();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeTutorial]);

  if (!isOpen || !activeTutorial || !currentStep) {
    return null;
  }

  const totalSteps = activeTutorial.steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const requiresExercise =
    currentStep.completion === "exercise-answer" && Boolean(currentStep.exercise);
  const canProceed = !requiresExercise || isExercisePassed;

  const handleJumpToTarget = () => {
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      targetElement.focus?.();
    }
  };

  const getBadgeClass = () => {
    switch (activeTutorial.scope) {
      case "titan":
        return "erp-tutorial-badge erp-tutorial-badge--titan";
      case "hahitantsoa":
        return "erp-tutorial-badge erp-tutorial-badge--hahitantsoa";
      default:
        return "erp-tutorial-badge erp-tutorial-badge--shared";
    }
  };

  const getScopeLabel = () => {
    switch (activeTutorial.scope) {
      case "titan":
        return "Titan Rental";
      case "hahitantsoa":
        return "Hahitantsoa";
      default:
        return "Ergon ERP";
    }
  };

  const isCentered = !targetElement;

  return (
    <aside
      className={`erp-tutorial-panel-container ${
        isCentered ? "erp-tutorial-panel--centered" : ""
      }`}
      aria-label={`Guide interactif : ${activeTutorial.title}`}
    >
      <div className="erp-tutorial-panel">
        {/* Header */}
        <div className="erp-tutorial-panel__header">
          <div className="flex items-center gap-2">
            <span className={getBadgeClass()}>{getScopeLabel()}</span>
            <span className="erp-tutorial-step-counter">
              Étape {currentStepIndex + 1} sur {totalSteps}
            </span>
          </div>
          <button
            type="button"
            className="erp-tutorial-close-btn"
            onClick={closeTutorial}
            aria-label="Fermer le guide"
            title="Fermer le guide"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="erp-tutorial-panel__body" aria-live="polite">
          <h4 className="erp-tutorial-panel__title">{currentStep.title}</h4>
          <p className="erp-tutorial-panel__text">{currentStep.body}</p>

          {/* Missing target notice */}
          {missingTargetMessage && (
            <div
              className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200"
              role="status"
            >
              <i className="fa-solid fa-triangle-exclamation mr-1.5" />
              {missingTargetMessage}
            </div>
          )}

          {/* Why explanation accordion */}
          {currentStep.whyExplanation && (
            <div>
              <button
                type="button"
                className="erp-tutorial-why-toggle"
                onClick={() => setIsWhyOpen((prev) => !prev)}
                aria-expanded={isWhyOpen}
              >
                <i
                  className={`fa-solid ${
                    isWhyOpen ? "fa-chevron-down" : "fa-chevron-right"
                  }`}
                  aria-hidden="true"
                />
                <span>Pourquoi cette règle ?</span>
              </button>
              {isWhyOpen && (
                <div className="erp-tutorial-why-box mt-1">
                  {currentStep.whyExplanation}
                </div>
              )}
            </div>
          )}

          {/* Exercise container if present */}
          {currentStep.exercise && (
            <div className="pt-2">
              <TutorialExercise
                key={currentStep.id}
                data={currentStep.exercise}
                onSuccess={() => setIsExercisePassed(true)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="erp-tutorial-panel__footer">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="erp-tutorial-btn erp-tutorial-btn--secondary"
              onClick={previousStep}
              disabled={isFirstStep}
              aria-label="Étape précédente"
            >
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
              <span>Précédent</span>
            </button>

            {targetElement && (
              <button
                type="button"
                className="erp-tutorial-btn erp-tutorial-btn--target-jump"
                onClick={handleJumpToTarget}
                aria-label="Voir l'élément ciblé"
                title="Faire défiler jusqu'à l'élément ciblé"
              >
                <i className="fa-solid fa-crosshairs" aria-hidden="true" />
                <span className="hidden sm:inline">Cible</span>
              </button>
            )}
          </div>

          <button
            type="button"
            className="erp-tutorial-btn erp-tutorial-btn--primary"
            onClick={nextStep}
            disabled={!canProceed}
            aria-label={isLastStep ? "Terminer le module" : "Étape suivante"}
          >
            <span>{isLastStep ? "Terminer" : "Continuer"}</span>
            <i
              className={`fa-solid ${
                isLastStep ? "fa-check" : "fa-arrow-right"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
