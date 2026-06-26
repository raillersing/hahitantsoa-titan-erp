import { type FormEvent, useEffect, useState } from "react";

import {
  ApiError,
  checkEndpointPermission,
  confirmReservationDraft,
  createReservationDraft,
  getCustomers,
  getReservationAvailabilitySummary,
  getReservationAvailableItemPreviews,
  getReservationDraft,
  getReservationDrafts,
  getReservationItemAvailabilityPreview,
  markReservationDraftContractSigned,
  markReservationDraftRequiredDepositReceived,
  updateReservationDraft,
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

type DraftListState =
  | { status: "loading" }
  | { status: "loaded"; drafts: ReservationDraft[] }
  | { status: "error"; message: string };

type DraftDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; draft: ReservationDraft }
  | { status: "error"; message: string };

type DraftUpdateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "updated"; draft: ReservationDraft }
  | { status: "error"; message: string };

type DraftLifecycleState =
  | { status: "idle" }
  | { status: "loading"; action: "contract" | "deposit" | "confirm" }
  | { status: "success"; message: string }
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

type DraftLineInput = {
  inventory_item_id: string;
  quantity: number;
  notes?: string;
};

function toDraftLineInputs(draft: ReservationDraft): DraftLineInput[] {
  return draft.lines.map((line) => ({
    inventory_item_id: line.inventory_item_id,
    quantity: line.quantity,
    notes: line.notes,
  }));
}

function isDraftEditable(draft: ReservationDraft): boolean {
  return draft.status === "draft";
}

function formatLifecycleState(value: string | null): string {
  return value ? formatDateTime(value) : "Pending";
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
  const [draftListState, setDraftListState] = useState<DraftListState>({
    status: "loading",
  });
  const [draftDetailState, setDraftDetailState] = useState<DraftDetailState>({
    status: "idle",
  });
  const [draftNotesDraft, setDraftNotesDraft] = useState("");
  const [draftCustomerIdDraft, setDraftCustomerIdDraft] = useState("");
  const [draftLinesDraft, setDraftLinesDraft] = useState<DraftLineInput[]>([]);
  const [draftPeriodDraft, setDraftPeriodDraft] = useState({
    startAt: "",
    endAt: "",
  });
  const [draftUpdateState, setDraftUpdateState] = useState<DraftUpdateState>({
    status: "idle",
  });
  const [draftLifecycleState, setDraftLifecycleState] =
    useState<DraftLifecycleState>({
      status: "idle",
    });
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/reservations/drafts/", "OPTIONS", controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  async function refreshDrafts(signal?: AbortSignal) {
    try {
      const drafts = await getReservationDrafts(undefined, signal);
      setDraftListState({ status: "loaded", drafts });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setDraftListState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reservation drafts could not be loaded.",
      });
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      try {
        const customers = await getCustomers(undefined, controller.signal);
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
    void refreshDrafts(controller.signal);

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

  function updateDraftLineItemId(index: number, inventoryItemId: string) {
    setDraftLinesDraft((currentLines) =>
      currentLines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              inventory_item_id: inventoryItemId,
            }
          : line,
      ),
    );
    setDraftUpdateState({ status: "idle" });
  }

  function updateDraftLineQuantity(index: number, quantityValue: string) {
    const quantity = Number.parseInt(quantityValue, 10);

    setDraftLinesDraft((currentLines) =>
      currentLines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              quantity,
            }
          : line,
      ),
    );
    setDraftUpdateState({ status: "idle" });
  }

  function updateDraftLineNotes(index: number, notes: string) {
    setDraftLinesDraft((currentLines) =>
      currentLines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              notes,
            }
          : line,
      ),
    );
    setDraftUpdateState({ status: "idle" });
  }

  function addDraftLineDraft() {
    const nextItem = inventoryItems.find(
      (inventoryItem) =>
        !draftLinesDraft.some(
          (line) => line.inventory_item_id === inventoryItem.id,
        ),
    );

    if (!nextItem) {
      setDraftUpdateState({
        status: "error",
        message: "No additional inventory item is available for this draft.",
      });
      return;
    }

    setDraftLinesDraft((currentLines) => [
      ...currentLines,
      {
        inventory_item_id: nextItem.id,
        quantity: 1,
        notes: "",
      },
    ]);
    setDraftUpdateState({ status: "idle" });
  }

  function removeDraftLineDraft(index: number) {
    if (draftLinesDraft.length <= 1) {
      setDraftUpdateState({
        status: "error",
        message: "Keep at least one draft line.",
      });
      return;
    }

    setDraftLinesDraft((currentLines) =>
      currentLines.filter((_, lineIndex) => lineIndex !== index),
    );
    setDraftUpdateState({ status: "idle" });
  }

  async function handleViewDraftDetail(draftId: string) {
    setDraftDetailState({ status: "loading" });

    try {
      const draft = await getReservationDraft(draftId);
      setDraftDetailState({ status: "loaded", draft });
      setDraftNotesDraft(draft.notes);
      setDraftCustomerIdDraft(draft.customer_id);
      setDraftLinesDraft(toDraftLineInputs(draft));
      setDraftPeriodDraft({
        startAt: toDateTimeLocalValue(new Date(draft.start_at)),
        endAt: toDateTimeLocalValue(new Date(draft.end_at)),
      });
      setDraftUpdateState({ status: "idle" });
      setDraftLifecycleState({ status: "idle" });
    } catch (error) {
      setDraftDetailState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reservation draft detail could not be loaded.",
      });
    }
  }

  async function applyUpdatedDraft(updatedDraft: ReservationDraft) {
    setDraftDetailState({ status: "loaded", draft: updatedDraft });
    setDraftNotesDraft(updatedDraft.notes);
    setDraftCustomerIdDraft(updatedDraft.customer_id);
    setDraftLinesDraft(toDraftLineInputs(updatedDraft));
    setDraftPeriodDraft({
      startAt: toDateTimeLocalValue(new Date(updatedDraft.start_at)),
      endAt: toDateTimeLocalValue(new Date(updatedDraft.end_at)),
    });
    setDraftCreationState((currentState) =>
      currentState.status === "created" &&
      currentState.draft.id === updatedDraft.id
        ? { status: "created", draft: updatedDraft }
        : currentState,
    );
    await refreshDrafts();
    setDraftUpdateState({ status: "updated", draft: updatedDraft });
    setDraftLifecycleState({ status: "idle" });
  }

  async function handleMarkContractSigned() {
    if (draftDetailState.status !== "loaded") return;

    setDraftLifecycleState({ status: "loading", action: "contract" });

    try {
      const result = await markReservationDraftContractSigned(
        draftDetailState.draft.id,
      );
      await applyUpdatedDraft(result.reservation_draft);
      setDraftLifecycleState({
        status: "success",
        message: "Contract marker recorded for this Titan reservation.",
      });
    } catch (error) {
      setDraftLifecycleState({
        status: "error",
        message:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "Contract marker could not be recorded.",
      });
    }
  }

  async function handleMarkRequiredDepositReceived() {
    if (draftDetailState.status !== "loaded") return;

    setDraftLifecycleState({ status: "loading", action: "deposit" });

    try {
      const result = await markReservationDraftRequiredDepositReceived(
        draftDetailState.draft.id,
      );
      await applyUpdatedDraft(result.reservation_draft);
      setDraftLifecycleState({
        status: "success",
        message: "Deposit marker recorded for this Titan reservation.",
      });
    } catch (error) {
      setDraftLifecycleState({
        status: "error",
        message:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "Deposit marker could not be recorded.",
      });
    }
  }

  async function handleConfirmDraft() {
    if (draftDetailState.status !== "loaded") return;

    setDraftLifecycleState({ status: "loading", action: "confirm" });

    try {
      const result = await confirmReservationDraft(draftDetailState.draft.id);
      await applyUpdatedDraft(result.reservation_draft);
      setDraftLifecycleState({
        status: "success",
        message: `Titan reservation confirmed. ${result.blocked_item_count} inventory blocks were created.`,
      });
    } catch (error) {
      setDraftLifecycleState({
        status: "error",
        message:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "Titan reservation could not be confirmed.",
      });
    }
  }

  async function handleUpdateDraftLines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draftDetailState.status !== "loaded") {
      setDraftUpdateState({
        status: "error",
        message: "Open a draft detail before saving lines.",
      });
      return;
    }

    if (draftLinesDraft.length === 0) {
      setDraftUpdateState({
        status: "error",
        message: "Keep at least one draft line.",
      });
      return;
    }

    const hasInvalidLine = draftLinesDraft.some(
      (line) =>
        !line.inventory_item_id ||
        !Number.isFinite(line.quantity) ||
        line.quantity < 1,
    );

    if (hasInvalidLine) {
      setDraftUpdateState({
        status: "error",
        message: "Choose valid draft lines with quantities greater than zero.",
      });
      return;
    }

    const inventoryItemIds = draftLinesDraft.map(
      (line) => line.inventory_item_id,
    );
    const hasDuplicateItem =
      new Set(inventoryItemIds).size !== inventoryItemIds.length;

    if (hasDuplicateItem) {
      setDraftUpdateState({
        status: "error",
        message: "Each inventory item can appear only once per draft.",
      });
      return;
    }

    setDraftUpdateState({ status: "loading" });

    try {
      const updatedDraft = await updateReservationDraft(
        draftDetailState.draft.id,
        {
          lines: draftLinesDraft.map((line) => ({
            inventory_item_id: line.inventory_item_id,
            quantity: line.quantity,
            notes: line.notes ?? "",
          })),
        },
      );

      await applyUpdatedDraft(updatedDraft);
    } catch (error) {
      setDraftUpdateState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reservation draft lines could not be saved.",
      });
    }
  }

  async function handleUpdateDraftCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draftDetailState.status !== "loaded") {
      setDraftUpdateState({
        status: "error",
        message: "Open a draft detail before saving the customer.",
      });
      return;
    }

    if (!draftCustomerIdDraft) {
      setDraftUpdateState({
        status: "error",
        message: "Choose a draft customer before saving.",
      });
      return;
    }

    setDraftUpdateState({ status: "loading" });

    try {
      const updatedDraft = await updateReservationDraft(
        draftDetailState.draft.id,
        {
          customer_id: draftCustomerIdDraft,
        },
      );

      await applyUpdatedDraft(updatedDraft);
    } catch (error) {
      setDraftUpdateState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reservation draft customer could not be saved.",
      });
    }
  }

  async function handleUpdateDraftPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draftDetailState.status !== "loaded") {
      setDraftUpdateState({
        status: "error",
        message: "Open a draft detail before saving the period.",
      });
      return;
    }

    const startDate = new Date(draftPeriodDraft.startAt);
    const endDate = new Date(draftPeriodDraft.endAt);

    if (
      !draftPeriodDraft.startAt ||
      !draftPeriodDraft.endAt ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      setDraftUpdateState({
        status: "error",
        message: "Choose a valid draft period with an end after the start.",
      });
      return;
    }

    setDraftUpdateState({ status: "loading" });

    try {
      const updatedDraft = await updateReservationDraft(
        draftDetailState.draft.id,
        {
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
        },
      );

      await applyUpdatedDraft(updatedDraft);
    } catch (error) {
      setDraftUpdateState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reservation draft period could not be saved.",
      });
    }
  }

  async function handleUpdateDraftNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draftDetailState.status !== "loaded") {
      setDraftUpdateState({
        status: "error",
        message: "Open a draft detail before saving notes.",
      });
      return;
    }

    setDraftUpdateState({ status: "loading" });

    try {
      const updatedDraft = await updateReservationDraft(
        draftDetailState.draft.id,
        {
          notes: draftNotesDraft,
        },
      );

      await applyUpdatedDraft(updatedDraft);
    } catch (error) {
      setDraftUpdateState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Reservation draft notes could not be saved.",
      });
    }
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
      setDraftDetailState({ status: "loaded", draft });
      setDraftNotesDraft(draft.notes);
      setDraftCustomerIdDraft(draft.customer_id);
      setDraftLinesDraft(toDraftLineInputs(draft));
      setDraftPeriodDraft({
        startAt: toDateTimeLocalValue(new Date(draft.start_at)),
        endAt: toDateTimeLocalValue(new Date(draft.end_at)),
      });
      setDraftUpdateState({ status: "idle" });
      await refreshDrafts();
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
          <p className="eyebrow">Prototype 4 · Titan</p>
          <h2 id="availability-heading">Titan reservations</h2>
          <p className="section-helper">
            Pure rental workflow for <code>material</code>, <code>article</code>, and{" "}
            <code>material_pack</code> only. Sign in through the backend
            <code> /api-auth/login/</code> first. For local demo data, run
            <code> seed_demo_availability</code> and choose a period overlapping
            its next two-hour window.
          </p>
        </div>
      </div>

      <div className="notice warning-notice" role="status">
        <h3>Titan business boundary</h3>
        <p>
          This module must never expose venues, rooms, halls, services, or event
          operations. Only Titan rental inventory is allowed here.
        </p>
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
        <p className="status" aria-live="polite">Checking availability...</p>
      ) : null}

      {availabilityState.status === "error" ? (
        <div className="notice availability-notice" role="alert">
          <h3>Availability unavailable</h3>
          <p>{availabilityState.message}</p>
        </div>
      ) : null}

      <section
        className="availability-results"
        aria-labelledby="reservation-drafts-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Draft-only reservations</p>
            <h2 id="reservation-drafts-heading">Reservation drafts</h2>
            <p className="section-helper">
              Prototype-aligned Titan list view for draft and confirmed rental
              reservations. Open a record below to manage lifecycle, customer,
              dates, and lines.
            </p>
          </div>
          {draftListState.status === "loaded" ? (
            <span>{draftListState.drafts.length}</span>
          ) : null}
        </div>

        {draftListState.status === "loading" ? (
          <p className="status" aria-live="polite">Loading reservation drafts...</p>
        ) : null}

        {draftListState.status === "error" ? (
          <div className="notice availability-notice" role="alert">
            <h3>Reservation drafts unavailable</h3>
            <p>{draftListState.message}</p>
          </div>
        ) : null}

        {draftListState.status === "loaded" ? (
          draftListState.drafts.length === 0 ? (
            <p className="status">
              No reservation drafts are currently visible.
            </p>
          ) : (
            <ul className="preview-list">
              {draftListState.drafts.map((draft) => (
                <li key={draft.id}>
                  <div>
                    <strong>{draft.public_reference}</strong>
                    <span>{draft.customer_display_name}</span>
                    <span>
                      {formatDateTime(draft.start_at)} —{" "}
                      {formatDateTime(draft.end_at)}
                    </span>
                  </div>
                  <span>{draft.status}</span>
                  <span>{draft.lines.length} lines</span>
                  <button
                    type="button"
                    onClick={() => void handleViewDraftDetail(draft.id)}
                  >
                    View details
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {draftDetailState.status === "loading" ? (
          <p className="status" aria-live="polite">Loading reservation draft detail...</p>
        ) : null}

        {draftDetailState.status === "error" ? (
          <div className="notice availability-notice" role="alert">
            <h3>Reservation draft detail unavailable</h3>
            <p>{draftDetailState.message}</p>
          </div>
        ) : null}

        {draftDetailState.status === "loaded" ? (
          <article className="availability-results">
            <h3>Draft detail {draftDetailState.draft.public_reference}</h3>
            <div className="reservation-summary-grid">
              <article className="reservation-summary-card">
                <span>Customer</span>
                <strong>{draftDetailState.draft.customer_display_name}</strong>
              </article>
              <article className="reservation-summary-card">
                <span>Period</span>
                <strong>{formatDateTime(draftDetailState.draft.start_at)}</strong>
                <small>{formatDateTime(draftDetailState.draft.end_at)}</small>
              </article>
              <article className="reservation-summary-card">
                <span>Status</span>
                <strong>{draftDetailState.draft.status}</strong>
                <small>{draftDetailState.draft.lines.length} lines</small>
              </article>
              <article className="reservation-summary-card">
                <span>Titan readiness</span>
                <strong>
                  {draftDetailState.draft.confirmed_at
                    ? "Confirmed"
                    : draftDetailState.draft.contract_signed_at &&
                        draftDetailState.draft.required_deposit_received_at
                      ? "Ready to confirm"
                      : "Pending prerequisites"}
                </strong>
                <small>Contract, deposit, inventory block</small>
              </article>
            </div>

            <div className="reservation-workflow-rail" aria-label="Titan reservation workflow">
              <span className="workflow-step workflow-step--done">Draft</span>
              <span
                className={
                  draftDetailState.draft.contract_signed_at
                    ? "workflow-step workflow-step--done"
                    : "workflow-step workflow-step--warning"
                }
              >
                Contract
              </span>
              <span
                className={
                  draftDetailState.draft.required_deposit_received_at
                    ? "workflow-step workflow-step--done"
                    : "workflow-step workflow-step--warning"
                }
              >
                Deposit
              </span>
              <span
                className={
                  draftDetailState.draft.confirmed_at
                    ? "workflow-step workflow-step--done"
                    : "workflow-step"
                }
              >
                Confirmed
              </span>
            </div>

            <dl className="summary-grid">
              <div>
                <dt>Contract marker</dt>
                <dd>{formatLifecycleState(draftDetailState.draft.contract_signed_at)}</dd>
              </div>
              <div>
                <dt>Deposit marker</dt>
                <dd>
                  {formatLifecycleState(
                    draftDetailState.draft.required_deposit_received_at,
                  )}
                </dd>
              </div>
              <div>
                <dt>Confirmed at</dt>
                <dd>{formatLifecycleState(draftDetailState.draft.confirmed_at)}</dd>
              </div>
              <div>
                <dt>Cancelled at</dt>
                <dd>{formatLifecycleState(draftDetailState.draft.cancelled_at)}</dd>
              </div>
            </dl>

            {canWrite && isDraftEditable(draftDetailState.draft) ? (
              <div className="detail-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={
                    draftLifecycleState.status === "loading" ||
                    Boolean(draftDetailState.draft.contract_signed_at)
                  }
                  onClick={() => void handleMarkContractSigned()}
                >
                  Mark contract signed
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={
                    draftLifecycleState.status === "loading" ||
                    Boolean(draftDetailState.draft.required_deposit_received_at)
                  }
                  onClick={() => void handleMarkRequiredDepositReceived()}
                >
                  Mark deposit received
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={
                    draftLifecycleState.status === "loading" ||
                    !draftDetailState.draft.contract_signed_at ||
                    !draftDetailState.draft.required_deposit_received_at
                  }
                  onClick={() => void handleConfirmDraft()}
                >
                  Confirm Titan reservation
                </button>
              </div>
            ) : null}

            {draftLifecycleState.status === "loading" ? (
              <p className="status" aria-live="polite">
                {draftLifecycleState.action === "contract"
                  ? "Recording contract marker..."
                  : draftLifecycleState.action === "deposit"
                    ? "Recording deposit marker..."
                    : "Confirming Titan reservation..."}
              </p>
            ) : null}

            {draftLifecycleState.status === "success" ? (
              <div className="notice success-notice" role="status">
                <p>{draftLifecycleState.message}</p>
              </div>
            ) : null}

            {draftLifecycleState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Titan lifecycle action unavailable</h4>
                <p>{draftLifecycleState.message}</p>
              </div>
            ) : null}

            {!isDraftEditable(draftDetailState.draft) ? (
              <div className="notice warning-notice" role="status">
                <h4>Confirmed or cancelled reservation</h4>
                <p>
                  This Titan reservation is no longer editable from the draft workflow.
                </p>
              </div>
            ) : null}
            {canWrite ? (<>
            <form
              className="availability-form"
              onSubmit={handleUpdateDraftCustomer}
            >
              <label>
                Draft customer
                <select
                  name="draft_customer_id"
                  value={draftCustomerIdDraft}
                  onChange={(event) =>
                    setDraftCustomerIdDraft(event.target.value)
                  }
                >
                  {customerState.status === "loaded"
                    ? customerState.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.display_name}
                        </option>
                      ))
                    : null}
                </select>
              </label>
              <button
                type="submit"
                disabled={
                  draftUpdateState.status === "loading" ||
                  !isDraftEditable(draftDetailState.draft) ||
                  customerState.status !== "loaded"
                }
              >
                Save draft customer
              </button>
            </form>
            <form
              className="availability-form"
              onSubmit={handleUpdateDraftPeriod}
            >
              <label>
                Draft start
                <input
                  name="draft_start_at"
                  type="datetime-local"
                  value={draftPeriodDraft.startAt}
                  onChange={(event) =>
                    setDraftPeriodDraft((currentPeriod) => ({
                      ...currentPeriod,
                      startAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Draft end
                <input
                  name="draft_end_at"
                  type="datetime-local"
                  value={draftPeriodDraft.endAt}
                  onChange={(event) =>
                    setDraftPeriodDraft((currentPeriod) => ({
                      ...currentPeriod,
                      endAt: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="submit"
                disabled={
                  draftUpdateState.status === "loading" ||
                  !isDraftEditable(draftDetailState.draft)
                }
              >
                Save draft period
              </button>
            </form>
            <form
              className="availability-form"
              onSubmit={handleUpdateDraftNotes}
            >
              <label>
                Draft notes
                <textarea
                  name="draft_notes"
                  value={draftNotesDraft}
                  onChange={(event) => setDraftNotesDraft(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={
                  draftUpdateState.status === "loading" ||
                  !isDraftEditable(draftDetailState.draft)
                }
              >
                Save draft notes
              </button>
            </form>

            {draftUpdateState.status === "loading" ? (
              <p className="status" aria-live="polite">Saving draft changes...</p>
            ) : null}

            {draftUpdateState.status === "updated" ? (
              <p className="status">Draft changes saved.</p>
            ) : null}

            {draftUpdateState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Draft update unavailable</h4>
                <p>{draftUpdateState.message}</p>
              </div>
            ) : null}

            <form
              className="availability-form"
              onSubmit={handleUpdateDraftLines}
            >
              <h4>Draft lines</h4>
              {draftLinesDraft.map((line, index) => (
                <fieldset key={`${line.inventory_item_id}-${index}`}>
                  <legend>Draft line {index + 1}</legend>
                  <label>
                    Draft line {index + 1} item
                    <select
                      value={line.inventory_item_id}
                      onChange={(event) =>
                        updateDraftLineItemId(index, event.target.value)
                      }
                    >
                      {inventoryItems.some(
                        (inventoryItem) =>
                          inventoryItem.id === line.inventory_item_id,
                      ) ? null : (
                        <option value={line.inventory_item_id}>
                          Current draft line item
                        </option>
                      )}
                      {inventoryItems.map((inventoryItem) => (
                        <option key={inventoryItem.id} value={inventoryItem.id}>
                          {inventoryItem.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Draft line {index + 1} quantity
                    <input
                      type="number"
                      min="1"
                      value={Number.isNaN(line.quantity) ? "" : line.quantity}
                      onChange={(event) =>
                        updateDraftLineQuantity(index, event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Draft line {index + 1} notes
                    <textarea
                      value={line.notes ?? ""}
                      onChange={(event) =>
                        updateDraftLineNotes(index, event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      draftUpdateState.status === "loading" ||
                      !isDraftEditable(draftDetailState.draft) ||
                      draftLinesDraft.length <= 1
                    }
                    onClick={() => removeDraftLineDraft(index)}
                  >
                    Remove draft line {index + 1}
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={
                  draftUpdateState.status === "loading" ||
                  !isDraftEditable(draftDetailState.draft) ||
                  inventoryItems.length === 0
                }
                onClick={addDraftLineDraft}
              >
                Add draft line
              </button>
              <button
                type="submit"
                disabled={
                  draftUpdateState.status === "loading" ||
                  !isDraftEditable(draftDetailState.draft)
                }
              >
                Save draft lines
              </button>
            </form>
            </>) : null}

            <ul className="preview-list">
              {draftDetailState.draft.lines.map((line) => (
                <li key={line.id}>
                  <span>{line.inventory_item_name}</span>
                  <span>{line.inventory_item_kind}</span>
                  <span>Quantity: {line.quantity}</span>
                  {line.notes ? <span>{line.notes}</span> : null}
                </li>
              ))}
            </ul>
            <p className="section-helper">
              Confirmation still depends on existing backend truth: signed contract
              document, confirmed deposit payment, availability revalidation, and
              reservation-sensitive authorization.
            </p>
          </article>
        ) : null}
      </section>

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
            <h3>New reservation wizard</h3>
            <div className="reservation-workflow-rail" aria-label="New Titan reservation wizard">
              <span className="workflow-step workflow-step--done">Choose period</span>
              <span
                className={
                  selectedCustomerId ? "workflow-step workflow-step--done" : "workflow-step"
                }
              >
                Select customer
              </span>
              <span
                className={
                  selectedItemIds.length > 0
                    ? "workflow-step workflow-step--done"
                    : "workflow-step"
                }
              >
                Pick items
              </span>
              <span
                className={
                  draftCreationState.status === "created"
                    ? "workflow-step workflow-step--done"
                    : "workflow-step"
                }
              >
                Create draft
              </span>
            </div>
            <p className="section-helper">
              This guided flow creates an editable Titan draft first, then the
              reservation can be finalized from the detail panel above.
            </p>

            {!canWrite ? (
              <p className="status">Sign in with write access to create draft reservations.</p>
            ) : null}

            {canWrite && customerState.status === "loading" ? (
              <p className="status" aria-live="polite">Loading customers...</p>
            ) : null}

            {canWrite && customerState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Customers unavailable</h4>
                <p>{customerState.message}</p>
              </div>
            ) : null}

            {canWrite && customerState.status === "loaded" ? (
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
                  Create Titan draft
                </button>
              </>
            ) : null}

            {draftCreationState.status === "loading" ? (
              <p className="status" aria-live="polite">Creating reservation draft...</p>
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
