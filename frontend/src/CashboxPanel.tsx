import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  checkEndpointPermission,
  closeCashboxSession,
  createCashboxMovement,
  getCashboxMovements,
  getCashboxSessions,
  openCashboxSession,
} from "./api";
import type {
  CashboxMovement,
  CashboxMovementDirection,
  CashboxSession,
} from "./types";

type ActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const EMPTY_OPEN_FORM = { operator: "", opening_note: "" };
const EMPTY_CLOSE_FORM = { closing_note: "" };
const EMPTY_MOVEMENT_FORM = {
  direction: "cash_in" as CashboxMovementDirection,
  amount: "",
  payment: "",
  billing_invoice: "",
  billing_refund_obligation: "",
  note: "",
};

function formatAmount(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value || "0");
  return new Intl.NumberFormat("fr-MG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function directionLabel(direction: CashboxMovementDirection): string {
  return direction === "cash_in" ? "Entrée" : "Sortie";
}

function statusTone(session: CashboxSession): "open" | "closed" {
  return session.closed_at ? "closed" : "open";
}

function CashboxSessionCard({
  session,
  selected,
  onSelect,
}: {
  session: CashboxSession;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = statusTone(session);
  return (
    <button
      type="button"
      className={`cashbox-card cashbox-card--selectable cashbox-card--${tone}`}
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`cashbox-session-row-${session.id}`}
    >
      <div className="cashbox-card__header">
        <strong>{session.operator}</strong>
        <span className={`scope-chip scope-chip--${tone === "open" ? "hah" : "titan"}`}>
          {tone === "open" ? "Session ouverte" : "Session clôturée"}
        </span>
      </div>
      <p className="cashbox-card__meta">
        Ouverte le {formatDateTime(session.opened_at)}
      </p>
      <p className="cashbox-card__amount">{formatAmount(session.net_amount)} MGA</p>
      <p className="cashbox-card__meta">
        {session.movements.length} mouvement(s) • Fermée le {formatDateTime(session.closed_at)}
      </p>
    </button>
  );
}

function MovementRow({ movement }: { movement: CashboxMovement }) {
  return (
    <li className="cashbox-movement-row" data-testid={`cashbox-movement-row-${movement.id}`}>
      <div>
        <strong>{directionLabel(movement.direction)}</strong>
        <p>{formatDateTime(movement.moved_at)}</p>
      </div>
      <div>
        <strong>{formatAmount(movement.amount)} MGA</strong>
        <p>{movement.note || "—"}</p>
      </div>
      <div className="cashbox-movement-row__refs">
        <span>{movement.payment ? `Paiement ${movement.payment.id.slice(0, 8)}` : "—"}</span>
        <span>
          {movement.billing_invoice
            ? `Facture ${movement.billing_invoice.id.slice(0, 8)}`
            : "—"}
        </span>
        <span>
          {movement.billing_refund_obligation
            ? `Remboursement ${movement.billing_refund_obligation.id.slice(0, 8)}`
            : "—"}
        </span>
      </div>
    </li>
  );
}

export default function CashboxPanel() {
  const [sessions, setSessions] = useState<CashboxSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [movements, setMovements] = useState<CashboxMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementLoading, setMovementLoading] = useState(false);
  const [error, setError] = useState("");
  const [movementError, setMovementError] = useState("");
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [movementActionState, setMovementActionState] = useState<ActionState>({
    status: "idle",
  });
  const [canManage, setCanManage] = useState(false);
  const [openForm, setOpenForm] = useState(EMPTY_OPEN_FORM);
  const [closeForm, setCloseForm] = useState(EMPTY_CLOSE_FORM);
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT_FORM);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
    [sessions, selectedSessionId],
  );

  const openSession = sessions.find((session) => session.closed_at === null) ?? null;

  const stats = useMemo(() => {
    const totalOpen = sessions.filter((session) => session.closed_at === null).length;
    const totalClosed = sessions.length - totalOpen;
    const totalMovements = sessions.reduce((count, session) => count + session.movements.length, 0);
    return { totalOpen, totalClosed, totalMovements };
  }, [sessions]);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/cashbox/sessions/open/", "OPTIONS", controller.signal).then(
      setCanManage,
    );
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getCashboxSessions(undefined, controller.signal)
      .then((data) => {
        const nextSessions = Array.isArray(data) ? data : [];
        setSessions(nextSessions);
        setSelectedSessionId((current) => current || nextSessions[0]?.id || "");
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load cashbox sessions.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sessionId = selectedSession?.id;
    if (!sessionId) {
      setMovements([]);
      return;
    }

    const controller = new AbortController();
    setMovementLoading(true);
    setMovementError("");
    getCashboxMovements({ session_id: sessionId }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setMovements(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setMovementError(err instanceof Error ? err.message : "Failed to load cashbox movements.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMovementLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedSession?.id]);

  const reloadSessions = async () => {
    const data = await getCashboxSessions();
    const nextSessions = Array.isArray(data) ? data : [];
    setSessions(nextSessions);
    setSelectedSessionId((current) => current || nextSessions[0]?.id || "");
  };

  const refreshMovements = async (sessionId: string) => {
    const data = await getCashboxMovements({ session_id: sessionId });
    setMovements(Array.isArray(data) ? data : []);
  };

  const handleOpenSession = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !openForm.operator.trim()) {
      return;
    }

    setActionState({ status: "loading" });
    try {
      await openCashboxSession({
        operator: openForm.operator.trim(),
        opening_note: openForm.opening_note,
      });
      setOpenForm(EMPTY_OPEN_FORM);
      await reloadSessions();
      setActionState({ status: "success", message: "Session caisse ouverte." });
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to open cashbox session.",
      });
    }
  };

  const handleCloseSession = async () => {
    if (!canManage || !selectedSession || selectedSession.closed_at) {
      return;
    }

    setActionState({ status: "loading" });
    try {
      await closeCashboxSession(selectedSession.id, { closing_note: closeForm.closing_note });
      setCloseForm(EMPTY_CLOSE_FORM);
      await reloadSessions();
      await refreshMovements(selectedSession.id);
      setActionState({ status: "success", message: "Session caisse clôturée." });
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to close cashbox session.",
      });
    }
  };

  const handleCreateMovement = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManage || !selectedSession || !movementForm.amount) {
      return;
    }

    setMovementActionState({ status: "loading" });
    try {
      await createCashboxMovement(selectedSession.id, {
        direction: movementForm.direction,
        amount: movementForm.amount,
        payment: movementForm.payment || null,
        billing_invoice: movementForm.billing_invoice || null,
        billing_refund_obligation: movementForm.billing_refund_obligation || null,
        note: movementForm.note,
      });
      setMovementForm(EMPTY_MOVEMENT_FORM);
      await reloadSessions();
      await refreshMovements(selectedSession.id);
      setMovementActionState({ status: "success", message: "Mouvement caisse enregistré." });
    } catch (err) {
      setMovementActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to create cashbox movement.",
      });
    }
  };

  if (loading) {
    return <p className="status notice loading-notice">Loading cashbox sessions...</p>;
  }

  if (error) {
    return (
      <section className="notice error-notice" role="alert">
        <h3>Cashbox unavailable</h3>
        <p>{error}</p>
      </section>
    );
  }

  if (!canManage) {
    return (
      <section className="notice info-notice" role="note">
        <h3>Cashbox access unavailable</h3>
        <p>Read-only users cannot open, close, or record cashbox sessions.</p>
      </section>
    );
  }

  return (
    <section className="cashbox-panel" aria-label="Cashbox sessions and movements">
      <div className="section-heading">
        <div>
          <h2>Caisse</h2>
          <p className="module-description">
            Session de caisse active, soldes, mouvements et clôtures sont pilotés depuis ce panneau.
          </p>
        </div>
        <span className="scope-chip scope-chip--titan">FE-F</span>
      </div>

      <div className="cashbox-stats-grid">
        <article className="cashbox-metric-card">
          <span>Sessions ouvertes</span>
          <strong>{stats.totalOpen}</strong>
        </article>
        <article className="cashbox-metric-card">
          <span>Sessions clôturées</span>
          <strong>{stats.totalClosed}</strong>
        </article>
        <article className="cashbox-metric-card">
          <span>Mouvements enregistrés</span>
          <strong>{stats.totalMovements}</strong>
        </article>
      </div>

      <div className="cashbox-layout">
        <aside className="cashbox-stack">
          <div className="section-heading">
            <h3>Sessions</h3>
            <span>{sessions.length}</span>
          </div>
          {sessions.length === 0 ? (
            <p className="status">Aucune session de caisse n'est visible.</p>
          ) : (
            <div className="cashbox-list">
              {sessions.map((session) => (
                <CashboxSessionCard
                  key={session.id}
                  session={session}
                  selected={session.id === selectedSession?.id}
                  onSelect={() => setSelectedSessionId(session.id)}
                />
              ))}
            </div>
          )}
        </aside>

        <div className="cashbox-stack">
          <div className="section-heading">
            <h3>Détails de session</h3>
            {selectedSession ? (
              <span className={`scope-chip scope-chip--${selectedSession.closed_at ? "titan" : "hah"}`}>
                {selectedSession.closed_at ? "Clôturée" : "Ouverte"}
              </span>
            ) : null}
          </div>

          {selectedSession ? (
            <>
              <div className="cashbox-summary">
                <p>
                  <strong>Opérateur :</strong> {selectedSession.operator}
                </p>
                <p>
                  <strong>Ouverte :</strong> {formatDateTime(selectedSession.opened_at)}
                </p>
                <p>
                  <strong>Fermée :</strong> {formatDateTime(selectedSession.closed_at)}
                </p>
                <p>
                  <strong>Solde net :</strong> {formatAmount(selectedSession.net_amount)} MGA
                </p>
                <p>
                  <strong>Note d'ouverture :</strong> {selectedSession.opening_note || "—"}
                </p>
                <p>
                  <strong>Note de clôture :</strong> {selectedSession.closing_note || "—"}
                </p>
              </div>

              <div className="cashbox-forms-grid">
                <form className="cashbox-form" onSubmit={handleOpenSession}>
                  <h4>Ouvrir une session</h4>
                  <label>
                    Opérateur
                    <input
                      type="text"
                      value={openForm.operator}
                      onChange={(event) =>
                        setOpenForm((current) => ({ ...current, operator: event.target.value }))
                      }
                      placeholder="ID de l'utilisateur"
                      required
                    />
                  </label>
                  <label>
                    Note d'ouverture
                    <textarea
                      value={openForm.opening_note}
                      onChange={(event) =>
                        setOpenForm((current) => ({ ...current, opening_note: event.target.value }))
                      }
                      rows={2}
                    />
                  </label>
                  <button type="submit" className="erp-button erp-button--primary">
                    Ouvrir
                  </button>
                </form>

                <form className="cashbox-form" onSubmit={handleCreateMovement}>
                  <h4>Enregistrer un mouvement</h4>
                  <label>
                    Sens
                    <select
                      value={movementForm.direction}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          direction: event.target.value as CashboxMovementDirection,
                        }))
                      }
                    >
                      <option value="cash_in">Entrée</option>
                      <option value="cash_out">Sortie</option>
                    </select>
                  </label>
                  <label>
                    Montant
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={movementForm.amount}
                      onChange={(event) =>
                        setMovementForm((current) => ({ ...current, amount: event.target.value }))
                      }
                      placeholder="0.00"
                      required
                    />
                  </label>
                  <label>
                    Paiement lié
                    <input
                      type="text"
                      value={movementForm.payment}
                      onChange={(event) =>
                        setMovementForm((current) => ({ ...current, payment: event.target.value }))
                      }
                      placeholder="Optionnel"
                    />
                  </label>
                  <label>
                    Facture liée
                    <input
                      type="text"
                      value={movementForm.billing_invoice}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          billing_invoice: event.target.value,
                        }))
                      }
                      placeholder="Optionnel"
                    />
                  </label>
                  <label>
                    Remboursement lié
                    <input
                      type="text"
                      value={movementForm.billing_refund_obligation}
                      onChange={(event) =>
                        setMovementForm((current) => ({
                          ...current,
                          billing_refund_obligation: event.target.value,
                        }))
                      }
                      placeholder="Optionnel"
                    />
                  </label>
                  <label>
                    Note de mouvement
                    <textarea
                      value={movementForm.note}
                      onChange={(event) =>
                        setMovementForm((current) => ({ ...current, note: event.target.value }))
                      }
                      rows={2}
                    />
                  </label>
                  <button type="submit" className="erp-button erp-button--primary">
                    Enregistrer
                  </button>
                </form>
              </div>

              <form className="cashbox-form cashbox-form--compact" onSubmit={handleCloseSession}>
                <h4>Clôture</h4>
                <label>
                  Note de clôture
                  <textarea
                    value={closeForm.closing_note}
                    onChange={(event) =>
                      setCloseForm({ closing_note: event.target.value })
                    }
                    rows={2}
                  />
                </label>
                <button
                  type="submit"
                  className="erp-button erp-button--secondary"
                  disabled={!selectedSession || Boolean(selectedSession.closed_at)}
                >
                  Clôturer la session
                </button>
              </form>
            </>
          ) : (
            <p className="status">Aucune session sélectionnée.</p>
          )}

          {actionState.status !== "idle" ? (
            <p className={`status ${actionState.status === "error" ? "status--error" : "status--success"}`}>
              {actionState.status === "loading" ? "Mise à jour en cours..." : actionState.message}
            </p>
          ) : null}
          {movementActionState.status !== "idle" ? (
            <p className={`status ${movementActionState.status === "error" ? "status--error" : "status--success"}`}>
              {movementActionState.status === "loading"
                ? "Enregistrement du mouvement..."
                : movementActionState.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="cashbox-stack">
        <div className="section-heading">
          <h3>Mouvements</h3>
          <span>{movements.length}</span>
        </div>
        {movementLoading ? (
          <p className="status notice loading-notice">Loading cashbox movements...</p>
        ) : movementError ? (
          <p className="status status--error" role="alert">
            {movementError}
          </p>
        ) : movements.length === 0 ? (
          <p className="status">Aucun mouvement pour cette session.</p>
        ) : (
          <ul className="cashbox-movement-list" aria-label="Cashbox movements">
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
