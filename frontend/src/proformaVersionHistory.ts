import type { DocumentInstance } from "./types";

export type ProformaVersionStatusCode =
  | "draft"              // Brouillon / devis préliminaire (avant confirmation)
  | "official_contract"  // Version officielle confirmée par contrat initial
  | "pending_amendment"  // Modification post-contrat, en attente de confirmation d'avenant
  | "official_amendment" // Version officielle confirmée par un avenant
  | "archived"           // Version officielle antérieure remplacée par un avenant ultérieur
  | "voided";            // Proforma annulé

export type ProformaVersionItem = {
  id: string;
  versionNumber: number; // 1, 2, 3...
  versionLabel: string;  // "v1", "v2", "v3"...
  reference: string;     // invariant reference, e.g. "HAH-2026-0001-PF"
  statusCode: ProformaVersionStatusCode;
  statusLabel: string;
  isOfficial: boolean;   // true if this is the currently active official version
  createdAt: string;
  preparedBy?: string;
  notes?: string;
  amendmentSequence?: number | null;
  instance: DocumentInstance;
};

export type ProformaHistorySummary = {
  reference: string;
  versions: ProformaVersionItem[]; // chronological: v1, v2, v3...
  currentOfficialVersion: ProformaVersionItem | null;
  latestVersion: ProformaVersionItem | null;
  hasPendingAmendment: boolean;
  totalVersionsCount: number;
};

export type AmendmentRecord = {
  amendment_sequence?: number | null;
  applied_at?: string | null;
  created_at?: string;
  status?: string;
};

export type BuildProformaHistoryParams = {
  documentInstances: DocumentInstance[];
  isConfirmed: boolean;
  confirmedAt?: string | null;
  amendments?: AmendmentRecord[];
  publicReference?: string;
  defaultReferencePrefix?: string;
};

/**
 * Filter, sort, and classify all proforma instances for a reservation/event draft
 * without changing the proforma reference number across revisions.
 */
export function buildProformaVersionHistory({
  documentInstances,
  isConfirmed,
  confirmedAt,
  amendments = [],
  publicReference = "",
  defaultReferencePrefix = "PF",
}: BuildProformaHistoryParams): ProformaHistorySummary {
  // 1. Filter all document instances that represent a proforma
  const proformaDocs = (documentInstances || []).filter(
    (di) =>
      di.document_type?.toLowerCase() === "proforma" ||
      di.template_key?.toLowerCase().includes("proforma"),
  );

  // 2. Sort chronologically (oldest first) to establish stable versions v1, v2, v3...
  proformaDocs.sort((a, b) => {
    const timeA = new Date(a.created_at || a.prepared_at || 0).getTime();
    const timeB = new Date(b.created_at || b.prepared_at || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });

  // Base proforma reference (remains invariant across all versions)
  const canonicalReference =
    proformaDocs.find((d) => Boolean(d.document_reference))?.document_reference ||
    (publicReference ? `${publicReference}-${defaultReferencePrefix}` : "PF");

  if (proformaDocs.length === 0) {
    return {
      reference: canonicalReference,
      versions: [],
      currentOfficialVersion: null,
      latestVersion: null,
      hasPendingAmendment: false,
      totalVersionsCount: 0,
    };
  }

  // Active confirmed amendments (sorted by sequence ascending)
  const confirmedAmendments = amendments
    .filter((a) => a.applied_at || a.status === "applied" || a.status === "confirmed")
    .sort((a, b) => (a.amendment_sequence || 0) - (b.amendment_sequence || 0));

  const maxConfirmedAmendmentSequence =
    confirmedAmendments.length > 0
      ? Math.max(...confirmedAmendments.map((a) => a.amendment_sequence || 0))
      : 0;

  // 3. Classify each version
  const items: ProformaVersionItem[] = [];

  // Determine the index of the proforma version confirmed by the initial contract
  // It is the latest non-voided proforma created before or at confirmation,
  // or before any post-confirmation amendment was started.
  let initialContractProformaIndex = -1;
  if (isConfirmed) {
    const confirmTime = confirmedAt ? new Date(confirmedAt).getTime() : Infinity;
    for (let idx = 0; idx < proformaDocs.length; idx++) {
      const doc = proformaDocs[idx];
      if (doc.status === "voided") continue;
      const docTime = new Date(doc.created_at || doc.prepared_at || 0).getTime();
      if (doc.amendment_sequence) {
        // Explicitly linked to an amendment, not the initial contract
        continue;
      }
      if (docTime <= confirmTime || initialContractProformaIndex === -1) {
        initialContractProformaIndex = idx;
      }
    }
  }

  // Find the latest official amendment sequence that has a corresponding proforma
  let latestOfficialIndex = -1;

  for (let idx = 0; idx < proformaDocs.length; idx++) {
    const doc = proformaDocs[idx];
    const versionNumber = idx + 1;
    const versionLabel = `v${versionNumber}`;
    const ref = doc.document_reference || canonicalReference;
    const notes = doc.notes || "";

    if (doc.status === "voided") {
      items.push({
        id: doc.id,
        versionNumber,
        versionLabel,
        reference: ref,
        statusCode: "voided",
        statusLabel: "Annulé",
        isOfficial: false,
        createdAt: doc.prepared_at || doc.created_at,
        preparedBy: doc.prepared_by,
        notes,
        amendmentSequence: doc.amendment_sequence,
        instance: doc,
      });
      continue;
    }

    if (!isConfirmed) {
      // Reservation is not confirmed yet: all non-voided versions are draft proposals
      const isLatestDraft = idx === proformaDocs.length - 1;
      items.push({
        id: doc.id,
        versionNumber,
        versionLabel,
        reference: ref,
        statusCode: "draft",
        statusLabel: isLatestDraft ? "Brouillon actif (Devis préliminaire)" : "Brouillon antérieur",
        isOfficial: false,
        createdAt: doc.prepared_at || doc.created_at,
        preparedBy: doc.prepared_by,
        notes,
        amendmentSequence: doc.amendment_sequence,
        instance: doc,
      });
      continue;
    }

    // Reservation is confirmed: check whether this version corresponds to:
    // - Initial contract
    // - A confirmed amendment
    // - A pending amendment (modification request waiting for an amendment)
    const docAmendmentSeq = doc.amendment_sequence ?? null;

    if (docAmendmentSeq !== null && docAmendmentSeq > 0) {
      if (docAmendmentSeq <= maxConfirmedAmendmentSequence) {
        // Confirmed via amendment
        items.push({
          id: doc.id,
          versionNumber,
          versionLabel,
          reference: ref,
          statusCode: "official_amendment",
          statusLabel: `Officiel (Avenant N°${docAmendmentSeq})`,
          isOfficial: false, // Will resolve below to mark only the latest as currently active official
          createdAt: doc.prepared_at || doc.created_at,
          preparedBy: doc.prepared_by,
          notes: notes || `Confirmé par l'Avenant N°${docAmendmentSeq}`,
          amendmentSequence: docAmendmentSeq,
          instance: doc,
        });
        latestOfficialIndex = idx;
      } else {
        // Has an amendment sequence that is not yet confirmed
        items.push({
          id: doc.id,
          versionNumber,
          versionLabel,
          reference: ref,
          statusCode: "pending_amendment",
          statusLabel: `Brouillon de modification (En attente d'avenant N°${docAmendmentSeq})`,
          isOfficial: false,
          createdAt: doc.prepared_at || doc.created_at,
          preparedBy: doc.prepared_by,
          notes: notes || `En attente de confirmation de l'Avenant N°${docAmendmentSeq}`,
          amendmentSequence: docAmendmentSeq,
          instance: doc,
        });
      }
    } else if (idx === initialContractProformaIndex) {
      // Confirmed by initial contract
      items.push({
        id: doc.id,
        versionNumber,
        versionLabel,
        reference: ref,
        statusCode: "official_contract",
        statusLabel: "Officiel (Contrat initial)",
        isOfficial: false, // Will resolve below
        createdAt: doc.prepared_at || doc.created_at,
        preparedBy: doc.prepared_by,
        notes: notes || "Validé par le contrat initial et le versement de l'acompte",
        amendmentSequence: null,
        instance: doc,
      });
      if (latestOfficialIndex === -1) {
        latestOfficialIndex = idx;
      }
    } else if (idx > initialContractProformaIndex) {
      // Created after contract confirmation without explicit amendment sequence yet
      // This is a proforma modification draft waiting for an amendment
      items.push({
        id: doc.id,
        versionNumber,
        versionLabel,
        reference: ref,
        statusCode: "pending_amendment",
        statusLabel: "Brouillon de modification (En attente d'avenant)",
        isOfficial: false,
        createdAt: doc.prepared_at || doc.created_at,
        preparedBy: doc.prepared_by,
        notes: notes || "Proforma de modification après contrat, en attente d'avenant",
        amendmentSequence: null,
        instance: doc,
      });
    } else {
      // Created before the confirmed version -> historical draft prior to confirmation
      items.push({
        id: doc.id,
        versionNumber,
        versionLabel,
        reference: ref,
        statusCode: "draft",
        statusLabel: "Brouillon antérieur (Pré-confirmation)",
        isOfficial: false,
        createdAt: doc.prepared_at || doc.created_at,
        preparedBy: doc.prepared_by,
        notes,
        amendmentSequence: null,
        instance: doc,
      });
    }
  }

  // 4. Resolve the single active official version (if confirmed)
  // If an amendment was confirmed, the proforma for that latest confirmed amendment is official,
  // and any previous official versions (like initial contract or older amendments) are archived.
  let currentOfficial: ProformaVersionItem | null = null;
  if (latestOfficialIndex >= 0 && latestOfficialIndex < items.length) {
    // Mark previous official versions as archived
    for (let i = 0; i < latestOfficialIndex; i++) {
      if (
        items[i].statusCode === "official_contract" ||
        items[i].statusCode === "official_amendment"
      ) {
        const supersededBy = items[latestOfficialIndex].amendmentSequence
          ? `Avenant N°${items[latestOfficialIndex].amendmentSequence}`
          : "dernière version officielle";
        items[i].statusCode = "archived";
        items[i].statusLabel = `Archivé (Remplacé par ${supersededBy})`;
        items[i].isOfficial = false;
      }
    }

    items[latestOfficialIndex].isOfficial = true;
    currentOfficial = items[latestOfficialIndex];
  }

  const latest = items.length > 0 ? items[items.length - 1] : null;
  const hasPending = items.some((item) => item.statusCode === "pending_amendment");

  return {
    reference: canonicalReference,
    versions: items,
    currentOfficialVersion: currentOfficial,
    latestVersion: latest,
    hasPendingAmendment: hasPending,
    totalVersionsCount: items.length,
  };
}
