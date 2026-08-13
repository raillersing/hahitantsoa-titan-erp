import React, { useEffect, useState } from "react";
import { getHahitantsoaEventDrafts } from "./api";
import type { HahitantsoaEventDraft } from "./types";
import PaymentWorkflowPanel from "./PaymentWorkflowPanel";
import TitanDocumentsPanel from "./TitanDocumentsPanel";
import HahitantsoaDocumentsPanel from "./HahitantsoaDocumentsPanel";
import { BillingInvoicePanel } from "./BillingInvoicePanel";
import { LogisticsDeliveryPanel } from "./LogisticsDeliveryPanel";

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
    status: "connected",
    statusLabel: "Connecté",
    description: "Facturation limitée au dossier événement Hahitantsoa sélectionné.",
    businessRule: "Aucune donnée de facturation Titan ne doit être affichée dans Hahitantsoa.",
  },
  {
    id: "payments",
    title: "Payments & Receipts",
    badge: "Payments",
    status: "connected",
    statusLabel: "Connecté",
    description: "Record provider deposits, payments validation, and issue transactional receipts.",
    businessRule: "Payment provider status is not reservation status.",
  },

  {
    id: "logistics",
    title: "Logistics & Delivery",
    badge: "Logistics",
    status: "connected",
    statusLabel: "Connecté",
    description: "Livraisons et remises limitées au dossier événement Hahitantsoa sélectionné.",
    businessRule: "Les événements Titan ne doivent pas être réutilisés pour Hahitantsoa.",
  },
  {
    id: "returns",
    title: "Returns Handling",
    badge: "Returns",
    status: "pending_backend",
    statusLabel: "Contrat backend requis",
    description: "Les retours Hahitantsoa attendent un contrat backend contextualisé.",
    businessRule: "Les retours doivent être liés à l’événement Hahitantsoa, jamais à une réservation Titan.",
  },
  {
    id: "breakage",
    title: "Breakage & Loss",
    badge: "Damage",
    status: "pending_backend",
    statusLabel: "Contrat backend requis",
    description: "Les dommages et pertes Hahitantsoa attendent un contrat backend contextualisé.",
    businessRule: "Les ajustements doivent rester rattachés au dossier Hahitantsoa.",
  },
  {
    id: "stock",
    title: "Stock Movement Ledger",
    badge: "Inventory",
    status: "pending_backend",
    statusLabel: "Contrat backend requis",
    description: "Le journal de stock Hahitantsoa attend un filtre de dossier événement.",
    businessRule: "Les mouvements doivent être isolés par événement et rester transactionnels.",
  },
];

type DocumentTab = "titan" | "hahitantsoa";

function BackendContractRequired({ description }: { description: string }) {
  return (
    <div className="pending-state-overlay" role="status" data-testid="hahitantsoa-backend-contract-required">
      <span className="pending-badge">Contrat backend requis</span>
      <p className="pending-helper">{description}</p>
    </div>
  );
}

export function HahitantsoaCommercialOpsPanel() {
  const [docTab, setDocTab] = useState<DocumentTab>("titan");
  const [drafts, setDrafts] = useState<HahitantsoaEventDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getHahitantsoaEventDrafts(undefined, controller.signal)
      .then((nextDrafts) => {
        if (controller.signal.aborted) return;
        setDrafts(nextDrafts);
        setSelectedDraftId((current) => current || nextDrafts[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDraftError(error instanceof Error ? error.message : "Impossible de charger les dossiers Hahitantsoa.");
        }
      });
    return () => controller.abort();
  }, []);

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

      <div className="commercial-context-selector">
        <label htmlFor="hahitantsoa-commercial-draft" className="sr-only">Dossier Hahitantsoa</label>
        <select
          id="hahitantsoa-commercial-draft"
          value={selectedDraftId}
          onChange={(event) => setSelectedDraftId(event.target.value)}
          aria-describedby="hahitantsoa-commercial-draft-help"
        >
          <option value="">Sélectionner un dossier Hahitantsoa</option>
          {drafts.map((draft) => (
            <option key={draft.id} value={draft.id}>
              {draft.public_reference} — {draft.event_name}
            </option>
          ))}
        </select>
        <p id="hahitantsoa-commercial-draft-help" className="section-helper">
          Les paiements et futures opérations seront limités au dossier sélectionné.
        </p>
        {draftError ? <p className="text-sm text-rose-700" role="alert">{draftError}</p> : null}
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
              <BackendContractRequired description={sec.description} />
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
                    Documents Titan
                   </button>
                   <button
                     role="tab"
                     aria-selected={docTab === "hahitantsoa"}
                     aria-controls="hahitantsoa-documents-panel"
                     className={`documents-tab ${docTab === "hahitantsoa" ? "documents-tab-active" : ""}`}
                     onClick={() => setDocTab("hahitantsoa")}
                     type="button"
                   >
                     Documents Hahitantsoa
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
                <PaymentWorkflowPanel businessScope="hahitantsoa" draftId={selectedDraftId || undefined} />
              </div>
            ) : null}
            {sec.id === "billing" && selectedDraftId ? (
              <div className="embedded-billing-panel">
                <BillingInvoicePanel businessScope="hahitantsoa" draftId={selectedDraftId} />
              </div>
            ) : null}
            {sec.id === "logistics" && selectedDraftId ? (
              <div className="embedded-logistics-panel">
                <LogisticsDeliveryPanel businessScope="hahitantsoa" draftId={selectedDraftId} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export default HahitantsoaCommercialOpsPanel;
