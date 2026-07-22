import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getReservationDrafts, getHahitantsoaEventDrafts, getVisitAppointments } from "../api";
import type {
  ReservationDraft,
  HahitantsoaEventDraft,
  VisitAppointment,
} from "../types";

interface PlanningPageProps {
  onNavigate?: (scope: any, param?: string) => void;
}

type PlanningItem = {
  id: string;
  kind: "titan" | "hahitantsoa" | "visit";
  dayIndex: number;
  startAt: Date;
  endAt: Date | null;
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

type FilterKind = "all" | "titan" | "hahitantsoa" | "visit";

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

function formatDuration(start: Date, end: Date | null): string {
  if (!end) return "Sans durée";
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return "-";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${minutes}`;
}

function formatDayDate(monday: Date, dayIndex: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
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

function statusBadgeClasses(label: string): string {
  if (label === "Confirmé") return "bg-green-100 text-green-700";
  if (label === "Annulé") return "bg-rose-100 text-rose-700";
  if (label === "Contrat signé" || label === "Dépôt reçu") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function getDayIndex(date: Date, monday: Date): number {
  const diff = date.getTime() - monday.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function visitPlanningStatus(status: VisitAppointment["status"]): string {
  if (status === "completed") return "Terminée";
  if (status === "cancelled") return "Annulée";
  return "Planifiée";
}

function formatReason(reason: VisitAppointment["reason"]): string {
  if (reason === "prospect") return "Visite prospect";
  if (reason === "other") return "Autre visite";
  return "Simple visite";
}

export default function PlanningPage({ onNavigate }: PlanningPageProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterKind, setFilterKind] = useState<FilterKind>("all");
  const [itemsState, setItemsState] = useState<ItemsState>({ status: "loading" });

  const monday = useMemo(
    () => addWeeks(getMonday(new Date()), weekOffset),
    [weekOffset],
  );

  const loadItems = useCallback(() => {
    setItemsState({ status: "loading" });

    const sundayExclusive = new Date(monday);
    sundayExclusive.setDate(sundayExclusive.getDate() + 7);
    Promise.all([
      getReservationDrafts(),
      getHahitantsoaEventDrafts(),
      getVisitAppointments({
        scheduled_after: monday.toISOString(),
        scheduled_before: sundayExclusive.toISOString(),
      }),
    ])
      .then(([reservationDrafts, eventDrafts, visits]) => {
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

        for (const visit of visits) {
          const startAt = new Date(visit.scheduled_at);
          const dayIndex = getDayIndex(startAt, monday);
          if (dayIndex < 0 || dayIndex > 6) continue;
          items.push({
            id: visit.id,
            kind: "visit",
            dayIndex,
            startAt,
            endAt: null,
            title: formatReason(visit.reason),
            subtitle: visit.location,
            customerName: visit.customer_display_name,
            resourceCount: 0,
            status: visitPlanningStatus(visit.status),
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
              : "Échec du chargement du planning.",
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

  const handleEventClick = (reservationId?: string) => {
    if (reservationId && onNavigate) {
      onNavigate("reservation-detail", reservationId);
    }
  };

  const filterChips: { kind: FilterKind; label: string; active: string; inactive: string }[] = [
    { kind: "all", label: "Tous", active: "bg-indigo-100 text-indigo-700", inactive: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
    { kind: "titan", label: "Titan", active: "bg-indigo-100 text-indigo-700", inactive: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
    { kind: "hahitantsoa", label: "Hahitantsoa", active: "bg-indigo-100 text-indigo-700", inactive: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
    { kind: "visit", label: "Visites", active: "bg-indigo-100 text-indigo-700", inactive: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
  ];

  return (
    <div className="page active space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Planning hebdomadaire</h2>
          <p className="text-sm text-slate-500">{formatDateRange(monday)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={() => setWeekOffset((p) => p - 1)}
          >
            ← Préc.
          </button>
          <button
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={() => setWeekOffset(0)}
          >
            Cette semaine
          </button>
          <button
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            onClick={() => setWeekOffset((p) => p + 1)}
          >
            Suiv. →
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">Filtrer :</span>
        {filterChips.map((chip) => (
          <button
            key={chip.kind}
            onClick={() => setFilterKind(chip.kind)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterKind === chip.kind ? chip.active : chip.inactive}`}
          >
            {chip.kind === "titan" && <i className="fa-solid fa-truck mr-1"></i>}
            {chip.kind === "hahitantsoa" && <i className="fa-solid fa-building mr-1"></i>}
            {chip.kind === "visit" && <i className="fa-solid fa-user-clock mr-1"></i>}
            {chip.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {itemsState.status === "loading" && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-500 mb-3"></i>
          <p className="text-sm text-slate-500">Chargement du planning...</p>
        </div>
      )}

      {/* Error */}
      {itemsState.status === "error" && (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-rose-500 mb-3"></i>
          <p className="text-sm text-rose-600 font-medium">{itemsState.message}</p>
          <button
            onClick={loadItems}
            className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Empty */}
      {itemsState.status === "loaded" && filteredItems.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <i className="fa-solid fa-calendar-xmark text-2xl text-slate-300 mb-3"></i>
          <p className="text-sm text-slate-500">Aucun événement planifié pour cette semaine.</p>
        </div>
      )}

      {/* Table */}
      {itemsState.status === "loaded" && filteredItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="text-left px-4 py-3 rounded-l-lg">Jour</th>
                <th className="text-left px-4 py-3">Événement</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Durée</th>
                <th className="text-left px-4 py-3">Ressources</th>
                <th className="text-left px-4 py-3 rounded-r-lg">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DAY_LABELS.map((dayLabel, dayIndex) => {
                const dayItems = itemsByDay[dayIndex];
                if (dayItems.length === 0) return null;
                return dayItems.map((item, rowIndex) => (
                  <tr key={`${item.kind}-${item.id}`} className="hover:bg-slate-50 transition-colors">
                    {rowIndex === 0 ? (
                      <td rowSpan={dayItems.length} className="px-4 py-4 align-top">
                        <div className="font-semibold text-slate-900">
                          {dayLabel} {formatDayDate(monday, dayIndex)}
                        </div>
                          <div className="text-xs text-slate-500">
                          {formatTime(item.startAt)}{item.endAt ? ` — ${formatTime(item.endAt)}` : ""}
                        </div>
                      </td>
                    ) : null}
                    <td className="px-4 py-4">
                      <button
                          onClick={() => item.kind !== "visit" && handleEventClick(item.id)}
                        className="text-left group"
                      >
                        <div className="font-medium text-slate-900 group-hover:text-indigo-600 group-hover:underline">
                          {item.title}
                        </div>
                        {item.subtitle ? (
                          <div className="text-xs text-slate-500">{item.subtitle}</div>
                        ) : null}
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                            item.kind === "hahitantsoa"
                              ? "bg-rose-50 text-rose-600"
                              : item.kind === "visit"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {item.kind === "hahitantsoa" ? "Hahitantsoa" : item.kind === "visit" ? "Visite" : "Titan"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{item.customerName}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDuration(item.startAt, item.endAt)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {item.kind === "visit" ? "—" : `${item.resourceCount} article(s)`}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClasses(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
