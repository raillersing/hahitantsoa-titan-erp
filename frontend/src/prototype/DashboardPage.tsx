import React, { useState, useEffect } from 'react';
import { LoadingSpinner } from '../components';
import {
  getReservationDrafts,
  getHahitantsoaEventDrafts,
  getInventoryItems,
  getBillingInvoices,
  getNotifications,
  ApiError,
} from "../api";
import type {
  ReservationDraft,
  HahitantsoaEventDraft,
  InventoryItem,
  BillingInvoice,
  SystemNotification,
} from "../types";
import UpcomingEventsPanel from "./UpcomingEventsPanel";

interface DashboardPageProps {
  onNavigate: (scope: any, param?: string) => void;
  canSensitiveWrite?: boolean;
}

/** Format a number as Madagascar Ariary with shorthand for millions. */
function formatAr(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M Ar`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k Ar`;
  }
  return `${Math.round(value)} Ar`;
}

/** Format a date string to a short French label like "28 Juin 2026". */
function formatDateFr(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Build the rolling 7-day window ending today (oldest first). */
function lastSevenDays(today = new Date()): Date[] {
  const days: Date[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    day.setHours(0, 0, 0, 0);
    days.push(day);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Count how many ISO timestamps fall on each day of the window. */
function countByDay(isoDates: string[], days: Date[]): number[] {
  const counts = days.map(() => 0);
  for (const iso of isoDates) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    const index = days.findIndex((day) => isSameDay(date, day));
    if (index >= 0) counts[index] += 1;
  }
  return counts;
}

function dayLabel(day: Date, today: Date): string {
  if (isSameDay(day, today)) return "Auj.";
  return day.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
}

/** Determine severity icon class for a notification. */
function notificationIconClass(severity: string): string {
  switch (severity) {
    case "error":
      return "fas fa-exclamation-circle text-red-500 mt-0.5";
    case "warning":
      return "fas fa-clock text-amber-500 mt-0.5";
    case "success":
      return "fas fa-check-circle text-green-500 mt-0.5";
    default:
      return "fas fa-info-circle text-blue-500 mt-0.5";
  }
}

/** Determine card background class for a notification severity. */
function notificationBgClass(severity: string): string {
  switch (severity) {
    case "error":
      return "bg-red-50 border border-red-100 hover:bg-red-100";
    case "warning":
      return "bg-amber-50 border border-amber-100 hover:bg-amber-100";
    case "success":
      return "bg-green-50 border border-green-100 hover:bg-green-100";
    default:
      return "bg-blue-50 border border-blue-100 hover:bg-blue-100";
  }
}

/** Determine text class for a notification severity title. */
function notificationTextClass(severity: string): string {
  switch (severity) {
    case "error":
      return "text-red-800";
    case "warning":
      return "text-amber-800";
    case "success":
      return "text-green-800";
    default:
      return "text-blue-800";
  }
}

/** Determine subtitle text class for a notification severity. */
function notificationSubTextClass(severity: string): string {
  switch (severity) {
    case "error":
      return "text-red-600";
    case "warning":
      return "text-amber-700";
    case "success":
      return "text-green-700";
    default:
      return "text-blue-700";
  }
}

export default function DashboardPage({ onNavigate, canSensitiveWrite = false }: DashboardPageProps) {
  const [drafts, setDrafts] = useState<ReservationDraft[]>([]);
  const [eventDrafts, setEventDrafts] = useState<HahitantsoaEventDraft[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialLoadMessage, setPartialLoadMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);
        setPartialLoadMessage(null);
        const results = await Promise.allSettled([
          getReservationDrafts(undefined, controller.signal),
          getHahitantsoaEventDrafts(undefined, controller.signal),
          getInventoryItems(controller.signal),
          getBillingInvoices(undefined, controller.signal),
          getNotifications(false, controller.signal),
        ]);
        if (controller.signal.aborted) return;

        const [draftsResult, eventDraftsResult, inventoryResult, invoicesResult, notificationsResult] = results;
        const unavailableSources: string[] = [];
        if (draftsResult.status === "fulfilled") setDrafts(draftsResult.value);
        else unavailableSources.push("les réservations Titan");
        if (eventDraftsResult.status === "fulfilled") setEventDrafts(eventDraftsResult.value);
        else unavailableSources.push("les événements Hahitantsoa");
        if (inventoryResult.status === "fulfilled") setInventoryItems(inventoryResult.value);
        else unavailableSources.push("l’inventaire");
        if (invoicesResult.status === "fulfilled") setInvoices(invoicesResult.value);
        else unavailableSources.push("la facturation");
        if (notificationsResult.status === "fulfilled") setNotifications(notificationsResult.value);
        else unavailableSources.push("les notifications");

        if (unavailableSources.length === results.length) {
          setError("Aucune donnée du tableau de bord n’a pu être chargée.");
        } else if (unavailableSources.length > 0) {
          setPartialLoadMessage(
            `Certaines données sont temporairement indisponibles : ${unavailableSources.join(", ")}.`,
          );
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Erreur lors du chargement du tableau de bord.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
    return () => controller.abort();
  }, []);

  // Compute dashboard statistics from real API data
  const activeReservations = drafts.filter((draft) => draft.status !== "cancelled").length;
  const activeEventDrafts = eventDrafts.length; // Hahitantsoa statuses are only "draft" | "confirmed"
  const totalItems = inventoryItems.length;
  const stockAlerts = notifications.filter((n) => n.notification_type === "stock").length;
  const remainingBalance = invoices.reduce((sum, inv) => {
    const bal = parseFloat(inv.remaining_balance || "0");
    return sum + (isNaN(bal) ? 0 : bal);
  }, 0);

  // Real 7-day activity: dossiers created per day, split Titan / Hahitantsoa
  const today = new Date();
  const activityDays = lastSevenDays(today);
  const titanActivity = countByDay(
    drafts.filter((d) => d.status !== "cancelled").map((d) => d.created_at),
    activityDays,
  );
  const hahActivity = countByDay(eventDrafts.map((d) => d.created_at), activityDays);
  const activityMax = Math.max(1, ...titanActivity, ...hahActivity);
  const activityTotal =
    titanActivity.reduce((sum, count) => sum + count, 0) +
    hahActivity.reduce((sum, count) => sum + count, 0);

  // Loading skeleton
  if (loading) {
    return <LoadingSpinner message="Chargement du tableau de bord…" />;
  }

  // Error state
  if (error) {
    return (
      <div className="page active">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-4"></i>
          <p className="text-red-800 font-semibold mb-2">Erreur de chargement</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
            onClick={() => window.location.reload()}
          >
            <i className="fas fa-redo mr-2"></i>Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page active">
      <div className="template-extra-actions flex flex-wrap gap-2 mb-6">
        {canSensitiveWrite && (
          <button className="px-4 py-2 bg-hah-600 text-white rounded-lg text-sm font-medium hover:bg-hah-700 transition shadow-sm" onClick={() => onNavigate("reservation-new")}>
            <i className="fas fa-plus mr-2"></i>Nouvelle réservation
          </button>
        )}
        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition" onClick={() => onNavigate("planning")}>
          <i className="fas fa-calendar mr-2"></i>Ouvrir le planning
        </button>
        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition" onClick={() => onNavigate("reports")}>
          <i className="fas fa-chart-bar mr-2 text-blue-500"></i>Voir les rapports
        </button>
      </div>

      {partialLoadMessage && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">
          <i className="fas fa-exclamation-triangle mr-2" aria-hidden="true"></i>
          {partialLoadMessage}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Reservations count */}
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-hah-50 flex items-center justify-center text-hah-600">
              <i className="fas fa-building text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              {activeEventDrafts} événement(s) Hah
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{activeReservations}</p>
          <p className="text-sm text-slate-500">Réservations Titan en cours</p>
          <button className="mt-3 text-xs text-hah-600 font-semibold hover:text-hah-700" onClick={() => onNavigate("hahitantsoa")}>Voir les réservations →</button>
        </div>

        {/* Card 2: Inventory items count */}
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-tit-50 flex items-center justify-center text-tit-600">
              <i className="fas fa-box text-xl"></i>
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {totalItems} articles
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{totalItems}</p>
          <p className="text-sm text-slate-500">Articles d'inventaire</p>
          <button className="mt-3 text-xs text-tit-600 font-semibold hover:text-tit-700" onClick={() => onNavigate("titan")}>Voir l'inventaire →</button>
        </div>

        {/* Card 3: Stock alerts from real notifications */}
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <i className="fas fa-exclamation-triangle text-xl"></i>
            </div>
            {stockAlerts > 0 ? (
              <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                {stockAlerts} alertes
              </span>
            ) : (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                ✓ OK
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-800">{stockAlerts}</p>
          <p className="text-sm text-slate-500">Alertes de stock</p>
        </div>

        {/* Card 4: Remaining balance (invoices) */}
        <div className="bg-white rounded-2xl p-6 card-hover border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <i className="fas fa-coins text-xl"></i>
            </div>
            {invoices.filter(i => i.invoice_status === "open").length > 0 ? (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                {invoices.filter(i => i.invoice_status === "open").length} facture(s)
              </span>
            ) : (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                ✓ Soldé
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-slate-800">{formatAr(remainingBalance)}</p>
          <p className="text-sm text-slate-500">Reste à payer (échéances)</p>
        </div>
      </div>

      {/* Activity chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Activité des 7 derniers jours</h3>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 rounded-full bg-hah-500"></span> Hahitantsoa</span>
              <span className="flex items-center gap-1 text-xs text-slate-500"><span className="w-3 h-3 rounded-full bg-tit-500"></span> Titan</span>
            </div>
          </div>
          {activityTotal === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <i className="fas fa-chart-bar text-3xl mb-3"></i>
                <p className="text-sm">Aucune activité sur les 7 derniers jours</p>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-2">
              {activityDays.map((day, i) => (
                <div key={day.toISOString()} className="flex-1 flex flex-col gap-1 justify-end h-full">
                  <div
                    className="w-full bg-tit-500 rounded-t-lg opacity-80"
                    style={{ height: `${(titanActivity[i] / activityMax) * 100}%` }}
                    title={`${titanActivity[i]} réservation(s) Titan`}
                  ></div>
                  <div
                    className="w-full bg-hah-500 rounded-t-lg"
                    style={{ height: `${(hahActivity[i] / activityMax) * 100}%` }}
                    title={`${hahActivity[i]} événement(s) Hahitantsoa`}
                  ></div>
                  <p className={`text-center text-xs mt-2 ${isSameDay(day, today) ? "text-slate-700 font-semibold" : "text-slate-400"}`}>
                    {dayLabel(day, today)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="font-bold text-slate-800 mb-4">Alertes & Notifications</h3>
          <div className="space-y-3">
            {notifications.length === 0 && (
              <div className="flex gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                <i className="fas fa-check-circle text-green-500 mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-green-800">Tout est en ordre</p>
                  <p className="text-xs text-green-600">Aucune alerte en cours</p>
                </div>
              </div>
            )}
            {notifications.slice(0, 5).map((notif) => (
              <div
                key={notif.id}
                className={`flex gap-3 p-3 rounded-xl cursor-pointer transition ${notificationBgClass(notif.severity)}`}
                onClick={() => {
                  if (notif.link) {
                    onNavigate(notif.link);
                  }
                }}
              >
                <i className={notificationIconClass(notif.severity)}></i>
                <div>
                  <p className={`text-sm font-semibold ${notificationTextClass(notif.severity)}`}>{notif.title}</p>
                  <p className={`text-xs ${notificationSubTextClass(notif.severity)}`}>{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming events (next 7 days) */}
      <UpcomingEventsPanel onNavigate={onNavigate} />

      {/* Dossiers en cours table */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="font-bold text-slate-800 mb-4">Dossiers en cours</h3>
        <div className="overflow-x-auto">
          {drafts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <i className="fas fa-folder-open text-3xl mb-3"></i>
              <p className="text-sm">Aucun dossier en cours</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left rounded-l-lg">Client</th>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-left">Date événement</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Articles</th>
                  <th className="px-4 py-3 text-left rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.slice(0, 10).map((draft) => (
                  <tr
                    key={draft.id}
                    className="hover:bg-slate-50 transition cursor-pointer"
                    onClick={() => onNavigate("reservation-detail", draft.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{draft.customer_display_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{draft.public_reference}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateFr(draft.start_at)}</td>
                    <td className="px-4 py-3">
                      {draft.status === "confirmed" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Confirmé</span>
                      )}
                      {draft.status === "draft" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Proforma</span>
                      )}
                      {draft.status === "cancelled" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">Annulé</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{draft.lines.length} article(s)</td>
                    <td className="px-4 py-3">
                      <button className="text-hah-600 hover:text-hah-700 text-xs font-semibold">Voir dossier →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
