/**
 * Local storage management for user tutorial progression.
 * Scoped by authenticated user id: erp:tutorial:v1:<user-id>.
 * Fallbacks gracefully to in-memory storage if localStorage is unavailable.
 */

import { getTutorialById } from "./catalog";

import type {
  ModuleProgressRecord,
  ModuleProgressStatus,
  UserTutorialStorage,
} from "./types";

export const TUTORIAL_STORAGE_SCHEMA_VERSION = 1;
export const TUTORIAL_CATALOG_VERSION = 1;

const inMemoryStore = new Map<string, UserTutorialStorage>();
const storageUnavailable = new Set<string>();

export function isTutorialStorageUnavailable(userId: string): boolean {
  return storageUnavailable.has(getTutorialStorageKey(userId));
}

export function getTutorialStorageKey(userId: string | number): string {
  const strId = String(userId ?? "").trim();
  const safeId = strId ? encodeURIComponent(strId) : "anonymous";
  return `erp:tutorial:v1:${safeId}`;
}

export function createDefaultProgress(): UserTutorialStorage {
  return {
    schemaVersion: TUTORIAL_STORAGE_SCHEMA_VERSION,
    catalogVersion: TUTORIAL_CATALOG_VERSION,
    dismissedInvitation: false,
    neverShowInvitation: false,
    activeTutorialId: null,
    activeStepIndex: 0,
    modules: {},
  };
}

function isValidProgressRecord(rec: unknown): rec is ModuleProgressRecord {
  if (!rec || typeof rec !== "object") return false;
  const r = rec as Record<string, unknown>;
  const validStatus: ModuleProgressStatus[] = ["not_started", "in_progress", "viewed"];
  return (
    typeof r.contentVersion === "number" &&
    typeof r.stepId === "string" &&
    typeof r.stepIndex === "number" &&
    validStatus.includes(r.status as ModuleProgressStatus) &&
    typeof r.updatedAt === "string"
  );
}

function parseAndValidateStorage(raw: string): UserTutorialStorage | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    if (parsed.schemaVersion !== TUTORIAL_STORAGE_SCHEMA_VERSION) {
      return null;
    }

    const modules: Record<string, ModuleProgressRecord> = {};
    if (parsed.modules && typeof parsed.modules === "object") {
      for (const [key, val] of Object.entries(parsed.modules)) {
        const tutorial = getTutorialById(key);
        if (tutorial && isValidProgressRecord(val) && Number.isInteger(val.stepIndex) &&
            val.stepIndex >= 0 && val.stepIndex < tutorial.steps.length &&
            tutorial.steps[val.stepIndex].id === val.stepId) {
          modules[key] = val;
        }
      }
    }

    return {
      schemaVersion: TUTORIAL_STORAGE_SCHEMA_VERSION,
      catalogVersion: typeof parsed.catalogVersion === "number" ? parsed.catalogVersion : TUTORIAL_CATALOG_VERSION,
      dismissedInvitation: Boolean(parsed.dismissedInvitation),
      neverShowInvitation: Boolean(parsed.neverShowInvitation),
      activeTutorialId: typeof parsed.activeTutorialId === "string" && modules[parsed.activeTutorialId] ? parsed.activeTutorialId : null,
      activeStepIndex: typeof parsed.activeTutorialId === "string" && modules[parsed.activeTutorialId] ? modules[parsed.activeTutorialId].stepIndex : 0,
      modules,
    };
  } catch {
    return null;
  }
}

export function loadUserTutorialProgress(userId: string): UserTutorialStorage {
  if (!userId) {
    return createDefaultProgress();
  }

  const key = getTutorialStorageKey(userId);

  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const validated = parseAndValidateStorage(raw);
      if (validated) {
        return validated;
      }
    }
  } catch {
    storageUnavailable.add(key);
  }

  const memory = inMemoryStore.get(key);
  if (memory) {
    return memory;
  }

  const def = createDefaultProgress();
  inMemoryStore.set(key, def);
  return def;
}

export function saveUserTutorialProgress(
  userId: string,
  progress: UserTutorialStorage,
): void {
  if (!userId) return;

  const key = getTutorialStorageKey(userId);
  inMemoryStore.set(key, progress);

  try {
    window.localStorage.setItem(key, JSON.stringify(progress));
    storageUnavailable.delete(key);
  } catch {
    storageUnavailable.add(key);
  }
}

export function updateModuleProgress(
  userId: string,
  tutorialId: string,
  contentVersion: number,
  stepId: string,
  stepIndex: number,
  status: ModuleProgressStatus,
): UserTutorialStorage {
  const current = loadUserTutorialProgress(userId);
  const now = new Date().toISOString();

  const existing = current.modules[tutorialId];
  // Retain 'viewed' status if already viewed unless explicitly reset
  const effectiveStatus = existing?.contentVersion === contentVersion && existing.status === "viewed" && status === "in_progress"
    ? "viewed"
    : status;

  const updated: UserTutorialStorage = {
    ...current,
    activeTutorialId: status === "viewed" ? null : tutorialId,
    activeStepIndex: status === "viewed" ? 0 : stepIndex,
    modules: {
      ...current.modules,
      [tutorialId]: {
        contentVersion,
        stepId,
        stepIndex,
        status: effectiveStatus,
        updatedAt: now,
      },
    },
  };

  saveUserTutorialProgress(userId, updated);
  return updated;
}

export function dismissInvitation(
  userId: string,
  neverAgain = false,
): UserTutorialStorage {
  const current = loadUserTutorialProgress(userId);
  const updated: UserTutorialStorage = {
    ...current,
    dismissedInvitation: true,
    neverShowInvitation: neverAgain ? true : current.neverShowInvitation,
  };
  saveUserTutorialProgress(userId, updated);
  return updated;
}

export function clearUserTutorialProgress(userId: string): void {
  if (!userId) return;
  const key = getTutorialStorageKey(userId);
  inMemoryStore.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignored
  }
}

export function clearAllTutorialStorage(): void {
  inMemoryStore.clear();
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith("erp:tutorial:v1:")) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignored
  }
}
