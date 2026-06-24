import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { checkDamageLossWritePermission, getDamageLossSettlements, validateDamageLossSettlement } from "./api";
import type { InventoryDamageLossSettlement } from "./types";

const STATUS_LABELS: Record<InventoryDamageLossSettlement["settlement_status"], string> = {
  draft: "Draft",
  validated: "Validated",
  cancelled: "Cancelled",
};

function formatAmount(value: number): string {
  return new Intl.NumberFormat("fr-MG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function BreakageLossPanel() {
  const [settlements, setSettlements] = useState<InventoryDamageLossSettlement[]>([]);
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selectedSettlement = useMemo(
    () => settlements.find((settlement) => settlement.id === selectedSettlementId) ?? null,
    [settlements, selectedSettlementId],
  );

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getDamageLossSettlements(abortRef.current.signal);
      const nextSettlements = Array.isArray(data) ? data : [];
      setSettlements(nextSettlements);
      setSelectedSettlementId((current) =>
        current && nextSettlements.some((settlement) => settlement.id === current)
          ? current
          : nextSettlements[0]?.id ?? null,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Failed to load damage & loss settlements.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkDamageLossWritePermission(controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const handleValidate = async () => {
    if (!selectedSettlement || !canWrite) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const nextSettlement = await validateDamageLossSettlement(selectedSettlement.id);
      setSettlements((current) =>
        current.map((settlement) =>
          settlement.id === nextSettlement.id ? nextSettlement : settlement,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to validate damage settlement.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="ops-panel" data-testid="breakage-loss-panel">
      <div className="ops-panel__header">
        <div className="ops-panel__header-copy">
          <p className="eyebrow">Prototype damage</p>
          <h3 className="ops-panel__title">Damage & loss settlement review</h3>
          <p className="ops-panel__summary">
            Settlement cards now expose caution impact, refund due, and validation status using the confirmed inventory contract.
          </p>
        </div>
        {canWrite ? (
          <span className="permission-tag permission-ok" data-testid="breakage-write-ok">Write access</span>
        ) : (
          <span className="permission-tag permission-denied" data-testid="breakage-write-denied">Read-only</span>
        )}
      </div>

      {loading ? <div className="loading-notice">Loading damage assessment...</div> : null}

      {!loading && error ? (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={() => void load()} aria-label="Retry loading settlements">
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && settlements.length === 0 ? (
        <div className="ops-empty">No damage & loss settlements found.</div>
      ) : null}

      {!loading && !error && settlements.length > 0 ? (
        <div className="ops-layout">
          <section className="ops-list-panel">
            <div className="ops-section-heading">
              <div>
                <h4>Settlement queue</h4>
                <p className="ops-section-helper">Prototype-style financial follow-up on return discrepancies.</p>
              </div>
            </div>
            <ul className="ops-list" role="list" aria-label="Settlement records list">
              {settlements.map((settlement) => (
                <li key={settlement.id}>
                  <button
                    className="ops-row"
                    data-testid={`settlement-row-${settlement.id}`}
                    type="button"
                    aria-pressed={selectedSettlementId === settlement.id}
                    onClick={() => setSelectedSettlementId(settlement.id)}
                  >
                    <div className="ops-row__primary">
                      <span className="ops-row__title">{settlement.return_operation.slice(0, 8)}</span>
                      <span className="ops-row__subtext">{formatAmount(settlement.damage_loss_total)} MGA</span>
                    </div>
                    <span className={`ops-status-badge ops-status-badge--${settlement.settlement_status}`}>
                      {STATUS_LABELS[settlement.settlement_status]}
                    </span>
                    <span className="ops-row__detail">{settlement.lines.length} line(s)</span>
                    <span className="ops-row__qty">Refund {formatAmount(settlement.refund_due)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="ops-detail-panel">
            {selectedSettlement ? (
              <div className="ops-detail-stack">
                <div className="ops-section-heading">
                  <div>
                    <h4>Settlement detail</h4>
                    <p className="ops-section-helper">Keep validation gated until the caution and damage totals are final.</p>
                  </div>
                  <span className={`ops-status-badge ops-status-badge--${selectedSettlement.settlement_status}`}>
                    {STATUS_LABELS[selectedSettlement.settlement_status]}
                  </span>
                </div>

                <dl className="ops-metrics">
                  <div className="ops-metric-card">
                    <dt>Total damage</dt>
                    <dd>{formatAmount(selectedSettlement.damage_loss_total)} MGA</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Caution available</dt>
                    <dd>{formatAmount(selectedSettlement.caution_available)} MGA</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Caution applied</dt>
                    <dd>{formatAmount(selectedSettlement.caution_applied)} MGA</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Refund due</dt>
                    <dd>{formatAmount(selectedSettlement.refund_due)} MGA</dd>
                  </div>
                </dl>

                <section className="ops-detail-section">
                  <h5>Settlement lines</h5>
                  <ul className="ops-line-list">
                    {selectedSettlement.lines.map((line) => (
                      <li className="ops-line-item" key={line.id}>
                        <div className="ops-line-item__head">
                          <strong>{line.manual_label || line.settlement_line_kind}</strong>
                          <span className="ops-chip ops-chip--draft">{formatAmount(line.total_amount)} MGA</span>
                        </div>
                        <div className="ops-line-item__meta">
                          <span>{line.settlement_line_kind}</span>
                          <span>Qty {line.quantity}</span>
                          <span>Unit {formatAmount(line.unit_amount)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="ops-line-actions">
                  <button
                    className="ops-button"
                    type="button"
                    disabled={!canWrite || actionLoading || selectedSettlement.settlement_status !== "draft"}
                    onClick={() => void handleValidate()}
                  >
                    Validate settlement
                  </button>
                </div>
              </div>
            ) : (
              <p className="ops-empty">Select a settlement to inspect damage and caution impact.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default BreakageLossPanel;
