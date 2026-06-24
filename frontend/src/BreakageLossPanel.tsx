import './operational-styles.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { checkEndpointPermission, getDamageLossSettlements } from './api';
import type { InventoryDamageLossSettlement } from './types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  validated: 'Validated',
  cancelled: 'Cancelled',
};

const STATUS_CLASSES: Record<string, string> = {
  draft: '',
  validated: '',
  cancelled: '',
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat('fr-MG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function SettlementRow({ settlement }: { settlement: InventoryDamageLossSettlement }) {
  return (
    <div className="ops-row" data-testid={`settlement-row-${settlement.id}`}>
      <span className="ops-row__ref">
        {settlement.return_operation.slice(0, 8)}
      </span>
      <span className={`ops-row__status ${STATUS_CLASSES[settlement.settlement_status] || ''}`}>
        {STATUS_LABELS[settlement.settlement_status] || settlement.settlement_status}
      </span>
      <span className="ops-row__detail">
        {settlement.damage_loss_total > 0
          ? `${formatAmount(settlement.damage_loss_total)} MGA`
          : '—'}
      </span>
      <span className="ops-row__qty">
        {settlement.lines.length} line{settlement.lines.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

export function BreakageLossPanel() {
  const [settlements, setSettlements] = useState<InventoryDamageLossSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission('/api/v1/inventory/damage-loss-settlements/', 'OPTIONS', controller.signal)
      .then(setCanWrite);
    return () => controller.abort();
  }, []);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getDamageLossSettlements(abortRef.current.signal);
      setSettlements(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Failed to load damage & loss settlements.');
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
    <div className="ops-panel" data-testid="breakage-loss-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Damage Assessment</h3>
        {canWrite ? (
          <span className="permission-tag permission-ok" data-testid="breakage-write-ok">Write access</span>
        ) : (
          <span className="permission-tag permission-denied" data-testid="breakage-write-denied">Read-only</span>
        )}
      </div>

      {loading && (
        <div className="loading-notice" aria-live="polite">
          Loading damage assessment...
        </div>
      )}

      {!loading && error && (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={load} aria-label="Retry loading settlements">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && settlements.length === 0 && (
        <div className="ops-empty">No damage & loss settlements found.</div>
      )}

      {!loading && !error && settlements.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Settlement records list">
          {settlements.map((s) => (
            <li key={s.id}>
              <SettlementRow settlement={s} />
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="ops-panel__actions" data-testid="breakage-actions">
          <p className="permission-note">
            Write access enabled. Validate and execute settlement actions will be available in a future update.
          </p>
        </div>
      )}
    </div>
  );
}

export default BreakageLossPanel;
