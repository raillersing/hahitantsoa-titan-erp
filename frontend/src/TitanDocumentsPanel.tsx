import { useEffect, useState } from "react";
import DocumentArtifactPreviewPanel from "./DocumentArtifactPreviewPanel";
import DocumentPdfPreviewPanel from "./DocumentPdfPreviewPanel";

import {
  checkEndpointPermission,
  getReservationDrafts,
  getDocumentTemplates,
  getReservationDraftDocumentInstances,
  createReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstancePdf,
} from "./api";
import type {
  ReservationDraft,
  DocumentTemplateDefinition,
  DocumentInstance,
} from "./types";

type TitanDocumentsState = {
  drafts: ReservationDraft[];
  templates: DocumentTemplateDefinition[];
  selectedDraftId: string;
  instances: DocumentInstance[];
  selectedTemplateKey: string;
  notes: string;
  loading: boolean;
  error: string;
  canWrite: boolean;
};

function TitanDocumentsPanel() {
  const [state, setState] = useState<TitanDocumentsState>({
    drafts: [],
    templates: [],
    selectedDraftId: "",
    instances: [],
    selectedTemplateKey: "",
    notes: "",
    loading: false,
    error: "",
    canWrite: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/documents/templates/", "OPTIONS", controller.signal)
      .then((allowed) => setState((prev) => ({ ...prev, canWrite: allowed })));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [draftsData, templatesData] = await Promise.all([
          getReservationDrafts(),
          getDocumentTemplates(),
        ]);
        setState((prev) => ({
          ...prev,
          drafts: draftsData,
          templates: templatesData,
          selectedDraftId: draftsData.length > 0 ? draftsData[0].id : "",
        }));
      } catch {
        setState((prev) => ({ ...prev, error: "Failed to load initial data." }));
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
        const data = await getReservationDraftDocumentInstances(state.selectedDraftId);
        if (!cancelled) {
          setState((prev) => ({ ...prev, instances: data, loading: false }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, error: "Failed to load document instances.", loading: false }));
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
      await createReservationDraftDocumentInstance(state.selectedDraftId, {
        template_key: state.selectedTemplateKey,
        notes: state.notes,
      });
      const data = await getReservationDraftDocumentInstances(state.selectedDraftId);
      setState((prev) => ({
        ...prev,
        instances: data,
        notes: "",
        selectedTemplateKey: "",
        loading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to prepare document instance.",
        loading: false,
      }));
    }
  };

  const handleGenerateInstance = async (id: string) => {
    if (!state.selectedDraftId || !state.canWrite) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      await generateReservationDraftDocumentInstance(state.selectedDraftId, id);
      const data = await getReservationDraftDocumentInstances(state.selectedDraftId);
      setState((prev) => ({ ...prev, instances: data, loading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to generate document HTML.",
        loading: false,
      }));
    }
  };

  const handleGeneratePdf = async (id: string) => {
    if (!state.selectedDraftId || !state.canWrite) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      await generateReservationDraftDocumentInstancePdf(state.selectedDraftId, id);
      const data = await getReservationDraftDocumentInstances(state.selectedDraftId);
      setState((prev) => ({ ...prev, instances: data, loading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to generate PDF artifact.",
        loading: false,
      }));
    }
  };

  return (
    <div className="titan-documents-panel" data-testid="titan-documents-panel">
      <h4>Titan Reservation Draft Documents</h4>
      <p className="section-helper">
        Manage document instances for Titan reservation drafts (proformas, contracts, delivery notes).
      </p>

      {state.error && (
        <div className="notice error-notice" role="alert">
          <p>{state.error}</p>
        </div>
      )}

      <div className="draft-selector-block">
        <label htmlFor="titan-draft-select">Select Reservation Draft:</label>
        <select
          id="titan-draft-select"
          value={state.selectedDraftId}
          onChange={(e) => setState((prev) => ({ ...prev, selectedDraftId: e.target.value }))}
          disabled={state.loading}
        >
          <option value="">-- Choose Reservation Draft --</option>
          {state.drafts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.public_reference} ({d.customer_display_name})
            </option>
          ))}
        </select>
      </div>

      {state.selectedDraftId && state.canWrite && (
        <form className="prepare-instance-form" onSubmit={handlePrepareInstance}>
          <h4>Prepare Document Instance</h4>
          <div className="prepare-fields">
            <div className="form-group">
              <label htmlFor="titan-template-select">Choose Template</label>
              <select
                id="titan-template-select"
                value={state.selectedTemplateKey}
                onChange={(e) => setState((prev) => ({ ...prev, selectedTemplateKey: e.target.value }))}
                required
                disabled={state.loading}
              >
                <option value="">-- Choose Template --</option>
                {state.templates.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} ({t.document_type})
                  </option>
                ))}
              </select>
            </div>
            <input
              id="titan-instance-notes"
              type="text"
              placeholder="Instance Notes"
              value={state.notes}
              onChange={(e) => setState((prev) => ({ ...prev, notes: e.target.value }))}
              disabled={state.loading}
            />
            <button type="submit" disabled={state.loading || !state.selectedTemplateKey}>
              Prepare Instance
            </button>
          </div>
        </form>
      )}

      {state.selectedDraftId && !state.canWrite && (
        <div className="permission-block" role="status">
          <p className="permission-note">Write access is required to prepare or generate document instances.</p>
        </div>
      )}

      {state.selectedDraftId && (
        <div className="instances-list-block">
          <h4>Document Instances</h4>
          {state.instances.length === 0 ? (
            <p className="empty-hint">No document instances prepared for this draft.</p>
          ) : (
            <ul className="instances-list">
              {state.instances.map((inst) => (
                <li key={inst.id} className="instance-item" data-testid={`titan-instance-${inst.id}`}>
                  <div className="instance-meta">
                    <strong>{inst.template_label}</strong> (v{inst.template_version})
                    <br />
                    <span className="meta-sub">
                      Status: <span className={`status-tag status-${inst.status}`}>{inst.status}</span>
                      {inst.notes ? ` | Notes: ${inst.notes}` : ""}
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
                        Generate HTML
                      </button>
                    )}
                    {inst.status === "prepared" && !state.canWrite && (
                      <span className="permission-note">Write access required</span>
                    )}
                    {inst.status === "generated" && (
                      <div className="generated-tag-stack">
                        <span className="generated-tag">HTML ready (ID: {inst.id})</span>
                        {inst.pdf_storage_path ? (
                          <span className="generated-tag generated-tag--pdf">PDF ready</span>
                        ) : state.canWrite ? (
                          <button
                            type="button"
                            className="btn-generate btn-generate--secondary"
                            onClick={() => handleGeneratePdf(inst.id)}
                            disabled={state.loading}
                          >
                            Generate PDF
                          </button>
                        ) : (
                          <span className="permission-note">PDF generation requires write access</span>
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
        <DocumentArtifactPreviewPanel />
      </div>
      <div className="artifact-preview-wrapper" style={{ marginTop: "24px" }}>
        <DocumentPdfPreviewPanel />
      </div>
    </div>
  );
}

export default TitanDocumentsPanel;
