import './operational-styles.css';
import React, { useState } from 'react';
import type { StockMovementRecord } from './types';

const PENDING_BACKEND_NOTICE = (
  <div className="ops-pending-notice" role="status">
    <span className="ops-pending-badge">Pending Backend Contract</span>
    <p className="ops-pending-hint">
      Stock Movement Ledger backend routes are not yet merged to main. This panel will
      activate automatically once the backend service is available.
    </p>
  </div>
);

const KIND_LABELS: Record<StockMovementRecord['kind'], string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  adjustment: 'Adjustment',
  write_off: 'Write-off',
};

export function StockMovementLedgerPanel() {
  const [records] = useState<StockMovementRecord[]>([]);
  const [_loading] = useState(false);

  return (
    <div className="ops-panel" data-testid="stock-movement-ledger-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Movement Ledger</h3>
      </div>
      {PENDING_BACKEND_NOTICE}
      {records.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Stock movement records list">
          {records.map((r) => (
            <li key={r.id} className="ops-row" data-testid={`stock-row-${r.id}`}>
              <span className="ops-row__ref">{r.reference}</span>
              <span className="ops-row__status">{KIND_LABELS[r.kind]}</span>
              <span className="ops-row__detail">{r.item_description}</span>
              <span className="ops-row__qty">Qty: {r.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default StockMovementLedgerPanel;
