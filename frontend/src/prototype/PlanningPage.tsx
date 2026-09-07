import React, { useCallback, useEffect, useMemo, useState } from "react";

import { AvailabilityDatePicker, AvailabilityInspectorModal } from "../components";
import { DraftConflictResolutionModal } from "./DraftConflictResolutionModal";
import {
  cancelVisitAppointment,
  completeVisitAppointment,
  createCustomer,
  createVisitAppointment,
  getCustomers,
  getHahitantsoaEventDrafts,
  getLogisticsEvents,
  getReservationDrafts,
  getTitanClosedDays,
  getVisitAppointments,
  getVisitResponsibles,
  updateVisitAppointment,
} from "../api";
import type {
  Customer,
  HahitantsoaEventDraft,
  LogisticsEvent,
  ReservationDraft,
  TitanClosedDay,
  VisitAppointment,
  VisitAppointmentPayload,
  VisitReason,
  VisitResponsible,
} from "../types";

interface PlanningPageProps {
  onNavigate?: (scope: any, param?: string) => void;
}

export type PlanningCategory =
  | "hahitantsoa"
  | "titan"
  | "logistics"
  | "visit"
  | "payment_due"
  | "closed_day";

export type ViewMode = "month" | "week" | "day" | "agenda";

export interface UnifiedPlanningEvent {
  id: string;
  category: PlanningCategory;
  title: string;
  subtitle: string;
  customerName: string;
  customerId?: string | null;
  startAt: Date;
  endAt: Date | null;
  status: string;
  statusKind: "confirmed" | "draft" | "conflict" | "scheduled" | "completed" | "cancelled" | "due" | "warning";
  location?: string;
  amountAriary?: number;
  resourceCount?: number;
  reference?: string;
  notes?: string;
  targetScope?: "reservation-detail" | "customer" | "logistics-dispatch" | "agenda-visitors";
  targetParam?: string;
  isOngoing?: boolean;
  isConflicted?: boolean;
  conflictingWith?: string;
  conflictingWithEventName?: string;
  raw: any;
}

type ItemsState =
  | { status: "loading" }
  | { status: "loaded"; events: UnifiedPlanningEvent[] }
  | { status: "error"; message: string };

const DAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const CATEGORY_CONFIG: Record<
  PlanningCategory,
  { label: string; icon: string; bgBadge: string; textBadge: string; borderBadge: string; cardAccent: string; chipBg: string; chipText: string }
> = {
  hahitantsoa: {
    label: "Hahitantsoa",
    icon: "fa-champagne-glasses",
    bgBadge: "bg-indigo-50 dark:bg-indigo-950/40",
    textBadge: "text-indigo-700 dark:text-indigo-300",
    borderBadge: "border-indigo-200 dark:border-indigo-800",
    cardAccent: "border-l-indigo-500",
    chipBg: "bg-indigo-500",
    chipText: "text-white",
  },
  titan: {
    label: "Titan Location",
    icon: "fa-boxes-stacked",
    bgBadge: "bg-sky-50 dark:bg-sky-950/40",
    textBadge: "text-sky-700 dark:text-sky-300",
    borderBadge: "border-sky-200 dark:border-sky-800",
    cardAccent: "border-l-sky-500",
    chipBg: "bg-sky-500",
    chipText: "text-white",
  },
  logistics: {
    label: "Logistique",
    icon: "fa-truck-fast",
    bgBadge: "bg-amber-50 dark:bg-amber-950/40",
    textBadge: "text-amber-800 dark:text-amber-300",
    borderBadge: "border-amber-200 dark:border-amber-800",
    cardAccent: "border-l-amber-500",
    chipBg: "bg-amber-500",
    chipText: "text-white",
  },
  visit: {
    label: "Visites & RDV",
    icon: "fa-handshake",
    bgBadge: "bg-emerald-50 dark:bg-emerald-950/40",
    textBadge: "text-emerald-700 dark:text-emerald-300",
    borderBadge: "border-emerald-200 dark:border-emerald-800",
    cardAccent: "border-l-emerald-500",
    chipBg: "bg-emerald-500",
    chipText: "text-white",
  },
  payment_due: {
    label: "Échéances",
    icon: "fa-credit-card",
    bgBadge: "bg-rose-50 dark:bg-rose-950/40",
    textBadge: "text-rose-700 dark:text-rose-300",
    borderBadge: "border-rose-200 dark:border-rose-800",
    cardAccent: "border-l-rose-500",
    chipBg: "bg-rose-500",
    chipText: "text-white",
  },
  closed_day: {
    label: "Fermeture",
    icon: "fa-building-circle-xmark",
    bgBadge: "bg-slate-100 dark:bg-slate-800",
    textBadge: "text-slate-600 dark:text-slate-400",
    borderBadge: "border-slate-200 dark:border-slate-700",
    cardAccent: "border-l-slate-400",
    chipBg: "bg-slate-500",
    chipText: "text-white",
  },
};

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

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatAriary(amount: number): string {
  return new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 }).format(amount) + " Ar";
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
  return `${hours}h${minutes > 0 ? minutes : ""}`;
}

function formatDayDate(monday: Date, dayIndex: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isEventOnDay(event: UnifiedPlanningEvent, day: Date): boolean {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const evStart = event.startAt;
  const evEnd = event.endAt ?? event.startAt;

  return evStart <= dayEnd && evEnd >= dayStart;
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

function visitPlanningStatus(status: VisitAppointment["status"]): string {
  if (status === "completed") return "Terminée";
  if (status === "cancelled") return "Annulée";
  return "Planifiée";
}

function formatReason(reason: VisitReason): string {
  if (reason === "prospect") return "Visite prospect";
  if (reason === "other") return "Autre visite";
  return "Simple visite";
}

function statusBadgeClasses(statusKind: UnifiedPlanningEvent["statusKind"]): string {
  switch (statusKind) {
    case "confirmed":
    case "completed":
      return "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold";
    case "conflict":
      return "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 font-black animate-pulse";
    case "due":
    case "warning":
      return "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "cancelled":
      return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    case "draft":
    case "scheduled":
    default:
      return "bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 border-dashed";
  }
}

function getEventCardClass(event: UnifiedPlanningEvent): string {
  if (event.statusKind === "conflict") {
    return "bg-rose-50/90 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 border-l-4 border-l-rose-600 shadow-xs hover:border-rose-500";
  }
  if (event.statusKind === "confirmed") {
    return "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 border-l-4 border-l-emerald-600 shadow-xs hover:border-emerald-500";
  }
  if (event.statusKind === "draft") {
    return "bg-amber-50/30 dark:bg-amber-950/20 border-dashed border-amber-300 dark:border-amber-700 border-l-4 border-l-amber-400 hover:bg-amber-50/60";
  }
  const cfg = CATEGORY_CONFIG[event.category];
  return `bg-slate-50/50 dark:bg-slate-800/40 border-l-4 ${cfg.cardAccent} ${cfg.borderBadge}`;
}

function getMonthChipStyle(event: UnifiedPlanningEvent): { chipBg: string; chipText: string; border: string; icon: string } {
  if (event.statusKind === "conflict") {
    return {
      chipBg: "bg-rose-600 dark:bg-rose-700",
      chipText: "text-white font-black",
      border: "border-rose-700 dark:border-rose-500",
      icon: "fa-triangle-exclamation text-rose-200",
    };
  }
  if (event.statusKind === "confirmed") {
    return {
      chipBg: "bg-emerald-600 dark:bg-emerald-700",
      chipText: "text-white font-bold",
      border: "border-emerald-700 dark:border-emerald-500",
      icon: "fa-circle-check text-emerald-200",
    };
  }
  if (event.statusKind === "draft") {
    return {
      chipBg: "bg-amber-100 dark:bg-amber-950/80",
      chipText: "text-amber-900 dark:text-amber-200 font-medium",
      border: "border border-dashed border-amber-400 dark:border-amber-600",
      icon: "fa-file-lines text-amber-600 dark:text-amber-400",
    };
  }
  const cfg = CATEGORY_CONFIG[event.category];
  return {
    chipBg: cfg.chipBg,
    chipText: cfg.chipText,
    border: `border ${cfg.borderBadge}`,
    icon: cfg.icon,
  };
}

export default function PlanningPage({ onNavigate }: PlanningPageProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [categoryFilter, setCategoryFilter] = useState<PlanningCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsState, setItemsState] = useState<ItemsState>({ status: "loading" });
  const [selectedEvent, setSelectedEvent] = useState<UnifiedPlanningEvent | null>(null);
  const [conflictEventToResolve, setConflictEventToResolve] = useState<UnifiedPlanningEvent | null>(null);
  const [conflictModalInitialTab, setConflictModalInitialTab] = useState<"reschedule" | "waitlist" | "cancel">("reschedule");

  const handleOpenConflictModal = useCallback((event: UnifiedPlanningEvent, tab: "reschedule" | "waitlist" | "cancel" = "reschedule") => {
    setConflictModalInitialTab(tab);
    setConflictEventToResolve(event);
  }, []);

  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [isAvailabilityInspectorOpen, setIsAvailabilityInspectorOpen] = useState(false);
  const [quickVisitDate, setQuickVisitDate] = useState<string>("");
  const [quickVisitTime, setQuickVisitTime] = useState<string>("10:00");

  const monday = useMemo(() => getMonday(currentDate), [currentDate]);

  const loadData = useCallback(async () => {
    setItemsState({ status: "loading" });
    try {
      const [
        reservationDrafts,
        eventDrafts,
        visits,
        logistics,
        closedDays,
      ] = await Promise.all([
        getReservationDrafts().catch(() => [] as ReservationDraft[]),
        getHahitantsoaEventDrafts().catch(() => [] as HahitantsoaEventDraft[]),
        getVisitAppointments().catch(() => [] as VisitAppointment[]),
        getLogisticsEvents().catch(() => [] as LogisticsEvent[]),
        getTitanClosedDays().catch(() => [] as TitanClosedDay[]),
      ]);

      const events: UnifiedPlanningEvent[] = [];

      for (const draft of reservationDrafts) {
        const startAt = new Date(draft.start_at);
        const endAt = new Date(draft.end_at);
        const statusLabel = planningStatusLabel(draft);

        events.push({
          id: draft.id,
          category: "titan",
          title: draft.public_reference,
          subtitle: `${draft.lines?.length ?? 0} article(s) réservé(s)`,
          customerName: draft.customer_display_name,
          customerId: draft.customer_id,
          startAt,
          endAt,
          status: statusLabel,
          statusKind: draft.status === "cancelled" ? "cancelled" : draft.confirmed_at ? "confirmed" : "draft",
          location: "Enlèvement magasin / Dépôt",
          resourceCount: draft.lines?.length ?? 0,
          reference: draft.public_reference,
          amountAriary: parseFloat(draft.total_amount || "0"),
          targetScope: "reservation-detail",
          targetParam: draft.id,
          isOngoing: startAt < monday,
          raw: draft,
        });

        if (draft.required_deposit_amount && !draft.required_deposit_received_at && draft.status !== "cancelled") {
          events.push({
            id: `pay-deposit-${draft.id}`,
            category: "payment_due",
            title: `Acompte réservation — ${draft.public_reference}`,
            subtitle: `Acompte matériel (${formatAriary(parseFloat(draft.required_deposit_amount))})`,
            customerName: draft.customer_display_name,
            customerId: draft.customer_id,
            startAt: draft.created_at ? new Date(draft.created_at) : startAt,
            endAt: null,
            status: "À percevoir",
            statusKind: "due",
            amountAriary: parseFloat(draft.required_deposit_amount),
            reference: draft.public_reference,
            targetScope: "reservation-detail",
            targetParam: draft.id,
            raw: draft,
          });
        }
      }

      const confirmedHahitantsoa = eventDrafts.filter((d) => d.status === "confirmed");

      for (const draft of eventDrafts) {
        const startAt = new Date(draft.start_at);
        const endAt = new Date(draft.end_at);
        let statusLabel = hahitantsoaPlanningStatus(draft.status);
        let statusKind: UnifiedPlanningEvent["statusKind"] = draft.status === "confirmed" ? "confirmed" : "draft";
        let isConflicted = false;
        let conflictingWith: string | undefined = undefined;
        let conflictingWithEventName: string | undefined = undefined;

        if (draft.status !== "confirmed") {
          const draftVenue = (draft.venue_name || "Salle principale").trim().toLowerCase();
          const overlap = confirmedHahitantsoa.find((conf) => {
            if (conf.id === draft.id) return false;
            const confVenue = (conf.venue_name || "Salle principale").trim().toLowerCase();
            const cStart = new Date(conf.start_at);
            const cEnd = new Date(conf.end_at);
            return confVenue === draftVenue && cStart < endAt && cEnd > startAt;
          });

          if (overlap) {
            isConflicted = true;
            statusKind = "conflict";
            statusLabel = "En conflit de date";
            conflictingWith = overlap.public_reference;
            conflictingWithEventName = overlap.event_name;
          } else {
            statusLabel = "Option / Devis";
          }
        } else {
          statusLabel = "✓ Confirmé (Ferme)";
        }

        events.push({
          id: draft.id,
          category: "hahitantsoa",
          title: draft.event_name || draft.public_reference,
          subtitle: draft.venue_name || draft.location_details || "Événement Hahitantsoa",
          customerName: draft.customer_display_name,
          customerId: draft.customer_id,
          startAt,
          endAt,
          status: statusLabel,
          statusKind,
          location: draft.venue_name || draft.location_details,
          resourceCount: draft.lines?.length ?? 0,
          reference: draft.public_reference,
          amountAriary: parseFloat(draft.space_rental_amount || "0"),
          targetScope: "reservation-detail",
          targetParam: `hahitantsoa:${draft.id}`,
          isOngoing: startAt < monday,
          isConflicted,
          conflictingWith,
          conflictingWithEventName,
          raw: draft,
        });

        if (draft.payment_schedule?.first_installment_due_on) {
          events.push({
            id: `pay-hah-dep-${draft.id}`,
            category: "payment_due",
            title: `Acompte — ${draft.public_reference}`,
            subtitle: `Acompte 50% attendu pour ${draft.event_name}`,
            customerName: draft.customer_display_name,
            customerId: draft.customer_id,
            startAt: new Date(draft.payment_schedule.first_installment_due_on),
            endAt: null,
            status: draft.status === "confirmed" ? "Reçu" : "En attente",
            statusKind: draft.status === "confirmed" ? "completed" : "due",
            amountAriary: parseFloat(draft.payment_schedule.first_installment_amount || draft.required_deposit_amount || "0"),
            reference: draft.public_reference,
            targetScope: "reservation-detail",
            targetParam: `hahitantsoa:${draft.id}`,
            raw: draft,
          });
        }
        if (draft.payment_schedule?.second_installment_due_on) {
          events.push({
            id: `pay-hah-bal-${draft.id}`,
            category: "payment_due",
            title: `Solde — ${draft.public_reference}`,
            subtitle: `Solde attendu pour ${draft.event_name}`,
            customerName: draft.customer_display_name,
            customerId: draft.customer_id,
            startAt: new Date(draft.payment_schedule.second_installment_due_on),
            endAt: null,
            status: "En attente",
            statusKind: "due",
            amountAriary: parseFloat(draft.payment_schedule.second_installment_amount || "0"),
            reference: draft.public_reference,
            targetScope: "reservation-detail",
            targetParam: `hahitantsoa:${draft.id}`,
            raw: draft,
          });
        }
      }

      for (const log of logistics) {
        const startAt = new Date(log.scheduled_at || log.created_at);
        const opLabel = log.operation === "outbound" ? "Sortie / Livraison" : "Retour / Réception";
        const typeLabel =
          log.event_type === "preparation"
            ? "Préparation"
            : log.event_type === "delivery"
              ? "Livraison"
              : log.event_type === "pickup"
                ? "Enlèvement / Retour"
                : "Passation";

        events.push({
          id: log.id,
          category: "logistics",
          title: `${typeLabel} — ${opLabel}`,
          subtitle: log.contact_name
            ? `${log.contact_name} • ${log.address || "Sur site"}`
            : log.address || "Dépôt central",
          customerName: log.contact_name || "Équipe logistique",
          startAt,
          endAt: log.executed_at ? new Date(log.executed_at) : null,
          status:
            log.status === "completed"
              ? "Terminée"
              : log.status === "dispatched"
                ? "Expédiée"
                : "Planifiée",
          statusKind:
            log.status === "completed"
              ? "completed"
              : log.status === "dispatched"
                ? "warning"
                : "scheduled",
          location: log.address || "Dépôt central",
          resourceCount: log.item_lines?.length ?? 0,
          notes: log.notes,
          targetScope: "logistics-dispatch",
          raw: log,
        });
      }

      for (const visit of visits) {
        const startAt = new Date(visit.scheduled_at);
        events.push({
          id: visit.id,
          category: "visit",
          title: formatReason(visit.reason),
          subtitle: `${visit.location} • Resp: ${visit.responsible_username || "Équipe"}`,
          customerName: visit.customer_display_name,
          customerId: visit.customer_id,
          startAt,
          endAt: null,
          status: visitPlanningStatus(visit.status),
          statusKind:
            visit.status === "completed"
              ? "completed"
              : visit.status === "cancelled"
                ? "cancelled"
                : "scheduled",
          location: visit.location,
          notes: visit.notes,
          targetScope: "agenda-visitors",
          raw: visit,
        });
      }

      for (const cd of closedDays) {
        const startAt = new Date(cd.date);
        events.push({
          id: cd.id,
          category: "closed_day",
          title: `Fermeture: ${cd.label || "Jour férié"}`,
          subtitle: cd.label || "Exploitation fermée",
          customerName: "Entreprise",
          startAt,
          endAt: null,
          status: "Fermé",
          statusKind: "warning",
          raw: cd,
        });
      }

      events.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      setItemsState({ status: "loaded", events });
    } catch (err: unknown) {
      setItemsState({
        status: "error",
        message: err instanceof Error ? err.message : "Échec du chargement du planning.",
      });
    }
  }, [monday]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allEvents = useMemo(
    () => (itemsState.status === "loaded" ? itemsState.events : []),
    [itemsState],
  );

  const filteredEvents = useMemo(() => {
    let result = allEvents;

    if (categoryFilter !== "all") {
      result = result.filter((e) => e.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter((e) => {
        if (statusFilter === "confirmed") return e.statusKind === "confirmed" || e.statusKind === "completed";
        if (statusFilter === "draft") return e.statusKind === "draft";
        if (statusFilter === "conflict") return e.statusKind === "conflict";
        if (statusFilter === "due") return e.statusKind === "due" || e.statusKind === "warning";
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle.toLowerCase().includes(q) ||
          e.customerName.toLowerCase().includes(q) ||
          (e.reference && e.reference.toLowerCase().includes(q)) ||
          (e.location && e.location.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [allEvents, categoryFilter, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      all: allEvents.length,
      confirmed: allEvents.filter((e) => e.statusKind === "confirmed" || e.statusKind === "completed").length,
      draft: allEvents.filter((e) => e.statusKind === "draft").length,
      conflict: allEvents.filter((e) => e.statusKind === "conflict").length,
    };
  }, [allEvents]);

  const kpis = useMemo(() => {
    const today = new Date();
    const todayEvents = allEvents.filter((e) => isEventOnDay(e, today));
    const logisticsCount = allEvents.filter((e) => e.category === "logistics").length;
    const visitsCount = allEvents.filter((e) => e.category === "visit").length;
    const totalPaymentsDue = allEvents
      .filter((e) => e.category === "payment_due")
      .reduce((sum, e) => sum + (e.amountAriary || 0), 0);

    return {
      todayCount: todayEvents.length,
      logisticsCount,
      visitsCount,
      totalPaymentsDue,
    };
  }, [allEvents]);

  const dateRangeLabel = useMemo(() => {
    if (viewMode === "month") {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return `Semaine du ${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  }, [currentDate, monday, viewMode]);

  const handlePrev = () => {
    if (viewMode === "month") setCurrentDate((d) => addMonths(d, -1));
    else if (viewMode === "day")
      setCurrentDate((d) => {
        const nd = new Date(d);
        nd.setDate(nd.getDate() - 1);
        return nd;
      });
    else setCurrentDate((d) => addWeeks(d, -1));
  };

  const handleNext = () => {
    if (viewMode === "month") setCurrentDate((d) => addMonths(d, 1));
    else if (viewMode === "day")
      setCurrentDate((d) => {
        const nd = new Date(d);
        nd.setDate(nd.getDate() + 1);
        return nd;
      });
    else setCurrentDate((d) => addWeeks(d, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleEventClick = (event: UnifiedPlanningEvent) => {
    setSelectedEvent(event);
  };

  const handleNavigateToEvent = (event: UnifiedPlanningEvent) => {
    if (!onNavigate) return;
    if (event.targetScope === "reservation-detail" && event.targetParam) {
      onNavigate("reservation-detail", event.targetParam);
    } else if (event.targetScope) {
      onNavigate(event.targetScope, event.targetParam);
    }
  };

  const openNewVisitModal = (date?: string, time?: string) => {
    if (date) setQuickVisitDate(date);
    else setQuickVisitDate(new Date().toISOString().slice(0, 10));
    if (time) setQuickVisitTime(time);
    else setQuickVisitTime("10:00");
    setIsVisitModalOpen(true);
  };

  return (
    <div className="page active space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Top Banner / Hero Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
              <i className="fa-solid fa-calendar-days text-xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Planning & Agenda Général
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Vue Entreprise
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Visualisation consolidée des événements, locations, logistique, visites et échéances financières
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAvailabilityInspectorOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <i className="fa-solid fa-calendar-check"></i>
            <span>Disponibilité & Stocks</span>
          </button>
          <button
            type="button"
            onClick={() => openNewVisitModal()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
          >
            <i className="fa-solid fa-calendar-plus"></i>
            <span>+ Nouveau RDV / Visite</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate("reservations")}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-list-check"></i>
            <span>Toutes les réservations</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-base">
            <i className="fa-solid fa-bolt"></i>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.todayCount}</div>
            <div className="text-xs text-slate-500 font-medium">Actifs aujourd'hui</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base">
            <i className="fa-solid fa-truck-ramp-box"></i>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.logisticsCount}</div>
            <div className="text-xs text-slate-500 font-medium">Missions logistiques</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base">
            <i className="fa-solid fa-user-clock"></i>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{kpis.visitsCount}</div>
            <div className="text-xs text-slate-500 font-medium">Visites & RDV</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex items-center gap-3.5 hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center text-base">
            <i className="fa-solid fa-coins"></i>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-white truncate">
              {formatAriary(kpis.totalPaymentsDue)}
            </div>
            <div className="text-xs text-slate-500 font-medium">Échéances financières</div>
          </div>
        </div>
      </div>

      {/* Control Bar: Navigation, Views, Filters & Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title="Période précédente"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title="Période suivante"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
            <span className="text-base font-bold text-slate-900 dark:text-white ml-2 capitalize">
              {dateRangeLabel}
            </span>

            <div className="hidden sm:block ml-2 w-48">
              <AvailabilityDatePicker
                value={currentDate.toISOString().slice(0, 10)}
                onChange={(dateStr) => {
                  if (dateStr) {
                    const parsed = new Date(`${dateStr}T00:00:00`);
                    if (!isNaN(parsed.getTime())) {
                      setCurrentDate(parsed);
                    }
                  }
                }}
                allowPast
                placeholder="Aller au..."
                ariaLabel="Aller à une date précise"
                showShortcuts
              />
            </div>
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {(
              [
                { mode: "month", label: "Mois", icon: "fa-calendar" },
                { mode: "week", label: "Semaine", icon: "fa-calendar-week" },
                { mode: "day", label: "Jour", icon: "fa-calendar-day" },
                { mode: "agenda", label: "Flux / Agenda", icon: "fa-list-ul" },
              ] as const
            ).map((vm) => (
              <button
                key={vm.mode}
                type="button"
                onClick={() => setViewMode(vm.mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewMode === vm.mode
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <i className={`fa-solid ${vm.icon}`}></i>
                <span>{vm.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Bar (Confirmés vs Devis vs Conflits) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <i className="fa-solid fa-filter text-[10px]"></i>
              Statut :
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                statusFilter === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              Tous ({statusCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("confirmed")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === "confirmed"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <i className="fa-solid fa-circle-check text-[10px]"></i>
              <span>Confirmés fermes ({statusCounts.confirmed})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === "draft"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-100"
              }`}
            >
              <i className="fa-solid fa-file-lines text-[10px]"></i>
              <span>Devis / Options ({statusCounts.draft})</span>
            </button>
            {statusCounts.conflict > 0 && (
              <button
                type="button"
                onClick={() => setStatusFilter("conflict")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  statusFilter === "conflict"
                    ? "bg-rose-600 text-white shadow-xs animate-pulse"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 hover:bg-rose-100"
                }`}
              >
                <i className="fa-solid fa-triangle-exclamation text-[10px] text-rose-600 dark:text-rose-400"></i>
                <span>En conflit ({statusCounts.conflict})</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                categoryFilter === "all"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Toutes catégories ({allEvents.length})
            </button>

            {(
              [
                { cat: "hahitantsoa", label: "🎪 Hahitantsoa" },
                { cat: "titan", label: "📦 Titan" },
                { cat: "logistics", label: "🚚 Logistique" },
                { cat: "visit", label: "🤝 Visites" },
                { cat: "payment_due", label: "💳 Échéances" },
              ] as const
            ).map((c) => {
              const count = allEvents.filter((e) => e.category === c.cat).length;
              return (
                <button
                  key={c.cat}
                  type="button"
                  onClick={() => setCategoryFilter(c.cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    categoryFilter === c.cat
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{c.label}</span>
                  <span className="text-[10px] opacity-80">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="relative max-w-xs w-full">
            <i className="fa-solid fa-search absolute left-3 top-2.5 text-xs text-slate-400"></i>
            <input
              type="text"
              placeholder="Rechercher client, réf, lieu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {itemsState.status === "loading" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center shadow-xs">
          <i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-600 mb-4"></i>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Chargement de l'agenda et des flux de l'entreprise...
          </p>
        </div>
      )}

      {itemsState.status === "error" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <i className="fa-solid fa-circle-exclamation text-xl"></i>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Erreur lors du chargement du planning
          </h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 mb-4">{itemsState.message}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition"
          >
            Réessayer
          </button>
        </div>
      )}

      {itemsState.status === "loaded" && (
        <>
          {viewMode === "month" && (
            <MonthViewGrid
              currentDate={currentDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onResolveConflict={handleOpenConflictModal}
              onDayClick={(d) => {
                setCurrentDate(d);
                setViewMode("day");
              }}
            />
          )}

          {viewMode === "week" && (
            <WeekViewGrid
              monday={monday}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onEventClick={handleEventClick}
              onResolveConflict={handleOpenConflictModal}
              onDayClick={(d) => {
                setCurrentDate(d);
                setViewMode("day");
              }}
            />
          )}

          {viewMode === "day" && (
            <DayViewTimeline
              currentDate={currentDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onEventClick={handleEventClick}
              onResolveConflict={handleOpenConflictModal}
              onAddVisit={(time) =>
                openNewVisitModal(currentDate.toISOString().slice(0, 10), time)
              }
            />
          )}

          {viewMode === "agenda" && (
            <AgendaStreamView
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onEventClick={handleEventClick}
              onResolveConflict={handleOpenConflictModal}
            />
          )}
        </>
      )}

      {/* Slide-Over Drawer */}
      {selectedEvent && (
        <EventDetailDrawer
          event={selectedEvent}
          allEvents={allEvents}
          onClose={() => setSelectedEvent(null)}
          onRefresh={loadData}
          onNavigate={(event) => {
            setSelectedEvent(null);
            handleNavigateToEvent(event);
          }}
          onResolveConflict={(event, tab) => {
            setSelectedEvent(null);
            handleOpenConflictModal(event, tab);
          }}
        />
      )}

      {/* Conflict Resolution & Rescheduling Modal */}
      {conflictEventToResolve && (
        <DraftConflictResolutionModal
          isOpen={!!conflictEventToResolve}
          event={conflictEventToResolve}
          initialTab={conflictModalInitialTab}
          onClose={() => setConflictEventToResolve(null)}
          onResolved={async () => {
            await loadData();
          }}
        />
      )}

      {/* Add Visit Modal */}
      {isVisitModalOpen && (
        <AddVisitModal
          initialDate={quickVisitDate}
          initialTime={quickVisitTime}
          onClose={() => setIsVisitModalOpen(false)}
          onCreated={() => {
            setIsVisitModalOpen(false);
            void loadData();
          }}
        />
      )}

      {/* Availability & Stock Inspector Modal */}
      <AvailabilityInspectorModal
        isOpen={isAvailabilityInspectorOpen}
        onClose={() => setIsAvailabilityInspectorOpen(false)}
        initialDate={currentDate.toISOString().slice(0, 10)}
        onSelectDateAndNavigate={(date, domain) => {
          if (onNavigate) {
            onNavigate("reservation-new", domain || "titan");
          }
        }}
      />
    </div>
  );
}

/* ==========================================================================
   VIEW COMPONENT: MonthViewGrid
   ========================================================================== */
interface MonthViewGridProps {
  currentDate: Date;
  events: UnifiedPlanningEvent[];
  onSelectEvent: (event: UnifiedPlanningEvent) => void;
  onResolveConflict?: (event: UnifiedPlanningEvent, tab?: "reschedule" | "waitlist" | "cancel") => void;
  onDayClick: (day: Date) => void;
}

function MonthViewGrid({
  currentDate,
  events,
  onSelectEvent,
  onResolveConflict,
  onDayClick,
}: MonthViewGridProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const matrix = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startMonday = getMonday(firstDayOfMonth);
    const days: Date[] = [];
    let cur = new Date(startMonday);

    while (
      cur <= lastDayOfMonth ||
      cur.getDay() !== 1 ||
      days.length < 35
    ) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
      if (days.length >= 42) break;
    }

    return days;
  }, [year, month]);

  const today = new Date();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-center text-xs font-bold text-slate-600 dark:text-slate-300 py-3">
        {DAY_LABELS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80">
        {matrix.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const dayEvents = events.filter((e) => isEventOnDay(e, day));
          const closedEvent = dayEvents.find((e) => e.category === "closed_day");

          return (
            <div
              key={idx}
              className={`min-h-[120px] p-2 flex flex-col justify-between transition-colors ${
                isCurrentMonth
                  ? "bg-white dark:bg-slate-900"
                  : "bg-slate-50/40 dark:bg-slate-950/40 text-slate-400"
              } ${closedEvent ? "bg-rose-50/20 dark:bg-rose-950/10" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={() => onDayClick(day)}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition ${
                    isToday
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {day.getDate()}
                </button>
                {closedEvent && (
                  <span
                    className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 truncate max-w-[80px]"
                    title={closedEvent.title}
                  >
                    <i className="fa-solid fa-lock mr-1"></i>
                    Fermé
                  </span>
                )}
              </div>

              <div className="space-y-1 my-auto overflow-hidden">
                {dayEvents.slice(0, 3).map((event) => {
                  const style = getMonthChipStyle(event);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className={`w-full text-left px-2 py-1 rounded-lg text-[11px] font-medium truncate flex items-center gap-1.5 transition ${style.chipBg} ${style.chipText} ${style.border} hover:scale-[1.02] shadow-2xs`}
                      title={`${event.title} - ${event.customerName} (${event.status})`}
                    >
                      <i className={`fa-solid ${style.icon} text-[9px] opacity-90 shrink-0`}></i>
                      <span className="truncate">{event.title}</span>
                      {event.statusKind === "conflict" && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onResolveConflict) onResolveConflict(event);
                          }}
                          className="ml-auto text-[9px] bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.5 rounded font-black cursor-pointer shadow-xs shrink-0"
                          title="Arbitrer / Relocaliser ce conflit"
                        >
                          ⚡ Arbitrer
                        </span>
                      )}
                    </button>
                  );
                })}

                {dayEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onDayClick(day)}
                    className="w-full text-center text-[10px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 py-0.5"
                  >
                    +{dayEvents.length - 3} autre(s)
                  </button>
                )}
              </div>

              <div className="text-[10px] text-slate-400 text-right">
                {dayEvents.length > 0 ? `${dayEvents.length} flux` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   VIEW COMPONENT: WeekViewGrid
   ========================================================================== */
interface WeekViewGridProps {
  monday: Date;
  events: UnifiedPlanningEvent[];
  onSelectEvent: (event: UnifiedPlanningEvent) => void;
  onEventClick: (event: UnifiedPlanningEvent) => void;
  onResolveConflict?: (event: UnifiedPlanningEvent, tab?: "reschedule" | "waitlist" | "cancel") => void;
  onDayClick: (day: Date) => void;
}

function WeekViewGrid({
  monday,
  events,
  onSelectEvent,
  onEventClick,
  onResolveConflict,
  onDayClick,
}: WeekViewGridProps) {
  const today = new Date();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
      {DAY_LABELS.map((dayLabel, dayIndex) => {
        const currentDay = new Date(monday);
        currentDay.setDate(currentDay.getDate() + dayIndex);
        const isToday = isSameDay(currentDay, today);
        const dayEvents = events.filter((e) => isEventOnDay(e, currentDay));

        return (
          <div
            key={dayLabel}
            className={`bg-white dark:bg-slate-900 rounded-3xl border transition p-4 flex flex-col justify-between ${
              isToday
                ? "border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20"
                : "border-slate-100 dark:border-slate-800 shadow-xs"
            }`}
          >
            <div>
              {/* Day Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onDayClick(currentDay)}
                  className="text-left group"
                >
                  <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-indigo-600 transition">
                    {dayLabel}
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{currentDay.getDate()}</span>
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block animate-pulse"></span>
                    )}
                  </div>
                </button>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {dayEvents.length}
                </span>
              </div>

              {/* Event Cards */}
              <div className="space-y-2.5">
                {dayEvents.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800/80 rounded-2xl">
                    <p className="text-[11px] font-medium text-slate-400">Aucun flux</p>
                  </div>
                ) : (
                  dayEvents.map((event) => {
                    const cfg = CATEGORY_CONFIG[event.category];
                    return (
                      <div
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className={`rounded-2xl border p-3 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all cursor-pointer ${getEventCardClass(event)}`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${cfg.bgBadge} ${cfg.textBadge}`}
                          >
                            <i className={`fa-solid ${cfg.icon} text-[9px]`}></i>
                            <span>{cfg.label}</span>
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusBadgeClasses(event.statusKind)}`}
                          >
                            {event.status}
                          </span>
                        </div>

                        {event.statusKind === "conflict" && (
                          <div className="mb-2 space-y-1.5">
                            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[10px] font-bold flex items-center gap-1 border border-rose-300">
                              <i className="fa-solid fa-triangle-exclamation text-rose-600 shrink-0"></i>
                              <span className="truncate">Date occupée par {event.conflictingWith}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onResolveConflict) onResolveConflict(event);
                              }}
                              className="w-full py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                            >
                              <i className="fa-solid fa-arrows-split-up-and-left text-[9px]"></i>
                              <span>⚡ Arbitrer / Relocaliser</span>
                            </button>
                          </div>
                        )}

                        {/* Title button */}
                        <button
                          type="button"
                          onClick={() => onEventClick(event)}
                          className="w-full text-left font-bold text-xs text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 transition mb-1"
                        >
                          {event.title}
                        </button>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate mb-1.5">
                          <i className="fa-regular fa-user mr-1 text-[9px]"></i>
                          {event.customerName}
                        </div>

                        {event.location && (
                          <div className="text-[10px] text-slate-400 truncate mb-1">
                            <i className="fa-solid fa-location-dot mr-1 text-[9px]"></i>
                            {event.location}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px]">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {event.isOngoing ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                En cours
                              </span>
                            ) : event.category === "visit" ? (
                              formatTime(event.startAt)
                            ) : (
                              formatDuration(event.startAt, event.endAt)
                            )}
                          </span>

                          {event.amountAriary ? (
                            <span className="font-black text-rose-600 dark:text-rose-400">
                              {formatAriary(event.amountAriary)}
                            </span>
                          ) : event.resourceCount !== undefined ? (
                            <span className="text-slate-500 font-medium">
                              {event.resourceCount} art.
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDayClick(currentDay)}
              className="mt-3 w-full py-1.5 text-center text-[11px] font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Voir la journée →
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   VIEW COMPONENT: DayViewTimeline
   ========================================================================== */
interface DayViewTimelineProps {
  currentDate: Date;
  events: UnifiedPlanningEvent[];
  onSelectEvent: (event: UnifiedPlanningEvent) => void;
  onEventClick: (event: UnifiedPlanningEvent) => void;
  onResolveConflict?: (event: UnifiedPlanningEvent, tab?: "reschedule" | "waitlist" | "cancel") => void;
  onAddVisit: (time?: string) => void;
}

function DayViewTimeline({
  currentDate,
  events,
  onSelectEvent,
  onEventClick,
  onResolveConflict,
  onAddVisit,
}: DayViewTimelineProps) {
  const dayEvents = useMemo(
    () => events.filter((e) => isEventOnDay(e, currentDate)),
    [events, currentDate],
  );

  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 to 20:00

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white capitalize">
            {currentDate.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {dayEvents.length} événement(s) et flux planifiés pour cette journée
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAddVisit()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 self-start sm:self-auto"
        >
          <i className="fa-solid fa-plus"></i>
          <span>Ajouter un RDV à cette date</span>
        </button>
      </div>

      {/* Day Events Overview Banner (for all active events on this date) */}
      {dayEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <i className="fa-solid fa-layer-group text-indigo-600"></i>
            <span>Flux & Événements actifs de la journée ({dayEvents.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dayEvents.map((event) => {
              const cfg = CATEGORY_CONFIG[event.category];
              return (
                <div
                  key={event.id}
                  className={`rounded-2xl border p-3.5 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all ${getEventCardClass(event)}`}
                >
                  {event.statusKind === "conflict" && (
                    <div className="mb-2 space-y-1.5">
                      <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[10px] font-bold flex items-center gap-1 border border-rose-300">
                        <i className="fa-solid fa-triangle-exclamation text-rose-600 shrink-0"></i>
                        <span>Date déjà réservée par {event.conflictingWith}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onResolveConflict) onResolveConflict(event);
                        }}
                        className="w-full py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                      >
                        <i className="fa-solid fa-arrows-split-up-and-left text-[9px]"></i>
                        <span>⚡ Arbitrer / Relocaliser</span>
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${cfg.bgBadge} ${cfg.textBadge}`}
                    >
                      <i className={`fa-solid ${cfg.icon} text-[9px]`}></i>
                      <span>{cfg.label}</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadgeClasses(event.statusKind)}`}
                    >
                      {event.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEventClick(event)}
                    className="font-black text-xs text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left block mb-1"
                  >
                    {event.title}
                  </button>

                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate mb-1">
                    <i className="fa-regular fa-user mr-1 text-slate-400 text-[9px]"></i>
                    {event.customerName}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px]">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {event.category === "visit"
                        ? formatTime(event.startAt)
                        : formatDuration(event.startAt, event.endAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                    >
                      Détails →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hourly Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 divide-y divide-slate-100 dark:divide-slate-800">
        {hours.map((hour) => {
          const hourString = `${hour.toString().padStart(2, "0")}:00`;
          const hourEvents = dayEvents.filter((e) => {
            const h = e.startAt.getHours();
            return h === hour;
          });

          return (
            <div key={hour} className="py-4 grid grid-cols-12 gap-4 items-start group">
              <div className="col-span-2 sm:col-span-1 text-xs font-black text-slate-400 group-hover:text-indigo-600 transition pt-1">
                {hourString}
              </div>

              <div className="col-span-10 sm:col-span-11 space-y-2">
                {hourEvents.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => onAddVisit(hourString)}
                    className="w-full text-left py-2 px-3 rounded-xl border border-transparent hover:border-dashed hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-400 text-xs transition opacity-0 group-hover:opacity-100"
                  >
                    <i className="fa-solid fa-plus mr-1 text-[10px]"></i>
                    Créer un RDV ou événement à {hourString}
                  </button>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {hourEvents.map((event) => {
                      const cfg = CATEGORY_CONFIG[event.category];
                      return (
                        <div
                          key={event.id}
                          className={`rounded-2xl border p-4 bg-slate-50/60 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all border-l-4 ${cfg.cardAccent} ${cfg.borderBadge}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold ${cfg.bgBadge} ${cfg.textBadge}`}
                            >
                              <i className={`fa-solid ${cfg.icon} text-[10px]`}></i>
                              <span>{cfg.label}</span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadgeClasses(event.statusKind)}`}
                            >
                              {event.status}
                            </span>
                          </div>

                          {event.statusKind === "conflict" && (
                            <div className="mb-2 space-y-1.5">
                              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 text-[10px] font-bold flex items-center gap-1 border border-rose-300">
                                <i className="fa-solid fa-triangle-exclamation text-rose-600 shrink-0"></i>
                                <span className="truncate">Date occupée par {event.conflictingWith}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onResolveConflict) onResolveConflict(event);
                                }}
                                className="w-full py-1.5 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                              >
                                <i className="fa-solid fa-arrows-split-up-and-left text-[9px]"></i>
                                <span>⚡ Arbitrer / Relocaliser</span>
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => onEventClick(event)}
                            className="font-black text-sm text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left block mb-1"
                          >
                            {event.title}
                          </button>

                          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-2">
                            <i className="fa-regular fa-user mr-1 text-slate-400"></i>
                            {event.customerName}
                          </div>

                          {event.location && (
                            <div className="text-xs text-slate-400 mb-2">
                              <i className="fa-solid fa-location-dot mr-1"></i>
                              {event.location}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              <i className="fa-regular fa-clock mr-1 text-slate-400"></i>
                              {formatTime(event.startAt)}
                              {event.endAt ? ` — ${formatTime(event.endAt)}` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSelectEvent(event)}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                            >
                              Détails →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   VIEW COMPONENT: AgendaStreamView
   ========================================================================== */
interface AgendaStreamViewProps {
  events: UnifiedPlanningEvent[];
  onSelectEvent: (event: UnifiedPlanningEvent) => void;
  onEventClick: (event: UnifiedPlanningEvent) => void;
  onResolveConflict?: (event: UnifiedPlanningEvent, tab?: "reschedule" | "waitlist" | "cancel") => void;
}

function AgendaStreamView({
  events,
  onSelectEvent,
  onEventClick,
  onResolveConflict,
}: AgendaStreamViewProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center shadow-xs">
        <i className="fa-solid fa-calendar-xmark text-4xl text-slate-300 dark:text-slate-700 mb-3"></i>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Aucun événement dans cette sélection
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Modifiez vos filtres ou effectuez une autre recherche.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
      <div className="p-4 bg-slate-50/75 dark:bg-slate-800/50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
        <span>Flux & Événements chronologiques ({events.length})</span>
        <span>Actions directes</span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {events.map((event) => {
          const cfg = CATEGORY_CONFIG[event.category];
          return (
            <div
              key={event.id}
              className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                {/* Date Badge */}
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {MONTH_NAMES[event.startAt.getMonth()].slice(0, 3)}
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-white">
                    {event.startAt.getDate()}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold ${cfg.bgBadge} ${cfg.textBadge}`}
                    >
                      <i className={`fa-solid ${cfg.icon} text-[10px]`}></i>
                      <span>{cfg.label}</span>
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusBadgeClasses(event.statusKind)}`}
                    >
                      {event.status}
                    </span>

                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {event.category === "visit"
                        ? formatTime(event.startAt)
                        : formatDuration(event.startAt, event.endAt)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onEventClick(event)}
                    className="font-black text-base text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left transition"
                  >
                    {event.title}
                  </button>

                  <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex flex-wrap items-center gap-3">
                    <span>
                      <i className="fa-regular fa-user mr-1 text-slate-400"></i>
                      {event.customerName}
                    </span>

                    {event.location && (
                      <span>
                        <i className="fa-solid fa-location-dot mr-1 text-slate-400"></i>
                        {event.location}
                      </span>
                    )}

                    {event.resourceCount !== undefined && event.resourceCount > 0 && (
                      <span>
                        <i className="fa-solid fa-boxes-stacked mr-1 text-slate-400"></i>
                        {event.resourceCount} articles
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                {event.amountAriary ? (
                  <div className="text-right mr-2">
                    <div className="text-xs text-slate-400 font-medium">Montant</div>
                    <div className="text-sm font-black text-rose-600 dark:text-rose-400">
                      {formatAriary(event.amountAriary)}
                    </div>
                  </div>
                ) : null}

                {event.statusKind === "conflict" && (
                  <button
                    type="button"
                    onClick={() => onResolveConflict && onResolveConflict(event)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-arrows-split-up-and-left text-[10px]"></i>
                    <span>⚡ Arbitrer</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition shadow-2xs"
                >
                  Détails
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ==========================================================================
   DRAWER COMPONENT: EventDetailDrawer (Slide-Over Panel)
   ========================================================================== */
interface EventDetailDrawerProps {
  event: UnifiedPlanningEvent;
  allEvents?: UnifiedPlanningEvent[];
  onClose: () => void;
  onNavigate: (event: UnifiedPlanningEvent) => void;
  onRefresh?: () => void | Promise<void>;
  onResolveConflict?: (event: UnifiedPlanningEvent, tab?: "reschedule" | "waitlist" | "cancel") => void;
}

function EventDetailDrawer({
  event,
  allEvents,
  onClose,
  onNavigate,
  onRefresh,
  onResolveConflict,
}: EventDetailDrawerProps) {
  const cfg = CATEGORY_CONFIG[event.category];
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const competingDrafts = useMemo(() => {
    if (event.statusKind !== "confirmed" || !allEvents) return [];
    const eventVenue = (event.location || "Salle principale").trim().toLowerCase();
    const eventStart = event.startAt;
    const eventEnd = event.endAt || event.startAt;
    return allEvents.filter((e) => {
      if (e.id === event.id || e.statusKind === "confirmed") return false;
      const venue = (e.location || "Salle principale").trim().toLowerCase();
      const s = e.startAt;
      const end = e.endAt || e.startAt;
      return venue === eventVenue && s < eventEnd && end > eventStart;
    });
  }, [event, allEvents]);

  // Edit visit state
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(() => {
    return event.startAt.toISOString().slice(0, 10);
  });
  const [editTime, setEditTime] = useState(() => {
    const hours = String(event.startAt.getHours()).padStart(2, "0");
    const mins = String(event.startAt.getMinutes()).padStart(2, "0");
    return `${hours}:${mins}`;
  });
  const [editLocation, setEditLocation] = useState(event.location || "Local de l'entreprise");
  const [editNotes, setEditNotes] = useState(event.notes || "");
  const [editResponsibleId, setEditResponsibleId] = useState("");
  const [responsibles, setResponsibles] = useState<VisitResponsible[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (event.category === "visit") {
      void getVisitResponsibles()
        .then((data) => {
          setResponsibles(data);
          if (event.raw?.responsible_id) {
            setEditResponsibleId(event.raw.responsible_id);
          } else if (data.length > 0) {
            setEditResponsibleId(data[0].id);
          }
        })
        .catch(() => {});
    }
  }, [event]);

  const handleCompleteVisit = async () => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      await completeVisitAppointment(event.id);
      await onRefresh?.();
      onClose();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erreur lors de la validation du rendez-vous.",
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancelVisit = async () => {
    setIsActionLoading(true);
    setActionError(null);
    try {
      await cancelVisitAppointment(event.id);
      await onRefresh?.();
      onClose();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erreur lors de l'annulation du rendez-vous.",
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionLoading(true);
    setActionError(null);
    try {
      const scheduled_at = `${editDate}T${editTime}:00`;
      await updateVisitAppointment(event.id, {
        scheduled_at,
        location: editLocation,
        notes: editNotes,
        responsible_id: editResponsibleId || undefined,
      });
      await onRefresh?.();
      setIsEditing(false);
      onClose();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Erreur lors de la mise à jour du rendez-vous.",
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold ${cfg.bgBadge} ${cfg.textBadge}`}
              >
                <i className={`fa-solid ${cfg.icon}`}></i>
                <span>{cfg.label}</span>
              </span>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 flex items-center justify-center transition"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {event.title}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">{event.subtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadgeClasses(event.statusKind)}`}
              >
                {event.status}
              </span>
              {event.reference && (
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {event.reference}
                </span>
              )}
            </div>
          </div>

          {/* Body content */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {event.statusKind === "conflict" && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 space-y-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-900 dark:text-rose-200">
                      Conflit de disponibilité de salle & date
                    </h4>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                      Ce devis pour <strong>{event.customerName}</strong> chevauche la réservation confirmée <strong>{event.conflictingWith || "Dossier Ferme"}</strong>. Il ne peut pas être confirmé à cette date.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onResolveConflict) onResolveConflict(event, "reschedule");
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-calendar-day"></i>
                    <span>Relocaliser / Reporter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onResolveConflict) onResolveConflict(event, "waitlist");
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-hourglass-half"></i>
                    <span>Mettre en attente</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onResolveConflict) onResolveConflict(event, "cancel");
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 shadow-xs flex items-center gap-1.5 transition"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    <span>Supprimer le devis</span>
                  </button>
                </div>
              </div>
            )}

            {competingDrafts.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 space-y-2.5 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <i className="fa-solid fa-circle-info"></i>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-900 dark:text-amber-200">
                      Devis concurrents en attente d'arbitrage
                    </h4>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                      {competingDrafts.length} devis ont été simulés sur cette même salle et date :
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  {competingDrafts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900 text-xs">
                      <div className="truncate">
                        <span className="font-bold text-slate-900 dark:text-white">{d.title}</span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1 text-[11px]">({d.customerName})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onResolveConflict && onResolveConflict(d)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold shadow-xs shrink-0 flex items-center gap-1"
                      >
                        <i className="fa-solid fa-arrows-split-up-and-left text-[9px]"></i>
                        <span>Arbitrer</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                <i className="fa-solid fa-circle-exclamation mr-1.5"></i>
                {actionError}
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <i className="fa-solid fa-pen-to-square mr-1.5"></i>
                  Modifier le rendez-vous
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <AvailabilityDatePicker
                      id="edit-visit-date"
                      label="Date"
                      required
                      value={editDate}
                      onChange={(val) => setEditDate(val)}
                      allowPast
                      showShortcuts
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-visit-time" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Heure *
                    </label>
                    <input
                      id="edit-visit-time"
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-visit-resp" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Responsable
                  </label>
                  <select
                    id="edit-visit-resp"
                    value={editResponsibleId}
                    onChange={(e) => setEditResponsibleId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    {responsibles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.display_name || r.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-visit-loc" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Lieu du RDV
                  </label>
                  <input
                    id="edit-visit-loc"
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-visit-notes" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Notes & Remarques
                  </label>
                  <textarea
                    id="edit-visit-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isActionLoading}
                    className="flex-1 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isActionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                    <span>Enregistrer</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Dates & Times */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    <i className="fa-regular fa-clock mr-1.5"></i>
                    Date et horaires
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Début :</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {event.startAt.toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        à {formatTime(event.startAt)}
                      </span>
                    </div>
                    {event.endAt && (
                      <div>
                        <span className="text-slate-400 block text-[11px]">Fin :</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {event.endAt.toLocaleDateString("fr-FR", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          à {formatTime(event.endAt)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Client / Interlocuteur */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    <i className="fa-regular fa-user mr-1.5"></i>
                    Client / Interlocuteur
                  </h3>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {event.customerName}
                  </div>
                </div>

                {/* Lieu */}
                {event.location && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      <i className="fa-solid fa-location-dot mr-1.5"></i>
                      Lieu / Emplacement
                    </h3>
                    <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {event.location}
                    </div>
                  </div>
                )}

                {/* Finances */}
                {event.amountAriary !== undefined && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      <i className="fa-solid fa-coins mr-1.5"></i>
                      Montant concerné
                    </h3>
                    <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                      {formatAriary(event.amountAriary)}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {event.notes && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      <i className="fa-regular fa-note-sticky mr-1.5"></i>
                      Observations & Notes
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {event.notes}
                    </p>
                  </div>
                )}

                {/* Direct Visit Actions */}
                {event.category === "visit" && (
                  <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                      <span><i className="fa-solid fa-list-check mr-1.5"></i>Actions sur le rendez-vous</span>
                    </h3>

                    {event.statusKind === "scheduled" && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={isActionLoading}
                          onClick={handleCompleteVisit}
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                        >
                          {isActionLoading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-circle-check"></i>}
                          <span>Marquer comme terminée</span>
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => setIsEditing(true)}
                            className="py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-pen-to-square text-indigo-600"></i>
                            <span>Modifier</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={handleCancelVisit}
                            className="py-2 px-3 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <i className="fa-solid fa-ban"></i>
                            <span>Annuler RDV</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {event.statusKind === "completed" && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                        <i className="fa-solid fa-circle-check text-emerald-600 text-base"></i>
                        <span>Ce rendez-vous a été honoré et marqué comme terminé.</span>
                      </div>
                    )}

                    {event.statusKind === "cancelled" && (
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold flex items-center gap-2">
                        <i className="fa-solid fa-ban text-slate-500 text-base"></i>
                        <span>Ce rendez-vous a été annulé.</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Fermer
            </button>

            {event.category === "visit" && event.customerId ? (
              <button
                type="button"
                onClick={() => onNavigate({ ...event, targetScope: "customer", targetParam: event.customerId! })}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-2"
              >
                <span>Fiche client</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            ) : event.targetParam ? (
              <button
                type="button"
                onClick={() => onNavigate(event)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm flex items-center gap-2"
              >
                <span>Accéder au dossier</span>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   MODAL COMPONENT: AddVisitModal (Quick appointment creation)
   ========================================================================== */
interface AddVisitModalProps {
  initialDate: string;
  initialTime: string;
  onClose: () => void;
  onCreated: () => void;
}

function AddVisitModal({
  initialDate,
  initialTime,
  onClose,
  onCreated,
}: AddVisitModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [responsibles, setResponsibles] = useState<VisitResponsible[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Mode: existing customer search vs new prospect express
  const [contactMode, setContactMode] = useState<"existing" | "new_prospect">("existing");

  // Existing customer search
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // New prospect fields
  const [prospectName, setProspectName] = useState("");
  const [prospectPhone, setProspectPhone] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectPartyType, setProspectPartyType] = useState<"individual" | "company">("individual");

  // Common visit fields
  const [reason, setReason] = useState<VisitReason>("simple_visit");
  const [dateStr, setDateStr] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [timeStr, setTimeStr] = useState(initialTime || "10:00");
  const [responsibleId, setResponsibleId] = useState("");
  const [location, setLocation] = useState("Local de l'entreprise");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [custs, resps] = await Promise.all([
          getCustomers().catch(() => [] as Customer[]),
          getVisitResponsibles().catch(() => [] as VisitResponsible[]),
        ]);
        if (!active) return;
        setCustomers(custs.filter((c) => c.is_active !== false && !c.is_deleted));
        setResponsibles(resps);
        if (resps.length > 0) {
          setResponsibleId(resps[0].id);
        }
      } finally {
        if (active) setLoadingInitial(false);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => {
        const name = (c.display_name || c.representative_name || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, 8);
  }, [customers, customerSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let targetCustomerId = "";

      if (contactMode === "new_prospect") {
        if (!prospectName.trim()) {
          setError("Veuillez renseigner le nom complet du prospect.");
          setSubmitting(false);
          return;
        }
        if (!prospectPhone.trim()) {
          setError("Veuillez renseigner un numéro de téléphone de contact.");
          setSubmitting(false);
          return;
        }

        const newCust = await createCustomer({
          display_name: prospectName.trim(),
          phone: prospectPhone.trim() || undefined,
          email: prospectEmail.trim() || undefined,
          party_type: prospectPartyType,
          lifecycle_status: "prospect",
        });
        targetCustomerId = newCust.id;
      } else {
        if (!selectedCustomer) {
          setError("Veuillez rechercher et sélectionner un client ou créer un nouveau prospect.");
          setSubmitting(false);
          return;
        }
        targetCustomerId = selectedCustomer.id;
      }

      const scheduled_at = `${dateStr}T${timeStr}:00`;
      const payload: VisitAppointmentPayload = {
        customer_id: targetCustomerId,
        reason,
        scheduled_at,
        responsible_id: responsibleId,
        location,
        notes,
      };

      await createVisitAppointment(payload);
      onCreated();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création du rendez-vous.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 flex items-center justify-center">
              <i className="fa-solid fa-calendar-plus text-base"></i>
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Nouveau Rendez-vous / Visite
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Planification rapide sur l'agenda de l'entreprise
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            <i className="fa-solid fa-circle-exclamation mr-1.5"></i>
            {error}
          </div>
        )}

        {loadingInitial ? (
          <div className="py-12 text-center text-slate-400">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-indigo-600 mb-2"></i>
            <p className="text-xs">Chargement des données clients et référents...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Contact Mode Switcher */}
            <div>
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setContactMode("existing");
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    contactMode === "existing"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-magnifying-glass text-[11px]"></i>
                  <span>Client existant</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactMode("new_prospect");
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    contactMode === "new_prospect"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <i className="fa-solid fa-user-plus text-[11px]"></i>
                  <span>+ Nouveau Prospect</span>
                </button>
              </div>
            </div>

            {/* Mode: Existing Customer Search */}
            {contactMode === "existing" && (
              <div className="space-y-2">
                <label
                  htmlFor="visit-customer-search"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Sélectionner le Client / Prospect *
                </label>

                {selectedCustomer ? (
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {selectedCustomer.display_name?.slice(0, 2).toUpperCase() || "CL"}
                      </div>
                      <div className="overflow-hidden">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate flex items-center gap-2">
                          <span>{selectedCustomer.display_name}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              selectedCustomer.lifecycle_status === "client"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {selectedCustomer.lifecycle_status === "client"
                              ? "Client"
                              : "Prospect"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {selectedCustomer.phone && <span className="mr-2">📞 {selectedCustomer.phone}</span>}
                          {selectedCustomer.email && <span>✉️ {selectedCustomer.email}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
                    >
                      <i className="fa-solid fa-xmark mr-1"></i>Changer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-xs text-slate-400"></i>
                      <input
                        id="visit-customer-search"
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Rechercher par nom, téléphone, e-mail..."
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-4 text-center space-y-2">
                          <p className="text-xs text-slate-400 font-medium">
                            Aucun contact trouvé pour "{customerSearch}".
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setContactMode("new_prospect");
                              setProspectName(customerSearch);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition"
                          >
                            <i className="fa-solid fa-user-plus mr-1.5"></i>
                            Créer comme nouveau prospect
                          </button>
                        </div>
                      ) : (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch("");
                            }}
                            className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 transition"
                          >
                            <div className="overflow-hidden">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {c.display_name || c.representative_name || c.email || c.phone}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {c.phone && <span className="mr-2">📞 {c.phone}</span>}
                                {c.email && <span>✉️ {c.email}</span>}
                              </div>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                c.lifecycle_status === "client"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              }`}
                            >
                              {c.lifecycle_status === "client" ? "Client" : "Prospect"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode: New Prospect Express */}
            {contactMode === "new_prospect" && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-user-plus text-indigo-600"></i>
                    Fiche Prospect Express
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                    Enregistrement automatique
                  </span>
                </div>

                <div>
                  <label htmlFor="prospect-name" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nom complet / Raison sociale *
                  </label>
                  <input
                    id="prospect-name"
                    type="text"
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    required
                    placeholder="Ex: Famille Rakoto, Société Madagascar Events..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="prospect-phone" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Téléphone mobile *
                    </label>
                    <input
                      id="prospect-phone"
                      type="tel"
                      value={prospectPhone}
                      onChange={(e) => setProspectPhone(e.target.value)}
                      required
                      placeholder="Ex: 034 00 000 00"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="prospect-email" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email (optionnel)
                    </label>
                    <input
                      id="prospect-email"
                      type="email"
                      value={prospectEmail}
                      onChange={(e) => setProspectEmail(e.target.value)}
                      placeholder="Ex: contact@email.mg"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="prospect-party-type" className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Typologie de prospect
                  </label>
                  <select
                    id="prospect-party-type"
                    value={prospectPartyType}
                    onChange={(e) => setProspectPartyType(e.target.value as "individual" | "company")}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="individual">Particulier (Mariage, Fête, Anniversaire...)</option>
                    <option value="company">Entreprise / Institution / Professionnel</option>
                  </select>
                </div>
              </div>
            )}

            {/* Visit Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="visit-reason"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Motif de visite
                </label>
                <select
                  id="visit-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as VisitReason)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="simple_visit">Simple visite de repérage</option>
                  <option value="prospect">Rendez-vous prospect commercial</option>
                  <option value="other">Autre rendez-vous</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="visit-responsible"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Responsable assigné
                </label>
                <select
                  id="visit-responsible"
                  value={responsibleId}
                  onChange={(e) => setResponsibleId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                >
                  {responsibles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.display_name || r.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <AvailabilityDatePicker
                  id="visit-date"
                  label="Date"
                  required
                  value={dateStr}
                  onChange={(val) => setDateStr(val)}
                  allowPast
                  showShortcuts
                />
              </div>

              <div>
                <label
                  htmlFor="visit-time"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Heure
                </label>
                <input
                  id="visit-time"
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="visit-location"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Lieu du RDV
              </label>
              <input
                id="visit-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Local de l'entreprise, Salle principale, Chez le client..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="visit-notes"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                Notes & Remarques
              </label>
              <textarea
                id="visit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Détails complémentaires sur le rendez-vous..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-xs flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i>
                    <span>{contactMode === "new_prospect" ? "Créer prospect & RDV" : "Créer le RDV"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
