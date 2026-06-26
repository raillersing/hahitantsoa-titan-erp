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
  glyph: string;
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
      title: "Inventaire Titan",
      value: String(metrics.inventoryCount),
      description: "Articles, matériels et packs en stock pour les opérateurs.",
      tone: "titan",
      actionLabel: "Ouvrir Titan",
      onAction: () => onNavigate("titan"),
      glyph: "\u25a3",
    },
    {
      title: "Brouillons Hahitantsoa",
      value: String(metrics.eventDraftCount),
      description: "Brouillons d'événements en préparation pour le domaine événementiel.",
      tone: "hah",
      actionLabel: "Ouvrir Hahitantsoa",
      onAction: () => onNavigate("hahitantsoa"),
      glyph: "\u2606",
    },
    {
      title: "Brouillons de réservation",
      value: String(metrics.reservationDraftCount),
      description: "Réservations en attente de confirmation, validation ou suivi.",
      tone: "titan",
      actionLabel: "Voir les réservations",
      onAction: () => onNavigate("titan"),
      glyph: "\u2630",
    },
    {
      title: "Paiements en cours",
      value: String(metrics.paymentCount),
      description: "Facturation, règlements et points de paiement nécessitant un suivi.",
      tone: "neutral",
      actionLabel: "Opérations commerciales",
      onAction: () => onNavigate("commercial-ops"),
      glyph: "\u2605",
    },
  ];

  if (loading) {
    return (
      <section className="dashboard-section" aria-labelledby="dashboard-overview-heading" role="status">
        <div className="dashboard-hero">
          <div className="dashboard-hero__copy">
            <p className="eyebrow">Vue d'ensemble</p>
            <h2 id="dashboard-overview-heading">Centre de commande ERP</h2>
          </div>
        </div>
        <div className="dashboard-grid dashboard-grid--summary" aria-label="Chargement des indicateurs">
          {[0, 1, 2, 3].map((i) => (
            <div className="dashboard-card" key={i}>
              <div className="dashboard-card__header">
                <div style={{ width: "60%", height: "1rem" }} className="skeleton" />
              </div>
              <div style={{ width: "40%", height: "2.5rem", marginTop: "0.5rem" }} className="skeleton" />
              <div style={{ width: "80%", height: "0.85rem", marginTop: "0.5rem" }} className="skeleton" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-section" aria-labelledby="dashboard-overview-heading">
      <div className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <p className="eyebrow">Vue d'ensemble</p>
          <h2 id="dashboard-overview-heading">Centre de commande ERP</h2>
          <p className="section-helper">
            Point d'entrée global pour les opérateurs Hahitantsoa et Titan, avec
            indicateurs en direct et accès rapides.
          </p>
        </div>

        <div className="dashboard-hero__rail" aria-label="Raccourcis opérationnels">
          <button className="hero-chip hero-chip--hah" type="button" onClick={() => onNavigate("hahitantsoa")}>
            Flux Hahitantsoa
          </button>
          <button className="hero-chip hero-chip--titan" type="button" onClick={() => onNavigate("titan")}>
            Inventaire Titan
          </button>
          <button
            className="hero-chip hero-chip--neutral"
            type="button"
            onClick={() => onNavigate("commercial-ops")}
          >
            Espace facturation
          </button>
        </div>
      </div>

      {error && (
        <div className="notice error-notice" role="alert">
          <h3>Erreur de chargement</h3>
          <p>{error}</p>
          <p>Vérifiez votre session Django authentifiée.</p>
        </div>
      )}

      <div className="dashboard-grid dashboard-grid--summary">
        {overviewCards.map((card) => (
          <article
            className={`dashboard-card dashboard-card--${card.tone} card-hover`}
            key={card.title}
          >
            <div className="dashboard-card__header">
              <div className="metric-icon metric-icon--{card.tone}">{card.glyph}</div>
              <div style={{ flex: 1 }}>
                <p className="dashboard-card__eyebrow">Indicateur en direct</p>
                <h3>{card.title}</h3>
              </div>
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
              <p className="eyebrow">Accès rapides</p>
              <h3 id="dashboard-quick-actions-heading">Raccourcis vers les modules</h3>
            </div>
          </div>
          <div className="dashboard-actions">
            <button className="dashboard-action" type="button" onClick={() => onNavigate("titan")}>
              Gérer l'inventaire
              <span>Accéder au module Titan pour la gestion des stocks.</span>
            </button>
            <button className="dashboard-action" type="button" onClick={() => onNavigate("hahitantsoa")}>
              Préparer un événement
              <span>Ouvrir le module Hahitantsoa pour les brouillons d'événements.</span>
            </button>
            <button className="dashboard-action" type="button" onClick={() => onNavigate("commercial-ops")}>
              Opérations commerciales
              <span>Facturation, caisse et règlements.</span>
            </button>
          </div>
        </section>

        <section className="dashboard-panel" aria-labelledby="dashboard-context-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Périmètre et marque</p>
              <h3 id="dashboard-context-heading">Context opérationnel</h3>
            </div>
          </div>
          <ul className="dashboard-context-list">
            <li>
              <strong>Ergon</strong>
              <span>Marque principale dans l'interface et l'écran de connexion.</span>
            </li>
            <li>
              <strong>Hahitantsoa</strong>
              <span>Domaine événementiel : planning, découverte, commercial.</span>
            </li>
            <li>
              <strong>Titan Rental</strong>
              <span>Domaine location matériel : stock, réservations, suivi opérationnel.</span>
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}

export default DashboardPanel;
