import './operational-styles.css';
import React, { useState } from 'react';
import type { ReturnRecord } from './types';

const PENDING_BACKEND_NOTICE = (
  <div className="ops-pending-notice" role="status">
    <span className="ops-pending-badge">Pending Backend Contract</span>
    <p className="ops-pending-hint">
      Returns Handling backend routes are not yet merged to main. This panel will
      activate automatically once the backend service is available.
    </p>
  </div>
);

const STATUS_LABELS: Record<ReturnRecord['status'], string> = {
  pending: 'Pending',
  partial: 'Partial',
  complete: 'Complete',
  disputed: 'Disputed',
};

export function ReturnsHandlingPanel() {
  const [records] = useState<ReturnRecord[]>([]);
  const [_loading] = useState(false);

  return (
    <div className="ops-panel" data-testid="returns-handling-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Returns Log</h3>
      </div>
      {PENDING_BACKEND_NOTICE}
      {records.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Returns records list">
          {records.map((r) => (
            <li key={r.id} className="ops-row" data-testid={`return-row-${r.id}`}>
              <span className="ops-row__ref">{r.reference}</span>
              <span className="ops-row__status">{STATUS_LABELS[r.status]}</span>
              <span className="ops-row__detail">
                {r.items_returned} returned / {r.items_missing} missing
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ReturnsHandlingPanel;
