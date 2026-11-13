import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SessionUser } from "../api";
import type { AppScope } from "../app-routes";
import { getTutorialById } from "./catalog";
import {
  clearUserTutorialProgress,
  dismissInvitation as saveDismissInvitation,
  loadUserTutorialProgress,
  isTutorialStorageUnavailable,
  updateModuleProgress,
} from "./progress";
import { TutorialContext } from "./TutorialContext";
import { TutorialPanel } from "./TutorialPanel";
import type {
  ModuleProgressRecord,
  TutorialContextValue,
  TutorialDefinition,
  TutorialLifecycleState,
  TutorialStep,
  UserTutorialStorage,
} from "./types";
import "./tutorial.css";

interface TutorialProviderProps {
  user?: SessionUser | null;
  activeScope?: AppScope;
  onNavigate?: (scope: any, param?: string) => void;
  children: React.ReactNode;
}

export function TutorialProvider({
  user,
  activeScope,
  onNavigate,
  children,
}: TutorialProviderProps) {
  const userId = user?.id !== undefined && user?.id !== null ? String(user.id) : "";

  // Capabilities are provided by the session; absent capabilities fail closed.
  const canAccessTutorial = useCallback((id: string) => {
    if (!user) return false;
    const required: Record<string, string | string[]> = {
      ADMIN: "canManageIdentity",
      SETTINGS: ["canSensitiveWrite", "canManageIdentity"],
      HR: "canViewPayroll",
      PAYMENT: "canManageFinance", CASH: "canOperateCashbox",
      PREP: "canOperateLogistics", DELIVERY: "canOperateLogistics", RETURN: "canOperateLogistics",
      SETS: "canManageInventory", IMPORT: "canManageInventory", BUY: "canManageFinance",
      "HAH-NEW": "canSensitiveWrite", "TIT-NEW": "canSensitiveWrite",
      AMEND: "canSensitiveWrite", CLOSE: "canSensitiveWrite",
    };
    const capability = required[id];
    if (!capability) return true;
    if (Array.isArray(capability)) {
      return capability.some((cap) => user.capabilities?.[cap] === true);
    }
    return user.capabilities?.[capability] === true;
  }, [user]);

  const [progress, setProgress] = useState<UserTutorialStorage>(() =>
    loadUserTutorialProgress(userId),
  );

  const [lifecycleState, setLifecycleState] =
    useState<TutorialLifecycleState>("idle");
  const [activeTutorialId, setActiveTutorialId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [isTargetSearching, setIsTargetSearching] = useState<boolean>(false);
  const [missingTargetMessage, setMissingTargetMessage] = useState<string | null>(
    null,
  );

  const [sessionDismissedInvitation, setSessionDismissedInvitation] = useState<boolean>(false);

  // Reload progress when user identity changes
  useEffect(() => {
    setProgress(loadUserTutorialProgress(userId));
    setActiveTutorialId(null);
    setCurrentStepIndex(0);
    setLifecycleState("idle");
    setTargetElement(null);
    setSessionDismissedInvitation(false);
  }, [userId]);

  const activeTutorial: TutorialDefinition | null = activeTutorialId
    ? getTutorialById(activeTutorialId) || null
    : null;

  const currentStep: TutorialStep | null =
    activeTutorial && activeTutorial.steps[currentStepIndex]
      ? activeTutorial.steps[currentStepIndex]
      : null;

  const isOpen = Boolean(activeTutorial && lifecycleState !== "idle" && lifecycleState !== "paused");

  useEffect(() => {
    if (activeTutorialId && !canAccessTutorial(activeTutorialId)) {
      setActiveTutorialId(null);
      setLifecycleState("idle");
    }
  }, [activeTutorialId, canAccessTutorial]);

  // Highlight management
  const previousTargetRef = useRef<HTMLElement | null>(null);

  const clearHighlight = useCallback(() => {
    if (previousTargetRef.current) {
      previousTargetRef.current.classList.remove(
        "erp-tutorial-highlight",
        "erp-tutorial-highlight--titan",
        "erp-tutorial-highlight--hahitantsoa",
      );
      previousTargetRef.current = null;
    }
    setTargetElement(null);
  }, []);

  const applyHighlight = useCallback(
    (el: HTMLElement, scope: TutorialDefinition["scope"]) => {
      clearHighlight();
      el.classList.add("erp-tutorial-highlight");
      if (scope === "titan") {
        el.classList.add("erp-tutorial-highlight--titan");
      } else if (scope === "hahitantsoa") {
        el.classList.add("erp-tutorial-highlight--hahitantsoa");
      }
      previousTargetRef.current = el;
      setTargetElement(el);
    },
    [clearHighlight],
  );

  // Search and bind DOM target element for current step
  useEffect(() => {
    if (!isOpen || !currentStep || !activeTutorial) {
      clearHighlight();
      return;
    }

    setMissingTargetMessage(null);

    // If step has no DOM target (e.g. exercise or conceptual step), no highlight needed
    if (!currentStep.target) {
      clearHighlight();
      setLifecycleState("showing");
      return;
    }

    if (currentStep.route && activeScope !== currentStep.route) {
      clearHighlight();
      setIsTargetSearching(false);
      const labels: Partial<Record<AppScope, string>> = {
        dashboard: "Tableau de bord", help: "Aide", customers: "Clients", customer: "Fiche client",
        planning: "Planning", reservations: "Réservations", "reservation-new": "Nouvelle réservation",
        "reservation-detail": "Détail de réservation", hahitantsoa: "Hahitantsoa", titan: "Titan",
        "commercial-ops": "Opérations commerciales", documents: "Documents", cashbox: "Caisse",
        inventory: "Inventaire", "inventory-management": "Gestion de l’inventaire", packages: "Ensembles",
        "stock-preparation": "Préparation", "logistics-dispatch": "Expéditions",
        "logistics-returns": "Retours", "breakage-loss": "Casse et perte",
        "bank-settings": "Paramètres bancaires", "hahitantsoa-settings": "Conditions Hahitantsoa",
        "agenda-visitors": "Agenda visiteurs", "desired-dates": "Dates souhaitées",
        "blacklist-intervenants": "Intervenants bloqués", "import-excel": "Import Excel",
        "hr-payroll": "RH et paie", hr: "RH", purchasing: "Achats", procurement: "Achats",
        services: "Services", venues: "Espaces", admin: "Administration", reports: "Rapports",
        notifications: "Notifications", profile: "Profil", "user-manual": "Manuel utilisateur",
      };
      setMissingTargetMessage(`Pour voir cet élément, ouvrez « ${labels[currentStep.route] ?? currentStep.route} » depuis le menu. Votre page actuelle reste ouverte.`);
      setLifecycleState("showing");
      return;
    }
    const targetKey = currentStep.target;
    setIsTargetSearching(true);
    setLifecycleState("waiting-target");

    let isCancelled = false;
    let attempts = 0;
    const maxAttempts = 20; // 20 * 200ms = 4 seconds timeout

    const checkTarget = () => {
      if (isCancelled) return;

      const el = document.querySelector<HTMLElement>(
        `[data-tutorial="${targetKey}"]`,
      );

      if (el && document.querySelectorAll(`[data-tutorial="${targetKey}"]`).length === 1 && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0)) {
        setIsTargetSearching(false);
        applyHighlight(el, activeTutorial.scope);
        setLifecycleState("showing");
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        setIsTargetSearching(false);
        clearHighlight();
        setLifecycleState("showing");
        if (currentStep.missingTarget === "pause") {
          setMissingTargetMessage("Cet élément est indisponible. Fermez le guide et réessayez lorsque la page est prête.");
        } else {
          setMissingTargetMessage(
            "Cet élément n'est pas affiché sur l'écran actuel (droits ou vue différente). Lisez l'explication et poursuivez.",
          );
        }
      } else {
        setTimeout(checkTarget, 200);
      }
    };

    checkTarget();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, currentStep, activeTutorial, activeScope, applyHighlight, clearHighlight]);

  // Clean highlight on unmount
  useEffect(() => {
    return () => {
      clearHighlight();
    };
  }, [clearHighlight]);

  // Actions
  const startTutorial = useCallback(
    (tutorialId: string, fromStepIndex = 0) => {
      const tut = getTutorialById(tutorialId);
      if (!tut || !canAccessTutorial(tutorialId)) return;

      setActiveTutorialId(tutorialId);
      const safeIndex =
        fromStepIndex >= 0 && fromStepIndex < tut.steps.length
          ? fromStepIndex
          : 0;
      setCurrentStepIndex(safeIndex);
      setLifecycleState("navigating");

      // Check if first step requires route navigation
      const firstStep = tut.steps[safeIndex];
      // Navigation remains under the user's control so in-progress forms are not abandoned.

      const updated = updateModuleProgress(
        userId,
        tutorialId,
        tut.version,
        firstStep?.id || "step-0",
        safeIndex,
        "in_progress",
      );
      setProgress(updated);
    },
    [userId, onNavigate, activeScope, canAccessTutorial],
  );

  const nextStep = useCallback(() => {
    if (!activeTutorial) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeTutorial.steps.length) {
      const nextStepDef = activeTutorial.steps[nextIndex];
      setCurrentStepIndex(nextIndex);
      setLifecycleState("navigating");



      const updated = updateModuleProgress(
        userId,
        activeTutorial.id,
        activeTutorial.version,
        nextStepDef.id,
        nextIndex,
        "in_progress",
      );
      setProgress(updated);
    } else {
      // Completed last step
      const updated = updateModuleProgress(
        userId,
        activeTutorial.id,
        activeTutorial.version,
        currentStep?.id || "complete",
        currentStepIndex,
        "viewed",
      );
      setProgress(updated);
      clearHighlight();
      setActiveTutorialId(null);
      setCurrentStepIndex(0);
      setLifecycleState("completed");
    }
  }, [
    activeTutorial,
    currentStepIndex,
    currentStep,
    userId,
    onNavigate,
    activeScope,
    clearHighlight,
  ]);

  const previousStep = useCallback(() => {
    if (!activeTutorial || currentStepIndex <= 0) return;

    const prevIndex = currentStepIndex - 1;
    const prevStepDef = activeTutorial.steps[prevIndex];
    setCurrentStepIndex(prevIndex);
    setLifecycleState("navigating");



    const updated = updateModuleProgress(
      userId,
      activeTutorial.id,
      activeTutorial.version,
      prevStepDef.id,
      prevIndex,
      "in_progress",
    );
    setProgress(updated);
  }, [activeTutorial, currentStepIndex, userId, onNavigate, activeScope]);

  const closeTutorial = useCallback(() => {
    clearHighlight();
    setActiveTutorialId(null);
    setCurrentStepIndex(0);
    setLifecycleState("idle");
  }, [clearHighlight]);

  const pauseTutorial = useCallback(() => {
    clearHighlight();
    setLifecycleState("paused");
  }, [clearHighlight]);

  const resumeTutorial = useCallback(() => {
    if (activeTutorial) {
      setLifecycleState("waiting-target");
    }
  }, [activeTutorial]);

  const dismissInvitationAction = useCallback(
    (neverAgain = false) => {
      setSessionDismissedInvitation(true);
      if (neverAgain) {
        const updated = saveDismissInvitation(userId, true);
        setProgress(updated);
      }
    },
    [userId],
  );

  const getModuleProgress = useCallback(
    (tutorialId: string): ModuleProgressRecord | undefined => {
      return progress.modules[tutorialId];
    },
    [progress],
  );

  const resetAllProgress = useCallback(() => {
    clearUserTutorialProgress(userId);
    setSessionDismissedInvitation(false);
    setProgress(loadUserTutorialProgress(userId));
    closeTutorial();
  }, [userId, closeTutorial]);

  const isInvitationVisible = Boolean(
    user &&
      !sessionDismissedInvitation &&
      !progress.neverShowInvitation &&
      !isOpen,
  );

  const contextValue: TutorialContextValue = {
    lifecycleState,
    canAccessTutorial,
    storageUnavailable: Boolean(userId && isTutorialStorageUnavailable(userId)),
    isOpen,
    activeTutorial,
    currentStepIndex,
    currentStep,
    isInvitationVisible,
    targetElement,
    isTargetSearching,
    missingTargetMessage,
    startTutorial,
    nextStep,
    previousStep,
    closeTutorial,
    pauseTutorial,
    resumeTutorial,
    dismissInvitation: dismissInvitationAction,
    getModuleProgress,
    resetAllProgress,
  };

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}
      {(() => {
        const panel = <TutorialPanel key={`${activeTutorialId ?? "closed"}:${currentStepIndex}`} />;
        const slot = document.getElementById("tutorial-panel-slot");
        return slot ? createPortal(panel, slot) : panel;
      })()}
    </TutorialContext.Provider>
  );
}
