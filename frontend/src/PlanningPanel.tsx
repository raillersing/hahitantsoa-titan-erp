import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getReservationDrafts,
  getHahitantsoaEventDrafts,
} from "./api";
import type {
  ReservationDraft,
  HahitantsoaEventDraft,
} from "./types";

type PlanningItem = {
  id: string;
  kind: "titan" | "hahitantsoa";
  dayIndex: number;
  startAt: Date;
  endAt: Date;
  title: string;
  subtitle: string;
  customerName: string;
  resourceCount: number;
  status: string;
};

type ItemsState =
  | { status: "loading" }
  | { status: "loaded"; items: PlanningItem[] }
  | { status: "error"; message: string };

type FilterKind = "all" | "titan" | "hahitantsoa";

const DAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function formatDateRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return `Semaine du ${monday.toLocaleDateString("fr-FR", options)} au ${sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function planningStatusLabel(draft: ReservationDraft): string {
  if (draft.status === "cancelled") return "Annulé";
  if (draft.confirmed_at) return "Confirmé";
  if (draft.required_deposit_received_at) return "Dépôt reçu";
  if (draft.contract_signed_at) return "Contrat signé";
  return "Brouillon";
}

function hahitantsoaPlanningStatus(status: HahitantsoaEventDraft["status"]): string {
  if (status === "confirmed") return "Confirmé";
  return "Brouillon";
}

function statusBadgeClass(label: string): string {
  if (label === "Confirmé") return "badge badge--success";
  if (label === "Annulé") return "badge badge--danger";
  if (label === "Contrat signé" || label === "Dépôt reçu") return "badge badge--warning";
  return "badge badge--neutral";
}

function PlanningPanel() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [itemsState, setItemsState] = useState<ItemsState>({ status: "loading" });

  const monday = useMemo(
    () => addWeeks(getMonday(new Date()), weekOffset),
    [weekOffset],
  );

  const loadItems = useCallback(() => {
    setItemsState({ status: "loading" });

    Promise.all([
      getReservationDrafts(),
      getHahitantsoaEventDrafts(),
    ])
      .then(([reservationDrafts, eventDrafts]) => {
        const items: PlanningItem[] = [];

        for (const draft of reservationDrafts) {
          const startAt = new Date(draft.start_at);
          const dayIndex = getDayIndex(startAt, monday);
          if (dayIndex < 0 || dayIndex > 6) continue;
          items.push({
            id: draft.id,
            kind: "titan",
            dayIndex,
            startAt,
            endAt: new Date(draft.end_at),
            title: draft.public_reference,
            subtitle: "",
            customerName: draft.customer_display_name,
            resourceCount: draft.lines.length,
            status: planningStatusLabel(draft),
          });
        }

        for (const draft of eventDrafts) {
          const startAt = new Date(draft.start_at);
          const dayIndex = getDayIndex(startAt, monday);
          if (dayIndex < 0 || dayIndex > 6) continue;
          items.push({
            id: draft.id,
            kind: "hahitantsoa",
            dayIndex,
            startAt,
            endAt: new Date(draft.end_at),
            title: draft.event_name,
            subtitle: draft.venue_name,
            customerName: draft.customer_display_name,
            resourceCount: draft.lines.length,
            status: hahitantsoaPlanningStatus(draft.status),
          });
        }

        items.sort((a, b) => a.dayIndex - b.dayIndex || a.startAt.getTime() - b.startAt.getTime());

        setItemsState({ status: "loaded", items });
      })
      .catch((err) => {
        setItemsState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load planning data.",
        });
      });
  }, [monday]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems =
    itemsState.status === "loaded"
      ? filterKind === "all"
        ? itemsState.items
        : itemsState.items.filter((i) => i.kind === filterKind)
      : [];

  const itemsByDay = DAY_LABELS.map((_, dayIndex) =>
    filteredItems.filter((i) => i.dayIndex === dayIndex),
  );

  const filterChips: { kind: FilterKind; label: string; activeClass: string }[] = [
    { kind: "all", label: "Tous", activeClass: "scope-chip scope-chip--neutral" },
    { kind: "titan", label: "Titan", activeClass: "scope-chip scope-chip--titan" },
    { kind: "hahitantsoa", label: "Hahitantsoa", activeClass: "scope-chip scope-chip--hah" },
  ];

  return (
    <section className="planning-panel" aria-labelledby="planning-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Planning</p>
          <h2 id="planning-heading">Planning hebdomadaire</h2>
          <p className="section-helper">{formatDateRange(monday)}</p>
        </div>
      </div>

      <div className="planning-controls">
        <div className="planning-nav">
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setWeekOffset((p) => p - 1)}
            aria-label="Semaine précédente"
          >
            &larr; Préc.
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setWeekOffset(0)}
            aria-label="Semaine courante"
          >
            Cette semaine
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setWeekOffset((p) => p + 1)}
            aria-label="Semaine suivante"
          >
            Suiv. &rarr;
          </button>
        </div>

        <div className="planning-filters" role="group" aria-label="Filtrer par type">
          {filterChips.map((chip) => (
            <button
              key={chip.kind}
              type="button"
              className={chip.activeClass + (filterKind === chip.kind ? "" : " scope-chip--inactive")}
              onClick={() => setFilterKind(chip.kind)}
              aria-pressed={filterKind === chip.kind}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {itemsState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">
          Chargement du planning...
        </p>
      ) : null}

      {itemsState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{itemsState.message}</p>
          <button type="button" onClick={loadItems}>
            Réessayer
          </button>
        </div>
      ) : null}

      {itemsState.status === "loaded" && filteredItems.length === 0 ? (
        <div className="notice info-notice" role="status">
          <p>Aucun événement planifié pour cette semaine.</p>
        </div>
      ) : null}

      {itemsState.status === "loaded" && filteredItems.length > 0 ? (
        <div className="table-shell">
          <table className="planning-table" aria-label="Planning hebdomadaire">
            <thead>
              <tr>
                <th scope="col">Jour</th>
                <th scope="col">Événement</th>
                <th scope="col">Client</th>
                <th scope="col">Statut</th>
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((dayLabel, dayIndex) => {
                const dayItems = itemsByDay[dayIndex];
                if (dayItems.length === 0) return null;
                return dayItems.map((item, rowIndex) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    {rowIndex === 0 ? (
                      <td rowSpan={dayItems.length}>
                        <div className="planning-day-label">{dayLabel}</div>
                        <div className="planning-time">
                          {formatTime(item.startAt)} &mdash; {formatTime(item.endAt)}
                        </div>
                      </td>
                    ) : null}
                    <td>
                      <div
                        className={
                          item.kind === "hahitantsoa"
                            ? "planning-event-name planning-event-name--hah"
                            : "planning-event-name planning-event-name--titan"
                        }
                      >
                        {item.title}
                      </div>
                      {item.subtitle ? (
                        <div className="planning-event-subtitle">{item.subtitle}</div>
                      ) : null}
                    </td>
                    <td>{item.customerName}</td>
                    <td>
                      <span className={statusBadgeClass(item.status)}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function getDayIndex(date: Date, monday: Date): number {
  const diff = date.getTime() - monday.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days;
}

export default PlanningPanel;
