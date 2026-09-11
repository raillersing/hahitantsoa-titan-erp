import { describe, expect, it } from "vitest";
import { buildProformaVersionHistory } from "./proformaVersionHistory";
import type { DocumentInstance } from "./types";

function makeProformaDoc(overrides: Partial<DocumentInstance> = {}): DocumentInstance {
  return {
    id: `doc-${Math.random().toString(36).slice(2, 7)}`,
    reservation_draft: "draft-1",
    customer: "cust-1",
    template_key: "titan.proforma.v1",
    template_version: "1.0",
    template_label: "Devis Proforma Titan",
    business_scope: "titan",
    document_type: "proforma",
    template_status: "active",
    template_source_kind: "file",
    template_source_reference: "ref",
    template_path: "path",
    template_preview_path: "preview",
    template_validated_by_client: true,
    template_notes: "",
    document_reference: "TITAN-2026-001-PF",
    reservation_public_reference: "TITAN-2026-001",
    reservation_status: "draft",
    customer_display_name: "Client Test",
    customer_email: "test@example.com",
    customer_phone: "0340000000",
    customer_address: "Antananarivo",
    status: "generated",
    prepared_at: "2026-06-01T10:00:00Z",
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    prepared_by: "user-1",
    voided_at: null,
    voided_by: null,
    void_reason: "",
    content_checksum: "sum",
    storage_path: "storage/p1.html",
    generated_content_size_bytes: 1024,
    valid_until: "2026-06-16T10:00:00Z",
    notes: "",
    ...overrides,
  };
}

describe("proformaVersionHistory", () => {
  it("gère une liste vide de proformas sans erreur", () => {
    const history = buildProformaVersionHistory({
      documentInstances: [],
      isConfirmed: false,
      publicReference: "TITAN-2026-001",
    });

    expect(history.reference).toBe("TITAN-2026-001-PF");
    expect(history.totalVersionsCount).toBe(0);
    expect(history.currentOfficialVersion).toBeNull();
    expect(history.latestVersion).toBeNull();
    expect(history.hasPendingAmendment).toBe(false);
  });

  it("classe plusieurs proformas pré-confirmation comme brouillons sous le même numéro", () => {
    const doc1 = makeProformaDoc({
      id: "doc-1",
      created_at: "2026-06-01T09:00:00Z",
      notes: "Première proposition",
    });
    const doc2 = makeProformaDoc({
      id: "doc-2",
      created_at: "2026-06-02T14:00:00Z",
      notes: "Ajout de chaises supplémentaires",
    });

    const history = buildProformaVersionHistory({
      documentInstances: [doc2, doc1], // non ordonné initialement
      isConfirmed: false,
      publicReference: "TITAN-2026-001",
    });

    expect(history.totalVersionsCount).toBe(2);
    expect(history.reference).toBe("TITAN-2026-001-PF");
    // Versions ordonnées chronologiquement
    expect(history.versions[0].versionLabel).toBe("v1");
    expect(history.versions[0].statusCode).toBe("draft");
    expect(history.versions[0].statusLabel).toContain("Brouillon antérieur");
    expect(history.versions[0].isOfficial).toBe(false);

    expect(history.versions[1].versionLabel).toBe("v2");
    expect(history.versions[1].statusCode).toBe("draft");
    expect(history.versions[1].statusLabel).toContain("Brouillon actif");
    expect(history.versions[1].isOfficial).toBe(false);

    expect(history.currentOfficialVersion).toBeNull();
    expect(history.latestVersion?.versionLabel).toBe("v2");
  });

  it("officialise la version active lors de la confirmation par acompte et contrat initial", () => {
    const doc1 = makeProformaDoc({
      id: "doc-1",
      created_at: "2026-06-01T09:00:00Z",
    });
    const doc2 = makeProformaDoc({
      id: "doc-2",
      created_at: "2026-06-02T14:00:00Z",
    });

    const history = buildProformaVersionHistory({
      documentInstances: [doc1, doc2],
      isConfirmed: true,
      confirmedAt: "2026-06-03T10:00:00Z",
      publicReference: "TITAN-2026-001",
    });

    expect(history.totalVersionsCount).toBe(2);
    expect(history.versions[0].versionLabel).toBe("v1");
    expect(history.versions[0].statusCode).toBe("draft");
    expect(history.versions[0].isOfficial).toBe(false);

    expect(history.versions[1].versionLabel).toBe("v2");
    expect(history.versions[1].statusCode).toBe("official_contract");
    expect(history.versions[1].statusLabel).toBe("Officiel (Contrat initial)");
    expect(history.versions[1].isOfficial).toBe(true);

    expect(history.currentOfficialVersion?.versionLabel).toBe("v2");
    expect(history.hasPendingAmendment).toBe(false);
  });

  it("gère une révision post-confirmation en attente d'avenant sans remplacer la version officielle en vigueur", () => {
    const doc1 = makeProformaDoc({
      id: "doc-1",
      created_at: "2026-06-01T09:00:00Z",
    });
    const doc2 = makeProformaDoc({
      id: "doc-2",
      created_at: "2026-06-15T11:00:00Z", // après confirmation
      notes: "Demande client: ajout éclairage",
    });

    const history = buildProformaVersionHistory({
      documentInstances: [doc1, doc2],
      isConfirmed: true,
      confirmedAt: "2026-06-05T10:00:00Z",
      amendments: [], // aucun avenant encore validé
      publicReference: "TITAN-2026-001",
    });

    expect(history.totalVersionsCount).toBe(2);

    // v1 est et reste la version officielle en cours
    expect(history.versions[0].versionLabel).toBe("v1");
    expect(history.versions[0].statusCode).toBe("official_contract");
    expect(history.versions[0].isOfficial).toBe(true);

    // v2 est en attente d'avenant
    expect(history.versions[1].versionLabel).toBe("v2");
    expect(history.versions[1].statusCode).toBe("pending_amendment");
    expect(history.versions[1].statusLabel).toContain("En attente d'avenant");
    expect(history.versions[1].isOfficial).toBe(false);

    expect(history.currentOfficialVersion?.versionLabel).toBe("v1");
    expect(history.latestVersion?.versionLabel).toBe("v2");
    expect(history.hasPendingAmendment).toBe(true);
  });

  it("officialise la nouvelle version et archive la précédente dès validation d'un avenant", () => {
    const doc1 = makeProformaDoc({
      id: "doc-1",
      created_at: "2026-06-01T09:00:00Z",
    });
    const doc2 = makeProformaDoc({
      id: "doc-2",
      created_at: "2026-06-15T11:00:00Z",
      amendment_sequence: 1,
      notes: "Révision pour Avenant N°1",
    });

    const history = buildProformaVersionHistory({
      documentInstances: [doc1, doc2],
      isConfirmed: true,
      confirmedAt: "2026-06-05T10:00:00Z",
      amendments: [
        {
          amendment_sequence: 1,
          applied_at: "2026-06-16T10:00:00Z",
          status: "applied",
        },
      ],
      publicReference: "TITAN-2026-001",
    });

    expect(history.totalVersionsCount).toBe(2);

    // v1 est désormais archivée car remplacée par l'avenant N°1
    expect(history.versions[0].versionLabel).toBe("v1");
    expect(history.versions[0].statusCode).toBe("archived");
    expect(history.versions[0].statusLabel).toContain("Archivé (Remplacé par Avenant N°1)");
    expect(history.versions[0].isOfficial).toBe(false);

    // v2 est devenue la version officielle active liée à l'avenant N°1
    expect(history.versions[1].versionLabel).toBe("v2");
    expect(history.versions[1].statusCode).toBe("official_amendment");
    expect(history.versions[1].statusLabel).toBe("Officiel (Avenant N°1)");
    expect(history.versions[1].isOfficial).toBe(true);

    expect(history.currentOfficialVersion?.versionLabel).toBe("v2");
    expect(history.hasPendingAmendment).toBe(false);
  });

  it("gère les proformas annulés (voided)", () => {
    const doc1 = makeProformaDoc({
      id: "doc-1",
      created_at: "2026-06-01T09:00:00Z",
      status: "voided",
      void_reason: "Erreur de saisie client",
    });

    const history = buildProformaVersionHistory({
      documentInstances: [doc1],
      isConfirmed: false,
    });

    expect(history.versions[0].statusCode).toBe("voided");
    expect(history.versions[0].statusLabel).toBe("Annulé");
    expect(history.versions[0].isOfficial).toBe(false);
  });
});
