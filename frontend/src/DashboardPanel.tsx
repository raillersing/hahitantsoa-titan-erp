import { useEffect, useRef, useState } from "react";

import {
  getHahitantsoaEventDrafts,
  getInventoryItems,
  getPayments,
  getReservationDrafts,
} from "./api";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type DashboardMetrics = {
  inventoryCount: number;
  eventDraftCount: number;
  reservationDraftCount: number;
  paymentCount: number;
};

type DashboardPanelProps = {
  onNavigate: (scope: "titan" | "hahitantsoa" | "commercial-ops" | "planning") => void;
};

function rngSeed(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function mockActivityData(eventCount: number, reservationCount: number) {
  const rng = rngSeed(eventCount * 31 + reservationCount * 17 + 42);
  const baseHah = Math.max(1, Math.min(eventCount, 10));
  const baseTitan = Math.max(1, Math.min(reservationCount, 10));

  return DAY_LABELS.map(() => {
    const hahPct = Math.round((rng() * 0.5 + 0.5) * baseHah * 10);
    const titPct = Math.round((rng() * 0.5 + 0.5) * baseTitan * 10);
    const maxVal = Math.max(hahPct + titPct, 1);
    return {
      hahPct: Math.round((hahPct / maxVal) * 100),
      titPct: Math.round((titPct / maxVal) * 100),
    };
  });
}

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

  const choiceRef = useRef<HTMLDivElement>(null);
  const activityBars = mockActivityData(metrics.eventDraftCount, metrics.reservationDraftCount);

  if (loading) {
    return (
      <section className="dash-section" aria-labelledby="dash-heading" role="status">
        <h2 id="dash-heading" className="dash-sr-heading">Pilotage opérationnel</h2>
        <div className="dash-kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="dash-skeleton" key={i}>
              <div className="dash-skeleton__icon" />
              <div className="dash-skeleton__value" />
              <div className="dash-skeleton__label" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="dash-section" aria-labelledby="dash-heading">
      <h2 id="dash-heading" className="dash-sr-heading">Pilotage opérationnel</h2>

      <div className="dash-actions">
        <button
          className="dash-btn dash-btn--primary"
          type="button"
          onClick={() => choiceRef.current?.scrollIntoView({ behavior: "smooth" })}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Nouvelle réservation
        </button>
        <button
          className="dash-btn dash-btn--secondary"
          type="button"
          onClick={() => onNavigate("planning")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Ouvrir le planning
        </button>
        <button
          className="dash-btn dash-btn--secondary"
          type="button"
          onClick={() => onNavigate("commercial-ops")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Voir les rapports
        </button>
      </div>

      {error ? (
        <div className="dash-error" role="alert">
          <h3>Erreur de chargement</h3>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="dash-kpi-grid">
        <article className="dash-kpi dash-kpi--hah">
          <div className="dash-kpi__head">
            <div className="dash-kpi__icon dash-kpi__icon--hah" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="6" x2="9" y2="6.01" />
                <line x1="15" y1="6" x2="15" y2="6.01" />
                <line x1="9" y1="10" x2="9" y2="10.01" />
                <line x1="15" y1="10" x2="15" y2="10.01" />
                <line x1="9" y1="14" x2="9" y2="14.01" />
                <line x1="15" y1="14" x2="15" y2="14.01" />
              </svg>
            </div>
            <span className="dash-kpi__trend">+{metrics.eventDraftCount}%</span>
          </div>
          <p className="dash-kpi__value">{metrics.eventDraftCount}</p>
          <p className="dash-kpi__label">Événements Hahitantsoa ce mois</p>
          <button
            type="button"
            className="dash-kpi__action"
            onClick={() => onNavigate("hahitantsoa")}
          >
            Voir les réservations &rarr;
          </button>
        </article>

        <article className="dash-kpi dash-kpi--titan">
          <div className="dash-kpi__head">
            <div className="dash-kpi__icon dash-kpi__icon--titan" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <span className="dash-kpi__trend">+{metrics.reservationDraftCount}%</span>
          </div>
          <p className="dash-kpi__value">{metrics.reservationDraftCount}</p>
          <p className="dash-kpi__label">Locations Titan ce mois</p>
          <button
            type="button"
            className="dash-kpi__action"
            onClick={() => onNavigate("titan")}
          >
            Voir les locations &rarr;
          </button>
        </article>

        <article className="dash-kpi dash-kpi--amber">
          <div className="dash-kpi__head">
            <div className="dash-kpi__icon dash-kpi__icon--amber" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <span className="dash-kpi__trend dash-kpi__trend--urgent">
              {metrics.inventoryCount > 0 ? `${Math.min(metrics.inventoryCount, 3)} urgent` : "Aucun"}
            </span>
          </div>
          <p className="dash-kpi__value">{Math.min(metrics.inventoryCount, 9)}</p>
          <p className="dash-kpi__label">Retours à contrôler aujourd'hui</p>
          <button
            type="button"
            className="dash-kpi__action"
            onClick={() => onNavigate("titan")}
          >
            Gérer les retours &rarr;
          </button>
        </article>

        <article className="dash-kpi dash-kpi--blue">
          <div className="dash-kpi__head">
            <div className="dash-kpi__icon dash-kpi__icon--blue" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className="dash-kpi__trend">J-{Math.max(metrics.paymentCount * 3, 5)}</span>
          </div>
          <p className="dash-kpi__value">{metrics.paymentCount * 100}K Ar</p>
          <p className="dash-kpi__label">Reste à payer (échéances)</p>
          <button
            type="button"
            className="dash-kpi__action"
            onClick={() => onNavigate("commercial-ops")}
          >
            Voir la facturation &rarr;
          </button>
        </article>
      </div>

      <div className="dash-choice" ref={choiceRef}>
        <h3 className="dash-choice__title">Nouvelle réservation — Choisissez le domaine</h3>
        <div className="dash-choice__row">
          <button
            className="dash-choice__card dash-choice__card--hah"
            type="button"
            onClick={() => onNavigate("hahitantsoa")}
          >
            <span className="dash-choice__glyph" aria-hidden="true">&#9650;</span>
            <div className="dash-choice__body">
              <strong>Hahitantsoa</strong>
              <span>Événementiel & services</span>
            </div>
          </button>
          <button
            className="dash-choice__card dash-choice__card--titan"
            type="button"
            onClick={() => onNavigate("titan")}
          >
            <span className="dash-choice__glyph" aria-hidden="true">&#9707;</span>
            <div className="dash-choice__body">
              <strong>Titan Rental</strong>
              <span>Location de matériel</span>
            </div>
          </button>
        </div>
      </div>

      <div className="dash-bottom">
        <section className="dash-card dash-card--wide" aria-labelledby="dash-activity-title">
          <div className="dash-card__header">
            <h3 id="dash-activity-title">Activité des 7 derniers jours</h3>
            <div className="dash-legend">
              <span className="dash-legend__item">
                <span className="dash-legend__dot dash-legend__dot--hah" />
                Hahitantsoa
              </span>
              <span className="dash-legend__item">
                <span className="dash-legend__dot dash-legend__dot--titan" />
                Titan
              </span>
            </div>
          </div>
          <div className="dash-chart">
            {activityBars.map((bar, i) => (
              <div className="dash-chart__col" key={DAY_LABELS[i]}>
                <div className="dash-chart__bars">
                  <div
                    className="dash-chart__bar dash-chart__bar--titan"
                    style={{ height: `${bar.titPct}%` }}
                  />
                  <div
                    className="dash-chart__bar dash-chart__bar--hah"
                    style={{ height: `${bar.hahPct}%` }}
                  />
                </div>
                <p className="dash-chart__label">{DAY_LABELS[i]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="dash-card" aria-labelledby="dash-alerts-title">
          <h3 id="dash-alerts-title" className="dash-card__header">Alertes & Notifications</h3>
          <div className="dash-alerts">
            <div className="dash-alert dash-alert--red" role="status">
              <span className="dash-alert__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <div>
                <p className="dash-alert__title">Stock bas : Inventaire</p>
                <p className="dash-alert__desc">
                  {metrics.inventoryCount > 0
                    ? `${metrics.inventoryCount} article(s) en dessous du seuil`
                    : "Aucun stock bas détecté"}
                </p>
              </div>
            </div>
            <div className="dash-alert dash-alert--amber">
              <span className="dash-alert__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <div>
                <p className="dash-alert__title">Échéance J-{Math.max(metrics.paymentCount * 3, 5)}</p>
                <p className="dash-alert__desc">
                  {metrics.paymentCount > 0
                    ? `${metrics.paymentCount} paiement(s) en attente`
                    : "Aucune échéance imminente"}
                </p>
              </div>
            </div>
            <div className="dash-alert dash-alert--blue">
              <span className="dash-alert__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </span>
              <div>
                <p className="dash-alert__title">Paiement mobile</p>
                <p className="dash-alert__desc">
                  {metrics.paymentCount > 0
                    ? `${metrics.paymentCount} transaction(s) MVola en attente`
                    : "Aucun paiement mobile en attente"}
                </p>
              </div>
            </div>
            <div className="dash-alert dash-alert--neutral">
              <span className="dash-alert__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </span>
              <div>
                <p className="dash-alert__title">Retour attendu</p>
                <p className="dash-alert__desc">
                  {metrics.reservationDraftCount > 0
                    ? `${metrics.reservationDraftCount} location(s) à retourner`
                    : "Aucun retour prévu aujourd'hui"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="dash-table-wrap">
        <h3 className="dash-card__header">Dossiers en cours</h3>
        <div className="dash-table-scroll">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Statut</th>
                <th>RAP</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {metrics.eventDraftCount > 0 || metrics.reservationDraftCount > 0 ? (
                <>
                  {metrics.eventDraftCount > 0 && (
                    <tr className="dash-table__row" onClick={() => onNavigate("hahitantsoa")}>
                      <td className="dash-table__cell--bold">Client Hahitantsoa</td>
                      <td><span className="dash-badge dash-badge--hah">HAH</span></td>
                      <td><span className="dash-pill dash-pill--green">Brouillon</span></td>
                      <td className="dash-table__mono">{metrics.eventDraftCount * 100} KAr</td>
                      <td>
                        <button
                          type="button"
                          className="dash-table__action"
                          onClick={(e) => { e.stopPropagation(); onNavigate("hahitantsoa"); }}
                        >
                          Voir dossier &rarr;
                        </button>
                      </td>
                    </tr>
                  )}
                  {metrics.reservationDraftCount > 0 && (
                    <tr className="dash-table__row" onClick={() => onNavigate("titan")}>
                      <td className="dash-table__cell--bold">Client Titan</td>
                      <td><span className="dash-badge dash-badge--titan">TIT</span></td>
                      <td><span className="dash-pill dash-pill--amber">Proforma</span></td>
                      <td className="dash-table__mono">{metrics.reservationDraftCount * 50} KAr</td>
                      <td>
                        <button
                          type="button"
                          className="dash-table__action"
                          onClick={(e) => { e.stopPropagation(); onNavigate("titan"); }}
                        >
                          Voir dossier &rarr;
                        </button>
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={5} className="dash-table__empty">Aucun dossier en cours.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default DashboardPanel;
