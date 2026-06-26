import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addLogisticsEventItemLine,
  checkEndpointPermission,
  completeLogisticsPassation,
  createLogisticsEvent,
  getDocumentInstancePdfBlob,
  getInventoryItems,
  getLogisticsEventItemLines,
  getLogisticsEvents,
  getReservationDrafts,
  removeLogisticsEventItemLine,
  transitionLogisticsEvent,
} from "./api";
import type { InventoryItem, LogisticsEvent, LogisticsEventItemLine, ReservationDraft } from "./types";

const STATUS_LABELS: Record<LogisticsEvent["status"], string> = {
  planned: "Planned",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
};

const EVENT_TYPE_LABELS: Record<LogisticsEvent["event_type"], string> = {
  delivery: "Delivery",
  pickup: "Pickup",
  preparation: "Preparation",
  handover: "Handover",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

type PassationState = {
  documentInstanceId: string | null;
  loading: boolean;
  error: string | null;
};

export function LogisticsDeliveryPanel() {
  const [events, setEvents] = useState<LogisticsEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [itemLines, setItemLines] = useState<LogisticsEventItemLine[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lineLoading, setLineLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState("");
  const [lineQuantity, setLineQuantity] = useState("1");
  const [lineNotes, setLineNotes] = useState("");
  const [passationState, setPassationState] = useState<PassationState>({
    documentInstanceId: null,
    loading: false,
    error: null,
  });
  const [eventFilter, setEventFilter] = useState<LogisticsEvent["event_type"] | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reservationDrafts, setReservationDrafts] = useState<ReservationDraft[]>([]);
  const [createForm, setCreateForm] = useState({
    reservation_draft: "",
    event_type: "delivery" as LogisticsEvent["event_type"],
    scheduled_at: "",
    address: "",
    contact_name: "",
    contact_phone: "",
    notes: "",
    signature_required: false,
  });
  const [confirmAction, setConfirmAction] = useState<{ type: string; lineId?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lineAbortRef = useRef<AbortController | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const filteredEvents = useMemo(
    () => eventFilter === "all" ? events : events.filter((e) => e.event_type === eventFilter),
    [events, eventFilter],
  );

  const replaceEvent = useCallback((nextEvent: LogisticsEvent) => {
    setEvents((current) =>
      current.map((event) => (event.id === nextEvent.id ? nextEvent : event)),
    );
  }, []);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();

    try {
      const [eventsData, itemsData] = await Promise.all([
        getLogisticsEvents(abortRef.current.signal),
        getInventoryItems(abortRef.current.signal),
      ]);
      const allEvents = Array.isArray(eventsData) ? eventsData : [];
      setEvents(allEvents);
      setInventoryItems(Array.isArray(itemsData) ? itemsData : []);
      setSelectedEventId((current) =>
        current && allEvents.some((event) => event.id === current)
          ? current
          : allEvents[0]?.id ?? null,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Failed to load logistics events.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItemLines = useCallback(async (eventId: string) => {
    lineAbortRef.current?.abort();
    lineAbortRef.current = new AbortController();
    setLineLoading(true);
    setLineError(null);
    try {
      const data = await getLogisticsEventItemLines(eventId, lineAbortRef.current.signal);
      setItemLines(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setLineError(err.message || "Failed to load logistics item lines.");
      }
    } finally {
      setLineLoading(false);
    }
  }, []);

  const loadReservationDrafts = useCallback(async () => {
    try {
      const drafts = await getReservationDrafts();
      setReservationDrafts(Array.isArray(drafts) ? drafts : []);
    } catch {
      // silent — reservation list is optional for creation
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/logistics/events/create/", "OPTIONS", controller.signal)
      .then(setCanWrite);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (!selectedEventId) {
      setItemLines([]);
      return;
    }
    void loadItemLines(selectedEventId);
    return () => {
      lineAbortRef.current?.abort();
    };
  }, [loadItemLines, selectedEventId]);

  const handleTransition = async (newStatus: LogisticsEvent["status"]) => {
    if (!selectedEvent || !canWrite) {
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const nextEvent = await transitionLogisticsEvent(selectedEvent.id, {
        new_status: newStatus,
        executed_at: newStatus === "completed" ? new Date().toISOString() : null,
        notes: selectedEvent.notes,
      });
      replaceEvent(nextEvent);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update logistics status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddLine = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedEvent || !canWrite || !selectedInventoryItemId) {
      return;
    }

    setActionLoading(true);
    setLineError(null);
    try {
      await addLogisticsEventItemLine(selectedEvent.id, {
        inventory_item_id: selectedInventoryItemId,
        quantity: Number(lineQuantity),
        notes: lineNotes,
      });
      setSelectedInventoryItemId("");
      setLineQuantity("1");
      setLineNotes("");
      await loadItemLines(selectedEvent.id);
    } catch (err: unknown) {
      setLineError(err instanceof Error ? err.message : "Failed to add logistics item line.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!selectedEvent || !canWrite) {
      return;
    }

    setActionLoading(true);
    setLineError(null);
    try {
      await removeLogisticsEventItemLine(selectedEvent.id, lineId);
      await loadItemLines(selectedEvent.id);
    } catch (err: unknown) {
      setLineError(err instanceof Error ? err.message : "Failed to remove logistics item line.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompletePassation = async () => {
    if (!selectedEvent || !canWrite) {
      return;
    }

    setPassationState({ documentInstanceId: null, loading: true, error: null });
    try {
      const response = await completeLogisticsPassation(selectedEvent.id, {});
      replaceEvent(response.event);
      setPassationState({
        documentInstanceId: response.document_instance_id,
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      setPassationState({
        documentInstanceId: null,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to complete passation.",
      });
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setActionLoading(true);
    setError(null);
    try {
      await createLogisticsEvent({
        reservation_draft: createForm.reservation_draft,
        event_type: createForm.event_type,
        scheduled_at: createForm.scheduled_at || null,
        address: createForm.address || undefined,
        contact_name: createForm.contact_name || undefined,
        contact_phone: createForm.contact_phone || undefined,
        notes: createForm.notes || undefined,
        signature_required: createForm.signature_required,
      });
      setShowCreateForm(false);
      setCreateForm({
        reservation_draft: "",
        event_type: "delivery",
        scheduled_at: "",
        address: "",
        contact_name: "",
        contact_phone: "",
        notes: "",
        signature_required: false,
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create logistics event.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadDeliveryNote = async () => {
    if (!passationState.documentInstanceId) return;
    try {
      const blob = await getDocumentInstancePdfBlob(passationState.documentInstanceId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setPassationState((prev) => ({ ...prev, error: "Failed to open delivery note PDF." }));
    }
  };

  const activeEventCount = filteredEvents.filter((event) => event.status !== "completed" && event.status !== "cancelled").length;

  return (
    <div className="ops-panel" data-testid="logistics-delivery-panel">
      <div className="ops-panel__header">
        <div className="ops-panel__header-copy">
          <p className="eyebrow">Logistique</p>
          <h3 className="ops-panel__title">Opérations logistiques</h3>
          <p className="ops-panel__summary">
            Gestion des événements logistiques : préparation, livraison, remise, enlèvement.
          </p>
        </div>
        <div className="ops-panel__actions">
          {canWrite ? (
            <span className="permission-tag permission-ok" data-testid="logistics-write-ok">Write access</span>
          ) : (
            <span className="permission-tag permission-denied" data-testid="logistics-read-only">Read-only</span>
          )}
        </div>
      </div>

      <div className="ops-toolbar">
        <div className="ops-toolbar__meta">
          <span className="ops-chip ops-chip--planned">{events.length} événements</span>
          <span className="ops-chip ops-chip--dispatched">{activeEventCount} actifs</span>
          <span className="ops-chip ops-chip--validated">{itemLines.length} lignes</span>
        </div>
        <div className="ops-toolbar__actions">
          {canWrite ? (
            <button className="ops-button" type="button" onClick={() => { setShowCreateForm(!showCreateForm); if (!showCreateForm) { void loadReservationDrafts(); } }}>
              {showCreateForm ? "Annuler" : "+ Nouvel événement"}
            </button>
          ) : null}
          <button className="ops-button-secondary" type="button" onClick={() => void load()}>
            Actualiser
          </button>
        </div>
      </div>

      {showCreateForm && canWrite ? (
        <form className="ops-inline-form ops-create-form" onSubmit={(e) => void handleCreateEvent(e)}>
          <div className="ops-section-heading">
            <h4>Créer un événement logistique</h4>
          </div>
          <div className="ops-inline-form__row">
            <label>
              Réservation
              <select value={createForm.reservation_draft} onChange={(e) => setCreateForm((f) => ({ ...f, reservation_draft: e.target.value }))} required>
                <option value="">Sélectionner une réservation</option>
                {reservationDrafts.map((d) => (
                  <option key={d.id} value={d.id}>{d.public_reference} — {d.customer_display_name}</option>
                ))}
              </select>
            </label>
            <label>
              Type
              <select value={createForm.event_type} onChange={(e) => setCreateForm((f) => ({ ...f, event_type: e.target.value as LogisticsEvent["event_type"] }))}>
                <option value="preparation">Préparation</option>
                <option value="delivery">Livraison</option>
                <option value="handover">Remise</option>
                <option value="pickup">Enlèvement</option>
              </select>
            </label>
            <label>
              Planifié le
              <input type="datetime-local" value={createForm.scheduled_at} onChange={(e) => setCreateForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
            </label>
          </div>
          <div className="ops-inline-form__row">
            <label>
              Adresse
              <input type="text" value={createForm.address} onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))} />
            </label>
            <label>
              Contact
              <input type="text" value={createForm.contact_name} onChange={(e) => setCreateForm((f) => ({ ...f, contact_name: e.target.value }))} />
            </label>
            <label>
              Téléphone
              <input type="text" value={createForm.contact_phone} onChange={(e) => setCreateForm((f) => ({ ...f, contact_phone: e.target.value }))} />
            </label>
          </div>
          <div className="ops-inline-form__row">
            <label>
              Notes
              <input type="text" value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} />
            </label>
            <label className="ops-checkbox-label">
              <input type="checkbox" checked={createForm.signature_required} onChange={(e) => setCreateForm((f) => ({ ...f, signature_required: e.target.checked }))} />
              Signature requise
            </label>
          </div>
          <div className="ops-inline-form__actions">
            <button className="ops-button" type="submit" disabled={actionLoading || !createForm.reservation_draft}>
              {actionLoading ? "Création..." : "Créer l'événement"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="ops-filter-bar">
        {(["all", "delivery", "handover", "preparation", "pickup"] as const).map((type) => (
          <button
            key={type}
            className={`ops-filter-btn${eventFilter === type ? " ops-filter-btn--active" : ""}`}
            type="button"
            onClick={() => setEventFilter(type)}
          >
            {type === "all" ? "Tous" : EVENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-notice">Chargement des événements...</div> : null}

      {!loading && error ? (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={() => void load()} aria-label="Réessayer">
            Réessayer
          </button>
        </div>
      ) : null}

      {!loading && !error && filteredEvents.length === 0 ? (
        <div className="ops-empty">Aucun événement trouvé.</div>
      ) : null}

      {!loading && !error && filteredEvents.length > 0 ? (
        <div className="ops-layout">
          <section className="ops-list-panel">
            <div className="ops-section-heading">
              <div>
                <h4>File d'événements</h4>
                <p className="ops-section-helper">{filteredEvents.length} événement(s) {eventFilter !== "all" ? EVENT_TYPE_LABELS[eventFilter] : ""}.</p>
              </div>
            </div>
            <ul className="ops-list" role="list" aria-label="Liste des événements logistiques">
              {filteredEvents.map((event) => (
                <li key={event.id}>
                  <button
                    className="ops-row"
                    data-testid={`delivery-row-${event.id}`}
                    type="button"
                    aria-pressed={selectedEventId === event.id}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <div className="ops-row__primary">
                      <span className="ops-row__title">{EVENT_TYPE_LABELS[event.event_type]}</span>
                      <span className="ops-row__subtext">{event.contact_name || "Aucun contact"}</span>
                    </div>
                    <span className={`ops-status-badge ops-status-badge--${event.status}`}>
                      {STATUS_LABELS[event.status] ?? event.status}
                    </span>
                    <span className="ops-row__detail">{formatDateTime(event.scheduled_at)}</span>
                    <span className="ops-row__ref">{event.reservation_draft.slice(0, 8)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="ops-detail-panel">
            {selectedEvent ? (
              <div className="ops-detail-stack">
                <div className="ops-section-heading">
                  <div>
                    <h4>{EVENT_TYPE_LABELS[selectedEvent.event_type]}</h4>
                    <p className="ops-section-helper">
                      Réservation {selectedEvent.reservation_draft.slice(0, 8)}
                    </p>
                  </div>
                  <span className={`ops-status-badge ops-status-badge--${selectedEvent.status}`}>
                    {STATUS_LABELS[selectedEvent.status]}
                  </span>
                </div>

                <dl className="ops-metrics">
                  <div className="ops-metric-card">
                    <dt>Planifié</dt>
                    <dd>{formatDateTime(selectedEvent.scheduled_at)}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Exécuté</dt>
                    <dd>{formatDateTime(selectedEvent.executed_at)}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Contact</dt>
                    <dd>{selectedEvent.contact_name || "—"}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Signature</dt>
                    <dd>{selectedEvent.signature_required ? (selectedEvent.signature_received ? "Reçue" : "Requise") : "Non requise"}</dd>
                  </div>
                </dl>

                <section className="ops-detail-section">
                  <h5>Détails opérationnels</h5>
                  <dl className="ops-detail-meta">
                    <div>
                      <dt>Adresse</dt>
                      <dd>{selectedEvent.address || "—"}</dd>
                    </div>
                    <div>
                      <dt>Téléphone</dt>
                      <dd>{selectedEvent.contact_phone || "—"}</dd>
                    </div>
                    <div>
                      <dt>Signé le</dt>
                      <dd>{formatDateTime(selectedEvent.signed_at)}</dd>
                    </div>
                    <div>
                      <dt>Notes</dt>
                      <dd>{selectedEvent.notes || "—"}</dd>
                    </div>
                  </dl>
                </section>

                <section className="ops-detail-section">
                  <div className="ops-section-heading">
                    <div>
                      <h5>Lignes d'articles</h5>
                      <p className="ops-section-helper">{itemLines.length} ligne(s) attachée(s).</p>
                    </div>
                  </div>

                  {lineLoading ? <div className="loading-notice">Chargement des lignes...</div> : null}
                  {!lineLoading && lineError ? (
                    <div className="notice error-notice" role="alert">
                      {lineError}
                    </div>
                  ) : null}

                  {!lineLoading && !lineError && itemLines.length === 0 ? (
                    <p className="ops-empty">Aucune ligne d'article attachée.</p>
                  ) : null}

                  {!lineLoading && !lineError && itemLines.length > 0 ? (
                    <ul className="ops-line-list">
                      {itemLines.map((line) => (
                        <li className="ops-line-item" key={line.id}>
                          <div className="ops-line-item__head">
                            <strong>{line.inventory_item_name}</strong>
                            <div className="ops-line-actions">
                              <span className="ops-chip ops-chip--planned">{line.quantity} unité(s)</span>
                              {canWrite ? (
                                confirmAction?.type === "remove-line" && confirmAction.lineId === line.id ? (
                                  <span className="confirm-delete-group">
                                    <span className="confirm-delete-hint">Supprimer ?</span>
                                    <button className="ops-button-danger" type="button" disabled={actionLoading} onClick={() => { setConfirmAction(null); void handleRemoveLine(line.id); }}>
                                      {actionLoading ? "..." : "Confirmer"}
                                    </button>
                                    <button className="ops-button-secondary" type="button" disabled={actionLoading} onClick={() => setConfirmAction(null)}>
                                      Annuler
                                    </button>
                                  </span>
                                ) : (
                                  <button className="ops-button-danger" type="button" disabled={actionLoading} onClick={() => setConfirmAction({ type: "remove-line", lineId: line.id })}>
                                    Supprimer
                                  </button>
                                )
                              ) : null}
                            </div>
                          </div>
                          <div className="ops-line-item__meta">
                            <span>{line.inventory_item_kind}</span>
                            <span>{line.notes || "Aucune note"}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canWrite ? (
                    <form className="ops-inline-form" onSubmit={(event) => void handleAddLine(event)}>
                      <div className="ops-inline-form__row">
                        <label>
                          Article
                          <select value={selectedInventoryItemId} onChange={(event) => setSelectedInventoryItemId(event.target.value)} required>
                            <option value="">Sélectionner</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>{item.name} ({item.kind})</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Quantité
                          <input min="1" step="1" type="number" value={lineQuantity} onChange={(event) => setLineQuantity(event.target.value)} required />
                        </label>
                        <label>
                          Note
                          <input type="text" value={lineNotes} onChange={(event) => setLineNotes(event.target.value)} />
                        </label>
                      </div>
                      <div className="ops-inline-form__actions">
                        <button className="ops-button" type="submit" disabled={actionLoading}>
                          Ajouter une ligne
                        </button>
                      </div>
                    </form>
                  ) : null}
                </section>

                <section className="ops-callout">
                  <strong>Actions</strong>
                  {passationState.documentInstanceId ? (
                    <div className="ops-preview-note">
                      <p>Bon de livraison généré.</p>
                      <button className="ops-button-secondary" type="button" onClick={() => void handleDownloadDeliveryNote()}>
                        Voir le PDF
                      </button>
                    </div>
                  ) : null}
                  {passationState.error ? (
                    <p className="ops-preview-note">{passationState.error}</p>
                  ) : null}
                </section>

                <div className="ops-line-actions">
                  {confirmAction?.type === "transition" ? (
                    <span className="confirm-delete-group">
                      <span className="confirm-delete-hint">Confirmer cette action ?</span>
                      {confirmAction.lineId === "dispatch" ? (
                        <button className="ops-button-secondary" type="button" disabled={actionLoading} onClick={() => { setConfirmAction(null); void handleTransition("dispatched"); }}>
                          {actionLoading ? "..." : "Confirmer l'envoi"}
                        </button>
                      ) : confirmAction.lineId === "complete" ? (
                        <button className="ops-button-secondary" type="button" disabled={actionLoading} onClick={() => { setConfirmAction(null); void handleTransition("completed"); }}>
                          {actionLoading ? "..." : "Confirmer la complétion"}
                        </button>
                      ) : (
                        <button className="ops-button-danger" type="button" disabled={actionLoading} onClick={() => { setConfirmAction(null); void handleTransition("cancelled"); }}>
                          {actionLoading ? "..." : "Confirmer l'annulation"}
                        </button>
                      )}
                      <button className="ops-button-secondary" type="button" disabled={actionLoading} onClick={() => setConfirmAction(null)}>
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <>
                      <button className="ops-button-secondary" type="button" disabled={!canWrite || actionLoading || selectedEvent.status !== "planned"} onClick={() => setConfirmAction({ type: "transition", lineId: "dispatch" })}>
                        Envoyer
                      </button>
                      <button className="ops-button-secondary" type="button" disabled={!canWrite || actionLoading || selectedEvent.status !== "dispatched"} onClick={() => setConfirmAction({ type: "transition", lineId: "complete" })}>
                        Compléter
                      </button>
                      <button className="ops-button-danger" type="button" disabled={!canWrite || actionLoading || selectedEvent.status === "completed" || selectedEvent.status === "cancelled"} onClick={() => setConfirmAction({ type: "transition", lineId: "cancel" })}>
                        Annuler
                      </button>
                      <button className="ops-button" type="button" disabled={!canWrite || passationState.loading || selectedEvent.event_type !== "handover" || selectedEvent.status !== "completed" || !selectedEvent.signature_required || selectedEvent.signature_received} onClick={() => void handleCompletePassation()}>
                        {passationState.loading ? "..." : "Finaliser la remise"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="ops-empty">Sélectionnez un événement pour voir les détails.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default LogisticsDeliveryPanel;
