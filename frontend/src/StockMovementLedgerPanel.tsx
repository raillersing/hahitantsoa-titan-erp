import './operational-styles.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { checkEndpointPermission, getStockMovements } from './api';
import type { InventoryStockMovement } from './types';

const TYPE_LABELS: Record<string, string> = {
  outbound_delivery: 'Outbound Delivery',
  inbound_return: 'Inbound Return',
  adjustment_in: 'Adjustment In',
  adjustment_out: 'Adjustment Out',
  damage: 'Damage',
  loss: 'Loss',
  other: 'Other',
};

const DIRECTION_LABELS: Record<string, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
};

export function StockMovementLedgerPanel() {
  const [movements, setMovements] = useState<InventoryStockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission('/api/v1/inventory/stock-movements/', 'OPTIONS', controller.signal)
      .then(setCanWrite);
    return () => controller.abort();
  }, []);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getStockMovements(abortRef.current.signal);
      setMovements(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Failed to load stock movements.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  return (
    <div className="ops-panel" data-testid="stock-movement-ledger-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Movement Ledger</h3>
        {canWrite ? (
          <span className="permission-tag permission-ok" data-testid="stock-write-ok">Write access</span>
        ) : (
          <span className="permission-tag permission-denied" data-testid="stock-write-denied">Read-only</span>
        )}
      </div>

      {loading && (
        <div className="loading-notice" aria-live="polite">
          Loading stock movements...
        </div>
      )}

      {!loading && error && (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={load} aria-label="Retry loading stock movements">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && movements.length === 0 && (
        <div className="ops-empty">No stock movements recorded yet.</div>
      )}

      {!loading && !error && movements.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Stock movements list">
          {movements.map((m) => (
            <li key={m.id}>
              <div className="ops-row" data-testid={`stock-movement-row-${m.id}`}>
                <span className="ops-row__status">
                  {TYPE_LABELS[m.movement_type] || m.movement_type}
                </span>
                <span className="ops-row__ref">
                  {DIRECTION_LABELS[m.direction] || m.direction}
                </span>
                <span className="ops-row__qty">&times;{m.quantity}</span>
                {m.source_label && (
                  <span className="ops-row__detail">{m.source_label}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="ops-panel__actions" data-testid="stock-actions">
          <p className="permission-note">
            Write access enabled. Record movement actions are available in the Titan scope.
          </p>
        </div>
      )}
    </div>
  );
}

export default StockMovementLedgerPanel;
