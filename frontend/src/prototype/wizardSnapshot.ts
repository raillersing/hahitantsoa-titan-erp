const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (): never => { throw new Error("Ce parcours enregistré contient des champs incompatibles. Vos saisies actuelles sont conservées. Choisissez un autre parcours ou le secours local."); };

// Validate before any setter: a private server snapshot is still external input.
export function validateWizardSnapshot(value: unknown, expectedStep?: number): void {
  if (!record(value)) fail();
  const state = value as Record<string, unknown>;
  for (const key of ["step", "maxReachedStep"]) {
    if (state[key] !== undefined && (!Number.isInteger(state[key]) || Number(state[key]) < 0 || Number(state[key]) > 9)) fail();
  }
  if (expectedStep !== undefined && state.step !== expectedStep) fail();
  for (const key of ["path", "clientMode", "selectedClientId", "domain", "documentReference", "issuedProspectProformaId", "customerCreationKey", "depositRecordingKey", "routeParam", "customPublicReference", "discountReason", "deliveryFee"]) {
    if (state[key] != null && typeof state[key] !== "string") fail();
  }
  for (const key of ["isEditingClient", "proformaGenerated", "deliveryModifiedManually", "returnModifiedManually", "useCustomReference", "discountIsPercentage"]) {
    if (state[key] !== undefined && typeof state[key] !== "boolean") fail();
  }
  for (const key of ["discountValue", "proformaValidity"]) if (state[key] !== undefined && (typeof state[key] !== "number" || !Number.isFinite(state[key]))) fail();
  for (const key of ["newClient", "hDetails", "tDetails", "payment", "lastCalculatedDelivery", "lastCalculatedReturn"]) {
    if (state[key] === undefined) continue;
    if (!record(state[key])) fail();
    for (const [field, content] of Object.entries(state[key] as Record<string, unknown>)) {
      if (["additionalEmails", "additionalPhones"].includes(field)) {
        if (!Array.isArray(content) || content.some(item => typeof item !== "string")) fail();
      } else if (field === "bareRentalComposition") {
        if (!Array.isArray(content) || content.some(item => !record(item) || typeof item.label !== "string" || !Number.isInteger(item.quantity))) fail();
      } else if (["venuePrice", "logisticsPrice", "advanceRate"].includes(field)) {
        if (typeof content !== "number" || !Number.isFinite(content)) fail();
      } else if (content !== undefined && typeof content !== "string") fail();
    }
  }
  const attachments = (rows: unknown) => {
    if (!Array.isArray(rows) || rows.some(row => !record(row) || ["id", "name", "category"].some(key => typeof row[key] !== "string") || (row.label !== undefined && typeof row.label !== "string") || (row.uploadedId !== undefined && typeof row.uploadedId !== "string"))) fail();
  };
  for (const key of ["clientAttachments", "paymentAttachments"]) if (state[key] !== undefined) attachments(state[key]);
  if (state.dedicatedAttachments !== undefined) {
    if (!record(state.dedicatedAttachments)) fail();
    for (const pages of Object.values(state.dedicatedAttachments as Record<string, unknown>)) attachments(Array.isArray(pages) ? pages : [pages]);
  }
  for (const key of ["selectedMaterials", "selectedServices", "recordedPayments"]) {
    if (state[key] === undefined) continue;
    if (!Array.isArray(state[key])) fail();
    for (const row of state[key] as unknown[]) {
      if (!record(row) || typeof row.id !== "string") fail();
      const item = row as Record<string, unknown>;
      if (key === "recordedPayments") {
        if (typeof item.amount !== "number" || !Number.isFinite(item.amount) || typeof item.method !== "string") fail();
      } else if (typeof item.name !== "string" || typeof item.price !== "number" || !Number.isFinite(item.price) || (key === "selectedMaterials" && typeof item.quantity !== "number") || (item.quantity !== undefined && (typeof item.quantity !== "number" || !Number.isFinite(item.quantity)))) fail();
    }
  }
  for (const key of ["editingDraftContext", "prospectProformaEmission"]) {
    if (state[key] == null) continue;
    if (!record(state[key])) fail();
    for (const [field, content] of Object.entries(state[key] as Record<string, unknown>)) {
      if (["isEditing", "loading", "htmlGenerated", "documentPdfGenerated", "needsRevision"].includes(field)) { if (typeof content !== "boolean") fail(); }
      else if (["requiredDepositAmount"].includes(field)) { if (typeof content !== "number" || !Number.isFinite(content)) fail(); }
      else if (content != null && typeof content !== "string") fail();
    }
  }
}
