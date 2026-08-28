import "./operational-styles.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addLogisticsEventItemLine,
  checkEndpointPermission,
  completeLogisticsPassation,
  createLogisticsEvent,
  createReservationDraftDocumentInstance,
  getDocumentInstancePdfBlob,
  getInventoryItems,
  getLogisticsEventItemLines,
  getLogisticsEvents,
  getHahitantsoaEventDraftLogisticsEvents,
  getHahitantsoaEventDraftDocumentInstances,
  getHahitantsoaEventDrafts,
  getReservationDraftDocumentInstances,
  getTitanClosedDays,
  getReservationDrafts,
  generateReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstancePdf,
  removeLogisticsEventItemLine,
  transitionLogisticsEvent,
} from "./api";
import HandoverSignaturePanel from "./HandoverSignaturePanel";
import type { HahitantsoaEventDraft, InventoryItem, LogisticsEvent, LogisticsEventItemLine, ReservationDraft, TitanClosedDay } from "./types";

const STATUS_LABELS: Record<LogisticsEvent["status"], string> = {
  planned: "Planifié",
  dispatched: "Expédié",
  completed: "Terminé",
  cancelled: "Annulé",
};

const EVENT_TYPE_LABELS: Record<LogisticsEvent["event_type"], string> = {
  delivery: "Livraison",
  pickup: "Enlèvement",
  preparation: "Préparation",
  handover: "Remise",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

const TITAN_OPENING_HOUR = 6;
const TITAN_CLOSING_HOUR = 22;
type LogisticsBusinessScope = "titan" | "hahitantsoa";

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTitanClosedDate(date: Date, closedDays: TitanClosedDay[]): boolean {
  return date.getDay() === 0 || closedDays.some((closedDay) => closedDay.date === localDateKey(date));
}

function shiftToTitanWorkingDate(date: Date, direction: -1 | 1, closedDays: TitanClosedDay[]): Date {
  const candidate = new Date(date);
  while (isTitanClosedDate(candidate, closedDays)) {
    candidate.setDate(candidate.getDate() + direction);
  }
  return candidate;
}

function defaultTitanSchedule(draft: ReservationDraft, operation: LogisticsEvent["operation"], closedDays: TitanClosedDay[]): string {
  const anchor = new Date(draft.start_at);
  anchor.setHours(0, 0, 0, 0);
  anchor.setDate(anchor.getDate() + (operation === "return" ? 1 : -1));
  const scheduledDate = shiftToTitanWorkingDate(anchor, operation === "return" ? 1 : -1, closedDays);
  scheduledDate.setHours(TITAN_OPENING_HOUR, 0, 0, 0);
  const offset = scheduledDate.getTimezoneOffset() * 60_000;
  return new Date(scheduledDate.getTime() - offset).toISOString().slice(0, 16);
}

function scheduleWarning(value: string, closedDays: TitanClosedDay[]): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Choisissez une date et une heure valides.";
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour < TITAN_OPENING_HOUR || hour > TITAN_CLOSING_HOUR) {
    return "Les manœuvres Titan sont possibles entre 06:00 et 22:00.";
  }
  if (isTitanClosedDate(date, closedDays)) {
    return "Cette date est fermée pour Titan. Choisissez un jour ouvré.";
  }
  return null;
}

type PassationState = {
  documentInstanceId: string | null;
  loading: boolean;
  error: string | null;
};

type PreparationState = {
  documentInstanceId: string | null;
  loading: boolean;
  error: string | null;
};

type ConfirmAction =
  | { type: "remove-line"; lineId: string }
  | { type: "transition"; action: "dispatch" | "complete" | "cancel" };

export function LogisticsDeliveryPanel({
  businessScope = "titan",
  draftId,
}: {
  businessScope?: LogisticsBusinessScope;
  draftId?: string;
}) {
  const isTitan = businessScope === "titan";
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
  const [preparationState, setPreparationState] = useState<PreparationState>({
    documentInstanceId: null,
    loading: false,
    error: null,
  });
  const [eventFilter, setEventFilter] = useState<LogisticsEvent["event_type"] | "all">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [reservationDrafts, setReservationDrafts] = useState<ReservationDraft[]>([]);
  const [hahitantsoaDrafts, setHahitantsoaDrafts] = useState<HahitantsoaEventDraft[]>([]);
  const [closedDays, setClosedDays] = useState<TitanClosedDay[]>([]);
  const [closedDaysLoading, setClosedDaysLoading] = useState(false);
  const [closedDaysError, setClosedDaysError] = useState<string | null>(null);
  const [scheduleTouched, setScheduleTouched] = useState(false);
  const [createForm, setCreateForm] = useState({
    reservation_draft: "",
    event_type: "delivery" as LogisticsEvent["event_type"],
    operation: "outbound" as LogisticsEvent["operation"],
    scheduled_at: "",
    address: "",
    contact_name: "",
    contact_phone: "",
    notes: "",
    signature_required: false,
  });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lineAbortRef = useRef<AbortController | null>(null);
  const passationLoadRef = useRef(0);

  const reservationReferenceById = useMemo(
    () => new Map(reservationDrafts.map((draft) => [draft.id, draft.public_reference])),
    [reservationDrafts],
  );

  const formatReservationReference = useCallback(
    (reservationDraftId: string | null, eventDraftId?: string | null) =>
      reservationDraftId
        ? reservationReferenceById.get(reservationDraftId) ?? reservationDraftId.slice(0, 8)
        : eventDraftId
          ? eventDraftId.slice(0, 8)
          : "Dossier non identifié",
    [reservationReferenceById],
  );

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
        isTitan
          ? getLogisticsEvents(abortRef.current.signal)
          : draftId
            ? getHahitantsoaEventDraftLogisticsEvents(draftId, abortRef.current.signal)
            : Promise.resolve([]),
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
        setError(err.message || "Échec du chargement des événements logistiques.");
      }
    } finally {
      setLoading(false);
    }
  }, [draftId, isTitan]);

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
        setLineError(err.message || "Échec du chargement des lignes d'articles.");
      }
    } finally {
      setLineLoading(false);
    }
  }, []);

  const loadReservationDrafts = useCallback(async () => {
    if (!isTitan) {
      try {
        const drafts = await getHahitantsoaEventDrafts();
        setHahitantsoaDrafts(Array.isArray(drafts) ? drafts : []);
      } catch {
        setHahitantsoaDrafts([]);
      }
      return;
    }
    try {
      const drafts = await getReservationDrafts();
      setReservationDrafts(Array.isArray(drafts) ? drafts : []);
    } catch {
      // silent — reservation list is optional for creation
    }
  }, [isTitan]);

  const loadClosedDays = useCallback(async (drafts: ReservationDraft[]) => {
    if (!isTitan) {
      setClosedDays([]);
      setClosedDaysError(null);
      setClosedDaysLoading(false);
      return;
    }

    const years = new Set([new Date().getFullYear(), ...drafts.flatMap((draft) => [
      new Date(draft.start_at).getFullYear(),
      new Date(draft.end_at).getFullYear(),
    ])]);
    setClosedDaysLoading(true);
    setClosedDaysError(null);
    try {
      const results = await Promise.all([...years].map((year) => getTitanClosedDays(year)));
      const uniqueDays = new Map(results.flat().map((closedDay) => [closedDay.date, closedDay]));
      setClosedDays([...uniqueDays.values()]);
    } catch (err: unknown) {
      setClosedDays([]);
      setClosedDaysError(err instanceof Error ? err.message : "Impossible de vérifier les jours fériés Titan.");
    } finally {
      setClosedDaysLoading(false);
    }
  }, [isTitan]);

  const loadPassationDocument = useCallback(async (event: LogisticsEvent) => {
    const requestId = ++passationLoadRef.current;
    if (!event.reservation_draft && !event.hahitantsoa_event_draft) {
      setPassationState({ documentInstanceId: null, loading: false, error: null });
      return;
    }

    try {
      const instances = event.hahitantsoa_event_draft
        ? await getHahitantsoaEventDraftDocumentInstances(event.hahitantsoa_event_draft)
        : await getReservationDraftDocumentInstances(event.reservation_draft!);
      if (requestId !== passationLoadRef.current) return;
      const deliveryNote = instances.find(
        (document) =>
          ["titan.delivery_note.v1", "hahitantsoa.delivery_note.v1"].includes(document.template_key) &&
          document.status !== "voided",
      );
      setPassationState({
        documentInstanceId: deliveryNote?.id ?? null,
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      if (requestId !== passationLoadRef.current) return;
      setPassationState({
        documentInstanceId: null,
        loading: false,
        error: err instanceof Error ? err.message : "Échec du chargement du bon de livraison.",
      });
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
    void loadReservationDrafts();
  }, [loadReservationDrafts]);

  useEffect(() => {
    if (reservationDrafts.length > 0) {
      void loadClosedDays(reservationDrafts);
    } else {
      setClosedDays([]);
      setClosedDaysError(null);
      setClosedDaysLoading(false);
    }
  }, [loadClosedDays, reservationDrafts]);

  const selectedCreateDraft = reservationDrafts.find((draft) => draft.id === createForm.reservation_draft) ?? null;
  const createScheduleWarning = isTitan ? scheduleWarning(createForm.scheduled_at, closedDays) : null;
  const createScheduleUnavailable = isTitan && Boolean(selectedCreateDraft) && (closedDaysLoading || Boolean(closedDaysError));

  useEffect(() => {
    if (!isTitan || !selectedCreateDraft || scheduleTouched || closedDaysLoading || closedDaysError) return;
    setCreateForm((current) => ({
      ...current,
      scheduled_at: defaultTitanSchedule(selectedCreateDraft, current.operation, closedDays),
    }));
  }, [closedDays, closedDaysError, closedDaysLoading, createForm.operation, isTitan, scheduleTouched, selectedCreateDraft]);

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

  useEffect(() => {
    setPassationState({ documentInstanceId: null, loading: true, error: null });
    if (selectedEvent) {
      void loadPassationDocument(selectedEvent);
    } else {
      setPassationState({ documentInstanceId: null, loading: false, error: null });
    }
  }, [loadPassationDocument, selectedEventId]);

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
      setError(err instanceof Error ? err.message : "Échec de la mise à jour du statut.");
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
      setLineError(err instanceof Error ? err.message : "Échec de l'ajout de la ligne d'article.");
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
      setLineError(err instanceof Error ? err.message : "Échec de la suppression de la ligne d'article.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompletePassation = async () => {
    if (!selectedEvent || !canWrite) {
      return;
    }

    passationLoadRef.current += 1;
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
        error: err instanceof Error ? err.message : "Échec de la finalisation de la remise.",
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
        ...(isTitan
          ? { reservation_draft: createForm.reservation_draft }
          : { hahitantsoa_event_draft: createForm.reservation_draft }),
        event_type: createForm.event_type,
        operation: createForm.operation,
        scheduled_at: createForm.scheduled_at || null,
        address: createForm.address || undefined,
        contact_name: createForm.contact_name || undefined,
        contact_phone: createForm.contact_phone || undefined,
        notes: createForm.notes || undefined,
        signature_required: createForm.signature_required,
      });
      setShowCreateForm(false);
      setScheduleTouched(false);
      setCreateForm({
        reservation_draft: "",
        event_type: "delivery",
        operation: "outbound",
        scheduled_at: "",
        address: "",
        contact_name: "",
        contact_phone: "",
        notes: "",
        signature_required: false,
      });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de la création de l'événement logistique.");
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
      setPassationState((prev) => ({ ...prev, error: "Échec de l'ouverture du PDF du bon de livraison." }));
    }
  };

  const handlePrintPreparationSheet = async () => {
    if (!selectedEvent || selectedEvent.event_type !== "preparation") return;
    if (!selectedEvent.reservation_draft) {
      setPreparationState({
        documentInstanceId: null,
        loading: false,
        error: "Le bon de préparation est disponible uniquement pour Titan.",
      });
      return;
    }

    setPreparationState({ documentInstanceId: null, loading: true, error: null });
    try {
      const existingInstances = await getReservationDraftDocumentInstances(
        selectedEvent.reservation_draft,
      );
      let instance = existingInstances.find(
        (document) =>
          document.template_key === "shared.preparation_sheet.v1" &&
          document.status !== "voided",
      );

      if (!instance) {
        instance = await createReservationDraftDocumentInstance(
          selectedEvent.reservation_draft,
          {
            template_key: "shared.preparation_sheet.v1",
            notes: `Bon de préparation pour l'événement logistique ${selectedEvent.id}`,
          },
        );
      }

      if (instance.status === "prepared") {
        instance = await generateReservationDraftDocumentInstance(
          selectedEvent.reservation_draft,
          instance.id,
        );
      }

      if (instance.status !== "generated" && instance.status !== "issued") {
        throw new Error("Le bon de préparation n'est pas prêt à être imprimé.");
      }

      if (instance.status === "generated") {
        await generateReservationDraftDocumentInstancePdf(
          selectedEvent.reservation_draft,
          instance.id,
        );
      }

      const blob = await getDocumentInstancePdfBlob(instance.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setPreparationState({ documentInstanceId: instance.id, loading: false, error: null });
    } catch (err: unknown) {
      setPreparationState({
        documentInstanceId: null,
        loading: false,
        error: err instanceof Error ? err.message : "Échec de la génération du bon de préparation.",
      });
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
            <span className="permission-tag permission-ok" data-testid="logistics-write-ok">Accès écriture</span>
          ) : (
            <span className="permission-tag permission-denied" data-testid="logistics-read-only">Lecture seule</span>
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
              {isTitan ? "Réservation" : "Dossier Hahitantsoa"}
              <select value={createForm.reservation_draft} onChange={(e) => { setScheduleTouched(false); setCreateForm((f) => ({ ...f, reservation_draft: e.target.value })); }} required>
                <option value="">Sélectionner {isTitan ? "une réservation" : "un dossier"}</option>
                {isTitan ? reservationDrafts.map((d) => (
                  <option key={d.id} value={d.id}>{d.public_reference} — {d.customer_display_name}</option>
                )) : hahitantsoaDrafts.map((d) => (
                  <option key={d.id} value={d.id}>{d.public_reference} — {d.event_name}</option>
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
              Opération
              <select value={createForm.operation} onChange={(e) => { setScheduleTouched(false); setCreateForm((f) => ({ ...f, operation: e.target.value as LogisticsEvent["operation"] })); }}>
                <option value="outbound">Sortie / livraison (J-1)</option>
                <option value="return">Retour / récupération (J+1)</option>
              </select>
            </label>
            <label>
              Planifié le
              <input type="datetime-local" value={createForm.scheduled_at} onChange={(e) => { setScheduleTouched(true); setCreateForm((f) => ({ ...f, scheduled_at: e.target.value })); }} />
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
            {isTitan && selectedCreateDraft ? <p className="ops-section-helper">Titan : sortie/livraison le jour ouvré précédent, retour/récupération le jour ouvré suivant. Dimanche et jours fériés sont exclus automatiquement.</p> : null}
            {isTitan && closedDaysLoading && selectedCreateDraft ? <p className="ops-section-helper">Vérification des jours fériés Titan...</p> : null}
            {isTitan && closedDaysError && selectedCreateDraft ? <p className="notice error-notice" role="alert">{closedDaysError} Réessayez avant de planifier l'opération.</p> : null}
            {createScheduleWarning ? <p className="notice error-notice" role="alert">{createScheduleWarning}</p> : null}
            <button className="ops-button" type="submit" disabled={actionLoading || !createForm.reservation_draft || createScheduleUnavailable || Boolean(createScheduleWarning)}>
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
                    <span className="ops-row__ref">{formatReservationReference(event.reservation_draft, event.hahitantsoa_event_draft)}</span>
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
                      {isTitan ? "Réservation" : "Dossier"} {formatReservationReference(selectedEvent.reservation_draft, selectedEvent.hahitantsoa_event_draft)}
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
                  {selectedEvent.event_type === "preparation" ? (
                    <div className="ops-preview-note">
                      <p>Bon de préparation imprimable.</p>
                      <button
                        className="ops-button-secondary"
                        type="button"
                        disabled={preparationState.loading}
                        onClick={() => void handlePrintPreparationSheet()}
                      >
                        {preparationState.loading ? "Génération..." : "Imprimer le bon de préparation"}
                      </button>
                    </div>
                  ) : null}
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
                  {preparationState.error ? (
                    <p className="ops-preview-note" role="alert">{preparationState.error}</p>
                  ) : null}
                </section>

                <HandoverSignaturePanel event={selectedEvent} canWrite={canWrite} onUpdate={replaceEvent} />

                <div className="ops-line-actions">
                  {confirmAction?.type === "transition" ? (
                    <span className="confirm-delete-group">
                      <span className="confirm-delete-hint">Confirmer cette action ?</span>
                      {confirmAction.action === "dispatch" ? (
                        <button className="ops-button-secondary" type="button" disabled={actionLoading} onClick={() => { setConfirmAction(null); void handleTransition("dispatched"); }}>
                          {actionLoading ? "..." : "Confirmer l'envoi"}
                        </button>
                      ) : confirmAction.action === "complete" ? (
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
                      <button className="ops-button-secondary" type="button" disabled={!canWrite || actionLoading || selectedEvent.status !== "planned"} onClick={() => setConfirmAction({ type: "transition", action: "dispatch" })}>
                        Envoyer
                      </button>
                      <button className="ops-button-secondary" type="button" disabled={!canWrite || actionLoading || selectedEvent.status !== "dispatched"} onClick={() => setConfirmAction({ type: "transition", action: "complete" })}>
                        Compléter
                      </button>
                      <button className="ops-button-danger" type="button" disabled={!canWrite || actionLoading || selectedEvent.status === "completed" || selectedEvent.status === "cancelled"} onClick={() => setConfirmAction({ type: "transition", action: "cancel" })}>
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
