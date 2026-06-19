import './operational-styles.css';
import React, { useEffect, useRef, useState } from 'react';
import { getReturnOperations } from './api';
import type { InventoryReturnOperation } from './types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  validated: 'Validated',
};

function ReturnRow({ operation }: { operation: InventoryReturnOperation }) {
  const totalReturned = operation.lines.reduce(
    (sum, l) => sum + l.returned_quantity, 0,
  );
  const totalMissing = operation.lines.reduce(
    (sum, l) => sum + l.missing_quantity, 0,
  );

  return (
    <div className="ops-row" data-testid={`return-row-${operation.id}`}>
      <span className="ops-row__ref">
        {operation.id.slice(0, 8)}
      </span>
      <span className="ops-row__status">
        {STATUS_LABELS[operation.status] || operation.status}
      </span>
      <span className="ops-row__detail">
        {totalReturned} returned / {totalMissing} missing
      </span>
      <span className="ops-row__qty">
        {operation.lines.length} line{operation.lines.length !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

export function ReturnsHandlingPanel() {
  const [operations, setOperations] = useState<InventoryReturnOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      abortRef.current = new AbortController();
      try {
        const data = await getReturnOperations(abortRef.current.signal);
        setOperations(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load return operations.');
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="ops-panel" data-testid="returns-handling-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Returns Log</h3>
      </div>

      {loading && (
        <div className="loading-notice" aria-live="polite">
          Loading return operations...
        </div>
      )}

      {!loading && error && (
        <div className="notice error-notice" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && operations.length === 0 && (
        <div className="ops-empty">No return operations found.</div>
      )}

      {!loading && !error && operations.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Return operations list">
          {operations.map((op) => (
            <li key={op.id}>
              <ReturnRow operation={op} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ReturnsHandlingPanel;
