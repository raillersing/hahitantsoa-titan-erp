import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { checkEndpointPermission, getStockMovements } from "./api";
import type { InventoryStockMovement } from "./types";

const TYPE_LABELS: Record<string, string> = {
  outbound_delivery: "Outbound Delivery",
  inbound_return: "Inbound Return",
  adjustment_in: "Adjustment In",
  adjustment_out: "Adjustment Out",
  damage: "Damage",
  loss: "Loss",
  other: "Other",
};

const DIRECTION_LABELS: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
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
          <p className="eyebrow">Prototype stock ledger</p>
          <h3 className="ops-panel__title">Movement ledger and traceability</h3>
          <p className="ops-panel__summary">
            Stock movement history now uses a prototype-style ledger layout while preserving the Titan-scope write boundary.
          </p>
        </div>
        {canWrite ? (
          <span className="permission-tag permission-ok" data-testid="stock-write-ok">Write access</span>
        ) : (
          <span className="permission-tag permission-denied" data-testid="stock-write-denied">Read-only</span>
        )}
      </div>

      {loading ? <div className="loading-notice">Loading stock movements...</div> : null}

      {!loading && error ? (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={() => void load()} aria-label="Retry loading stock movements">
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && movements.length === 0 ? (
        <div className="ops-empty">No stock movements recorded yet.</div>
      ) : null}

      {!loading && !error && movements.length > 0 ? (
        <div className="ops-layout">
          <section className="ops-list-panel">
            <div className="ops-section-heading">
              <div>
                <h4>Ledger entries</h4>
                <p className="ops-section-helper">Use the Titan scope for actual movement creation; this view focuses on traceability.</p>
              </div>
            </div>
            <ul className="ops-list" role="list" aria-label="Stock movements list">
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
                      <span className="ops-row__subtext">{movement.source_label || "No source label"}</span>
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
                    <h4>Ledger detail</h4>
                    <p className="ops-section-helper">This panel remains read-oriented; creation stays in the Titan inventory scope.</p>
                  </div>
                  <span className="ops-chip ops-chip--planned">{selectedMovement.id.slice(0, 8)}</span>
                </div>

                <dl className="ops-metrics">
                  <div className="ops-metric-card">
                    <dt>Movement type</dt>
                    <dd>{TYPE_LABELS[selectedMovement.movement_type] || selectedMovement.movement_type}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Direction</dt>
                    <dd>{DIRECTION_LABELS[selectedMovement.direction] || selectedMovement.direction}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Quantity</dt>
                    <dd>{selectedMovement.quantity}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Effective at</dt>
                    <dd>{selectedMovement.effective_at ? new Date(selectedMovement.effective_at).toLocaleString() : "—"}</dd>
                  </div>
                </dl>

                <section className="ops-detail-section">
                  <h5>Traceability</h5>
                  <dl className="ops-detail-meta">
                    <div>
                      <dt>Inventory item</dt>
                      <dd>{selectedMovement.inventory_item}</dd>
                    </div>
                    <div>
                      <dt>Reservation</dt>
                      <dd>{selectedMovement.reservation_draft ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Validated at</dt>
                      <dd>{selectedMovement.validated_at ? new Date(selectedMovement.validated_at).toLocaleString() : "Pending"}</dd>
                    </div>
                    <div>
                      <dt>Source label</dt>
                      <dd>{selectedMovement.source_label || "—"}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            ) : (
              <p className="ops-empty">Select a movement to inspect its traceability detail.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default StockMovementLedgerPanel;
