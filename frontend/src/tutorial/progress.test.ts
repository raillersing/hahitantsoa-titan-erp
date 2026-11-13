import { beforeEach, describe, expect, it } from "vitest";
import {
  clearUserTutorialProgress,
  dismissInvitation,
  getTutorialStorageKey,
  loadUserTutorialProgress,
  saveUserTutorialProgress,
  updateModuleProgress,
} from "./progress";

describe("tutorial progress storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("generates user-scoped storage key", () => {
    expect(getTutorialStorageKey("user-123")).toBe("erp:tutorial:v1:user-123");
    expect(getTutorialStorageKey("  ")).toBe("erp:tutorial:v1:anonymous");
  });

  it("returns default progress for a new user", () => {
    const progress = loadUserTutorialProgress("user-alpha");
    expect(progress.schemaVersion).toBe(1);
    expect(progress.dismissedInvitation).toBe(false);
    expect(progress.neverShowInvitation).toBe(false);
    expect(progress.activeTutorialId).toBeNull();
    expect(progress.modules).toEqual({});
  });

  it("persists progress across reads for the same user", () => {
    updateModuleProgress("user-alpha", "START", 1, "start-welcome", 0, "in_progress");
    const progress = loadUserTutorialProgress("user-alpha");

    expect(progress.activeTutorialId).toBe("START");
    expect(progress.activeStepIndex).toBe(0);
    expect(progress.modules["START"]).toBeDefined();
    expect(progress.modules["START"]?.status).toBe("in_progress");
    expect(progress.modules["START"]?.stepId).toBe("start-welcome");
  });

  it("isolates data between different users", () => {
    updateModuleProgress("user-1", "START", 1, "start-brand-choice", 1, "in_progress");
    updateModuleProgress("user-2", "CONTRACT", 1, "contract-proforma", 0, "viewed");

    const p1 = loadUserTutorialProgress("user-1");
    const p2 = loadUserTutorialProgress("user-2");

    expect(p1.modules["START"]?.status).toBe("in_progress");
    expect(p1.modules["CONTRACT"]).toBeUndefined();

    expect(p2.modules["CONTRACT"]?.status).toBe("viewed");
    expect(p2.modules["START"]).toBeUndefined();
  });

  it("ignores unregistered modules and mismatched step identities", () => {
    const key = getTutorialStorageKey("user-invalid");
    const record = { contentVersion: 1, stepId: "not-a-step", stepIndex: 0, status: "viewed", updatedAt: "now" };
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, modules: { START: record, FAKE: record } }));
    expect(loadUserTutorialProgress("user-invalid").modules).toEqual({});
  });

  it("does not preserve viewed status across newer content versions", () => {
    updateModuleProgress("user-version", "START", 1, "start-welcome", 0, "viewed");
    updateModuleProgress("user-version", "START", 2, "start-welcome", 0, "in_progress");
    expect(loadUserTutorialProgress("user-version").modules.START.status).toBe("in_progress");
  });

  it("handles corrupted localStorage gracefully without throwing", () => {
    const key = getTutorialStorageKey("user-corrupt");
    window.localStorage.setItem(key, "NOT_JSON{{{");

    const progress = loadUserTutorialProgress("user-corrupt");
    expect(progress.schemaVersion).toBe(1);
    expect(progress.modules).toEqual({});
  });

  it("handles schema mismatch by resetting safely", () => {
    const key = getTutorialStorageKey("user-old-schema");
    window.localStorage.setItem(
      key,
      JSON.stringify({ schemaVersion: 999, modules: { START: { status: "viewed" } } }),
    );

    const progress = loadUserTutorialProgress("user-old-schema");
    expect(progress.schemaVersion).toBe(1);
    expect(progress.modules).toEqual({});
  });

  it("dismisses invitation temporarily or permanently", () => {
    dismissInvitation("user-inv", false);
    let p = loadUserTutorialProgress("user-inv");
    expect(p.dismissedInvitation).toBe(true);
    expect(p.neverShowInvitation).toBe(false);

    dismissInvitation("user-inv", true);
    p = loadUserTutorialProgress("user-inv");
    expect(p.dismissedInvitation).toBe(true);
    expect(p.neverShowInvitation).toBe(true);
  });

  it("clears user progress cleanly", () => {
    updateModuleProgress("user-del", "START", 1, "start-welcome", 0, "viewed");
    clearUserTutorialProgress("user-del");

    const p = loadUserTutorialProgress("user-del");
    expect(p.modules).toEqual({});
  });
});
