import { type FormEvent, useEffect, useState } from "react";
import {
  createHahitantsoaEventDraft,
  getCustomers,
  getHahitantsoaEventDrafts,
  getHahitantsoaEventDraft,
  updateHahitantsoaEventDraft,
  deleteHahitantsoaEventDraft,
  getHahitantsoaEventDraftAvailabilityPreview,
} from "./api";
import type {
  Customer,
  InventoryItem,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftAvailabilityPreview,
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

type ActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type HahitantsoaEventDraftsPanelProps = {
  inventoryItems?: InventoryItem[];
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

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);

  // New Draft Form State
  const initialPeriod = defaultPeriod();
  const [newEventName, setNewEventName] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newVenueName, setNewVenueName] = useState("");
  const [newLocationDetails, setNewLocationDetails] = useState("");
  const [newServiceNotes, setNewServiceNotes] = useState("");
  const [newStartAt, setNewStartAt] = useState(initialPeriod.startAt);
  const [newEndAt, setNewEndAt] = useState(initialPeriod.endAt);
  const [newNotes, setNewNotes] = useState("");
  const [newLineInputs, setNewLineInputs] = useState<DraftLineInput[]>([]);

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

    getCustomers(controller.signal)
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
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to create draft.",
      });
    }
  };

  const handleViewDetails = async (draftId: string) => {
    setDraftDetailState({ status: "loading" });
    setAvailabilityPreviewState({ status: "idle" });
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
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to update draft.",
      });
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!window.confirm("Are you sure you want to delete this event draft?"))
      return;

    setActionState({ status: "loading" });
    try {
      await deleteHahitantsoaEventDraft(draftId);
      setActionState({ status: "success", message: "Draft deleted." });
      setDraftDetailState({ status: "idle" });
      setAvailabilityPreviewState({ status: "idle" });
      fetchDrafts();
    } catch (err) {
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
        </div>
      </div>

      {actionState.status === "loading" && <p className="status">Processing...</p>}
      {actionState.status === "success" && (
        <div className="notice" role="status">
          <p>{actionState.message}</p>
          <button onClick={() => setActionState({ status: "idle" })}>
            Dismiss
          </button>
        </div>
      )}
      {actionState.status === "error" && (
        <div className="notice availability-notice" role="alert">
          <h3>Operation Failed</h3>
          <p>{actionState.message}</p>
          <button onClick={() => setActionState({ status: "idle" })}>
            Dismiss
          </button>
        </div>
      )}

      <div className="preview-list-section">
        <h3>Existing Event Drafts</h3>
        {draftListState.status === "loading" && (
          <p className="status">Loading drafts...</p>
        )}
        {draftListState.status === "error" && (
          <p className="status error">{draftListState.message}</p>
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
        <p className="status">Loading draft details...</p>
      )}
      {draftDetailState.status === "error" && (
        <p className="status error">{draftDetailState.message}</p>
      )}
      {draftDetailState.status === "loaded" && (
        <div className="availability-results">
          <h3>Manage Draft: {draftDetailState.draft.public_reference}</h3>
          <form className="availability-form" onSubmit={handleUpdateDraft}>
            <label>
              Event Name
              <input
                type="text"
                value={editEventName}
                onChange={(e) => setEditEventName(e.target.value)}
              />
            </label>
            <label>
              Venue Name
              <input
                type="text"
                value={editVenueName}
                onChange={(e) => setEditVenueName(e.target.value)}
              />
            </label>
            <label>
              Location Details
              <textarea
                value={editLocationDetails}
                onChange={(e) => setEditLocationDetails(e.target.value)}
              />
            </label>
            <label>
              Service Notes
              <textarea
                value={editServiceNotes}
                onChange={(e) => setEditServiceNotes(e.target.value)}
              />
            </label>
            <label>
              Start Time
              <input
                type="datetime-local"
                value={editStartAt}
                onChange={(e) => setEditStartAt(e.target.value)}
              />
            </label>
            <label>
              End Time
              <input
                type="datetime-local"
                value={editEndAt}
                onChange={(e) => setEditEndAt(e.target.value)}
              />
            </label>
            <label>
              Notes
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </label>

            <h4>Lines</h4>
            {editLines.map((line, idx) => (
              <fieldset key={idx}>
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
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    value={line.notes || ""}
                    onChange={(e) =>
                      updateLineField(idx, "notes", e.target.value, true)
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeLine(idx, true)}
                  disabled={editLines.length <= 1}
                >
                  Remove Line
                </button>
              </fieldset>
            ))}
            <button type="button" onClick={() => addLine(true)}>
              Add Line
            </button>
            <button type="submit">Save Changes</button>
          </form>

          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => handleCheckAvailability(draftDetailState.draft.id)}
            >
              Check Cascading Availability
            </button>
            <button
              type="button"
              className="error-btn"
              onClick={() => handleDeleteDraft(draftDetailState.draft.id)}
              style={{ marginLeft: "1rem", backgroundColor: "#b91c1c" }}
            >
              Delete Draft
            </button>
          </div>

          {availabilityPreviewState.status === "loading" && (
            <p className="status">Analyzing line availability...</p>
          )}
          {availabilityPreviewState.status === "error" && (
            <p className="status error">{availabilityPreviewState.message}</p>
          )}
          {availabilityPreviewState.status === "loaded" && (
            <div
              className="notice"
              style={{ marginTop: "1rem", borderLeftColor: "#059669" }}
            >
              <h4>Cascading Availability Report</h4>
              <p>
                Status: {availabilityPreviewState.preview.available_line_count}{" "}
                / {availabilityPreviewState.preview.line_count} lines available.
              </p>
              <ul>
                {availabilityPreviewState.preview.lines.map((line) => (
                  <li key={line.event_draft_line_id}>
                    {line.inventory_item_name} (x{line.quantity}) -{" "}
                    <strong
                      style={{
                        color:
                          line.status === "available" ? "#059669" : "#dc2626",
                      }}
                    >
                      {line.status}
                    </strong>{" "}
                    ({line.conflict_count} conflicts)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="preview-list-section" style={{ marginTop: "2rem" }}>
        <h3>Create Hahitantsoa Event Draft</h3>
        <form className="availability-form" onSubmit={handleCreateDraft}>
          <label>
            Event Name
            <input
              type="text"
              required
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
            />
          </label>
          <label>
            Customer
            <select
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Venue Name
            <input
              type="text"
              value={newVenueName}
              onChange={(e) => setNewVenueName(e.target.value)}
            />
          </label>
          <label>
            Location Details
            <textarea
              value={newLocationDetails}
              onChange={(e) => setNewLocationDetails(e.target.value)}
            />
          </label>
          <label>
            Service Notes
            <textarea
              value={newServiceNotes}
              onChange={(e) => setNewServiceNotes(e.target.value)}
            />
          </label>
          <label>
            Start Time
            <input
              type="datetime-local"
              value={newStartAt}
              onChange={(e) => setNewStartAt(e.target.value)}
            />
          </label>
          <label>
            End Time
            <input
              type="datetime-local"
              value={newEndAt}
              onChange={(e) => setNewEndAt(e.target.value)}
            />
          </label>
          <label>
            Notes
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />
          </label>

          <h4>Lines</h4>
          {newLineInputs.map((line, idx) => (
            <fieldset key={idx}>
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
                />
              </label>
              <label>
                Notes
                <textarea
                  value={line.notes || ""}
                  onChange={(e) =>
                    updateLineField(idx, "notes", e.target.value, false)
                  }
                />
              </label>
              <button type="button" onClick={() => removeLine(idx, false)}>
                Remove Line
              </button>
            </fieldset>
          ))}
          <button type="button" onClick={() => addLine(false)}>
            Add Line
          </button>
          <button type="submit">Create Draft</button>
        </form>
      </div>
    </section>
  );
}
export default HahitantsoaEventDraftsPanel;
