import './operational-styles.css';
import React, { useState } from 'react';
import type { BreakageRecord } from './types';

const PENDING_BACKEND_NOTICE = (
  <div className="ops-pending-notice" role="status">
    <span className="ops-pending-badge">Pending Backend Contract</span>
    <p className="ops-pending-hint">
      Breakage &amp; Loss backend routes are not yet merged to main. This panel will
      activate automatically once the backend service is available.
    </p>
  </div>
);

const STATUS_LABELS: Record<BreakageRecord['status'], string> = {
  reported: 'Reported',
  assessed: 'Assessed',
  invoiced: 'Invoiced',
  resolved: 'Resolved',
};

export function BreakageLossPanel() {
  const [records] = useState<BreakageRecord[]>([]);
  const [_loading] = useState(false);

  return (
    <div className="ops-panel" data-testid="breakage-loss-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Damage Assessment</h3>
      </div>
      {PENDING_BACKEND_NOTICE}
      {records.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Breakage records list">
          {records.map((r) => (
            <li key={r.id} className="ops-row" data-testid={`breakage-row-${r.id}`}>
              <span className="ops-row__ref">{r.reference}</span>
              <span className="ops-row__status">{STATUS_LABELS[r.status]}</span>
              <span className="ops-row__detail">{r.item_description}</span>
              <span className="ops-row__amount">{r.estimated_value} MGA</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BreakageLossPanel;
