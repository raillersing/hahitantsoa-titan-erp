import { useEffect, useState } from "react";
import DocumentArtifactPreviewPanel from "./DocumentArtifactPreviewPanel";
import DocumentPdfPreviewPanel from "./DocumentPdfPreviewPanel";

import {
  checkEndpointPermission,
  getHahitantsoaEventDrafts,
  getDocumentTemplates,
  getBankProfiles,
  getHahitantsoaEventDraftDocumentInstances,
  createHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstancePdf,
} from "./api";
import type {
  HahitantsoaEventDraft,
  DocumentTemplateDefinition,
  DocumentInstance,
  BankProfile,
} from "./types";

type HahitantsoaDocumentsState = {
  drafts: HahitantsoaEventDraft[];
  templates: DocumentTemplateDefinition[];
  selectedDraftId: string;
  instances: DocumentInstance[];
  selectedTemplateKey: string;
  notes: string;
  documentDate: string;
  loading: boolean;
  error: string;
  canWrite: boolean;
  previewArtifactId: string;
  previewPdfId: string;
};

function HahitantsoaDocumentsPanel() {
  const [state, setState] = useState<HahitantsoaDocumentsState>({
    drafts: [],
    templates: [],
    selectedDraftId: "",
    instances: [],
    selectedTemplateKey: "",
    notes: "",
    documentDate: "",
    loading: false,
    error: "",
    canWrite: false,
    previewArtifactId: "",
    previewPdfId: "",
  });
  const [bankProfiles, setBankProfiles] = useState<BankProfile[]>([]);
  const [bankProfileId, setBankProfileId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/documents/templates/", "OPTIONS", controller.signal)
      .then((allowed) => setState((prev) => ({ ...prev, canWrite: allowed })));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getBankProfiles("hahitantsoa", controller.signal).then(setBankProfiles).catch(() => setBankProfiles([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [draftsData, templatesData] = await Promise.all([
          getHahitantsoaEventDrafts(),
          getDocumentTemplates(),
        ]);
        setState((prev) => ({
          ...prev,
          drafts: draftsData,
          templates: templatesData,
          selectedDraftId: draftsData.length > 0 ? draftsData[0].id : "",
        }));
      } catch {
        setState((prev) => ({ ...prev, error: "Échec du chargement des données initiales." }));
      }
    }
    void loadData();
  }, []);

  useEffect(() => {
    if (!state.selectedDraftId) {
      setState((prev) => ({ ...prev, instances: [] }));
      return;
    }
    let cancelled = false;
    async function loadInstances() {
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const data = await getHahitantsoaEventDraftDocumentInstances(state.selectedDraftId);
        if (!cancelled) {
          setState((prev) => ({ ...prev, instances: data, loading: false }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, error: "Échec du chargement des instances de document.", loading: false }));
        }
      }
    }
    void loadInstances();
    return () => { cancelled = true; };
  }, [state.selectedDraftId]);

  const handlePrepareInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.selectedDraftId || !state.selectedTemplateKey || !state.canWrite) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      await createHahitantsoaEventDraftDocumentInstance(state.selectedDraftId, {
        template_key: state.selectedTemplateKey,
        notes: state.notes,
        ...(bankProfileId ? { bank_profile: bankProfileId } : {}),
        ...(state.selectedTemplateKey === "hahitantsoa.delivery_note.v1" && state.documentDate
          ? { document_date: state.documentDate }
          : {}),
      });
      const data = await getHahitantsoaEventDraftDocumentInstances(state.selectedDraftId);
      setState((prev) => ({
        ...prev,
        instances: data,
        notes: "",
        documentDate: "",
        selectedTemplateKey: "",
        loading: false,
      }));
      setBankProfileId("");
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Échec de la préparation de l’instance de document.",
        loading: false,
      }));
    }
  };

  const handleGenerateInstance = async (id: string) => {
    if (!state.selectedDraftId || !state.canWrite) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      await generateHahitantsoaEventDraftDocumentInstance(state.selectedDraftId, id);
      const data = await getHahitantsoaEventDraftDocumentInstances(state.selectedDraftId);
      setState((prev) => ({ ...prev, instances: data, loading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Échec de la génération du HTML du document.",
        loading: false,
      }));
    }
  };

  const handleGeneratePdf = async (id: string) => {
    if (!state.selectedDraftId || !state.canWrite) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      await generateHahitantsoaEventDraftDocumentInstancePdf(state.selectedDraftId, id);
      const data = await getHahitantsoaEventDraftDocumentInstances(state.selectedDraftId);
      setState((prev) => ({ ...prev, instances: data, loading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Échec de la génération de l’aperçu PDF.",
        loading: false,
      }));
    }
  };

  return (
    <div className="hahitantsoa-documents-panel" data-testid="hahitantsoa-documents-panel">
      <h4>Documents des brouillons d'événements Hahitantsoa</h4>
      <p className="section-helper">
        Gérez les instances de documents pour les brouillons d'événements Hahitantsoa (contrats, annexes).
      </p>

      {state.error && (
        <div className="notice error-notice" role="alert">
          <p>{state.error}</p>
        </div>
      )}

      <div className="draft-selector-block">
        <label htmlFor="hahitantsoa-draft-select">Sélectionnez un brouillon d'événement :</label>
        <select
          id="hahitantsoa-draft-select"
          value={state.selectedDraftId}
          onChange={(e) => setState((prev) => ({ ...prev, selectedDraftId: e.target.value }))}
          disabled={state.loading}
        >
          <option value="">-- Choisissez un brouillon --</option>
          {state.drafts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.public_reference} ({d.customer_display_name} - {d.event_name})
            </option>
          ))}
        </select>
      </div>

      {state.selectedDraftId && state.canWrite && (
        <form className="prepare-instance-form" onSubmit={handlePrepareInstance}>
          <h4>Préparer une instance de document</h4>
          <div className="prepare-fields">
            <div className="form-group">
              <label htmlFor="hahitantsoa-template-select">Choisissez un modèle</label>
              <select
                id="hahitantsoa-template-select"
                value={state.selectedTemplateKey}
                onChange={(e) => setState((prev) => ({ ...prev, selectedTemplateKey: e.target.value }))}
                required
                disabled={state.loading}
              >
                <option value="">-- Choisissez un modèle --</option>
                {state.templates
                  .filter((t) => t.business_scope === "hahitantsoa" || t.business_scope === "shared")
                  .map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label} ({t.document_type})
                    </option>
                  ))}
              </select>
            </div>
            <input
              id="hahitantsoa-instance-notes"
              type="text"
              placeholder="Notes de l'instance"
              value={state.notes}
              onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
              disabled={state.loading}
            />
            <label htmlFor="hahitantsoa-bank-profile">
              Banque à afficher dans le document
              <select id="hahitantsoa-bank-profile" value={bankProfileId} onChange={(e) => setBankProfileId(e.target.value)} disabled={state.loading}>
                <option value="">Banque par défaut</option>
                {bankProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.bank_name} — {profile.account_code}{profile.is_default_for_documents ? " (défaut)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {state.selectedTemplateKey === "hahitantsoa.delivery_note.v1" && (
              <label htmlFor="hahitantsoa-delivery-date">
                Date du bon de livraison
                <input
                  id="hahitantsoa-delivery-date"
                  type="date"
                  value={state.documentDate || (() => {
                    const start = state.drafts.find((draft) => draft.id === state.selectedDraftId)?.start_at;
                    if (!start) return "";
                    const date = new Date(start);
                    date.setDate(date.getDate() - 1);
                    return date.toISOString().slice(0, 10);
                  })()}
                  onChange={(e) => setState((prev) => ({ ...prev, documentDate: e.target.value }))}
                  disabled={state.loading}
                />
              </label>
            )}
            <button type="submit" disabled={state.loading || !state.selectedTemplateKey}>
              Préparer l'instance
            </button>
          </div>
        </form>
      )}

      {state.selectedDraftId && !state.canWrite && (
        <div className="permission-block" role="status">
          <p className="permission-note">L'accès en écriture est requis pour préparer ou générer des instances de document.</p>
        </div>
      )}

      {state.selectedDraftId && (
        <div className="instances-list-block">
          <h4>Instances de document</h4>
          {state.instances.length === 0 ? (
            <p className="empty-hint">Aucune instance de document préparée pour ce brouillon.</p>
          ) : (
            <ul className="instances-list">
              {state.instances.map((inst) => (
                <li key={inst.id} className="instance-item" data-testid={`hahitantsoa-instance-${inst.id}`}>
                  <div className="instance-meta">
                    <strong>{inst.template_label}</strong> (v{inst.template_version})
                    <br />
                    <span className="meta-sub">
                      Statut : <span className={`status-tag status-${inst.status}`}>{inst.status}</span>
                      {inst.notes ? ` | Notes : ${inst.notes}` : ""}
                    </span>
                  </div>
                  <div className="instance-actions">
                    {inst.status === "prepared" && state.canWrite && (
                      <button
                        type="button"
                        className="btn-generate"
                        onClick={() => handleGenerateInstance(inst.id)}
                        disabled={state.loading}
                      >
                        Générer HTML
                      </button>
                    )}
                    {inst.status === "prepared" && !state.canWrite && (
                      <span className="permission-note">Accès écriture requis</span>
                    )}
                    {inst.status === "generated" && (
                      <div className="generated-tag-stack">
                        <span className="generated-tag">HTML prêt (ID : {inst.id})</span>
                        <button
                          type="button"
                          className="btn-generate btn-generate--secondary"
                          onClick={() => setState((prev) => ({ ...prev, previewArtifactId: inst.id }))}
                        >
                          Aperçu HTML
                        </button>
                        {inst.pdf_storage_path ? (
                          <>
                            <span className="generated-tag generated-tag--pdf">PDF prêt</span>
                            <button
                              type="button"
                              className="btn-generate btn-generate--secondary"
                              onClick={() => setState((prev) => ({ ...prev, previewPdfId: inst.id }))}
                            >
                              Aperçu PDF
                            </button>
                          </>
                        ) : state.canWrite ? (
                          <button
                            type="button"
                            className="btn-generate btn-generate--secondary"
                            onClick={() => handleGeneratePdf(inst.id)}
                            disabled={state.loading}
                          >
                            Générer PDF
                          </button>
                        ) : (
                          <span className="permission-note">La génération PDF nécessite un accès en écriture</span>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="artifact-preview-wrapper" style={{ marginTop: "24px" }}>
        <DocumentArtifactPreviewPanel documentInstanceId={state.previewArtifactId} />
      </div>
      <div className="artifact-preview-wrapper" style={{ marginTop: "24px" }}>
        <DocumentPdfPreviewPanel documentInstanceId={state.previewPdfId} />
      </div>
    </div>
  );
}

export default HahitantsoaDocumentsPanel;
