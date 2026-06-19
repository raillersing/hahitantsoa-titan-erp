import { useEffect, useState } from "react";
import { getInventoryItems, getHahitantsoaEventDrafts, getReservationDrafts, getPayments } from "./api";


type DashboardMetrics = {
  inventoryCount: number;
  eventDraftCount: number;
  reservationDraftCount: number;
  paymentCount: number;
};


type DashboardPanelProps = {
  onNavigate: (scope: "titan" | "hahitantsoa" | "commercial-ops") => void;
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
          getHahitantsoaEventDrafts(controller.signal),
          getReservationDrafts(controller.signal),
          getPayments(controller.signal).catch(() => [] as import('./types').Payment[]),
        ]);

        setMetrics({
          inventoryCount: items.length,
          eventDraftCount: eventDrafts.length,
          reservationDraftCount: reservationDrafts.length,
          paymentCount: payments.length,
        });

        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard statistics.");
        setLoading(false);
      }
    }

    void fetchDashboardData();

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="notice loading-notice" role="status">
        <p className="loading-spinner">Loading ERP dashboard summary...</p>
      </div>
    );
  }

  return (
    <section className="dashboard-section" aria-labelledby="dashboard-overview-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Enterprise Overview</p>
          <h2 id="dashboard-overview-heading">ERP Dashboard</h2>
          <p className="section-helper">
            Consolidated operational status across Hahitantsoa Discovery planning and Titan rental systems.
          </p>
        </div>
      </div>

      {error && (
        <div className="notice error-notice" role="alert">
          <h3>Dashboard Diagnostics Warning</h3>
          <p>{error}</p>
          <p>Verify active Django backend session/auth if connection fails.</p>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="metric-card">
          <div className="metric-header">
            <h3>Titan Inventory Items</h3>
            <span className="metric-badge">Catalog</span>
          </div>
          <p className="metric-value">{metrics.inventoryCount}</p>
          <p className="metric-desc">Physical rental items, materials, and pack definitions.</p>
          <button
            type="button"
            className="metric-action-btn"
            onClick={() => onNavigate("titan")}
          >
            Manage Inventory &rarr;
          </button>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Hahitantsoa Event Drafts</h3>
            <span className="metric-badge">Discovery</span>
          </div>
          <p className="metric-value">{metrics.eventDraftCount}</p>
          <p className="metric-desc">Exploratory planning drafts and event-specific pre-reservation workflows.</p>
          <button
            type="button"
            className="metric-action-btn"
            onClick={() => onNavigate("hahitantsoa")}
          >
            Explore Drafts &rarr;
          </button>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Titan Reservation Drafts</h3>
            <span className="metric-badge">Reservations</span>
          </div>
          <p className="metric-value">{metrics.reservationDraftCount}</p>
          <p className="metric-desc">Active draft-only material reservations prepared for confirmation.</p>
          <button
            type="button"
            className="metric-action-btn"
            onClick={() => onNavigate("titan")}
          >
            Check Availability &rarr;
          </button>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Commercial Operations</h3>
            <span className="metric-badge">Operations</span>
          </div>
          <p className="metric-value">{metrics.paymentCount}</p>
          <p className="metric-desc">Billing, payments capture, operational logistics, returns, and damages closeout.</p>
          <button
            type="button"
            className="metric-action-btn"
            onClick={() => onNavigate("commercial-ops")}
          >
            View Operations &rarr;
          </button>
        </div>
      </div>

      <div className="dashboard-welcome">
        <h3>System Authenticated session active</h3>
        <p>Your current session is validated using the framework Django session cookie. Both Titan inventory rules and Hahitantsoa scope boundaries are actively enforced.</p>
      </div>
    </section>
  );
}

export default DashboardPanel;
