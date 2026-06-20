import React, { useState } from "react";
import PaymentWorkflowPanel from "./PaymentWorkflowPanel";
import LogisticsDeliveryPanel from "./LogisticsDeliveryPanel";
import ReturnsHandlingPanel from "./ReturnsHandlingPanel";
import BreakageLossPanel from "./BreakageLossPanel";
import StockMovementLedgerPanel from "./StockMovementLedgerPanel";
import BillingInvoicePanel from "./BillingInvoicePanel";
import TitanDocumentsPanel from "./TitanDocumentsPanel";
import HahitantsoaDocumentsPanel from "./HahitantsoaDocumentsPanel";

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
    status: "partially_connected",
    statusLabel: "Partially Connected",
    description: "View and track delivery events from logistics operations.",
    businessRule: "Requires explicit operator and date validation indicators.",
  },
  {
    id: "returns",
    title: "Returns Handling",
    badge: "Returns",
    status: "partially_connected",
    statusLabel: "Partially Connected",
    description: "View return operations with line-level item tracking and quantities.",
    businessRule: "Tracks returned vs missing items snapshot.",
  },
  {
    id: "breakage",
    title: "Breakage & Loss",
    badge: "Damage",
    status: "partially_connected",
    statusLabel: "Partially Connected",
    description: "View damage & loss settlements with line-level amounts and totals.",
    businessRule: "Commercial adjustment occurs on confirmed resolution notes.",
  },
  {
    id: "stock",
    title: "Stock Movement Ledger",
    badge: "Inventory",
    status: "partially_connected",
    statusLabel: "Partially Connected",
    description: "View stock movement ledger with movement types, directions, and quantities.",
    businessRule: "Durable adjustments are posted only on atomic committed operations.",
  },
];

type DocumentTab = "titan" | "hahitantsoa";

export function HahitantsoaCommercialOpsPanel() {
  const [docTab, setDocTab] = useState<DocumentTab>("titan");

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
                <div className="documents-tab-bar" role="tablist" aria-label="Document scope">
                  <button
                    role="tab"
                    aria-selected={docTab === "titan"}
                    aria-controls="titan-documents-panel"
                    className={`documents-tab ${docTab === "titan" ? "documents-tab-active" : ""}`}
                    onClick={() => setDocTab("titan")}
                    type="button"
                  >
                    Titan Documents
                  </button>
                  <button
                    role="tab"
                    aria-selected={docTab === "hahitantsoa"}
                    aria-controls="hahitantsoa-documents-panel"
                    className={`documents-tab ${docTab === "hahitantsoa" ? "documents-tab-active" : ""}`}
                    onClick={() => setDocTab("hahitantsoa")}
                    type="button"
                  >
                    Hahitantsoa Documents
                  </button>
                </div>
                <div
                  id="titan-documents-panel"
                  role="tabpanel"
                  hidden={docTab !== "titan"}
                >
                  {docTab === "titan" && <TitanDocumentsPanel />}
                </div>
                <div
                  id="hahitantsoa-documents-panel"
                  role="tabpanel"
                  hidden={docTab !== "hahitantsoa"}
                >
                  {docTab === "hahitantsoa" && <HahitantsoaDocumentsPanel />}
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
