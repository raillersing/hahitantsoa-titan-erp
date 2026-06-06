import { type FormEvent, useState } from "react";

import {
  getReservationAvailabilitySummary,
  getReservationAvailableItemPreviews,
} from "./api";
import type {
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
} from "./types";

type AvailabilityState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      summary: ReservationAvailabilitySummary;
      previews: ReservationAvailableItemPreview[];
    }
  | { status: "error"; message: string };

function toDateTimeLocalValue(date: Date): string {
  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function defaultPeriod(): { startAt: string; endAt: string } {
  const startAt = new Date();
  startAt.setSeconds(0, 0);
  const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

  return {
    startAt: toDateTimeLocalValue(startAt),
    endAt: toDateTimeLocalValue(endAt),
  };
}

function AvailabilityPanel() {
  const initialPeriod = defaultPeriod();
  const [startAt, setStartAt] = useState(initialPeriod.startAt);
  const [endAt, setEndAt] = useState(initialPeriod.endAt);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>({
    status: "idle",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (
      !startAt ||
      !endAt ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      setAvailabilityState({
        status: "error",
        message: "Choose a valid period with an end after the start.",
      });
      return;
    }

    setAvailabilityState({ status: "loading" });

    try {
      const startAtIso = startDate.toISOString();
      const endAtIso = endDate.toISOString();
      const [summary, previews] = await Promise.all([
        getReservationAvailabilitySummary(startAtIso, endAtIso),
        getReservationAvailableItemPreviews(startAtIso, endAtIso),
      ]);

      setAvailabilityState({ status: "loaded", summary, previews });
    } catch (error) {
      setAvailabilityState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Availability could not be checked.",
      });
    }
  }

  return (
    <section className="availability-section" aria-labelledby="availability-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Read-only availability</p>
          <h2 id="availability-heading">Availability</h2>
          <p className="section-helper">
            Read-only check. Sign in through the backend /api-auth/login/ first.
            Checking availability does not create a reservation.
          </p>
        </div>
      </div>

      <form className="availability-form" onSubmit={handleSubmit}>
        <label>
          Start
          <input
            name="start_at"
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
          />
        </label>
        <label>
          End
          <input
            name="end_at"
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
          />
        </label>
        <button type="submit" disabled={availabilityState.status === "loading"}>
          Check availability
        </button>
      </form>

      {availabilityState.status === "loading" ? (
        <p className="status">Checking availability...</p>
      ) : null}

      {availabilityState.status === "error" ? (
        <div className="notice availability-notice" role="alert">
          <h3>Availability unavailable</h3>
          <p>{availabilityState.message}</p>
        </div>
      ) : null}

      {availabilityState.status === "loaded" ? (
        <div className="availability-results">
          <dl className="summary-grid">
            <div>
              <dt>Start</dt>
              <dd>{formatDateTime(availabilityState.summary.start_at)}</dd>
            </div>
            <div>
              <dt>End</dt>
              <dd>{formatDateTime(availabilityState.summary.end_at)}</dd>
            </div>
            <div>
              <dt>Available items</dt>
              <dd>{availabilityState.summary.available_item_count}</dd>
            </div>
            <div>
              <dt>Available previews</dt>
              <dd>{availabilityState.summary.available_preview_count}</dd>
            </div>
          </dl>

          <div className="availability-kinds">
            <h3>Available kinds</h3>
            <p>{availabilityState.summary.available_item_kinds.join(", ") || "None"}</p>
          </div>

          <div className="preview-list-section">
            <h3>Available item previews</h3>
            {availabilityState.previews.length === 0 ? (
              <p className="status">No items are available for this period.</p>
            ) : (
              <ul className="preview-list">
                {availabilityState.previews.map((preview) => (
                  <li key={preview.inventory_item_id}>
                    <span>{preview.inventory_item_name}</span>
                    <span>{preview.inventory_item_kind}</span>
                    <strong>{preview.status}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AvailabilityPanel;
