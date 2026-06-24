import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { checkReturnsWritePermission, getReturnOperations, validateReturnOperation } from "./api";
import type { InventoryReturnOperation } from "./types";

const STATUS_LABELS: Record<InventoryReturnOperation["status"], string> = {
  draft: "Draft",
  validated: "Validated",
};

function quantitySummary(operation: InventoryReturnOperation) {
  return operation.lines.reduce(
    (summary, line) => ({
      returned: summary.returned + line.returned_quantity,
      damaged: summary.damaged + line.damaged_quantity,
      missing: summary.missing + line.missing_quantity,
    }),
    { returned: 0, damaged: 0, missing: 0 },
  );
}

export function ReturnsHandlingPanel() {
  const [operations, setOperations] = useState<InventoryReturnOperation[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selectedOperation = useMemo(
    () => operations.find((operation) => operation.id === selectedOperationId) ?? null,
    [operations, selectedOperationId],
  );

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getReturnOperations(abortRef.current.signal);
      const nextOperations = Array.isArray(data) ? data : [];
      setOperations(nextOperations);
      setSelectedOperationId((current) =>
        current && nextOperations.some((operation) => operation.id === current)
          ? current
          : nextOperations[0]?.id ?? null,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Failed to load return operations.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkReturnsWritePermission(controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const handleValidate = async () => {
    if (!selectedOperation || !canWrite) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const nextOperation = await validateReturnOperation(selectedOperation.id);
      setOperations((current) =>
        current.map((operation) => (operation.id === nextOperation.id ? nextOperation : operation)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to validate return operation.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="ops-panel" data-testid="returns-handling-panel">
      <div className="ops-panel__header">
        <div className="ops-panel__header-copy">
          <p className="eyebrow">Prototype returns</p>
          <h3 className="ops-panel__title">Returns inspection workflow</h3>
          <p className="ops-panel__summary">
            Prototype-aligned return review with per-line intact, damaged, and missing quantities,
            plus validate action when FE-A permits write access.
          </p>
        </div>
        {canWrite ? (
          <span className="permission-tag permission-ok" data-testid="returns-write-ok">Write access</span>
        ) : (
          <span className="permission-tag permission-denied" data-testid="returns-write-denied">Read-only</span>
        )}
      </div>

      {loading ? <div className="loading-notice">Loading return operations...</div> : null}

      {!loading && error ? (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={() => void load()} aria-label="Retry loading return operations">
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && operations.length === 0 ? (
        <div className="ops-empty">No return operations found.</div>
      ) : null}

      {!loading && !error && operations.length > 0 ? (
        <div className="ops-layout">
          <section className="ops-list-panel">
            <div className="ops-section-heading">
              <div>
                <h4>Return operations</h4>
                <p className="ops-section-helper">Read/write state remains controlled by backend permission probes.</p>
              </div>
            </div>
            <ul className="ops-list" role="list" aria-label="Return operations list">
              {operations.map((operation) => {
                const summary = quantitySummary(operation);
                return (
                  <li key={operation.id}>
                    <button
                      className="ops-row"
                      data-testid={`return-row-${operation.id}`}
                      type="button"
                      aria-pressed={selectedOperationId === operation.id}
                      onClick={() => setSelectedOperationId(operation.id)}
                    >
                      <div className="ops-row__primary">
                        <span className="ops-row__title">{operation.id.slice(0, 8)}</span>
                        <span className="ops-row__subtext">{summary.returned} returned / {summary.missing} missing</span>
                      </div>
                      <span className={`ops-status-badge ops-status-badge--${operation.status}`}>
                        {STATUS_LABELS[operation.status]}
                      </span>
                      <span className="ops-row__detail">{operation.lines.length} line(s)</span>
                      <span className="ops-row__ref">{operation.reservation_draft?.slice(0, 8) ?? "No draft"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="ops-detail-panel">
            {selectedOperation ? (
              <div className="ops-detail-stack">
                <div className="ops-section-heading">
                  <div>
                    <h4>Inspection detail</h4>
                    <p className="ops-section-helper">
                      Validate only after physical review is complete.
                    </p>
                  </div>
                  <span className={`ops-status-badge ops-status-badge--${selectedOperation.status}`}>
                    {STATUS_LABELS[selectedOperation.status]}
                  </span>
                </div>

                <dl className="ops-metrics">
                  <div className="ops-metric-card">
                    <dt>Reservation</dt>
                    <dd>{selectedOperation.reservation_draft?.slice(0, 8) ?? "—"}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Validated at</dt>
                    <dd>{selectedOperation.validated_at ? new Date(selectedOperation.validated_at).toLocaleString() : "Pending"}</dd>
                  </div>
                </dl>

                <section className="ops-detail-section">
                  <h5>Return lines</h5>
                  <ul className="ops-line-list">
                    {selectedOperation.lines.map((line) => (
                      <li className="ops-line-item" key={line.id}>
                        <div className="ops-line-item__head">
                          <strong>{line.inventory_item}</strong>
                          <span className={`ops-status-badge ops-status-badge--${selectedOperation.status}`}>
                            {line.condition_status}
                          </span>
                        </div>
                        <div className="ops-line-item__meta">
                          <span>Expected {line.expected_quantity}</span>
                          <span>Returned {line.returned_quantity}</span>
                          <span>Damaged {line.damaged_quantity}</span>
                          <span>Missing {line.missing_quantity}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                {selectedOperation.notes ? (
                  <section className="ops-callout">
                    <strong>Operator note</strong>
                    <p>{selectedOperation.notes}</p>
                  </section>
                ) : null}

                <div className="ops-line-actions">
                  <button
                    className="ops-button"
                    type="button"
                    disabled={!canWrite || actionLoading || selectedOperation.status !== "draft"}
                    onClick={() => void handleValidate()}
                  >
                    Validate return
                  </button>
                </div>
              </div>
            ) : (
              <p className="ops-empty">Select a return operation to inspect line-level quantities.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default ReturnsHandlingPanel;
