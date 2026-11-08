import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SessionUser } from "../api";
import type { AppScope } from "../app-routes";
import { getTutorialById } from "./catalog";
import {
  clearUserTutorialProgress,
  dismissInvitation as saveDismissInvitation,
  loadUserTutorialProgress,
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
  const userId = user?.id || "";

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

  const isOpen = Boolean(activeTutorial && lifecycleState !== "idle");

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

      if (el) {
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
        if (currentStep.missingTarget === "explain") {
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
      if (!tut) return;

      setActiveTutorialId(tutorialId);
      const safeIndex =
        fromStepIndex >= 0 && fromStepIndex < tut.steps.length
          ? fromStepIndex
          : 0;
      setCurrentStepIndex(safeIndex);
      setLifecycleState("navigating");

      // Check if first step requires route navigation
      const firstStep = tut.steps[safeIndex];
      if (firstStep?.route && onNavigate && activeScope !== firstStep.route) {
        onNavigate(firstStep.route, firstStep.routeParam);
      }

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
    [userId, onNavigate, activeScope],
  );

  const nextStep = useCallback(() => {
    if (!activeTutorial) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeTutorial.steps.length) {
      const nextStepDef = activeTutorial.steps[nextIndex];
      setCurrentStepIndex(nextIndex);
      setLifecycleState("navigating");

      if (
        nextStepDef.route &&
        onNavigate &&
        activeScope !== nextStepDef.route
      ) {
        onNavigate(nextStepDef.route, nextStepDef.routeParam);
      }

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

    if (
      prevStepDef.route &&
      onNavigate &&
      activeScope !== prevStepDef.route
    ) {
      onNavigate(prevStepDef.route, prevStepDef.routeParam);
    }

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
      <TutorialPanel />
    </TutorialContext.Provider>
  );
}
