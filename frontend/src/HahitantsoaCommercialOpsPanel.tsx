import React from "react";
import DocumentArtifactPreviewPanel from "./DocumentArtifactPreviewPanel";

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
    description: "Generate and store private commercial artifacts for reservations and drafts.",
    businessRule: "Proformas remain estimates. Contracts require signatures and deposits before confirmation.",
  },
  {
    id: "billing",
    title: "Billing & Invoices",
    badge: "Billing",
    status: "pending_backend",
    statusLabel: "Pending Backend Integration",
    description: "Track invoices status, totals summaries, and accounting ledger allocations.",
    businessRule: "Invoice lifecycle runs independently of event confirmation state.",
  },
  {
    id: "payments",
    title: "Payments & Receipts",
    badge: "Payments",
    status: "pending_backend",
    statusLabel: "Pending Backend Integration",
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
                <DocumentArtifactPreviewPanel />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default HahitantsoaCommercialOpsPanel;
