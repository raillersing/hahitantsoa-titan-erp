import { useEffect, useState } from "react";

import {
  getHahitantsoaEventDrafts,
  getInventoryItems,
  getPayments,
  getReservationDrafts,
} from "./api";

type DashboardMetrics = {
  inventoryCount: number;
  eventDraftCount: number;
  reservationDraftCount: number;
  paymentCount: number;
};

type DashboardPanelProps = {
  onNavigate: (scope: "titan" | "hahitantsoa" | "commercial-ops") => void;
};

type OverviewCard = {
  title: string;
  value: string;
  description: string;
  tone: "hah" | "titan" | "neutral";
  actionLabel: string;
  onAction: () => void;
};

function DashboardPanel({ onNavigate }: DashboardPanelProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    inventoryCount: 0,
    eventDraftCount: 0,
    reservationDraftCount: 0,
    paymentCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDashboardData() {
      try {
        const [items, eventDrafts, reservationDrafts, payments] = await Promise.all([
          getInventoryItems(controller.signal),
          getHahitantsoaEventDrafts(undefined, controller.signal),
          getReservationDrafts(undefined, controller.signal),
          getPayments(controller.signal).catch(() => []),
        ]);

        setMetrics({
          inventoryCount: items.length,
          eventDraftCount: eventDrafts.length,
          reservationDraftCount: reservationDrafts.length,
          paymentCount: payments.length,
        });
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Failed to load dashboard statistics.");
        setLoading(false);
      }
    }

    void fetchDashboardData();

    return () => controller.abort();
  }, []);

  const overviewCards: OverviewCard[] = [
    {
      title: "Titan inventory",
      value: String(metrics.inventoryCount),
      description: "Rental items, material packs, and stock visibility for operator routing.",
      tone: "titan",
      actionLabel: "Open Titan",
      onAction: () => onNavigate("titan"),
    },
    {
      title: "Hahitantsoa drafts",
      value: String(metrics.eventDraftCount),
      description: "Exploratory event drafts and preparation steps for event-scoped work.",
      tone: "hah",
      actionLabel: "Open Hahitantsoa",
      onAction: () => onNavigate("hahitantsoa"),
    },
    {
      title: "Reservation drafts",
      value: String(metrics.reservationDraftCount),
      description: "Draft reservations waiting for confirmation, validation, or follow-up.",
      tone: "titan",
      actionLabel: "Review reservations",
      onAction: () => onNavigate("titan"),
    },
    {
      title: "Operational payments",
      value: String(metrics.paymentCount),
      description: "Billing, settlement, and payment touchpoints that still need operator review.",
      tone: "neutral",
      actionLabel: "Open operations",
      onAction: () => onNavigate("commercial-ops"),
    },
  ];

  if (loading) {
    return (
      <div className="notice loading-notice" role="status">
        <p className="loading-spinner">Loading ERP dashboard summary...</p>
      </div>
    );
  }

  return (
    <section className="dashboard-section" aria-labelledby="dashboard-overview-heading">
      <div className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <p className="eyebrow">Prototype-aligned overview</p>
          <h2 id="dashboard-overview-heading">ERP command center</h2>
          <p className="section-helper">
            Global entry point for Hahitantsoa and Titan operators, with brand context,
            quick actions, and live summary cards aligned to the client-approved prototype.
          </p>
        </div>

        <div className="dashboard-hero__rail" aria-label="Operational shortcuts">
          <button className="hero-chip hero-chip--hah" type="button" onClick={() => onNavigate("hahitantsoa")}>
            Hahitantsoa flow
          </button>
          <button className="hero-chip hero-chip--titan" type="button" onClick={() => onNavigate("titan")}>
            Titan inventory
          </button>
          <button
            className="hero-chip hero-chip--neutral"
            type="button"
            onClick={() => onNavigate("commercial-ops")}
          >
            Billing workspace
          </button>
        </div>
      </div>

      {error && (
        <div className="notice error-notice" role="alert">
          <h3>Dashboard diagnostics warning</h3>
          <p>{error}</p>
          <p>Verify the authenticated Django session if the summary cannot be loaded.</p>
        </div>
      )}

      <div className="dashboard-grid dashboard-grid--summary">
        {overviewCards.map((card) => (
          <article className={`dashboard-card dashboard-card--${card.tone}`} key={card.title}>
            <div className="dashboard-card__header">
              <div>
                <p className="dashboard-card__eyebrow">Live summary</p>
                <h3>{card.title}</h3>
              </div>
              <span className={`scope-chip scope-chip--${card.tone}`}>Prototype 4</span>
            </div>
            <p className="dashboard-card__value">{card.value}</p>
            <p className="dashboard-card__description">{card.description}</p>
            <button type="button" className="dashboard-card__action" onClick={card.onAction}>
              {card.actionLabel}
            </button>
          </article>
        ))}
      </div>

      <div className="dashboard-layout">
        <section className="dashboard-panel" aria-labelledby="dashboard-quick-actions-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quick actions</p>
              <h3 id="dashboard-quick-actions-heading">Prototype-inspired shortcuts</h3>
            </div>
          </div>
          <div className="dashboard-actions">
            <button className="dashboard-action" type="button" onClick={() => onNavigate("titan")}>
              Manage inventory
              <span>Jump into the Titan scope.</span>
            </button>
            <button className="dashboard-action" type="button" onClick={() => onNavigate("hahitantsoa")}>
              Prepare event draft
              <span>Open the Hahitantsoa planning flow.</span>
            </button>
            <button className="dashboard-action" type="button" onClick={() => onNavigate("commercial-ops")}>
              Review operations
              <span>Inspect billing, cashbox and settlement workspaces.</span>
            </button>
          </div>
        </section>

        <section className="dashboard-panel" aria-labelledby="dashboard-context-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Brand and scope</p>
              <h3 id="dashboard-context-heading">Operational context</h3>
            </div>
          </div>
          <ul className="dashboard-context-list">
            <li>
              <strong>Ergon</strong>
              <span>Master brand in the app shell and login presentation.</span>
            </li>
            <li>
              <strong>Hahitantsoa</strong>
              <span>Event-domain scope for planning, discovery, and commercial handoff.</span>
            </li>
            <li>
              <strong>Titan Rental</strong>
              <span>Material rental scope for stock, reservations, and operational follow-up.</span>
            </li>
          </ul>
        </section>
      </div>

      <div className="dashboard-welcome">
        <h3>System authenticated session active</h3>
        <p>
          The dashboard keeps the current shell, FE-A permission gating, and prototype-driven
          branding intact while surfacing the main operational routes.
        </p>
      </div>
    </section>
  );
}

export default DashboardPanel;
