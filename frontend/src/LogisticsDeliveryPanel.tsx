import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addLogisticsEventItemLine,
  checkEndpointPermission,
  completeLogisticsPassation,
  getInventoryItems,
  getLogisticsEventItemLines,
  getLogisticsEvents,
  removeLogisticsEventItemLine,
  transitionLogisticsEvent,
} from "./api";
import type { InventoryItem, LogisticsEvent, LogisticsEventItemLine } from "./types";

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
  const abortRef = useRef<AbortController | null>(null);
  const lineAbortRef = useRef<AbortController | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const deliveryEvents = useMemo(
    () => events.filter((event) => event.event_type === "delivery" || event.event_type === "handover"),
    [events],
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
      const filteredEvents = Array.isArray(eventsData)
        ? eventsData.filter(
            (event) => event.event_type === "delivery" || event.event_type === "handover",
          )
        : [];
      setEvents(filteredEvents);
      setInventoryItems(Array.isArray(itemsData) ? itemsData : []);
      setSelectedEventId((current) =>
        current && filteredEvents.some((event) => event.id === current)
          ? current
          : filteredEvents[0]?.id ?? null,
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

  const activeEventCount = deliveryEvents.filter((event) => event.status !== "completed" && event.status !== "cancelled").length;

  return (
    <div className="ops-panel" data-testid="logistics-delivery-panel">
      <div className="ops-panel__header">
        <div className="ops-panel__header-copy">
          <p className="eyebrow">Prototype logistics</p>
          <h3 className="ops-panel__title">Logistics & handover operations</h3>
          <p className="ops-panel__summary">
            Delivery and handover events now expose operational status transitions,
            line-item composition, and client passation completion when the backend contract allows it.
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
          <span className="ops-chip ops-chip--planned">{deliveryEvents.length} events</span>
          <span className="ops-chip ops-chip--dispatched">{activeEventCount} active</span>
          <span className="ops-chip ops-chip--validated">{itemLines.length} selected lines</span>
        </div>
        <div className="ops-toolbar__actions">
          <button className="ops-button-secondary" type="button" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? <div className="loading-notice">Loading delivery events...</div> : null}

      {!loading && error ? (
        <div className="notice error-notice" role="alert">
          {error}
          <button onClick={() => void load()} aria-label="Retry loading delivery events">
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && deliveryEvents.length === 0 ? (
        <div className="ops-empty">No delivery events found.</div>
      ) : null}

      {!loading && !error && deliveryEvents.length > 0 ? (
        <div className="ops-layout">
          <section className="ops-list-panel">
            <div className="ops-section-heading">
              <div>
                <h4>Event queue</h4>
                <p className="ops-section-helper">Prototype-inspired operational list with handover visibility.</p>
              </div>
            </div>
            <ul className="ops-list" role="list" aria-label="Delivery events list">
              {deliveryEvents.map((event) => (
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
                      <span className="ops-row__subtext">{event.contact_name || "No contact provided"}</span>
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
                    <h4>{EVENT_TYPE_LABELS[selectedEvent.event_type]} detail</h4>
                    <p className="ops-section-helper">
                      Reservation {selectedEvent.reservation_draft.slice(0, 8)} with prototype-aligned operational actions.
                    </p>
                  </div>
                  <span className={`ops-status-badge ops-status-badge--${selectedEvent.status}`}>
                    {STATUS_LABELS[selectedEvent.status]}
                  </span>
                </div>

                <dl className="ops-metrics">
                  <div className="ops-metric-card">
                    <dt>Scheduled</dt>
                    <dd>{formatDateTime(selectedEvent.scheduled_at)}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Executed</dt>
                    <dd>{formatDateTime(selectedEvent.executed_at)}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Contact</dt>
                    <dd>{selectedEvent.contact_name || "—"}</dd>
                  </div>
                  <div className="ops-metric-card">
                    <dt>Signature</dt>
                    <dd>{selectedEvent.signature_required ? (selectedEvent.signature_received ? "Received" : "Required") : "Not required"}</dd>
                  </div>
                </dl>

                <section className="ops-detail-section">
                  <h5>Operational detail</h5>
                  <dl className="ops-detail-meta">
                    <div>
                      <dt>Address</dt>
                      <dd>{selectedEvent.address || "—"}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{selectedEvent.contact_phone || "—"}</dd>
                    </div>
                    <div>
                      <dt>Signed at</dt>
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
                      <h5>Item lines</h5>
                      <p className="ops-section-helper">Backend item lines attached to the logistics event.</p>
                    </div>
                  </div>

                  {lineLoading ? <div className="loading-notice">Loading logistics item lines...</div> : null}
                  {!lineLoading && lineError ? (
                    <div className="notice error-notice" role="alert">
                      {lineError}
                    </div>
                  ) : null}

                  {!lineLoading && !lineError && itemLines.length === 0 ? (
                    <p className="ops-empty">No logistics item lines are attached yet.</p>
                  ) : null}

                  {!lineLoading && !lineError && itemLines.length > 0 ? (
                    <ul className="ops-line-list">
                      {itemLines.map((line) => (
                        <li className="ops-line-item" key={line.id}>
                          <div className="ops-line-item__head">
                            <strong>{line.inventory_item_name}</strong>
                            <div className="ops-line-actions">
                              <span className="ops-chip ops-chip--planned">{line.quantity} unit(s)</span>
                              {canWrite ? (
                                <button
                                  className="ops-button-danger"
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => void handleRemoveLine(line.id)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div className="ops-line-item__meta">
                            <span>{line.inventory_item_kind}</span>
                            <span>{line.notes || "No line note"}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canWrite ? (
                    <form className="ops-inline-form" onSubmit={(event) => void handleAddLine(event)}>
                      <div className="ops-inline-form__row">
                        <label>
                          Inventory item
                          <select
                            value={selectedInventoryItemId}
                            onChange={(event) => setSelectedInventoryItemId(event.target.value)}
                            required
                          >
                            <option value="">Select item</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.kind})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Quantity
                          <input
                            min="1"
                            step="1"
                            type="number"
                            value={lineQuantity}
                            onChange={(event) => setLineQuantity(event.target.value)}
                            required
                          />
                        </label>
                        <label>
                          Line note
                          <input
                            type="text"
                            value={lineNotes}
                            onChange={(event) => setLineNotes(event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="ops-inline-form__actions">
                        <button className="ops-button" type="submit" disabled={actionLoading}>
                          Add item line
                        </button>
                      </div>
                    </form>
                  ) : null}
                </section>

                <section className="ops-callout">
                  <strong>Workflow actions</strong>
                  <p>
                    FE-B wires backend-approved logistics transitions and handover passation
                    without inventing any new state machine.
                  </p>
                  {passationState.documentInstanceId ? (
                    <p className="ops-preview-note">
                      Delivery note generated. Document instance ID: {passationState.documentInstanceId}
                    </p>
                  ) : null}
                  {passationState.error ? (
                    <p className="ops-preview-note">{passationState.error}</p>
                  ) : null}
                </section>

                <div className="ops-line-actions">
                  <button
                    className="ops-button-secondary"
                    type="button"
                    disabled={!canWrite || actionLoading || selectedEvent.status !== "planned"}
                    onClick={() => void handleTransition("dispatched")}
                  >
                    Dispatch
                  </button>
                  <button
                    className="ops-button-secondary"
                    type="button"
                    disabled={!canWrite || actionLoading || selectedEvent.status !== "dispatched"}
                    onClick={() => void handleTransition("completed")}
                  >
                    Complete
                  </button>
                  <button
                    className="ops-button-danger"
                    type="button"
                    disabled={!canWrite || actionLoading || selectedEvent.status === "completed" || selectedEvent.status === "cancelled"}
                    onClick={() => void handleTransition("cancelled")}
                  >
                    Cancel
                  </button>
                  <button
                    className="ops-button"
                    type="button"
                    disabled={
                      !canWrite ||
                      passationState.loading ||
                      selectedEvent.event_type !== "handover" ||
                      selectedEvent.status !== "completed" ||
                      !selectedEvent.signature_required ||
                      selectedEvent.signature_received
                    }
                    onClick={() => void handleCompletePassation()}
                  >
                    Complete passation
                  </button>
                </div>
              </div>
            ) : (
              <p className="ops-empty">Select a logistics event to inspect its operational detail.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default LogisticsDeliveryPanel;
