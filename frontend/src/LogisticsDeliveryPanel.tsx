import './operational-styles.css';
import React, { useState } from 'react';
import type { DeliveryRecord } from './types';

// Placeholder panel — backend routes for logistics/delivery are not on main yet.
// This surface is API-ready: endpoints, types, and UI states are wired for activation
// once the Codex logistics backend merges to main.

const PENDING_BACKEND_NOTICE = (
  <div className="ops-pending-notice" role="status">
    <span className="ops-pending-badge">Pending Backend Contract</span>
    <p className="ops-pending-hint">
      Logistics &amp; Delivery backend routes are not yet merged to main. This panel will
      activate automatically once the backend service is available.
    </p>
  </div>
);

const STATUS_LABELS: Record<DeliveryRecord['status'], string> = {
  scheduled: 'Scheduled',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  failed: 'Failed',
};

export function LogisticsDeliveryPanel() {
  // State preserved for API-readiness — will be wired to getDeliveryRecords() once available
  const [records] = useState<DeliveryRecord[]>([]);
  const [_loading] = useState(false);

  return (
    <div className="ops-panel" data-testid="logistics-delivery-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Delivery Records</h3>
      </div>
      {PENDING_BACKEND_NOTICE}
      {records.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Delivery records list">
          {records.map((r) => (
            <li key={r.id} className="ops-row" data-testid={`delivery-row-${r.id}`}>
              <span className="ops-row__ref">{r.reference}</span>
              <span className="ops-row__status">{STATUS_LABELS[r.status]}</span>
              <span className="ops-row__operator">{r.operator_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LogisticsDeliveryPanel;
