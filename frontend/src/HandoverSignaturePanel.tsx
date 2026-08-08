import React, { useCallback, useState } from "react";

import { updateLogisticsEventSignature } from "./api";
import type { LogisticsEvent } from "./types";

const SIGNATURE_STATUS_LABELS: Record<LogisticsEvent["signature_status"], string> = {
  pending: "En attente de signature",
  received: "Document signé reçu",
  exception: "Signature exceptionnellement non obtenue",
};

const SIGNATURE_STATUS_BADGE_CLASS: Record<LogisticsEvent["signature_status"], string> = {
  pending: "ops-status-badge--planned",
  received: "ops-status-badge--validated",
  exception: "ops-status-badge--rejected",
};

type HandoverSignaturePanelProps = {
  event: LogisticsEvent;
  canWrite: boolean;
  onUpdate: (nextEvent: LogisticsEvent) => void;
};

export function HandoverSignaturePanel({ event, canWrite, onUpdate }: HandoverSignaturePanelProps) {
  const [mode, setMode] = useState<"idle" | "received" | "exception">("idle");
  const [signedByClientName, setSignedByClientName] = useState("");
  const [signedDocumentFile, setSignedDocumentFile] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitReceived = useCallback(async () => {
    if (!canWrite) return;
    setLoading(true);
    setError(null);
    try {
      const nextEvent = await updateLogisticsEventSignature(event.id, {
        signature_status: "received",
        signed_by_client_name: signedByClientName || undefined,
        signed_document_file: signedDocumentFile || undefined,
      });
      onUpdate(nextEvent);
      setMode("idle");
      setSignedByClientName("");
      setSignedDocumentFile("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de la mise à jour de la signature.");
    } finally {
      setLoading(false);
    }
  }, [canWrite, event.id, signedByClientName, signedDocumentFile, onUpdate]);

  const handleSubmitException = useCallback(async () => {
    if (!canWrite) return;
    setLoading(true);
    setError(null);
    try {
      const nextEvent = await updateLogisticsEventSignature(event.id, {
        signature_status: "exception",
        signature_exception_reason: exceptionReason,
      });
      onUpdate(nextEvent);
      setMode("idle");
      setExceptionReason("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de la mise à jour de la signature.");
    } finally {
      setLoading(false);
    }
  }, [canWrite, event.id, exceptionReason, onUpdate]);

  const isHandover = event.event_type === "handover";
  const isCompleted = event.status === "completed";
  const requiresSignature = event.signature_required;
  const signatureDone = event.signature_status !== "pending";

  if (!isHandover || !requiresSignature) {
    return null;
  }

  return (
    <section className="ops-detail-section" data-testid="handover-signature-panel">
      <div className="ops-section-heading">
        <div>
          <h5>Signature de passation</h5>
          <p className="ops-section-helper">
            Statut :
            <span className={`ops-status-badge ${SIGNATURE_STATUS_BADGE_CLASS[event.signature_status]}`}>
              {SIGNATURE_STATUS_LABELS[event.signature_status]}
            </span>
          </p>
        </div>
      </div>

      {event.signed_by_client_name ? (
        <dl className="ops-detail-meta">
          <div>
            <dt>Signé par (client)</dt>
            <dd>{event.signed_by_client_name}</dd>
          </div>
          {event.signed_document_file ? (
            <div>
              <dt>Fichier</dt>
              <dd>{event.signed_document_file}</dd>
            </div>
          ) : null}
          {event.signature_exception_reason ? (
            <div>
              <dt>Motif exception</dt>
              <dd>{event.signature_exception_reason}</dd>
            </div>
          ) : null}
          {event.signed_at ? (
            <div>
              <dt>Date de signature</dt>
              <dd>{new Date(event.signed_at).toLocaleString()}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {error ? (
        <div className="notice error-notice" role="alert">
          {error}
        </div>
      ) : null}

      {canWrite && isCompleted && !signatureDone ? (
        <div className="ops-line-actions">
          {mode === "idle" ? (
            <>
              <button
                className="ops-button"
                type="button"
                disabled={loading}
                onClick={() => setMode("received")}
                data-testid="signature-mark-received"
              >
                Marquer comme signé
              </button>
              <button
                className="ops-button-danger"
                type="button"
                disabled={loading}
                onClick={() => setMode("exception")}
                data-testid="signature-report-exception"
              >
                Signaler une exception
              </button>
            </>
          ) : null}

          {mode === "received" ? (
            <div className="ops-inline-form">
              <div className="ops-inline-form__row">
                <label>
                  Nom du signataire client
                  <input
                    type="text"
                    value={signedByClientName}
                    onChange={(e) => setSignedByClientName(e.target.value)}
                    placeholder="Nom du signataire"
                  />
                </label>
                <label>
                  Fichier signé (chemin / URL)
                  <input
                    type="text"
                    value={signedDocumentFile}
                    onChange={(e) => setSignedDocumentFile(e.target.value)}
                    placeholder="documents/signed_xxx.pdf"
                  />
                </label>
              </div>
              <div className="ops-inline-form__actions">
                <button
                  className="ops-button"
                  type="button"
                  disabled={loading || !signedByClientName}
                  onClick={() => void handleSubmitReceived()}
                  data-testid="signature-submit-received"
                >
                  {loading ? "Envoi..." : "Confirmer le document signé"}
                </button>
                <button
                  className="ops-button-secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => setMode("idle")}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : null}

          {mode === "exception" ? (
            <div className="ops-inline-form">
              <div className="ops-inline-form__row">
                <label>
                  Motif de l&apos;exception
                  <input
                    type="text"
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                    placeholder="Raison pour laquelle la signature n'a pas été obtenue"
                  />
                </label>
              </div>
              <div className="ops-inline-form__actions">
                <button
                  className="ops-button-danger"
                  type="button"
                  disabled={loading || !exceptionReason}
                  onClick={() => void handleSubmitException()}
                  data-testid="signature-submit-exception"
                >
                  {loading ? "Envoi..." : "Confirmer l'exception"}
                </button>
                <button
                  className="ops-button-secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => setMode("idle")}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default HandoverSignaturePanel;
