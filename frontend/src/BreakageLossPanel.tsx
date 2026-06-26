import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { checkDamageLossWritePermission, getDamageLossSettlements, validateDamageLossSettlement } from "./api";
import type { InventoryDamageLossSettlement } from "./types";

const STATUS_LABELS: Record<InventoryDamageLossSettlement["settlement_status"], string> = {
  draft: "Brouillon",
  validated: "Validé",
  cancelled: "Annulé",
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
          <p className="eyebrow">Dommages prototype</p>
          <h3 className="ops-panel__title">Révision des règlements de dommages</h3>
          <p className="ops-panel__summary">
            Les fiches de règlement exposent l'impact sur la caution, le remboursement dû et le statut de validation.
          </p>
        </div>
        {canWrite ? (
          <span className="permission-tag permission-ok" data-testid="breakage-write-ok">Accès écriture</span>
        ) : (
          <span className="permission-tag permission-denied" data-testid="breakage-write-denied">Lecture seule</span>
        )}
      </div>

      {loading ? <div className="loading-notice">Chargement de l'évaluation des dommages...</div> : null}

      {!loading && error ? (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={() => void load()} aria-label="Réessayer le chargement des règlements">
            Réessayer
          </button>
        </div>
      ) : null}

      {!loading && !error && settlements.length === 0 ? (
        <div className="ops-empty">Aucun règlement de dommages trouvé.</div>
      ) : null}

      {!loading && !error && settlements.length > 0 ? (
        <div className="ops-layout">
          <section className="ops-list-panel">
            <div className="ops-section-heading">
              <div>
                <h4>File des règlements</h4>
                <p className="ops-section-helper">Suivi financier des écarts de retour.</p>
              </div>
            </div>
            <ul className="ops-list" role="list" aria-label="Liste des règlements">
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
                    <span className="ops-row__detail">{settlement.lines.length} ligne(s)</span>
                    <span className="ops-row__qty">Remboursement {formatAmount(settlement.refund_due)}</span>
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
                    <h4>Détail du règlement</h4>
                    <p className="ops-section-helper">La validation reste bloquée tant que les totaux de caution et dommages ne sont pas finaux.</p>
                  </div>
                  <span className={`ops-status-badge ops-status-badge--${selectedSettlement.settlement_status}`}>
                    {STATUS_LABELS[selectedSettlement.settlement_status]}
                  </span>
                </div>

                <dl className="ops-metrics">
                  <div className="ops-metric-card">
                    <dt>Total dommages</dt>
                    <dd>{formatAmount(selectedSettlement.damage_loss_total)} MGA</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Caution disponible</dt>
                    <dd>{formatAmount(selectedSettlement.caution_available)} MGA</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Caution appliquée</dt>
                    <dd>{formatAmount(selectedSettlement.caution_applied)} MGA</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Remboursement dû</dt>
                    <dd>{formatAmount(selectedSettlement.refund_due)} MGA</dd>
                  </div>
                </dl>

                <section className="ops-detail-section">
                  <h5>Lignes de règlement</h5>
                  <ul className="ops-line-list">
                    {selectedSettlement.lines.map((line) => (
                      <li className="ops-line-item" key={line.id}>
                        <div className="ops-line-item__head">
                          <strong>{line.manual_label || line.settlement_line_kind}</strong>
                          <span className="ops-chip ops-chip--draft">{formatAmount(line.total_amount)} MGA</span>
                        </div>
                        <div className="ops-line-item__meta">
                          <span>{line.settlement_line_kind}</span>
                          <span>Qté {line.quantity}</span>
                          <span>Prix unitaire {formatAmount(line.unit_amount)}</span>
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
                    Valider le règlement
                  </button>
                </div>
              </div>
            ) : (
              <p className="ops-empty">Sélectionnez un règlement pour inspecter les dommages et l'impact sur la caution.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default BreakageLossPanel;
