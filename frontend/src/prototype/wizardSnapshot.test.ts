import { describe, expect, it } from "vitest";
import { validateWizardSnapshot } from "./wizardSnapshot";
describe("wizard snapshot boundary", () => {
  it("accepts incomplete dates as text for correction without manufacturing dates", () => {
    expect(() => validateWizardSnapshot({ step: 3, hDetails: { startDate: "2026-11-", endDate: "" }, selectedMaterials: [] }, 3)).not.toThrow();
  });
  it.each([
    { selectedMaterials: [null] }, { selectedServices: [{}] }, { hDetails: { startDate: {} } },
    { step: "x" }, { step: 10 }, { clientAttachments: [null] }, { newClient: { name: [] } },
    { payment: null }, { dedicatedAttachments: { CIN: null } },
  ])("rejects incompatible values before changing any form state: %j", state => {
    expect(() => validateWizardSnapshot(state)).toThrow("saisies actuelles sont conservées");
  });
  it("rejects inconsistent metadata instead of silently moving to an unvalidated step", () => {
    expect(() => validateWizardSnapshot({ step: 8 }, 3)).toThrow();
  });
  it("accepts the legacy dedicated attachment object that restoration migrates to an array", () => {
    expect(() => validateWizardSnapshot({ dedicatedAttachments: { CIN: { id: "x", name: "cin.pdf", category: "CIN" } } })).not.toThrow();
  });
});
