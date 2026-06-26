import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { checkEndpointPermission, getStockMovements } from "./api";
import type { InventoryStockMovement } from "./types";

const TYPE_LABELS: Record<string, string> = {
  outbound_delivery: "Livraison sortante",
  inbound_return: "Retour entrant",
  adjustment_in: "Ajustement entrant",
  adjustment_out: "Ajustement sortant",
  damage: "Dommage",
  loss: "Perte",
  other: "Autre",
};

const DIRECTION_LABELS: Record<string, string> = {
  inbound: "Entrant",
  outbound: "Sortant",
};

export function StockMovementLedgerPanel() {
  const [movements, setMovements] = useState<InventoryStockMovement[]>([]);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selectedMovement = useMemo(
    () => movements.find((movement) => movement.id === selectedMovementId) ?? null,
    [movements, selectedMovementId],
  );

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getStockMovements(abortRef.current.signal);
      const nextMovements = Array.isArray(data) ? data : [];
      setMovements(nextMovements);
      setSelectedMovementId((current) =>
        current && nextMovements.some((movement) => movement.id === current)
          ? current
          : nextMovements[0]?.id ?? null,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Failed to load stock movements.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/inventory/stock-movements/", "OPTIONS", controller.signal)
      .then(setCanWrite);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return (
    <div className="ops-panel" data-testid="stock-movement-ledger-panel">
      <div className="ops-panel__header">
        <div className="ops-panel__header-copy">
          <p className="eyebrow">Registre de stock prototype</p>
          <h3 className="ops-panel__title">Registre des mouvements et traçabilité</h3>
          <p className="ops-panel__summary">
            L'historique des mouvements de stock utilise une mise en page de registre prototype tout en préservant la limite d'écriture Titan.
          </p>
        </div>
        {canWrite ? (
          <span className="permission-tag permission-ok" data-testid="stock-write-ok">Accès écriture</span>
        ) : (
          <span className="permission-tag permission-denied" data-testid="stock-write-denied">Lecture seule</span>
        )}
      </div>

      {loading ? <div className="loading-notice">Chargement des mouvements de stock...</div> : null}

      {!loading && error ? (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={() => void load()} aria-label="Réessayer le chargement des mouvements de stock">
            Réessayer
          </button>
        </div>
      ) : null}

      {!loading && !error && movements.length === 0 ? (
        <div className="ops-empty">Aucun mouvement de stock enregistré.</div>
      ) : null}

      {!loading && !error && movements.length > 0 ? (
        <div className="ops-layout">
          <section className="ops-list-panel">
            <div className="ops-section-heading">
              <div>
                <h4>Entrées du registre</h4>
                <p className="ops-section-helper">Utilisez le scope Titan pour la création de mouvements ; cette vue se concentre sur la traçabilité.</p>
              </div>
            </div>
            <ul className="ops-list" role="list" aria-label="Liste des mouvements de stock">
              {movements.map((movement) => (
                <li key={movement.id}>
                  <button
                    className="ops-row"
                    data-testid={`stock-movement-row-${movement.id}`}
                    type="button"
                    aria-pressed={selectedMovementId === movement.id}
                    onClick={() => setSelectedMovementId(movement.id)}
                  >
                    <div className="ops-row__primary">
                      <span className="ops-row__title">{TYPE_LABELS[movement.movement_type] || movement.movement_type}</span>
                      <span className="ops-row__subtext">{movement.source_label || "Pas de source"}</span>
                    </div>
                    <span className="ops-chip ops-chip--dispatched">{DIRECTION_LABELS[movement.direction] || movement.direction}</span>
                    <span className="ops-row__qty">×{movement.quantity}</span>
                    <span className="ops-row__detail">{movement.effective_at ? new Date(movement.effective_at).toLocaleString() : "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="ops-detail-panel">
            {selectedMovement ? (
              <div className="ops-detail-stack">
                <div className="ops-section-heading">
                  <div>
                    <h4>Détail du registre</h4>
                    <p className="ops-section-helper">Ce panneau reste en lecture seule ; la création reste dans le scope inventaire Titan.</p>
                  </div>
                  <span className="ops-chip ops-chip--planned">{selectedMovement.id.slice(0, 8)}</span>
                </div>

                <dl className="ops-metrics">
                  <div className="ops-metric-card">
                    <dt>Type de mouvement</dt>
                    <dd>{TYPE_LABELS[selectedMovement.movement_type] || selectedMovement.movement_type}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Direction</dt>
                    <dd>{DIRECTION_LABELS[selectedMovement.direction] || selectedMovement.direction}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Quantité</dt>
                    <dd>{selectedMovement.quantity}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Effectif le</dt>
                    <dd>{selectedMovement.effective_at ? new Date(selectedMovement.effective_at).toLocaleString() : "—"}</dd>
                  </div>
                </dl>

                <section className="ops-detail-section">
                  <h5>Traçabilité</h5>
                  <dl className="ops-detail-meta">
                    <div>
                      <dt>Article</dt>
                      <dd>{selectedMovement.inventory_item}</dd>
                    </div>
                    <div>
                      <dt>Réservation</dt>
                      <dd>{selectedMovement.reservation_draft ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Validé le</dt>
                      <dd>{selectedMovement.validated_at ? new Date(selectedMovement.validated_at).toLocaleString() : "En attente"}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{selectedMovement.source_label || "—"}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            ) : (
              <p className="ops-empty">Sélectionnez un mouvement pour inspecter sa traçabilité.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default StockMovementLedgerPanel;
