import { type FormEvent, useEffect, useRef, useState } from "react";

import {
  ApiError,
  cancelReservationDraft,
  checkEndpointPermission,
  confirmReservationDraft,
  createReservationDraft,
  getCustomers,
  getBillingInvoices,
  getLogisticsEvents,
  getPayments,
  getReservationAvailabilitySummary,
  getReservationAvailableItemPreviews,
  getReservationDraft,
  getReservationDraftDocumentInstances,
  getReservationDrafts,
  getReservationItemAvailabilityPreview,
  markReservationDraftContractSigned,
  markReservationDraftRequiredDepositReceived,
  updateReservationDraft,
} from "./api";
import type {
  BillingInvoice,
  Customer,
  DocumentInstance,
  InventoryItem,
  LogisticsEvent,
  Payment,
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
  | { status: "loading"; action: "contract" | "deposit" | "confirm" | "cancel" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type DraftRelatedDataState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; payments: Payment[]; invoices: BillingInvoice[]; logistics: LogisticsEvent[]; documents: DocumentInstance[] }
  | { status: "error"; message: string };

type AvailabilityPanelProps = {
  inventoryItems?: InventoryItem[];
  onNavigate?: (scope: string) => void;
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
  return value ? formatDateTime(value) : "En attente";
}

function AvailabilityPanel({ inventoryItems = [], onNavigate }: AvailabilityPanelProps) {
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
  const [draftRelatedDataState, setDraftRelatedDataState] =
    useState<DraftRelatedDataState>({ status: "idle" });
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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
      void loadRelatedData(draft.id);
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

  async function handleCancelDraft() {
    if (draftDetailState.status !== "loaded") return;
    const draft = draftDetailState.draft;
    const reason = window.prompt(
      "Annuler la réservation Titan ?\nRenseignez un motif (obligatoire).",
      "",
    );
    if (reason === null) return; // annulé par l'opérateur
    if (!reason.trim()) {
      setDraftLifecycleState({
        status: "error",
        message: "Le motif d'annulation est obligatoire.",
      });
      return;
    }

    setDraftLifecycleState({ status: "loading", action: "cancel" });
    try {
      const updated = await cancelReservationDraft(draft.id, { reason: reason.trim() });
      await applyUpdatedDraft(updated);
      setDraftLifecycleState({
        status: "success",
        message: `Réservation ${updated.public_reference} annulée.`,
      });
    } catch (error) {
      setDraftLifecycleState({
        status: "error",
        message:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : "La réservation n'a pas pu être annulée.",
      });
    }
  }

  async function loadRelatedData(draftId: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setDraftRelatedDataState({ status: "loading" });

    try {
      const [payments, invoices, logistics, documents] = await Promise.all([
        getPayments(draftId, controller.signal).catch(() => [] as Payment[]),
        getBillingInvoices(draftId, controller.signal).catch(() => [] as BillingInvoice[]),
        getLogisticsEvents(draftId, controller.signal).catch(() => [] as LogisticsEvent[]),
        getReservationDraftDocumentInstances(draftId, controller.signal).catch(() => [] as DocumentInstance[]),
      ]);

      if (!controller.signal.aborted) {
        setDraftRelatedDataState({ status: "loaded", payments, invoices, logistics, documents });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setDraftRelatedDataState({
        status: "error",
        message: error instanceof Error ? error.message : "Related data could not be loaded.",
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
          <p className="eyebrow">Module Titan</p>
          <h2 id="availability-heading">Réservations Titan</h2>
          <p className="section-helper">
            Workflow de location pure pour les <code>articles</code>, <code>matériels</code> et{" "}
            <code>packs</code>. Les brouillons de réservation suivent le cycle : création, contrat signé, dépôt reçu, confirmation.
          </p>
        </div>
      </div>

      <div className="notice warning-notice" role="status">
        <h3>Périmètre métier Titan</h3>
        <p>
          Ce module ne doit jamais exposer les lieux, salles, halls, services ou
          opérations d'événement. Seul l'inventaire de location Titan est autorisé ici.
        </p>
      </div>

      <form className="availability-form" onSubmit={handleSubmit}>
        <label>
          Début
          <input
            name="start_at"
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
          />
        </label>
        <label>
          Fin
          <input
            name="end_at"
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
          />
        </label>
        <button type="submit" disabled={availabilityState.status === "loading"}>
          Vérifier la disponibilité
        </button>
      </form>

      {availabilityState.status === "loading" ? (
        <p className="status" aria-live="polite">Vérification de la disponibilité...</p>
      ) : null}

      {availabilityState.status === "error" ? (
        <div className="notice availability-notice" role="alert">
          <h3>Disponibilité indisponible</h3>
          <p>{availabilityState.message}</p>
        </div>
      ) : null}

      <section
        className="availability-results"
        aria-labelledby="reservation-drafts-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Brouillons de réservation</p>
            <h2 id="reservation-drafts-heading">Brouillons de réservation</h2>
            <p className="section-helper">
              Liste des brouillons Titan pour les réservations de location.
              Ouvrez un enregistrement ci-dessous pour gérer le cycle de vie, le client, les dates et les lignes.
            </p>
          </div>
          {draftListState.status === "loaded" ? (
            <span>{draftListState.drafts.length}</span>
          ) : null}
        </div>

        {draftListState.status === "loading" ? (
          <p className="status" aria-live="polite">Chargement des brouillons...</p>
        ) : null}

        {draftListState.status === "error" ? (
          <div className="notice availability-notice" role="alert">
            <h3>Brouillons indisponibles</h3>
            <p>{draftListState.message}</p>
          </div>
        ) : null}

        {draftListState.status === "loaded" ? (
          draftListState.drafts.length === 0 ? (
            <p className="status">
              Aucun brouillon de réservation visible.
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
                  <span>{draft.lines.length} lignes</span>
                  <button
                    type="button"
                    onClick={() => void handleViewDraftDetail(draft.id)}
                  >
                    Voir le détail
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {draftDetailState.status === "loading" ? (
          <p className="status" aria-live="polite">Chargement du détail...</p>
        ) : null}

        {draftDetailState.status === "error" ? (
          <div className="notice availability-notice" role="alert">
            <h3>Détail du brouillon indisponible</h3>
            <p>{draftDetailState.message}</p>
          </div>
        ) : null}

        {draftDetailState.status === "loaded" ? (
          <article className="availability-results">
            <h3>Détail du brouillon {draftDetailState.draft.public_reference}</h3>
            <div className="reservation-summary-grid">
              <article className="reservation-summary-card">
                <span>Client</span>
                <strong>{draftDetailState.draft.customer_display_name}</strong>
              </article>
              <article className="reservation-summary-card">
                <span>Période</span>
                <strong>{formatDateTime(draftDetailState.draft.start_at)}</strong>
                <small>{formatDateTime(draftDetailState.draft.end_at)}</small>
              </article>
              <article className="reservation-summary-card">
                <span>Statut</span>
                <strong>{draftDetailState.draft.status}</strong>
                <small>{draftDetailState.draft.lines.length} lignes</small>
              </article>
              <article className="reservation-summary-card">
                <span>Disponibilité Titan</span>
                <strong>
                  {draftDetailState.draft.confirmed_at
                    ? "Confirmé"
                    : draftDetailState.draft.contract_signed_at &&
                        draftDetailState.draft.required_deposit_received_at
                      ? "Prêt à confirmer"
                      : "Prérequis en attente"}
                </strong>
                <small>Contrat, dépôt, blocage de stock</small>
              </article>
            </div>

            <div className="reservation-workflow-rail" aria-label="Workflow de réservation Titan">
              <span className="workflow-step workflow-step--done">Brouillon</span>
              <span
                className={
                  draftDetailState.draft.contract_signed_at
                    ? "workflow-step workflow-step--done"
                    : "workflow-step workflow-step--warning"
                }
              >
                Contrat
              </span>
              <span
                className={
                  draftDetailState.draft.required_deposit_received_at
                    ? "workflow-step workflow-step--done"
                    : "workflow-step workflow-step--warning"
                }
              >
                Dépôt
              </span>
              <span
                className={
                  draftDetailState.draft.confirmed_at
                    ? "workflow-step workflow-step--done"
                    : "workflow-step"
                }
              >
                Confirmé
              </span>
            </div>

            <dl className="summary-grid">
              <div>
                <dt>Marqueur contrat</dt>
                <dd>{formatLifecycleState(draftDetailState.draft.contract_signed_at)}</dd>
              </div>
              <div>
                <dt>Marqueur dépôt</dt>
                <dd>
                  {formatLifecycleState(
                    draftDetailState.draft.required_deposit_received_at,
                  )}
                </dd>
              </div>
              <div>
                <dt>Confirmé le</dt>
                <dd>{formatLifecycleState(draftDetailState.draft.confirmed_at)}</dd>
              </div>
              <div>
                <dt>Annulé le</dt>
                <dd>{formatLifecycleState(draftDetailState.draft.cancelled_at)}</dd>
              </div>
            </dl>

            {canWrite && isDraftEditable(draftDetailState.draft) ? (
              <>
              <div className="prerequisite-checklist" aria-label="Prérequis avant confirmation">
                <h4>Prérequis avant confirmation</h4>
                <ul>
                  <li className={draftDetailState.draft.contract_signed_at ? "prereq-met" : "prereq-pending"}>
                    {draftDetailState.draft.contract_signed_at ? "✓" : "○"} Contrat signé
                    {draftDetailState.draft.contract_signed_at ? <small> — {formatLifecycleState(draftDetailState.draft.contract_signed_at)}</small> : null}
                  </li>
                  <li className={draftDetailState.draft.required_deposit_received_at ? "prereq-met" : "prereq-pending"}>
                    {draftDetailState.draft.required_deposit_received_at ? "✓" : "○"} Dépôt reçu
                    {draftDetailState.draft.required_deposit_received_at ? <small> — {formatLifecycleState(draftDetailState.draft.required_deposit_received_at)}</small> : null}
                  </li>
                  <li className={draftDetailState.draft.confirmed_at ? "prereq-met" : "prereq-pending"}>
                    {draftDetailState.draft.confirmed_at ? "✓" : "○"} Réservation confirmée
                    {draftDetailState.draft.confirmed_at ? <small> — {formatLifecycleState(draftDetailState.draft.confirmed_at)}</small> : null}
                  </li>
                </ul>
              </div>
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
                  Marquer contrat signé
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
                  Marquer dépôt reçu
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
                  Confirmer la réservation
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  disabled={
                    draftLifecycleState.status === "loading" ||
                    Boolean(draftDetailState.draft.cancelled_at)
                  }
                  onClick={() => void handleCancelDraft()}
                >
                  Annuler la réservation
                </button>
              </div>
              </>
            ) : null}

            {draftLifecycleState.status === "loading" ? (
              <p className="status" aria-live="polite">
                {draftLifecycleState.action === "contract"
                  ? "Enregistrement du contrat..."
                  : draftLifecycleState.action === "deposit"
                    ? "Enregistrement du dépôt..."
                    : draftLifecycleState.action === "cancel"
                      ? "Annulation de la réservation..."
                      : "Confirmation de la réservation..."}
              </p>
            ) : null}

            {draftLifecycleState.status === "success" ? (
              <div className="notice success-notice" role="status">
                <p>{draftLifecycleState.message}</p>
              </div>
            ) : null}

            {draftLifecycleState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Action cycle de vie indisponible</h4>
                <p>{draftLifecycleState.message}</p>
              </div>
            ) : null}

            <div className="related-resources">
              <h4>Ressources liées</h4>
              {draftRelatedDataState.status === "loading" ? (
                <p className="status" aria-live="polite">Chargement des ressources liées...</p>
              ) : null}
              {draftRelatedDataState.status === "loaded" ? (
                <div className="reservation-summary-grid">
                  <button
                    type="button"
                    className="reservation-summary-card related-link"
                    onClick={() => onNavigate?.("commercial-ops")}
                    aria-label={`Documents : ${draftRelatedDataState.documents.length} instance(s)`}
                  >
                    <span>Documents</span>
                    <strong>{draftRelatedDataState.documents.length}</strong>
                    <small>Voir dans Commercial Ops</small>
                  </button>
                  <button
                    type="button"
                    className="reservation-summary-card related-link"
                    onClick={() => onNavigate?.("commercial-ops")}
                    aria-label={`Factures : ${draftRelatedDataState.invoices.length} facture(s)`}
                  >
                    <span>Factures</span>
                    <strong>{draftRelatedDataState.invoices.length}</strong>
                    <small>Voir dans Commercial Ops</small>
                  </button>
                  <button
                    type="button"
                    className="reservation-summary-card related-link"
                    onClick={() => onNavigate?.("commercial-ops")}
                    aria-label={`Paiements : ${draftRelatedDataState.payments.length} paiement(s)`}
                  >
                    <span>Paiements</span>
                    <strong>{draftRelatedDataState.payments.length}</strong>
                    <small>Voir dans Commercial Ops</small>
                  </button>
                  <button
                    type="button"
                    className="reservation-summary-card related-link"
                    onClick={() => onNavigate?.("commercial-ops")}
                    aria-label={`Logistique : ${draftRelatedDataState.logistics.length} événement(s)`}
                  >
                    <span>Logistique</span>
                    <strong>{draftRelatedDataState.logistics.length}</strong>
                    <small>Voir dans Commercial Ops</small>
                  </button>
                </div>
              ) : null}
              {draftRelatedDataState.status === "error" ? (
                <p className="status" aria-live="polite">Ressources liées indisponibles.</p>
              ) : null}
            </div>

            {!isDraftEditable(draftDetailState.draft) ? (
              <div className="notice warning-notice" role="status">
                <h4>Réservation confirmée ou annulée</h4>
                <p>
                  Cette réservation Titan n'est plus modifiable depuis le workflow brouillon.
                </p>
              </div>
            ) : null}
            {canWrite ? (<>
            <form
              className="availability-form"
              onSubmit={handleUpdateDraftCustomer}
            >
              <label>
                Client du brouillon
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
                Enregistrer le client
              </button>
            </form>
            <form
              className="availability-form"
              onSubmit={handleUpdateDraftPeriod}
            >
              <label>
                Début du brouillon
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
                Fin du brouillon
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
                Enregistrer la période
              </button>
            </form>
            <form
              className="availability-form"
              onSubmit={handleUpdateDraftNotes}
            >
              <label>
                Notes du brouillon
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
                Enregistrer les notes
              </button>
            </form>

            {draftUpdateState.status === "loading" ? (
              <p className="status" aria-live="polite">Enregistrement des modifications...</p>
            ) : null}

            {draftUpdateState.status === "updated" ? (
              <p className="status">Modifications enregistrées.</p>
            ) : null}

            {draftUpdateState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Mise à jour indisponible</h4>
                <p>{draftUpdateState.message}</p>
              </div>
            ) : null}

            <form
              className="availability-form"
              onSubmit={handleUpdateDraftLines}
            >
              <h4>Lignes du brouillon</h4>
              {draftLinesDraft.map((line, index) => (
                <fieldset key={`${line.inventory_item_id}-${index}`}>
                  <legend>Ligne {index + 1}</legend>
                  <label>
                    Article de la ligne {index + 1}
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
                          Article actuel de la ligne
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
                    Quantité de la ligne {index + 1}
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
                    Notes de la ligne {index + 1}
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
                    Supprimer la ligne {index + 1}
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
                Ajouter une ligne
              </button>
              <button
                type="submit"
                disabled={
                  draftUpdateState.status === "loading" ||
                  !isDraftEditable(draftDetailState.draft)
                }
              >
                Enregistrer les lignes
              </button>
            </form>
            </>) : null}

              <ul className="preview-list">
                {draftDetailState.draft.lines.map((line) => (
                  <li key={line.id}>
                    <span>{line.inventory_item_name}</span>
                    <span>{line.inventory_item_kind}</span>
                    <span>Quantité : {line.quantity}</span>
                    {line.notes ? <span>{line.notes}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="section-helper">
                La confirmation dépend toujours de la vérité du backend : document de contrat
                signé, paiement du dépôt confirmé, revalidation de la disponibilité et
                autorisation sensible à la réservation.
              </p>
          </article>
        ) : null}
      </section>

      {availabilityState.status === "loaded" ? (
        <div className="availability-results">
          <dl className="summary-grid">
            <div>
              <dt>Début</dt>
              <dd>{formatDateTime(availabilityState.summary.start_at)}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{formatDateTime(availabilityState.summary.end_at)}</dd>
            </div>
            <div>
              <dt>Articles disponibles</dt>
              <dd>{availabilityState.summary.available_item_count}</dd>
            </div>
            <div>
              <dt>Aperçus disponibles</dt>
              <dd>{availabilityState.summary.available_preview_count}</dd>
            </div>
          </dl>

          <div className="availability-kinds">
            <h3>Types disponibles</h3>
            <p>
              {availabilityState.summary.available_item_kinds.join(", ") ||
                "Aucun"}
            </p>
          </div>

          <div className="preview-list-section">
            <h3>Aperçus des articles disponibles</h3>
            {availabilityState.previews.length === 0 ? (
              <p className="status">Aucun article disponible pour cette période.</p>
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

          <div className="preview-list-section wizard-section">
            <h3>Nouveau brouillon</h3>
            <div className="reservation-workflow-rail" aria-label="Nouvel assistant de réservation Titan">
              <span className="workflow-step workflow-step--done">
                <span className="step-number">1</span> Choisir la période
              </span>
              <span
                className={
                  selectedCustomerId ? "workflow-step workflow-step--done" : "workflow-step"
                }
              >
                <span className="step-number">2</span> Sélectionner le client
              </span>
              <span
                className={
                  selectedItemIds.length > 0
                    ? "workflow-step workflow-step--done"
                    : "workflow-step"
                }
              >
                <span className="step-number">3</span> Choisir les articles
              </span>
              <span
                className={
                  draftCreationState.status === "created"
                    ? "workflow-step workflow-step--done"
                    : "workflow-step"
                }
              >
                <span className="step-number">4</span> Créer le brouillon
              </span>
            </div>
            <p className="section-helper">
              Ce flux guidé crée d'abord un brouillon Titan modifiable, puis
              la réservation peut être finalisée depuis le panneau de détail ci-dessus.
            </p>

            {!canWrite ? (
              <p className="status">Connectez-vous avec un accès en écriture pour créer des brouillons de réservation.</p>
            ) : null}

            {canWrite && customerState.status === "loading" ? (
              <p className="status" aria-live="polite">Chargement des clients...</p>
            ) : null}

            {canWrite && customerState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Clients indisponibles</h4>
                <p>{customerState.message}</p>
              </div>
            ) : null}

            {canWrite && customerState.status === "loaded" ? (
              <>
                <label>
                  Client
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

                {selectedItemIds.length > 0 && selectedCustomerId && draftCreationState.status !== "created" ? (
                  <div className="wizard-summary">
                    <h4>Résumé de la création</h4>
                    <ul>
                      <li>Client : {customerState.customers.find((c) => c.id === selectedCustomerId)?.display_name ?? selectedCustomerId}</li>
                      <li>Période : {formatDateTime(availabilityState.summary.start_at)} — {formatDateTime(availabilityState.summary.end_at)}</li>
                      <li>Articles ({selectedItemIds.length}) : {selectedItemIds.map((id) => availabilityState.previews.find((p) => p.inventory_item_id === id)?.inventory_item_name ?? id).join(", ")}</li>
                    </ul>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="primary-btn"
                  disabled={
                    draftCreationState.status === "loading" ||
                    availabilityState.previews.length === 0 ||
                    selectedItemIds.length === 0 ||
                    !selectedCustomerId
                  }
                  onClick={handleCreateDraft}
                >
                  Créer le brouillon
                </button>
              </>
            ) : null}

            {draftCreationState.status === "loading" ? (
              <p className="status" aria-live="polite">Création du brouillon...</p>
            ) : null}

            {draftCreationState.status === "error" ? (
              <div className="notice availability-notice" role="alert">
                <h4>Brouillon indisponible</h4>
                <p>{draftCreationState.message}</p>
              </div>
            ) : null}

            {draftCreationState.status === "created" ? (
              <div className="notice success-notice">
                <h4>Brouillon créé</h4>
                <p>Référence : {draftCreationState.draft.public_reference}</p>
                <p>Statut : {draftCreationState.draft.status}</p>
                <p className="section-helper">
                  Utilisez le panneau de détail ci-dessus pour gérer le cycle de vie.
                </p>
              </div>
            ) : null}
            <p className="section-helper">
              Action limitée au brouillon. La réservation reste modifiable et
              non finalisée.
            </p>
          </div>

          <div className="preview-list-section">
            <h3>Aperçus de disponibilité par article</h3>
            {availabilityState.itemPreviews.length === 0 ? (
              <p className="status">
                Aucun article chargé pour l'aperçu individuel.
              </p>
            ) : (
              <ul className="preview-list">
                {availabilityState.itemPreviews.map((preview) => (
                  <li key={preview.inventory_item_id}>
                    <span>{preview.inventory_item_name}</span>
                    <span>{preview.inventory_item_kind}</span>
                    <strong>{preview.status}</strong>
                    <span>{preview.conflict_count} conflits</span>
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
