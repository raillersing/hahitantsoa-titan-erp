import React, { useEffect, useState } from "react";
import DocumentArtifactPreviewPanel from "./DocumentArtifactPreviewPanel";
import PaymentWorkflowPanel from "./PaymentWorkflowPanel";
import LogisticsDeliveryPanel from "./LogisticsDeliveryPanel";
import ReturnsHandlingPanel from "./ReturnsHandlingPanel";
import BreakageLossPanel from "./BreakageLossPanel";
import StockMovementLedgerPanel from "./StockMovementLedgerPanel";
import BillingInvoicePanel from "./BillingInvoicePanel";


import {
  getReservationDrafts,
  getDocumentTemplates,
  getReservationDraftDocumentInstances,
  createReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstance,
} from "./api";
import type {
  ReservationDraft,
  DocumentTemplateDefinition,
  DocumentInstance,
} from "./types";

type IntegrationStatus = "connected" | "partially_connected" | "pending_backend";

type CommercialSection = {
  id: string;
  title: string;
  badge: string;
  status: IntegrationStatus;
  statusLabel: string;
  description: string;
  businessRule: string;
};

const SECTIONS: CommercialSection[] = [
  {
    id: "documents",
    title: "Documents & Contracts",
    badge: "Documents",
    status: "partially_connected",
    statusLabel: "Partially Connected",
    description: "Prepare, generate, list and preview private HTML document instances from templates.",
    businessRule: "Proformas remain estimates. Contracts require signatures and deposits before confirmation.",
  },
  {
    id: "billing",
    title: "Billing & Invoices",
    badge: "Billing",
    status: "partially_connected",
    statusLabel: "Partially Connected",
    description: "Track invoices status, totals summaries, and accounting ledger allocations.",
    businessRule: "Invoice lifecycle runs independently of event confirmation state.",
  },
  {
    id: "payments",
    title: "Payments & Receipts",
    badge: "Payments",
    status: "partially_connected",
    statusLabel: "Partially Connected",
    description: "Record provider deposits, payments validation, and issue transactional receipts.",
    businessRule: "Payment provider status is not reservation status.",
  },

  {
    id: "logistics",
    title: "Logistics & Delivery",
    badge: "Logistics",
    status: "pending_backend",
    statusLabel: "Pending Backend Integration",
    description: "Prepare internal release notes and customer delivery execution checklists.",
    businessRule: "Requires explicit operator and date validation indicators.",
  },
  {
    id: "returns",
    title: "Returns Handling",
    badge: "Returns",
    status: "pending_backend",
    statusLabel: "Pending Backend Integration",
    description: "Verify returned materials quantities, update logs, and trigger closeout.",
    businessRule: "Tracks returned vs missing items snapshot.",
  },
  {
    id: "breakage",
    title: "Breakage & Loss",
    badge: "Damage",
    status: "pending_backend",
    statusLabel: "Pending Backend Integration",
    description: "Assess damaged items, initiate repair tickets, and issue breakage invoices.",
    businessRule: "Commercial adjustment occurs on confirmed resolution notes.",
  },
  {
    id: "stock",
    title: "Stock Movement Ledger",
    badge: "Inventory",
    status: "pending_backend",
    statusLabel: "Pending Backend Integration",
    description: "Record physical movement ledger logs, reconciliation notes, and active stock count.",
    businessRule: "Durable adjustments are posted only on atomic committed operations.",
  },
];

export function HahitantsoaCommercialOpsPanel() {
  const [drafts, setDrafts] = useState<ReservationDraft[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateDefinition[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [instances, setInstances] = useState<DocumentInstance[]>([]);
  
  // Creation state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      try {
        const [draftsData, templatesData] = await Promise.all([
          getReservationDrafts(),
          getDocumentTemplates(),
        ]);
        setDrafts(draftsData);
        setTemplates(templatesData);
        if (draftsData.length > 0) {
          setSelectedDraftId(draftsData[0].id);
        }
      } catch (err) {
        setError("Failed to load initial data for documents management.");
      }
    }
    void loadData();
  }, []);

  useEffect(() => {
    if (!selectedDraftId) {
      setInstances([]);
      return;
    }
    async function loadInstances() {
      setLoading(true);
      setError("");
      try {
        const data = await getReservationDraftDocumentInstances(selectedDraftId);
        setInstances(data);
      } catch (err) {
        setError("Failed to load document instances for selected draft.");
      } finally {
        setLoading(false);
      }
    }
    void loadInstances();
  }, [selectedDraftId]);

  const handlePrepareInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDraftId || !selectedTemplateKey) return;
    setLoading(true);
    setError("");
    try {
      await createReservationDraftDocumentInstance(selectedDraftId, {
        template_key: selectedTemplateKey,
        notes,
      });
      setNotes("");
      setSelectedTemplateKey("");
      // reload
      const data = await getReservationDraftDocumentInstances(selectedDraftId);
      setInstances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare document instance.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInstance = async (id: string) => {
    if (!selectedDraftId) return;
    setLoading(true);
    setError("");
    try {
      await generateReservationDraftDocumentInstance(selectedDraftId, id);
      // reload
      const data = await getReservationDraftDocumentInstances(selectedDraftId);
      setInstances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate document HTML.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="commercial-ops-panel" aria-labelledby="commercial-ops-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Enterprise Commercials</p>
          <h2 id="commercial-ops-heading">Commercial Operations</h2>
          <p className="section-helper">
            Consolidated operational closeout dashboard tracking documents, billing, logistics, and stock status.
          </p>
        </div>
      </div>

      {error && (
        <div className="notice error-notice" role="alert">
          <p>{error}</p>
        </div>
      )}

      <div className="commercial-grid">
        {SECTIONS.map((sec) => (
          <div key={sec.id} className="commercial-card" data-testid={`card-${sec.id}`}>
            <div className="card-header">
              <span className="section-badge">{sec.badge}</span>
              <span className={`status-badge status-${sec.status}`}>
                {sec.statusLabel}
              </span>
            </div>
            <h3>{sec.title}</h3>
            <p className="desc">{sec.description}</p>
            <p className="rule"><strong>Rule:</strong> {sec.businessRule}</p>
            {sec.status === "pending_backend" ? (
              <div className="pending-state-overlay">
                <span className="pending-badge">Pending Backend Contract</span>
                <p className="pending-helper">This block is configured on the frontend and will activate automatically once the Codex backend service merges on main.</p>
              </div>
            ) : null}
            {sec.id === "documents" ? (
              <div className="embedded-documents-panel">
                <div className="draft-selector-block">
                  <label htmlFor="draft-select">Select Reservation Draft:</label>
                  <select
                    id="draft-select"
                    value={selectedDraftId}
                    onChange={(e) => setSelectedDraftId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">-- Choose Reservation Draft --</option>
                    {drafts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.public_reference} ({d.customer_display_name})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDraftId && (
                  <form className="prepare-instance-form" onSubmit={handlePrepareInstance}>
                    <h4>Prepare Document Instance</h4>
                    <div className="prepare-fields">
                      <div className="form-group">
                        <label htmlFor="template-select">Choose Template</label>
                        <select
                          id="template-select"
                          value={selectedTemplateKey}
                          onChange={(e) => setSelectedTemplateKey(e.target.value)}
                          required
                          disabled={loading}
                        >
                          <option value="">-- Choose Template --</option>
                          {templates.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.label} ({t.document_type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        id="instance-notes"
                        type="text"
                        placeholder="Instance Notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={loading}
                      />
                      <button type="submit" disabled={loading || !selectedTemplateKey}>
                        Prepare Instance
                      </button>
                    </div>
                  </form>
                )}

                {selectedDraftId && (
                  <div className="instances-list-block">
                    <h4>Document Instances</h4>
                    {instances.length === 0 ? (
                      <p className="empty-hint">No document instances prepared for this draft.</p>
                    ) : (
                      <ul className="instances-list">
                        {instances.map((inst) => (
                          <li key={inst.id} className="instance-item" data-testid={`instance-${inst.id}`}>
                            <div className="instance-meta">
                              <strong>{inst.template_label}</strong> (v{inst.template_version})
                              <br />
                              <span className="meta-sub">
                                Status: <span className={`status-tag status-${inst.status}`}>{inst.status}</span>
                                {inst.notes ? ` | Notes: ${inst.notes}` : ""}
                              </span>
                            </div>
                            <div className="instance-actions">
                              {inst.status === "prepared" && (
                                <button
                                  type="button"
                                  className="btn-generate"
                                  onClick={() => handleGenerateInstance(inst.id)}
                                  disabled={loading}
                                >
                                  Generate HTML
                                </button>
                              )}
                              {inst.status === "generated" && (
                                <span className="generated-tag">Ready (Instance ID: {inst.id})</span>
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
              </div>
            ) : null}
            {sec.id === "payments" && sec.status !== "pending_backend" ? (
              <div className="embedded-payments-panel">
                <PaymentWorkflowPanel />
              </div>
            ) : null}
            {sec.id === "billing" && sec.status !== "pending_backend" ? (
              <BillingInvoicePanel />
            ) : null}
            {sec.id === "logistics" && sec.status !== "pending_backend" ? (
              <LogisticsDeliveryPanel />
            ) : null}
            {sec.id === "returns" && sec.status !== "pending_backend" ? (
              <ReturnsHandlingPanel />
            ) : null}
            {sec.id === "breakage" && sec.status !== "pending_backend" ? (
              <BreakageLossPanel />
            ) : null}
            {sec.id === "stock" && sec.status !== "pending_backend" ? (
              <StockMovementLedgerPanel />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default HahitantsoaCommercialOpsPanel;
