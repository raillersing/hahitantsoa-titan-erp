import { useCallback, useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "../components";
import { getReservationDrafts, getHahitantsoaEventDrafts, ApiError } from "../api";
import type { ReservationDraft, HahitantsoaEventDraft } from "../types";

interface UpcomingEventsPanelProps {
  onNavigate: (scope: any, param?: string) => void;
}

type UpcomingKind = "titan" | "hahitantsoa";

type UpcomingItem = {
  id: string;
  kind: UpcomingKind;
  dayIndex: number;
  startAt: Date;
  endAt: Date | null;
  title: string;
  subtitle: string;
  customerName: string;
  status: string;
};

type ItemsState =
  | { status: "loading" }
  | { status: "loaded"; items: UpcomingItem[] }
  | { status: "error"; message: string };

function startOfToday(today = new Date()): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabel(day: Date): string {
  const today = startOfToday();
  if (day.getTime() === today.getTime()) return "Aujourd'hui";
  return day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
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

function statusBadgeClasses(label: string): string {
  if (label === "Confirmé") return "bg-green-100 text-green-700";
  if (label === "Contrat signé" || label === "Dépôt reçu") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function UpcomingEventsPanel({ onNavigate }: UpcomingEventsPanelProps) {
  const [itemsState, setItemsState] = useState<ItemsState>({ status: "loading" });

  const loadItems = useCallback(() => {
    setItemsState({ status: "loading" });

    const windowStart = startOfToday();
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 7);

    Promise.all([
      getReservationDrafts(),
      getHahitantsoaEventDrafts(),
    ])
      .then(([reservationDrafts, eventDrafts]) => {
        const items: UpcomingItem[] = [];

        const inWindow = (startAt: Date): boolean =>
          startAt >= windowStart && startAt < windowEnd;

        for (const draft of reservationDrafts) {
          if (draft.status === "cancelled") continue;
          const startAt = new Date(draft.start_at);
          if (!inWindow(startAt)) continue;
          items.push({
            id: draft.id,
            kind: "titan",
            dayIndex: Math.floor((startAt.getTime() - windowStart.getTime()) / 86_400_000),
            startAt,
            endAt: draft.end_at ? new Date(draft.end_at) : null,
            title: draft.public_reference,
            subtitle: "",
            customerName: draft.customer_display_name,
            status: planningStatusLabel(draft),
          });
        }

        for (const draft of eventDrafts) {
          const startAt = new Date(draft.start_at);
          if (!inWindow(startAt)) continue;
          items.push({
            id: draft.id,
            kind: "hahitantsoa",
            dayIndex: Math.floor((startAt.getTime() - windowStart.getTime()) / 86_400_000),
            startAt,
            endAt: draft.end_at ? new Date(draft.end_at) : null,
            title: draft.event_name,
            subtitle: draft.venue_name,
            customerName: draft.customer_display_name,
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
            err instanceof ApiError || err instanceof Error
              ? err.message
              : "Erreur lors du chargement des événements à venir.",
        });
      });
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const itemsByDay = useMemo(() => {
    if (itemsState.status !== "loaded") return [];
    const days: UpcomingItem[][] = Array.from({ length: 7 }, () => []);
    for (const item of itemsState.items) {
      if (item.dayIndex >= 0 && item.dayIndex < 7) days[item.dayIndex].push(item);
    }
    return days;
  }, [itemsState]);

  return (
    <section className="mb-6" aria-labelledby="upcoming-events-heading">
      <h3 className="font-bold text-slate-800 mb-4">7 prochains jours</h3>

      {itemsState.status === "loading" && (
        <LoadingSpinner message="Chargement des événements à venir…" />
      )}

      {itemsState.status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6" role="alert">
          <p className="text-red-600 text-sm mb-3">{itemsState.message}</p>
          <button
            type="button"
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
            onClick={loadItems}
          >
            Réessayer
          </button>
        </div>
      )}

      {itemsState.status === "loaded" && itemsState.items.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-400">
          <i className="fas fa-calendar text-3xl mb-3"></i>
          <p className="text-sm">Aucun événement dans les 7 prochains jours</p>
        </div>
      )}

      {itemsState.status === "loaded" && itemsState.items.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Événements des 7 prochains jours">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left rounded-l-lg">Jour</th>
                  <th scope="col" className="px-4 py-3 text-left">Événement</th>
                  <th scope="col" className="px-4 py-3 text-left">Client</th>
                  <th scope="col" className="px-4 py-3 text-left">Horaire</th>
                  <th scope="col" className="px-4 py-3 text-left rounded-r-lg">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemsByDay.map((dayItems, dayIndex) => {
                  if (dayItems.length === 0) return null;
                  const day = new Date(startOfToday());
                  day.setDate(day.getDate() + dayIndex);
                  return dayItems.map((item, rowIndex) => (
                    <tr
                      key={`${item.kind}-${item.id}`}
                      className="hover:bg-slate-50 transition cursor-pointer"
                      onClick={() =>
                        onNavigate(
                          "reservation-detail",
                          item.kind === "titan" ? `titan:${item.id}` : `hahitantsoa:${item.id}`,
                        )
                      }
                    >
                      {rowIndex === 0 ? (
                        <td rowSpan={dayItems.length} className="px-4 py-3 align-top font-medium text-slate-800">
                          {dayLabel(day)}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{item.title}</div>
                        {item.subtitle ? (
                          <div className="text-xs text-slate-500">{item.subtitle}</div>
                        ) : null}
                        <span
                          className={
                            item.kind === "hahitantsoa"
                              ? "inline-block mt-1 px-2 py-0.5 rounded-full bg-hah-50 text-hah-600 text-xs font-semibold"
                              : "inline-block mt-1 px-2 py-0.5 rounded-full bg-tit-50 text-tit-600 text-xs font-semibold"
                          }
                        >
                          {item.kind === "hahitantsoa" ? "Hah" : "Titan"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.customerName}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatTime(item.startAt)}
                        {item.endAt ? ` — ${formatTime(item.endAt)}` : ""}
                      </td>
                      <td className="px-4 py-3">
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
        </div>
      )}
    </section>
  );
}