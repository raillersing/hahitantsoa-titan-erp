import './operational-styles.css';
import React, { useEffect, useRef, useState } from 'react';
import { getLogisticsEvents } from './api';
import type { LogisticsEvent } from './types';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  dispatched: 'Dispatched',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_CLASSES: Record<string, string> = {
  planned: '',
  dispatched: '',
  completed: '',
  cancelled: '',
};

function DeliveryRow({ event }: { event: LogisticsEvent }) {
  return (
    <div className="ops-row" data-testid={`delivery-row-${event.id}`}>
      <span className="ops-row__ref">
        {event.reservation_draft.slice(0, 8)}
      </span>
      <span className="ops-row__status">
        {STATUS_LABELS[event.status] || event.status}
      </span>
      <span className="ops-row__detail">
        {event.scheduled_at
          ? new Date(event.scheduled_at).toLocaleDateString()
          : '—'}
      </span>
      <span className="ops-row__qty">
        {event.contact_name || '—'}
      </span>
    </div>
  );
}

export function LogisticsDeliveryPanel() {
  const [events, setEvents] = useState<LogisticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      abortRef.current = new AbortController();
      try {
        const data = await getLogisticsEvents(abortRef.current.signal);
        setEvents(Array.isArray(data) ? data.filter(
          (e) => e.event_type === 'delivery',
        ) : []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load logistics events.');
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
    <div className="ops-panel" data-testid="logistics-delivery-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Delivery Events</h3>
      </div>

      {loading && (
        <div className="loading-notice" aria-live="polite">
          Loading delivery events...
        </div>
      )}

      {!loading && error && (
        <div className="notice error-notice" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="ops-empty">No delivery events found.</div>
      )}

      {!loading && !error && events.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Delivery events list">
          {events.map((ev) => (
            <li key={ev.id}>
              <DeliveryRow event={ev} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LogisticsDeliveryPanel;
