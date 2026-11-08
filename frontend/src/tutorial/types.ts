/**
 * Types and closed contracts for the ERP interactive tutorial system.
 * Zero external dependencies.
 */

import type { AppScope } from "../app-routes";
import type { FrontendCapabilities } from "../capabilities";

export type TutorialMode = "live-readonly" | "exercise";
export type TutorialDomainScope = "shared" | "titan" | "hahitantsoa";

export type TutorialStepCompletion = "continue" | "route-ready" | "exercise-answer";
export type TutorialMissingTargetAction = "explain" | "pause";

export interface TutorialExerciseChoice {
  id: string;
  label: string;
  isCorrect: boolean;
  explanation: string;
}

export interface TutorialExerciseData {
  kind: "multiple-choice" | "sequence-order";
  question: string;
  choices: readonly TutorialExerciseChoice[];
  correctSequenceIds?: readonly string[];
}

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  whyExplanation?: string;
  target?: string; // Value of data-tutorial on target element
  route?: AppScope; // Expected route for this step
  routeParam?: string;
  completion: TutorialStepCompletion;
  missingTarget: TutorialMissingTargetAction;
  exercise?: TutorialExerciseData;
}

export interface TutorialDefinition {
  id: string;
  version: number;
  title: string;
  shortDescription: string;
  category: "discovery" | "daily" | "advanced";
  durationMinutes: number;
  mode: TutorialMode;
  scope: TutorialDomainScope;
  associatedScopes?: readonly AppScope[];
  requiredCapability?: keyof FrontendCapabilities;
  prerequisites?: readonly string[];
  steps: readonly TutorialStep[];
}

export type ModuleProgressStatus = "not_started" | "in_progress" | "viewed";

export interface ModuleProgressRecord {
  contentVersion: number;
  stepId: string;
  stepIndex: number;
  status: ModuleProgressStatus;
  updatedAt: string;
}

export interface UserTutorialStorage {
  schemaVersion: number;
  catalogVersion: number;
  dismissedInvitation: boolean;
  neverShowInvitation: boolean;
  activeTutorialId: string | null;
  activeStepIndex: number;
  modules: Record<string, ModuleProgressRecord>;
}

export type TutorialLifecycleState =
  | "idle"
  | "choosing"
  | "navigating"
  | "waiting-target"
  | "showing"
  | "completed"
  | "paused"
  | "error";

export interface TutorialContextValue {
  lifecycleState: TutorialLifecycleState;
  isOpen: boolean;
  activeTutorial: TutorialDefinition | null;
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  isInvitationVisible: boolean;
  targetElement: HTMLElement | null;
  isTargetSearching: boolean;
  missingTargetMessage: string | null;
  startTutorial: (tutorialId: string, fromStepIndex?: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  closeTutorial: () => void;
  pauseTutorial: () => void;
  resumeTutorial: () => void;
  dismissInvitation: (neverAgain?: boolean) => void;
  getModuleProgress: (tutorialId: string) => ModuleProgressRecord | undefined;
  resetAllProgress: () => void;
}
