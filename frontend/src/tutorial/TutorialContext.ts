import { createContext, useContext } from "react";
import type { TutorialContextValue } from "./types";

export const TutorialContext = createContext<TutorialContextValue | null>(null);

const defaultFallback: TutorialContextValue = {
  lifecycleState: "idle",
  isOpen: false,
  activeTutorial: null,
  currentStepIndex: 0,
  currentStep: null,
  isInvitationVisible: false,
  targetElement: null,
  isTargetSearching: false,
  missingTargetMessage: null,
  startTutorial: () => {},
  nextStep: () => {},
  previousStep: () => {},
  closeTutorial: () => {},
  pauseTutorial: () => {},
  resumeTutorial: () => {},
  dismissInvitation: () => {},
  getModuleProgress: () => undefined,
  resetAllProgress: () => {},
};

export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);
  return context ?? defaultFallback;
}
