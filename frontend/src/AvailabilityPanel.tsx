import { type FormEvent, useEffect, useState } from "react";

import {
  createReservationDraft,
  getCustomers,
  getReservationAvailabilitySummary,
  getReservationAvailableItemPreviews,
  getReservationItemAvailabilityPreview,
} from "./api";
import type {
  Customer,
  InventoryItem,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
  ReservationDraft,
  ReservationItemAvailabilityPreview,
} from "./types";

type AvailabilityState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      summary: ReservationAvailabilitySummary;
      previews: ReservationAvailableItemPreview[];
      itemPreviews: ReservationItemAvailabilityPreview[];
    }
  | { status: "error"; message: string };

type DraftCreationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "created"; draft: ReservationDraft }
  | { status: "error"; message: string };

type CustomerState =
  | { status: "loading" }
  | { status: "loaded"; customers: Customer[] }
  | { status: "error"; message: string };

type AvailabilityPanelProps = {
  inventoryItems?: InventoryItem[];
};

function toDateTimeLocalValue(date: Date): string {
  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMilliseconds)
    .toISOString()
    .slice(0, 16);
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

function AvailabilityPanel({ inventoryItems = [] }: AvailabilityPanelProps) {
  const initialPeriod = defaultPeriod();
  const [startAt, setStartAt] = useState(initialPeriod.startAt);
  const [endAt, setEndAt] = useState(initialPeriod.endAt);
  const [availabilityState, setAvailabilityState] = useState<AvailabilityState>(
    {
      status: "idle",
    },
  );
  const [customerState, setCustomerState] = useState<CustomerState>({
    status: "loading",
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [draftCreationState, setDraftCreationState] =
    useState<DraftCreationState>({
      status: "idle",
    });

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      try {
        const customers = await getCustomers(controller.signal);
        setCustomerState({ status: "loaded", customers });
        if (customers.length > 0) {
          setSelectedCustomerId(customers[0].id);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setCustomerState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Customers could not be loaded.",
        });
      }
    }

    void loadCustomers();

    return () => controller.abort();
  }, []);

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
      const [summary, previews, itemPreviews] = await Promise.all([
        getReservationAvailabilitySummary(startAtIso, endAtIso),
        getReservationAvailableItemPreviews(startAtIso, endAtIso),
        Promise.all(
          inventoryItems.map((item) =>
            getReservationItemAvailabilityPreview(
              item.id,
              startAtIso,
              endAtIso,
            ),
          ),
        ),
      ]);

      setAvailabilityState({
        status: "loaded",
        summary,
        previews,
        itemPreviews,
      });
      setSelectedItemIds(previews.map((preview) => preview.inventory_item_id));
      setDraftCreationState({ status: "idle" });
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

  function toggleSelectedItem(inventoryItemId: string) {
    setSelectedItemIds((currentSelectedItemIds) =>
      currentSelectedItemIds.includes(inventoryItemId)
        ? currentSelectedItemIds.filter((itemId) => itemId !== inventoryItemId)
        : [...currentSelectedItemIds, inventoryItemId],
    );
    setDraftCreationState({ status: "idle" });
  }

  async function handleCreateDraft() {
    if (availabilityState.status !== "loaded") {
      setDraftCreationState({
        status: "error",
        message: "Check availability before creating a draft.",
      });
      return;
    }

    if (!selectedCustomerId) {
      setDraftCreationState({
        status: "error",
        message: "Choose a customer before creating a draft.",
      });
      return;
    }

    if (selectedItemIds.length === 0) {
      setDraftCreationState({
        status: "error",
        message: "Choose at least one available item before creating a draft.",
      });
      return;
    }

    setDraftCreationState({ status: "loading" });

    try {
      const draft = await createReservationDraft({
        customer_id: selectedCustomerId,
        start_at: availabilityState.summary.start_at,
        end_at: availabilityState.summary.end_at,
        notes: "Created from the frontend MVP draft flow.",
        lines: selectedItemIds.map((inventoryItemId) => ({
          inventory_item_id: inventoryItemId,
          quantity: 1,
          notes: "",
        })),
      });

      setDraftCreationState({ status: "created", draft });
    } catch (error) {
      setDraftCreationState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reservation draft could not be created.",
      });
    }
  }

  return (
    <section
      className="availability-section"
      aria-labelledby="availability-heading"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Read-only availability</p>
          <h2 id="availability-heading">Availability</h2>
          <p className="section-helper">
            Read-only check. Sign in through the backend /api-auth/login/ first.
            For local demo data, run seed_demo_availability and choose a period
            overlapping its next two-hour window. Checking availability does not
            create a reservation.
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
            <p>
              {availabilityState.summary.available_item_kinds.join(", ") ||
                "None"}
            </p>
          </div>

          <div className="preview-list-section">
            <h3>Available item previews</h3>
            {availabilityState.previews.length === 0 ? (
              <p className="status">No items are available for this period.</p>
            ) : (
              <ul className="preview-list">
                {availabilityState.previews.map((preview) => (
                  <li key={preview.inventory_item_id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(
                          preview.inventory_item_id,
                        )}
                        onChange={() =>
                          toggleSelectedItem(preview.inventory_item_id)
                        }
                      />
                      <span>{preview.inventory_item_name}</span>
                    </label>
                    <span>{preview.inventory_item_kind}</span>
                    <strong>{preview.status}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="preview-list-section">
            <h3>Reservation draft</h3>

            {customerState.status === "loading" ? (
              <p className="status">Loading customers...</p>
            ) : null}

            {customerState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Customers unavailable</h4>
                <p>{customerState.message}</p>
              </div>
            ) : null}

            {customerState.status === "loaded" ? (
              <>
                <label>
                  Customer
                  <select
                    value={selectedCustomerId}
                    onChange={(event) => {
                      setSelectedCustomerId(event.target.value);
                      setDraftCreationState({ status: "idle" });
                    }}
                  >
                    {customerState.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.display_name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  disabled={
                    draftCreationState.status === "loading" ||
                    availabilityState.previews.length === 0 ||
                    selectedItemIds.length === 0 ||
                    !selectedCustomerId
                  }
                  onClick={handleCreateDraft}
                >
                  Create draft
                </button>
              </>
            ) : null}

            {draftCreationState.status === "loading" ? (
              <p className="status">Creating reservation draft...</p>
            ) : null}

            {draftCreationState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Reservation draft unavailable</h4>
                <p>{draftCreationState.message}</p>
              </div>
            ) : null}

            {draftCreationState.status === "created" ? (
              <div className="notice">
                <h4>Draft created</h4>
                <p>Reference: {draftCreationState.draft.public_reference}</p>
                <p>Status: {draftCreationState.draft.status}</p>
              </div>
            ) : null}
            <p className="section-helper">
              Draft-only action. The reservation remains editable and
              unfinalized.
            </p>
          </div>

          <div className="preview-list-section">
            <h3>Item-specific availability previews</h3>
            {availabilityState.itemPreviews.length === 0 ? (
              <p className="status">
                No inventory items are loaded for item-specific preview.
              </p>
            ) : (
              <ul className="preview-list">
                {availabilityState.itemPreviews.map((preview) => (
                  <li key={preview.inventory_item_id}>
                    <span>{preview.inventory_item_name}</span>
                    <span>{preview.inventory_item_kind}</span>
                    <strong>{preview.status}</strong>
                    <span>{preview.conflict_count} conflicts</span>
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
