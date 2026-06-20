import { type FormEvent, useEffect, useState } from "react";
import {
  checkEndpointPermission,
  createHahitantsoaEventDraft,
  getCustomers,
  getHahitantsoaEventDrafts,
  getHahitantsoaEventDraft,
  updateHahitantsoaEventDraft,
  deleteHahitantsoaEventDraft,
  getHahitantsoaEventDraftAvailabilityPreview,
  getHahitantsoaEventDraftConfirmationPreflight,
  getHahitantsoaEventDraftAmendmentPreflight,
  confirmHahitantsoaEventDraft,
  getHahitantsoaEventDraftAmendmentRequests,
  createHahitantsoaEventDraftAmendmentRequest,
  updateHahitantsoaEventDraftAmendmentRequest,
  getHahitantsoaEventDraftAmendmentRequestLines,
  createHahitantsoaEventDraftAmendmentRequestLine,
  updateHahitantsoaEventDraftAmendmentRequestLine,
  deleteHahitantsoaEventDraftAmendmentRequestLine,
  getHahitantsoaEventDraftAmendmentRequestAvailabilityPreflight,
  ApiError,
} from "./api";
import type {
  Customer,
  InventoryItem,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftAvailabilityPreview,
  HahitantsoaEventDraftConfirmationPreflight,
  HahitantsoaEventDraftAmendmentPreflight,
  HahitantsoaEventDraftConfirmationResult,
  HahitantsoaEventDraftAmendmentRequest,
  HahitantsoaEventDraftAmendmentRequestLine,
  HahitantsoaEventDraftAmendmentRequestAvailabilityPreview,
} from "./types";

type DraftListState =
  | { status: "loading" }
  | { status: "loaded"; drafts: HahitantsoaEventDraft[] }
  | { status: "error"; message: string };

type DraftDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; draft: HahitantsoaEventDraft }
  | { status: "error"; message: string };

type AvailabilityPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; preview: HahitantsoaEventDraftAvailabilityPreview }
  | { status: "error"; message: string };

type PreflightState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; preflight: HahitantsoaEventDraftConfirmationPreflight }
  | { status: "error"; message: string };

type AmendmentPreflightState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; preflight: HahitantsoaEventDraftAmendmentPreflight }
  | { status: "error"; message: string };

type ActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };


type HahitantsoaEventDraftsPanelProps = {
  inventoryItems?: InventoryItem[];
  prefillEventName?: string;
  prefillVenueName?: string;
};

type DraftLineInput = {
  inventory_item_id: string;
  quantity: number;
  notes?: string;
};

function toDateTimeLocalValue(date: Date): string {
  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

const AMENDMENT_BLOCKER_LABELS: Record<string, string> = {
  draft_not_confirmed_for_amendment: "This draft has not been confirmed yet. Amendment is only available on confirmed drafts.",
  draft_not_found: "This draft could not be found. It may have been deleted.",
  draft_has_no_active_lines: "This draft has no active lines. Add line items before attempting an amendment.",
  draft_period_invalid: "The draft period is invalid. Correct the start and end dates before amending.",
  user_not_owner: "You are not the owner of this draft. Only the owner may request an amendment.",
  missing_required_data: "Required event draft data is missing.",
  active_availability_conflict: "There is an active inventory availability conflict.",
  missing_signed_contract: "The signed contract marker is missing.",
  missing_required_deposit: "The required deposit marker is missing.",
};

function formatBlockerLabel(blocker: string): string {
  return AMENDMENT_BLOCKER_LABELS[blocker] ?? blocker;
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

export function HahitantsoaEventDraftsPanel({
  inventoryItems = [],
  prefillEventName = "",
  prefillVenueName = "",
}: HahitantsoaEventDraftsPanelProps) {
  const [draftListState, setDraftListState] = useState<DraftListState>({
    status: "loading",
  });
  const [draftDetailState, setDraftDetailState] = useState<DraftDetailState>({
    status: "idle",
  });
  const [availabilityPreviewState, setAvailabilityPreviewState] =
    useState<AvailabilityPreviewState>({ status: "idle" });
  const [actionState, setActionState] = useState<ActionState>({
    status: "idle",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const [preflightState, setPreflightState] = useState<PreflightState>({
    status: "idle",
  });

  const [amendmentPreflightState, setAmendmentPreflightState] = useState<AmendmentPreflightState>({
    status: "idle",
  });

  const [amendmentRequests, setAmendmentRequests] = useState<HahitantsoaEventDraftAmendmentRequest[]>([]);
  const [amendmentRequestsLoading, setAmendmentRequestsLoading] = useState(false);
  const [amendmentRequestsError, setAmendmentRequestsError] = useState("");
  const [newAmendmentReason, setNewAmendmentReason] = useState("");
  const [newAmendmentNotes, setNewAmendmentNotes] = useState("");
  const [editingAmendmentId, setEditingAmendmentId] = useState<string | null>(null);
  const [editingAmendmentReason, setEditingAmendmentReason] = useState("");
  const [editingAmendmentNotes, setEditingAmendmentNotes] = useState("");

  const [amendmentRequestPreflights, setAmendmentRequestPreflights] = useState<
    Record<
      string,
      | {
          status: "idle" | "loading" | "loaded" | "error";
          data?: HahitantsoaEventDraftAmendmentRequestAvailabilityPreview;
          error?: string;
        }
      | undefined
    >
  >({});

  const [newAmendmentLineItemId, setNewAmendmentLineItemId] = useState<Record<string, string>>({});
  const [newAmendmentLineQuantity, setNewAmendmentLineQuantity] = useState<Record<string, number>>({});
  const [newAmendmentLineNotes, setNewAmendmentLineNotes] = useState<Record<string, string>>({});

  const [editingAmendmentLineId, setEditingAmendmentLineId] = useState<string | null>(null);
  const [editingAmendmentLineItemId, setEditingAmendmentLineItemId] = useState("");
  const [editingAmendmentLineQuantity, setEditingAmendmentLineQuantity] = useState(1);
  const [editingAmendmentLineNotes, setEditingAmendmentLineNotes] = useState("");

  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/hahitantsoa/event-drafts/", "OPTIONS", controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  const isActionLoading = actionState.status === "loading";
  const isDetailLoading = draftDetailState.status === "loading";
  const isAvailabilityLoading = availabilityPreviewState.status === "loading";
  const isPreflightLoading = preflightState.status === "loading";
  const isAmendmentPreflightLoading = amendmentPreflightState.status === "loading";
  const isDisabled = isActionLoading || isDetailLoading || isAvailabilityLoading || isPreflightLoading || isAmendmentPreflightLoading || amendmentRequestsLoading;

  const isReadOnly = draftDetailState.status === "loaded" && draftDetailState.draft.status !== "draft";
  const noWriteAccess = !canWrite;
  const formDisabled = isDisabled || isReadOnly || noWriteAccess;


  // Customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);

  // New Draft Form State
  const initialPeriod = defaultPeriod();
  const [newEventName, setNewEventName] = useState(prefillEventName);
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newVenueName, setNewVenueName] = useState(prefillVenueName);
  const [newLocationDetails, setNewLocationDetails] = useState("");
  const [newServiceNotes, setNewServiceNotes] = useState("");
  const [newStartAt, setNewStartAt] = useState(initialPeriod.startAt);
  const [newEndAt, setNewEndAt] = useState(initialPeriod.endAt);
  const [newNotes, setNewNotes] = useState("");
  const [newLineInputs, setNewLineInputs] = useState<DraftLineInput[]>([]);

  // Effect to adopt prefills when they change
  useEffect(() => {
    setNewEventName(prefillEventName);
  }, [prefillEventName]);

  useEffect(() => {
    setNewVenueName(prefillVenueName);
  }, [prefillVenueName]);

  // Update State
  const [editEventName, setEditEventName] = useState("");
  const [editVenueName, setEditVenueName] = useState("");
  const [editLocationDetails, setEditLocationDetails] = useState("");
  const [editServiceNotes, setEditServiceNotes] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");
  const [editLines, setEditLines] = useState<DraftLineInput[]>([]);

  const fetchDrafts = async (signal?: AbortSignal) => {
    try {
      const drafts = await getHahitantsoaEventDrafts(signal);
      setDraftListState({ status: "loaded", drafts });
    } catch (err) {
      if (signal?.aborted) return;
      setDraftListState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Failed to load event drafts.",
      });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDrafts(controller.signal);

    getCustomers(undefined, controller.signal)
      .then((data) => {
        setCustomers(data);
        setCustomersLoaded(true);
        if (data.length > 0) {
          setNewCustomerId(data[0].id);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load customers", err);
      });

    return () => controller.abort();
  }, []);

  const handleCreateDraft = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (!newEventName) {
      setActionState({ status: "error", message: "Event name is required." });
      return;
    }
    if (!newCustomerId) {
      setActionState({ status: "error", message: "Customer is required." });
      return;
    }
    if (newLineInputs.length === 0) {
      setActionState({
        status: "error",
        message: "At least one line item is required.",
      });
      return;
    }

    const startDate = new Date(newStartAt);
    const endDate = new Date(newEndAt);
    if (endDate <= startDate) {
      setActionState({
        status: "error",
        message: "End time must be after start time.",
      });
      return;
    }

    setActionState({ status: "loading" });
    try {
      const newDraft = await createHahitantsoaEventDraft({
        event_name: newEventName,
        customer_id: newCustomerId,
        venue_name: newVenueName,
        location_details: newLocationDetails,
        service_notes: newServiceNotes,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        notes: newNotes,
        lines: newLineInputs,
      });

      setActionState({
        status: "success",
        message: `Draft ${newDraft.public_reference} created successfully.`,
      });
      setNewEventName("");
      setNewVenueName("");
      setNewLocationDetails("");
      setNewServiceNotes("");
      setNewNotes("");
      setNewLineInputs([]);
      fetchDrafts();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors);
      }
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to create draft.",
      });
    }
  };

  const fetchAmendmentRequests = async (draftId: string) => {
    setAmendmentRequestsLoading(true);
    setAmendmentRequestsError("");
    try {
      const data = await getHahitantsoaEventDraftAmendmentRequests(draftId);
      setAmendmentRequests(data);
    } catch (err) {
      setAmendmentRequestsError(
        err instanceof Error ? err.message : "Failed to load amendment requests."
      );
    } finally {
      setAmendmentRequestsLoading(false);
    }
  };

  const handleCreateAmendmentRequest = async (e: FormEvent, draftId: string) => {
    e.preventDefault();
    setFieldErrors({});
    setActionState({ status: "loading" });
    try {
      await createHahitantsoaEventDraftAmendmentRequest(draftId, {
        reason: newAmendmentReason,
        notes: newAmendmentNotes,
      });
      setNewAmendmentReason("");
      setNewAmendmentNotes("");
      setActionState({ status: "success", message: "Amendment request created successfully." });
      void fetchAmendmentRequests(draftId);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors);
      }
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to create amendment request.",
      });
    }
  };

  const handleUpdateAmendmentRequest = async (e: FormEvent, draftId: string, requestId: string) => {
    e.preventDefault();
    setFieldErrors({});
    setActionState({ status: "loading" });
    try {
      await updateHahitantsoaEventDraftAmendmentRequest(draftId, requestId, {
        reason: editingAmendmentReason,
        notes: editingAmendmentNotes,
      });
      setEditingAmendmentId(null);
      setEditingAmendmentReason("");
      setEditingAmendmentNotes("");
      setActionState({ status: "success", message: "Amendment request updated successfully." });
      void fetchAmendmentRequests(draftId);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors);
      }
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to update amendment request.",
      });
    }
  };

  const handleCreateAmendmentLine = async (e: FormEvent, draftId: string, amendmentRequestId: string) => {
    e.preventDefault();
    setFieldErrors({});
    setActionState({ status: "loading" });
    const inventoryItemId = newAmendmentLineItemId[amendmentRequestId];
    const quantity = newAmendmentLineQuantity[amendmentRequestId] || 1;
    const notes = newAmendmentLineNotes[amendmentRequestId] || "";

    if (!inventoryItemId) {
      setActionState({ status: "error", message: "Inventory item is required." });
      return;
    }

    try {
      await createHahitantsoaEventDraftAmendmentRequestLine(draftId, amendmentRequestId, {
        inventory_item_id: inventoryItemId,
        quantity,
        notes,
      });
      setNewAmendmentLineItemId(curr => ({ ...curr, [amendmentRequestId]: "" }));
      setNewAmendmentLineQuantity(curr => ({ ...curr, [amendmentRequestId]: 1 }));
      setNewAmendmentLineNotes(curr => ({ ...curr, [amendmentRequestId]: "" }));
      setActionState({ status: "success", message: "Amendment request line added successfully." });
      void fetchAmendmentRequests(draftId);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors);
      }
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to add amendment request line.",
      });
    }
  };

  const handleUpdateAmendmentLine = async (e: FormEvent, draftId: string, amendmentRequestId: string, lineId: string) => {
    e.preventDefault();
    setFieldErrors({});
    setActionState({ status: "loading" });

    try {
      await updateHahitantsoaEventDraftAmendmentRequestLine(draftId, amendmentRequestId, lineId, {
        inventory_item_id: editingAmendmentLineItemId,
        quantity: editingAmendmentLineQuantity,
        notes: editingAmendmentLineNotes,
      });
      setEditingAmendmentLineId(null);
      setEditingAmendmentLineItemId("");
      setEditingAmendmentLineQuantity(1);
      setEditingAmendmentLineNotes("");
      setActionState({ status: "success", message: "Amendment request line updated successfully." });
      void fetchAmendmentRequests(draftId);
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors);
      }
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to update amendment request line.",
      });
    }
  };

  const handleDeleteAmendmentLine = async (draftId: string, amendmentRequestId: string, lineId: string) => {
    setFieldErrors({});
    setActionState({ status: "loading" });

    try {
      await deleteHahitantsoaEventDraftAmendmentRequestLine(draftId, amendmentRequestId, lineId);
      setActionState({ status: "success", message: "Amendment request line deleted successfully." });
      void fetchAmendmentRequests(draftId);
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to delete amendment request line.",
      });
    }
  };

  const handleCheckAmendmentRequestAvailabilityPreflight = async (draftId: string, amendmentRequestId: string) => {
    setAmendmentRequestPreflights(curr => ({
      ...curr,
      [amendmentRequestId]: { status: "loading" },
    }));

    try {
      const data = await getHahitantsoaEventDraftAmendmentRequestAvailabilityPreflight(draftId, amendmentRequestId);
      setAmendmentRequestPreflights(curr => ({
        ...curr,
        [amendmentRequestId]: { status: "loaded", data },
      }));
    } catch (err) {
      setAmendmentRequestPreflights(curr => ({
        ...curr,
        [amendmentRequestId]: {
          status: "error",
          error: err instanceof Error ? err.message : "Failed to load availability preflight.",
        },
      }));
    }
  };

  const handleViewDetails = async (draftId: string) => {
    setDraftDetailState({ status: "loading" });
    setAvailabilityPreviewState({ status: "idle" });
    setPreflightState({ status: "idle" });
    setAmendmentPreflightState({ status: "idle" });
    setFieldErrors({});
    setAmendmentRequests([]);
    try {
      const draft = await getHahitantsoaEventDraft(draftId);
      setDraftDetailState({ status: "loaded", draft });
      setEditEventName(draft.event_name);
      setEditVenueName(draft.venue_name);
      setEditLocationDetails(draft.location_details);
      setEditServiceNotes(draft.service_notes);
      setEditNotes(draft.notes);
      setEditStartAt(toDateTimeLocalValue(new Date(draft.start_at)));
      setEditEndAt(toDateTimeLocalValue(new Date(draft.end_at)));
      setEditLines(
        draft.lines.map((l) => ({
          inventory_item_id: l.inventory_item_id,
          quantity: l.quantity,
          notes: l.notes,
        })),
      );
      void fetchAmendmentRequests(draftId);
    } catch (err) {
      setDraftDetailState({
        status: "error",
        message:
          err instanceof Error ? err.message : "Failed to load draft details.",
      });
    }
  };

  const handleUpdateDraft = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    if (draftDetailState.status !== "loaded") return;
    const draftId = draftDetailState.draft.id;

    if (!editEventName) {
      setActionState({ status: "error", message: "Event name is required." });
      return;
    }
    if (editLines.length === 0) {
      setActionState({
        status: "error",
        message: "At least one line is required.",
      });
      return;
    }

    const startDate = new Date(editStartAt);
    const endDate = new Date(editEndAt);
    if (endDate <= startDate) {
      setActionState({
        status: "error",
        message: "End time must be after start time.",
      });
      return;
    }

    setActionState({ status: "loading" });
    try {
      const updated = await updateHahitantsoaEventDraft(draftId, {
        event_name: editEventName,
        venue_name: editVenueName,
        location_details: editLocationDetails,
        service_notes: editServiceNotes,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        notes: editNotes,
        lines: editLines,
      });

      setDraftDetailState({ status: "loaded", draft: updated });
      setActionState({ status: "success", message: "Draft updated." });
      fetchDrafts();
      if (availabilityPreviewState.status === "loaded") {
        handleCheckAvailability(draftId);
      }
      if (preflightState.status === "loaded") {
        handleCheckPreflight(draftId);
      }
      if (amendmentPreflightState.status === "loaded") {
        handleCheckAmendmentPreflight(draftId);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors);
      }
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to update draft.",
      });
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!window.confirm("Are you sure you want to delete this event draft?"))
      return;

    setFieldErrors({});
    setActionState({ status: "loading" });
    try {
      await deleteHahitantsoaEventDraft(draftId);
      setActionState({ status: "success", message: "Draft deleted." });
      setDraftDetailState({ status: "idle" });
      setAvailabilityPreviewState({ status: "idle" });
      setPreflightState({ status: "idle" });
      setAmendmentPreflightState({ status: "idle" });
      fetchDrafts();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.errors);
      }
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to delete draft.",
      });
    }
  };

  const handleCheckAvailability = async (draftId: string) => {
    setAvailabilityPreviewState({ status: "loading" });
    try {
      const preview = await getHahitantsoaEventDraftAvailabilityPreview(
        draftId,
      );
      setAvailabilityPreviewState({ status: "loaded", preview });
    } catch (err) {
      setAvailabilityPreviewState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to load availability preview.",
      });
    }
  };

  const handleCheckPreflight = async (draftId: string) => {
    setPreflightState({ status: "loading" });
    try {
      const preflight = await getHahitantsoaEventDraftConfirmationPreflight(
        draftId,
      );
      setPreflightState({ status: "loaded", preflight });
    } catch (err) {
      setPreflightState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to load confirmation preflight.",
      });
    }
  };

  const handleCheckAmendmentPreflight = async (draftId: string) => {
    setAmendmentPreflightState({ status: "loading" });
    try {
      const preflight = await getHahitantsoaEventDraftAmendmentPreflight(
        draftId,
      );
      setAmendmentPreflightState({ status: "loaded", preflight });
    } catch (err) {
      setAmendmentPreflightState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to load amendment preflight.",
      });
    }
  };

  const handleConfirmDraft = async (draftId: string) => {
    setActionState({ status: "loading" });
    try {
      const result = await confirmHahitantsoaEventDraft(draftId);
      setActionState({
        status: "success",
        message: `Draft ${result.public_reference} confirmed successfully! Blocked items: ${result.blocked_item_count}.`,
      });
      // Clear panel details and fetch updated drafts list
      setDraftDetailState({ status: "idle" });
      setAvailabilityPreviewState({ status: "idle" });
      setPreflightState({ status: "idle" });
      setAmendmentPreflightState({ status: "idle" });
      fetchDrafts();
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to confirm draft.",
      });
    }
  };

  const addLine = (isEdit: boolean) => {
    const defaultItem = inventoryItems[0];
    if (!defaultItem) return;

    const newLine: DraftLineInput = {
      inventory_item_id: defaultItem.id,
      quantity: 1,
      notes: "",
    };

    if (isEdit) {
      setEditLines([...editLines, newLine]);
    } else {
      setNewLineInputs([...newLineInputs, newLine]);
    }
  };

  const removeLine = (index: number, isEdit: boolean) => {
    if (isEdit) {
      setEditLines(editLines.filter((_, i) => i !== index));
    } else {
      setNewLineInputs(newLineInputs.filter((_, i) => i !== index));
    }
  };

  const updateLineField = (
    index: number,
    field: keyof DraftLineInput,
    value: any,
    isEdit: boolean,
  ) => {
    const lines = isEdit ? editLines : newLineInputs;
    const updated = lines.map((line, i) =>
      i === index ? { ...line, [field]: value } : line,
    );
    if (isEdit) {
      setEditLines(updated);
    } else {
      setNewLineInputs(updated);
    }
  };

  return (
    <section
      className="availability-section"
      aria-labelledby="hahitantsoa-event-drafts-heading"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Hahitantsoa Event Draft Lifecycle</p>
          <h2 id="hahitantsoa-event-drafts-heading">Event Drafts</h2>
          <p className="section-helper">
            Manage Hahitantsoa Event Drafts, check cascading availability for
            concept items, and trigger soft-delete lifecycle operations.
          </p>
          {!canWrite ? (
            <p className="status">Sign in with write access to create or modify event drafts.</p>
          ) : null}
        </div>
      </div>

      {actionState.status === "loading" && (
        <div className="notice loading-notice" role="status">
          <p className="loading-spinner">Processing operation, please wait...</p>
        </div>
      )}
      {actionState.status === "success" && (
        <div className="notice success-notice" role="status">
          <p>{actionState.message}</p>
          <button type="button" onClick={() => setActionState({ status: "idle" })}>
            Dismiss
          </button>
        </div>
      )}
      {actionState.status === "error" && (
        <div className="notice error-notice" role="alert">
          <h3>Operation Failed</h3>
          <p>{actionState.message}</p>
          <button type="button" onClick={() => setActionState({ status: "idle" })}>
            Dismiss
          </button>
        </div>
      )}

      <div className="preview-list-section">
        <h3>Existing Event Drafts</h3>
        {draftListState.status === "loading" && (
          <p className="status" aria-live="polite">Loading drafts...</p>
        )}
        {draftListState.status === "error" && (
          <p className="status error" role="alert">{draftListState.message}</p>
        )}
        {draftListState.status === "loaded" && (
          <>
            {draftListState.drafts.length === 0 ? (
              <p className="status">No event drafts found.</p>
            ) : (
              <ul className="preview-list">
                {draftListState.drafts.map((draft) => (
                  <li key={draft.id}>
                    <div>
                      <strong>{draft.public_reference}</strong> -{" "}
                      {draft.event_name}
                      <br />
                      <span>{draft.customer_display_name}</span>
                      <br />
                      <span>
                        {formatDateTime(draft.start_at)} —{" "}
                        {formatDateTime(draft.end_at)}
                      </span>
                    </div>
                    <span>{draft.status}</span>
                    <button
                      type="button"
                      onClick={() => handleViewDetails(draft.id)}
                      disabled={isDisabled}
                    >
                      View & Manage
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {draftDetailState.status === "loading" && (
        <p className="status" aria-live="polite">Loading draft details...</p>
      )}
      {draftDetailState.status === "error" && (
        <p className="status error" role="alert">{draftDetailState.message}</p>
      )}
      {draftDetailState.status === "loaded" && (
        <div className="availability-results">
          <h3>Manage Draft: {draftDetailState.draft.public_reference}</h3>

          {isReadOnly && (
            <div className="notice warning-notice" role="alert">
              <h4>Confirmed & Immutable Event Draft</h4>
              <p>This event draft has been confirmed and is read-only. Mutations are disabled.</p>
            </div>
          )}

          <form className="availability-form" onSubmit={handleUpdateDraft}>
            <label>
              Event Name
              <input
                type="text"
                className={fieldErrors.event_name ? "invalid-input-highlight" : ""}
                value={editEventName}
                onChange={(e) => {
                  setEditEventName(e.target.value);
                  if (fieldErrors.event_name) {
                    setFieldErrors(curr => ({ ...curr, event_name: undefined }));
                  }
                }}
                disabled={formDisabled}
              />
              {fieldErrors.event_name && (
                <span className="field-error-text" role="alert">{fieldErrors.event_name.join(", ")}</span>
              )}
            </label>
            <label>
              Venue Name
              <input
                type="text"
                className={fieldErrors.venue_name ? "invalid-input-highlight" : ""}
                value={editVenueName}
                onChange={(e) => {
                  setEditVenueName(e.target.value);
                  if (fieldErrors.venue_name) {
                    setFieldErrors(curr => ({ ...curr, venue_name: undefined }));
                  }
                }}
                disabled={formDisabled}
              />
              {fieldErrors.venue_name && (
                <span className="field-error-text" role="alert">{fieldErrors.venue_name.join(", ")}</span>
              )}
            </label>
            <label>
              Location Details
              <textarea
                className={fieldErrors.location_details ? "invalid-input-highlight" : ""}
                value={editLocationDetails}
                onChange={(e) => {
                  setEditLocationDetails(e.target.value);
                  if (fieldErrors.location_details) {
                    setFieldErrors(curr => ({ ...curr, location_details: undefined }));
                  }
                }}
                disabled={formDisabled}
              />
              {fieldErrors.location_details && (
                <span className="field-error-text" role="alert">{fieldErrors.location_details.join(", ")}</span>
              )}
            </label>
            <label>
              Service Notes
              <textarea
                className={fieldErrors.service_notes ? "invalid-input-highlight" : ""}
                value={editServiceNotes}
                onChange={(e) => {
                  setEditServiceNotes(e.target.value);
                  if (fieldErrors.service_notes) {
                    setFieldErrors(curr => ({ ...curr, service_notes: undefined }));
                  }
                }}
                disabled={formDisabled}
              />
              {fieldErrors.service_notes && (
                <span className="field-error-text" role="alert">{fieldErrors.service_notes.join(", ")}</span>
              )}
            </label>
            <label>
              Start Time
              <input
                type="datetime-local"
                className={fieldErrors.start_at ? "invalid-input-highlight" : ""}
                value={editStartAt}
                onChange={(e) => {
                  setEditStartAt(e.target.value);
                  if (fieldErrors.start_at) {
                    setFieldErrors(curr => ({ ...curr, start_at: undefined }));
                  }
                }}
                disabled={formDisabled}
              />
              {fieldErrors.start_at && (
                <span className="field-error-text" role="alert">{fieldErrors.start_at.join(", ")}</span>
              )}
            </label>
            <label>
              End Time
              <input
                type="datetime-local"
                className={fieldErrors.end_at ? "invalid-input-highlight" : ""}
                value={editEndAt}
                onChange={(e) => {
                  setEditEndAt(e.target.value);
                  if (fieldErrors.end_at) {
                    setFieldErrors(curr => ({ ...curr, end_at: undefined }));
                  }
                }}
                disabled={formDisabled}
              />
              {fieldErrors.end_at && (
                <span className="field-error-text" role="alert">{fieldErrors.end_at.join(", ")}</span>
              )}
            </label>
            <label>
              Notes
              <textarea
                className={fieldErrors.notes ? "invalid-input-highlight" : ""}
                value={editNotes}
                onChange={(e) => {
                  setEditNotes(e.target.value);
                  if (fieldErrors.notes) {
                    setFieldErrors(curr => ({ ...curr, notes: undefined }));
                  }
                }}
                disabled={formDisabled}
              />
              {fieldErrors.notes && (
                <span className="field-error-text" role="alert">{fieldErrors.notes.join(", ")}</span>
              )}
            </label>

            <h4>Lines</h4>
            {editLines.map((line, idx) => (
              <fieldset key={idx} disabled={formDisabled}>
                <legend>Line {idx + 1}</legend>
                <label>
                  Item
                  <select
                    value={line.inventory_item_id}
                    onChange={(e) =>
                      updateLineField(
                        idx,
                        "inventory_item_id",
                        e.target.value,
                        true,
                      )
                    }
                    disabled={formDisabled}
                  >
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
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLineField(
                        idx,
                        "quantity",
                        parseInt(e.target.value, 10),
                        true,
                      )
                    }
                    disabled={formDisabled}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    value={line.notes || ""}
                    onChange={(e) =>
                      updateLineField(idx, "notes", e.target.value, true)
                    }
                    disabled={formDisabled}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeLine(idx, true)}
                  disabled={formDisabled || editLines.length <= 1}
                >
                  Remove Line
                </button>
              </fieldset>
            ))}
            <button type="button" onClick={() => addLine(true)} disabled={formDisabled}>
              Add Line
            </button>
            <button type="submit" disabled={formDisabled}>
              {isActionLoading ? "Saving..." : "Save Changes"}
            </button>
          </form>

          <div className="hahitantsoa-actions">
            <button
              type="button"
              onClick={() => handleCheckAvailability(draftDetailState.draft.id)}
              disabled={isDisabled || isReadOnly}
            >
              {isAvailabilityLoading ? "Checking Availability..." : "Check Cascading Availability"}
            </button>
            <button
              type="button"
              onClick={() => handleCheckPreflight(draftDetailState.draft.id)}
              disabled={isDisabled || isReadOnly}
            >
              {isPreflightLoading ? "Running Preflight Check..." : "Check Confirmation Preflight"}
            </button>
            <button
              type="button"
              onClick={() => handleCheckAmendmentPreflight(draftDetailState.draft.id)}
              disabled={isDisabled}
            >
              {isAmendmentPreflightLoading ? "Running Amendment Preflight..." : "Check Amendment Preflight"}
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={() => handleDeleteDraft(draftDetailState.draft.id)}
              disabled={isDisabled || isReadOnly}
            >
              {isActionLoading ? "Deleting Draft..." : "Delete Draft"}
            </button>
          </div>

          {availabilityPreviewState.status === "loading" && (
            <p className="status" aria-live="polite">Analyzing line availability...</p>
          )}
          {availabilityPreviewState.status === "error" && (
            <p className="status error" role="alert">{availabilityPreviewState.message}</p>
          )}
          {availabilityPreviewState.status === "loaded" && (
            <div className="notice report-panel success-notice">
              <div>
                <h4>Cascading Availability Report</h4>
                <p>
                  Status: {availabilityPreviewState.preview.available_line_count}{" "}
                  / {availabilityPreviewState.preview.line_count} lines available.
                </p>
                <ul>
                  {availabilityPreviewState.preview.lines.map((line) => (
                    <li key={line.event_draft_line_id}>
                      {line.inventory_item_name} (x{line.quantity}) -{" "}
                      <strong className={line.status === "available" ? "status-available" : "status-unavailable"}>
                        {line.status}
                      </strong>{" "}
                      ({line.conflict_count} conflicts)
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {preflightState.status === "loading" && (
            <p className="status" aria-live="polite">Running confirmation preflight checks...</p>
          )}
          {preflightState.status === "error" && (
            <p className="status error" role="alert">{preflightState.message}</p>
          )}
          {preflightState.status === "loaded" && (
            <div
              className={`notice report-panel ${
                preflightState.preflight.can_confirm
                  ? "success-notice"
                  : "error-notice"
              }`}
            >
              <div>
                <h4>Confirmation Preflight Report</h4>
                <p><strong>Public Reference:</strong> {preflightState.preflight.public_reference}</p>
                <p><strong>Status:</strong> {preflightState.preflight.status}</p>
                <p><strong>Active Line Count:</strong> {preflightState.preflight.active_line_count}</p>
                <p><strong>Unavailable Line Count:</strong> {preflightState.preflight.unavailable_line_count}</p>
                <p>
                  <strong>Can Confirm:</strong>{" "}
                  <span style={{ fontWeight: "bold" }}>
                    {preflightState.preflight.can_confirm ? "Yes (Ready)" : "No (Blocked)"}
                  </span>
                </p>
                {preflightState.preflight.blockers.length > 0 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <strong>Blockers:</strong>
                    <ul style={{ marginTop: "0.25rem", paddingLeft: "1.2rem" }}>
                      {preflightState.preflight.blockers.map((blocker, idx) => (
                        <li key={idx}>{blocker}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {preflightState.preflight.can_confirm && (
                  <div style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      className="btn-confirm-action"
                      onClick={() => handleConfirmDraft(draftDetailState.draft.id)}
                      disabled={isDisabled}
                    >
                      Confirm Event Draft
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {amendmentPreflightState.status === "loading" && (
            <p className="status" aria-live="polite">Running amendment preflight checks...</p>
          )}
          {amendmentPreflightState.status === "error" && (
            <div className="notice error-notice" role="alert">
              <h4>Amendment Preflight Failed</h4>
              <p>{amendmentPreflightState.message}</p>
              <button
                type="button"
                onClick={() => handleCheckAmendmentPreflight(draftDetailState.draft.id)}
                disabled={isDisabled}
              >
                Retry Preflight Check
              </button>
            </div>
          )}
          {amendmentPreflightState.status === "loaded" && (
            <div
              className={`notice report-panel ${
                amendmentPreflightState.preflight.can_amend
                  ? "success-notice"
                  : "error-notice"
              }`}
            >
              <div>
                <h4>Amendment Preflight Report</h4>
                <p><strong>Public Reference:</strong> {amendmentPreflightState.preflight.public_reference}</p>
                <p><strong>Status:</strong> {amendmentPreflightState.preflight.status}</p>
                <p><strong>Active Line Count:</strong> {amendmentPreflightState.preflight.active_line_count}</p>
                <p>
                  <strong>Can Amend:</strong>{" "}
                  <span style={{ fontWeight: "bold" }}>
                    {amendmentPreflightState.preflight.can_amend ? "Yes (Ready)" : "No (Blocked)"}
                  </span>
                </p>
                {amendmentPreflightState.preflight.blockers.length > 0 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <strong>Blockers:</strong>
                    <ul style={{ marginTop: "0.25rem", paddingLeft: "1.2rem" }}>
                      {amendmentPreflightState.preflight.blockers.map((blocker, idx) => (
                        <li key={idx}>{formatBlockerLabel(blocker)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="amendment-requests-section">
            <h3>Amendment Requests</h3>

            {amendmentRequestsLoading && <p className="status" aria-live="polite">Loading amendment requests...</p>}
            {amendmentRequestsError && (
              <div className="notice error-notice" role="alert">
                <p>{amendmentRequestsError}</p>
                <button
                  type="button"
                  onClick={() => fetchAmendmentRequests(draftDetailState.draft.id)}
                  disabled={isDisabled}
                >
                  Retry Loading Requests
                </button>
              </div>
            )}

            {!amendmentRequestsLoading && amendmentRequests.length === 0 && (
              <p className="no-amendments-text">No amendment requests found for this draft.</p>
            )}

            {!amendmentRequestsLoading && amendmentRequests.length > 0 && (
              <ul className="amendment-requests-list">
                {amendmentRequests.map((req) => (
                  <li key={req.id} className="amendment-request-card">
                    {editingAmendmentId === req.id ? (
                      <form onSubmit={(e) => handleUpdateAmendmentRequest(e, draftDetailState.draft.id, req.id)} className="edit-amendment-form">
                        <label>
                          Reason
                          <input
                            type="text"
                            required
                            className={fieldErrors.reason ? "invalid-input-highlight" : ""}
                            value={editingAmendmentReason}
                            onChange={(e) => {
                              setEditingAmendmentReason(e.target.value);
                              if (fieldErrors.reason) {
                                setFieldErrors(curr => ({ ...curr, reason: undefined }));
                              }
                            }}
                          />
                          {fieldErrors.reason && (
                            <span className="field-error-text" role="alert">{fieldErrors.reason.join(", ")}</span>
                          )}
                        </label>
                        <label>
                          Notes
                          <textarea
                            className={fieldErrors.notes ? "invalid-input-highlight" : ""}
                            value={editingAmendmentNotes}
                            onChange={(e) => {
                              setEditingAmendmentNotes(e.target.value);
                              if (fieldErrors.notes) {
                                setFieldErrors(curr => ({ ...curr, notes: undefined }));
                              }
                            }}
                          />
                          {fieldErrors.notes && (
                            <span className="field-error-text" role="alert">{fieldErrors.notes.join(", ")}</span>
                          )}
                        </label>
                        <div className="form-actions">
                          <button type="submit" disabled={isDisabled}>Save</button>
                          <button type="button" onClick={() => setEditingAmendmentId(null)} disabled={isDisabled}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="amendment-request-details">
                        <div className="amendment-header">
                          <span className={`status-badge status-${req.status}`}>
                            {req.status}
                          </span>
                          <span className="timestamp">
                            {formatDateTime(req.created_at)}
                          </span>
                        </div>
                        <p><strong>Reason:</strong> {req.reason || <em>No reason provided</em>}</p>
                        {req.notes && <p><strong>Notes:</strong> {req.notes}</p>}

                        <div className="amendment-request-lines-wrapper">
                          <h5>Proposed Line Changes</h5>
                          {req.lines && req.lines.length > 0 ? (
                            <ul className="amendment-lines-list">
                              {req.lines.map((line) => (
                                <li key={line.id} className="amendment-line-item">
                                  {editingAmendmentLineId === line.id ? (
                                    <form
                                      onSubmit={(e) => handleUpdateAmendmentLine(e, draftDetailState.draft.id, req.id, line.id)}
                                      className="inline-edit-line-form"
                                    >
                                      <select
                                        value={editingAmendmentLineItemId}
                                        onChange={(e) => setEditingAmendmentLineItemId(e.target.value)}
                                        required
                                        disabled={isDisabled}
                                      >
                                        <option value="">-- Select Inventory Item --</option>
                                        {inventoryItems.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.name} ({item.kind})
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        min="1"
                                        value={editingAmendmentLineQuantity}
                                        onChange={(e) => setEditingAmendmentLineQuantity(parseInt(e.target.value) || 1)}
                                        required
                                        disabled={isDisabled}
                                      />
                                      <input
                                        type="text"
                                        placeholder="Notes"
                                        value={editingAmendmentLineNotes}
                                        onChange={(e) => setEditingAmendmentLineNotes(e.target.value)}
                                        disabled={isDisabled}
                                      />
                                      <div className="inline-form-actions">
                                        <button type="submit" disabled={isDisabled}>Save</button>
                                        <button type="button" onClick={() => setEditingAmendmentLineId(null)} disabled={isDisabled}>Cancel</button>
                                      </div>
                                    </form>
                                  ) : (
                                    <div className="amendment-line-display">
                                      <span>
                                        <strong>{line.inventory_item_name}</strong> ({line.inventory_item_kind}) &times; {line.quantity}
                                        {line.notes && <span className="line-notes-text"> ({line.notes})</span>}
                                      </span>
                                      <div className="line-actions">
                                        <button
                                          type="button"
                                          className="edit-line-btn"
                                          disabled={isDisabled}
                                          onClick={() => {
                                            setEditingAmendmentLineId(line.id);
                                            setEditingAmendmentLineItemId(line.inventory_item_id);
                                            setEditingAmendmentLineQuantity(line.quantity);
                                            setEditingAmendmentLineNotes(line.notes);
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="delete-line-btn"
                                          disabled={isDisabled}
                                          onClick={() => handleDeleteAmendmentLine(draftDetailState.draft.id, req.id, line.id)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="empty-lines-hint">No proposed lines added yet.</p>
                          )}

                          <form
                            onSubmit={(e) => handleCreateAmendmentLine(e, draftDetailState.draft.id, req.id)}
                            className="inline-add-line-form"
                          >
                            <h6>Add Proposed Line Change</h6>
                            <div className="inline-add-line-fields">
                              <select
                                value={newAmendmentLineItemId[req.id] || ""}
                                onChange={(e) => setNewAmendmentLineItemId(curr => ({ ...curr, [req.id]: e.target.value }))}
                                required
                                disabled={isDisabled}
                              >
                                <option value="">-- Select Inventory Item --</option>
                                {inventoryItems.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name} ({item.kind})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                value={newAmendmentLineQuantity[req.id] || 1}
                                onChange={(e) => setNewAmendmentLineQuantity(curr => ({ ...curr, [req.id]: parseInt(e.target.value) || 1 }))}
                                required
                                disabled={isDisabled}
                              />
                              <input
                                type="text"
                                placeholder="Line Notes"
                                value={newAmendmentLineNotes[req.id] || ""}
                                onChange={(e) => setNewAmendmentLineNotes(curr => ({ ...curr, [req.id]: e.target.value }))}
                                disabled={isDisabled}
                              />
                              <button type="submit" disabled={isDisabled}>Add Line</button>
                            </div>
                          </form>
                        </div>

                        <div className="amendment-availability-preflight-wrapper">
                          <button
                            type="button"
                            className="check-availability-btn"
                            disabled={isDisabled}
                            onClick={() => handleCheckAmendmentRequestAvailabilityPreflight(draftDetailState.draft.id, req.id)}
                          >
                            Check Amendment Availability Preflight
                          </button>

                          {amendmentRequestPreflights[req.id]?.status === "loading" && (
                            <p className="status" aria-live="polite">Checking availability...</p>
                          )}

                          {amendmentRequestPreflights[req.id]?.status === "error" && (
                            <p className="status error" role="alert">{amendmentRequestPreflights[req.id]?.error}</p>
                          )}

                          {amendmentRequestPreflights[req.id]?.status === "loaded" && amendmentRequestPreflights[req.id]?.data && (
                            <div className="availability-preflight-report">
                              <h4>Availability Preflight Report</h4>
                              <p>
                                <strong>Status:</strong> {amendmentRequestPreflights[req.id]?.data?.status}
                              </p>
                              <p>
                                <strong>Lines Checked:</strong> {amendmentRequestPreflights[req.id]?.data?.line_count}
                              </p>
                              <p>
                                <strong>Available Lines:</strong>{" "}
                                <span className="success-badge">{amendmentRequestPreflights[req.id]?.data?.available_line_count}</span>
                              </p>
                              <p>
                                <strong>Unavailable Lines:</strong>{" "}
                                <span className={amendmentRequestPreflights[req.id]?.data?.unavailable_line_count ? "error-badge" : "success-badge"}>
                                  {amendmentRequestPreflights[req.id]?.data?.unavailable_line_count}
                                </span>
                              </p>

                              {(() => {
                                const preflight = amendmentRequestPreflights[req.id];
                                if (!preflight || preflight.status !== "loaded" || !preflight.data) return null;
                                return preflight.data.lines && preflight.data.lines.length > 0 && (
                                  <table className="availability-preflight-table" aria-label="Amendment availability preflight">
                                    <thead>
                                      <tr>
                                        <th scope="col">Item</th>
                                        <th scope="col">Qty</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Conflicts</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {preflight.data.lines.map((ln) => (
                                        <tr key={ln.amendment_request_line_id}>
                                          <td>{ln.inventory_item_name} ({ln.inventory_item_kind})</td>
                                          <td>{ln.quantity}</td>
                                          <td>
                                            <span className={`status-badge status-${ln.status}`}>
                                              {ln.status}
                                            </span>
                                          </td>
                                          <td>{ln.conflict_count}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        <div className="card-footer-actions">
                          <button
                            type="button"
                            className="edit-btn"
                            disabled={isDisabled}
                            onClick={() => {
                              setEditingAmendmentId(req.id);
                              setEditingAmendmentReason(req.reason);
                              setEditingAmendmentNotes(req.notes);
                            }}
                          >
                            Edit Request Details
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="create-amendment-section">
              <h4>Create Amendment Request</h4>
              {amendmentPreflightState.status === "idle" && (
                <p className="amendment-preflight-hint">
                  Run the amendment preflight check above to verify this draft is eligible before submitting a request.
                </p>
              )}
              {amendmentPreflightState.status === "loaded" && !amendmentPreflightState.preflight.can_amend && (
                <p className="amendment-preflight-blocked">
                  Amendment is currently blocked. See the preflight report above for details.
                </p>
              )}
              {amendmentPreflightState.status === "loaded" && amendmentPreflightState.preflight.can_amend && (
                <p className="amendment-preflight-ready">
                  This draft is eligible for amendment. Fill in the form below to submit a request.
                </p>
              )}
              <form onSubmit={(e) => handleCreateAmendmentRequest(e, draftDetailState.draft.id)} className="availability-form">
                <label>
                  Reason
                  <input
                    type="text"
                    required
                    className={fieldErrors.reason ? "invalid-input-highlight" : ""}
                    value={newAmendmentReason}
                    onChange={(e) => {
                      setNewAmendmentReason(e.target.value);
                      if (fieldErrors.reason) {
                        setFieldErrors(curr => ({ ...curr, reason: undefined }));
                      }
                    }}
                    disabled={isDisabled}
                  />
                  {fieldErrors.reason && (
                    <span className="field-error-text" role="alert">{fieldErrors.reason.join(", ")}</span>
                  )}
                </label>
                <label>
                  Notes
                  <textarea
                    className={fieldErrors.notes ? "invalid-input-highlight" : ""}
                    value={newAmendmentNotes}
                    onChange={(e) => {
                      setNewAmendmentNotes(e.target.value);
                      if (fieldErrors.notes) {
                        setFieldErrors(curr => ({ ...curr, notes: undefined }));
                      }
                    }}
                    disabled={isDisabled}
                  />
                  {fieldErrors.notes && (
                    <span className="field-error-text" role="alert">{fieldErrors.notes.join(", ")}</span>
                  )}
                </label>
                <button type="submit" disabled={isDisabled}>
                  Submit Amendment Request
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="preview-list-section hahitantsoa-creation-section">
        <h3>Create Hahitantsoa Event Draft</h3>
         <form className="availability-form" onSubmit={handleCreateDraft}>
          <label>
            Event Name
            <input
              type="text"
              required
              className={fieldErrors.event_name ? "invalid-input-highlight" : ""}
              value={newEventName}
              onChange={(e) => {
                setNewEventName(e.target.value);
                if (fieldErrors.event_name) {
                  setFieldErrors(curr => ({ ...curr, event_name: undefined }));
                }
              }}
              disabled={isDisabled}
            />
            {fieldErrors.event_name && (
              <span className="field-error-text" role="alert">{fieldErrors.event_name.join(", ")}</span>
            )}
          </label>
          <label>
            Customer
            <select
              className={fieldErrors.customer_id ? "invalid-input-highlight" : ""}
              value={newCustomerId}
              onChange={(e) => {
                setNewCustomerId(e.target.value);
                if (fieldErrors.customer_id) {
                  setFieldErrors(curr => ({ ...curr, customer_id: undefined }));
                }
              }}
              disabled={isDisabled}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
            {fieldErrors.customer_id && (
              <span className="field-error-text" role="alert">{fieldErrors.customer_id.join(", ")}</span>
            )}
          </label>
          <label>
            Venue Name
            <input
              type="text"
              className={fieldErrors.venue_name ? "invalid-input-highlight" : ""}
              value={newVenueName}
              onChange={(e) => {
                setNewVenueName(e.target.value);
                if (fieldErrors.venue_name) {
                  setFieldErrors(curr => ({ ...curr, venue_name: undefined }));
                }
              }}
              disabled={isDisabled}
            />
            {fieldErrors.venue_name && (
              <span className="field-error-text" role="alert">{fieldErrors.venue_name.join(", ")}</span>
            )}
          </label>
          <label>
            Location Details
            <textarea
              className={fieldErrors.location_details ? "invalid-input-highlight" : ""}
              value={newLocationDetails}
              onChange={(e) => {
                setNewLocationDetails(e.target.value);
                if (fieldErrors.location_details) {
                  setFieldErrors(curr => ({ ...curr, location_details: undefined }));
                }
              }}
              disabled={isDisabled}
            />
            {fieldErrors.location_details && (
              <span className="field-error-text" role="alert">{fieldErrors.location_details.join(", ")}</span>
            )}
          </label>
          <label>
            Service Notes
            <textarea
              className={fieldErrors.service_notes ? "invalid-input-highlight" : ""}
              value={newServiceNotes}
              onChange={(e) => {
                setNewServiceNotes(e.target.value);
                if (fieldErrors.service_notes) {
                  setFieldErrors(curr => ({ ...curr, service_notes: undefined }));
                }
              }}
              disabled={isDisabled}
            />
            {fieldErrors.service_notes && (
              <span className="field-error-text" role="alert">{fieldErrors.service_notes.join(", ")}</span>
            )}
          </label>
          <label>
            Start Time
            <input
              type="datetime-local"
              className={fieldErrors.start_at ? "invalid-input-highlight" : ""}
              value={newStartAt}
              onChange={(e) => {
                setNewStartAt(e.target.value);
                if (fieldErrors.start_at) {
                  setFieldErrors(curr => ({ ...curr, start_at: undefined }));
                }
              }}
              disabled={isDisabled}
            />
            {fieldErrors.start_at && (
              <span className="field-error-text" role="alert">{fieldErrors.start_at.join(", ")}</span>
            )}
          </label>
          <label>
            End Time
            <input
              type="datetime-local"
              className={fieldErrors.end_at ? "invalid-input-highlight" : ""}
              value={newEndAt}
              onChange={(e) => {
                setNewEndAt(e.target.value);
                if (fieldErrors.end_at) {
                  setFieldErrors(curr => ({ ...curr, end_at: undefined }));
                }
              }}
              disabled={isDisabled}
            />
            {fieldErrors.end_at && (
              <span className="field-error-text" role="alert">{fieldErrors.end_at.join(", ")}</span>
            )}
          </label>
          <label>
            Notes
            <textarea
              className={fieldErrors.notes ? "invalid-input-highlight" : ""}
              value={newNotes}
              onChange={(e) => {
                setNewNotes(e.target.value);
                if (fieldErrors.notes) {
                  setFieldErrors(curr => ({ ...curr, notes: undefined }));
                }
              }}
              disabled={isDisabled}
            />
            {fieldErrors.notes && (
              <span className="field-error-text" role="alert">{fieldErrors.notes.join(", ")}</span>
            )}
          </label>

          <h4>Lines</h4>
          {newLineInputs.map((line, idx) => (
            <fieldset key={idx} disabled={isDisabled}>
              <legend>Line {idx + 1}</legend>
              <label>
                Item
                <select
                  value={line.inventory_item_id}
                  onChange={(e) =>
                    updateLineField(
                      idx,
                      "inventory_item_id",
                      e.target.value,
                      false,
                    )
                  }
                  disabled={isDisabled}
                >
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
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLineField(
                      idx,
                      "quantity",
                      parseInt(e.target.value, 10),
                      false,
                    )
                  }
                  disabled={isDisabled}
                />
              </label>
              <label>
                Notes
                <textarea
                  value={line.notes || ""}
                  onChange={(e) =>
                    updateLineField(idx, "notes", e.target.value, false)
                  }
                  disabled={isDisabled}
                />
              </label>
              <button
                type="button"
                onClick={() => removeLine(idx, false)}
                disabled={isDisabled}
              >
                Remove Line
              </button>
            </fieldset>
          ))}
          <button type="button" onClick={() => addLine(false)} disabled={isDisabled}>
            Add Line
          </button>
          <button type="submit" disabled={isDisabled}>
            {isActionLoading ? "Creating..." : "Create Draft"}
          </button>
        </form>
      </div>
    </section>
  );
}
export default HahitantsoaEventDraftsPanel;
