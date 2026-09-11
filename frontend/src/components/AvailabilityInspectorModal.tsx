import React, { useEffect, useMemo, useState } from "react";

import {
  getHahitantsoaEventDrafts,
  getHahitantsoaVenueOccupancy,
  getInventoryItems,
  getReservationAvailableItemPreviews,
  getReservationDrafts,
  getTitanClosedDays,
} from "../api";
import type {
  HahitantsoaEventDraft,
  HahitantsoaVenueOccupancy,
  InventoryItem,
  ReservationAvailableItemPreview,
  ReservationDraft,
  TitanClosedDay,
} from "../types";

export interface AvailabilityInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onSelectDateAndNavigate?: (date: string, domain?: "hahitantsoa" | "titan") => void;
}

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

const HAHITANTSOA_VENUES = [
  { id: "all", name: "Toutes les salles" },
  { id: "salle_fetes", name: "Salle des fêtes + jardin" },
  { id: "espace_vip", name: "Espace VIP & Lounge" },
  { id: "chapiteau", name: "Chapiteau Extérieur" },
];

function nextDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function selectedDayPeriod(dateStr: string): { startAt: string; endAt: string } {
  return {
    startAt: `${dateStr}T00:00:00.000Z`,
    endAt: `${nextDate(dateStr)}T00:00:00.000Z`,
  };
}

function displayedMonthPeriod(year: number, month: number): { startAt: string; endAt: string } {
  return {
    startAt: new Date(Date.UTC(year, month, 1)).toISOString(),
    endAt: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
  };
}

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AvailabilityInspectorModal({
  isOpen,
  onClose,
  initialDate,
  onSelectDateAndNavigate,
}: AvailabilityInspectorModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || getTodayISO());
  const initialDateObj = initialDate ? new Date(`${initialDate}T00:00:00`) : new Date();

  const [currentMonth, setCurrentMonth] = useState<number>(
    isNaN(initialDateObj.getTime()) ? new Date().getMonth() : initialDateObj.getMonth(),
  );
  const [currentYear, setCurrentYear] = useState<number>(
    isNaN(initialDateObj.getTime()) ? new Date().getFullYear() : initialDateObj.getFullYear(),
  );

  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [materialFilterTab, setMaterialFilterTab] = useState<"all" | "available" | "reserved">("all");
  const [materialSearchQuery, setMaterialSearchQuery] = useState<string>("");

  // Data states
  const [monthVenueOccupancy, setMonthVenueOccupancy] = useState<HahitantsoaVenueOccupancy[]>([]);
  const [closedDays, setClosedDays] = useState<TitanClosedDay[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [dayAvailablePreviews, setDayAvailablePreviews] = useState<ReservationAvailableItemPreview[]>([]);
  const [allTitanDrafts, setAllTitanDrafts] = useState<ReservationDraft[]>([]);
  const [allHahDrafts, setAllHahDrafts] = useState<HahitantsoaEventDraft[]>([]);

  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(false);
  const [isLoadingDayDetails, setIsLoadingDayDetails] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initial date if opened with new prop
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      const parsed = new Date(`${initialDate}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        setCurrentMonth(parsed.getMonth());
        setCurrentYear(parsed.getFullYear());
      }
    }
  }, [initialDate, isOpen]);

  // Load monthly occupancy & drafts & closed days
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setIsLoadingMonth(true);
    setErrorMsg(null);

    const { startAt, endAt } = displayedMonthPeriod(currentYear, currentMonth);
    const venueArg = selectedVenue === "all" ? undefined : selectedVenue;

    Promise.all([
      getHahitantsoaVenueOccupancy(startAt, endAt, venueArg, controller.signal).catch(() => ({ items: [] })),
      getTitanClosedDays(currentYear, controller.signal).catch(() => []),
      getInventoryItems(controller.signal).catch(() => []),
      getReservationDrafts(undefined, controller.signal).catch(() => []),
      getHahitantsoaEventDrafts(undefined, controller.signal).catch(() => []),
    ])
      .then(([venueRes, closedRes, invRes, titanDraftsRes, hahDraftsRes]) => {
        if (!controller.signal.aborted) {
          setMonthVenueOccupancy(Array.isArray(venueRes?.items) ? venueRes.items : []);
          setClosedDays(Array.isArray(closedRes) ? closedRes : []);
          setInventoryItems(Array.isArray(invRes) ? invRes : []);
          setAllTitanDrafts(Array.isArray(titanDraftsRes) ? titanDraftsRes : []);
          setAllHahDrafts(Array.isArray(hahDraftsRes) ? hahDraftsRes : []);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setErrorMsg(err instanceof Error ? err.message : "Erreur lors du chargement des disponibilités");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingMonth(false);
        }
      });

    return () => controller.abort();
  }, [isOpen, currentMonth, currentYear, selectedVenue]);

  // Load specific selected day's available items
  useEffect(() => {
    if (!isOpen || !selectedDate) return;

    const controller = new AbortController();
    setIsLoadingDayDetails(true);
    const { startAt, endAt } = selectedDayPeriod(selectedDate);

    getReservationAvailableItemPreviews(startAt, endAt)
      .then((previews) => {
        if (!controller.signal.aborted) {
          setDayAvailablePreviews(previews);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setDayAvailablePreviews([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingDayDetails(false);
        }
      });

    return () => controller.abort();
  }, [isOpen, selectedDate]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Day occupancy status lookup for Hahitantsoa
  const getVenueOccupancyForDay = (dateStr: string) => {
    const { startAt, endAt } = selectedDayPeriod(dateStr);
    const dayStart = Date.parse(startAt);
    const dayEnd = Date.parse(endAt);

    const overlaps = monthVenueOccupancy.filter(
      (item) => Date.parse(item.start_at) < dayEnd && Date.parse(item.end_at) > dayStart,
    );

    const isReserved = overlaps.some((item) => item.occupancy_status === "reserved");
    const isOption = overlaps.some((item) => item.occupancy_status === "option");

    return {
      status: isReserved ? ("reserved" as const) : isOption ? ("option" as const) : ("free" as const),
      items: overlaps,
    };
  };

  // Titan reservations active on a specific day
  const getTitanReservationsForDay = (dateStr: string) => {
    const { startAt, endAt } = selectedDayPeriod(dateStr);
    const dayStart = Date.parse(startAt);
    const dayEnd = Date.parse(endAt);

    return allTitanDrafts.filter((draft) => {
      if (!draft.start_at || !draft.end_at) return false;
      const s = Date.parse(draft.start_at);
      const e = Date.parse(draft.end_at);
      return s < dayEnd && e > dayStart;
    });
  };

  // Hahitantsoa event active on selected day
  const getHahEventForSelectedDay = useMemo(() => {
    if (!selectedDate) return null;
    const { startAt, endAt } = selectedDayPeriod(selectedDate);
    const dayStart = Date.parse(startAt);
    const dayEnd = Date.parse(endAt);

    return allHahDrafts.find((draft) => {
      if (!draft.start_at || !draft.end_at) return false;
      const s = Date.parse(draft.start_at);
      const e = Date.parse(draft.end_at);
      return s < dayEnd && e > dayStart;
    });
  }, [allHahDrafts, selectedDate]);

  // Titan active reservations on selected date
  const activeTitanReservationsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return getTitanReservationsForDay(selectedDate);
  }, [allTitanDrafts, selectedDate]);

  // Hahitantsoa active event drafts on selected date
  const activeHahDraftsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const { startAt, endAt } = selectedDayPeriod(selectedDate);
    const dayStart = Date.parse(startAt);
    const dayEnd = Date.parse(endAt);

    return allHahDrafts.filter((draft) => {
      if (!draft.start_at || !draft.end_at) return false;
      const s = Date.parse(draft.start_at);
      const e = Date.parse(draft.end_at);
      return s < dayEnd && e > dayStart;
    });
  }, [allHahDrafts, selectedDate]);

  const hasConfirmationsOnSelectedDate = useMemo(() => {
    return (
      activeTitanReservationsOnSelectedDate.length > 0 ||
      activeHahDraftsOnSelectedDate.length > 0 ||
      (selectedDate ? getVenueOccupancyForDay(selectedDate).status === "reserved" : false)
    );
  }, [activeTitanReservationsOnSelectedDate, activeHahDraftsOnSelectedDate, selectedDate, monthVenueOccupancy]);

  // Material partition: Total Inventory vs Available Previews & active bookings
  const materialInventoryStatus = useMemo(() => {
    const availableItemIds = new Set(dayAvailablePreviews.map((p) => p.inventory_item_id));

    return inventoryItems
      .filter((item) => !item.is_deleted && item.is_active !== false)
      .map((item) => {
        const totalStock =
          item.stock_summary?.reported_inventory_quantity ??
          item.reported_inventory_quantity ??
          1;

        // Calcul des quantités en usage
        const titanReservedQty = activeTitanReservationsOnSelectedDate.reduce((sum, draft) => {
          const line = draft.lines?.find((l) => l.inventory_item_id === item.id);
          return sum + (line ? line.quantity : 0);
        }, 0);

        const hahReservedQty = activeHahDraftsOnSelectedDate.reduce((sum, draft) => {
          const line = draft.lines?.find((l) => l.inventory_item_id === item.id);
          return sum + (line ? line.quantity : 0);
        }, 0);

        const totalReservedQty = titanReservedQty + hahReservedQty;

        let availableStock: number;
        if (totalReservedQty > 0) {
          availableStock = Math.max(0, totalStock - totalReservedQty);
        } else if (dayAvailablePreviews.length > 0 && !availableItemIds.has(item.id)) {
          availableStock = 0;
        } else {
          availableStock = totalStock;
        }

        const isAvailable = availableStock > 0;
        const isInUsage = totalReservedQty > 0 || (dayAvailablePreviews.length > 0 && !availableItemIds.has(item.id));

        return {
          id: item.id,
          name: item.name,
          kind: item.kind,
          code: item.code || "REF-MAT",
          totalStock,
          availableStock,
          titanReservedQty,
          hahReservedQty,
          totalReservedQty,
          isAvailable,
          isInUsage,
        };
      });
  }, [inventoryItems, dayAvailablePreviews, activeTitanReservationsOnSelectedDate, activeHahDraftsOnSelectedDate]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materialInventoryStatus.filter((mat) => {
      const matchesSearch =
        !materialSearchQuery.trim() ||
        mat.name.toLowerCase().includes(materialSearchQuery.toLowerCase()) ||
        mat.code.toLowerCase().includes(materialSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (materialFilterTab === "available") return mat.isAvailable;
      if (materialFilterTab === "reserved") return mat.isInUsage || !mat.isAvailable;
      return true;
    });
  }, [materialInventoryStatus, materialFilterTab, materialSearchQuery]);

  const availableCount = materialInventoryStatus.filter((m) => m.isAvailable).length;
  const reservedCount = materialInventoryStatus.filter((m) => m.isInUsage || !m.isAvailable).length;
  const totalMaterialsCount = materialInventoryStatus.length;

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  if (!isOpen) return null;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startingDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const todayISO = getTodayISO();

  const selectedDayOccupancy = selectedDate ? getVenueOccupancyForDay(selectedDate) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="availability-inspector-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100 dark:shadow-none">
              <i className="fa-solid fa-calendar-check text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="availability-inspector-title" className="text-lg font-black text-slate-900 dark:text-white">
                  Inspecteur de Disponibilité & Stocks
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Vue Croisée Hahitantsoa & Titan
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Vérification des disponibilités des salles exclusives (Hahitantsoa) et des stocks de matériel multi-clients (Titan)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'inspecteur"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Core Explanatory Banner */}
        <div className="bg-blue-50/70 dark:bg-blue-950/40 px-6 py-2.5 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
            <i className="fa-solid fa-circle-info text-blue-600 dark:text-blue-400"></i>
            <span>
              <strong>Règle métier :</strong> La salle (Hahitantsoa) est <u>exclusive par événement</u>. Le matériel (Titan) est <u>partageable entre plusieurs clients</u> tant que les stocks suffisent.
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Salle réservée
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Option salle
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Locations Titan actives
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 100% Libre
            </span>
          </div>
        </div>

        {/* Modal Body: Two-column layout */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* LEFT: Interactive Monthly Calendar */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Mois précédent"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="flex gap-1 text-sm font-bold text-slate-900 dark:text-white">
                  <span>{MONTH_NAMES[currentMonth]}</span>
                  <span>{currentYear}</span>
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Mois suivant"
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = getTodayISO();
                    setSelectedDate(today);
                    const now = new Date();
                    setCurrentMonth(now.getMonth());
                    setCurrentYear(now.getFullYear());
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Aujourd'hui
                </button>
              </div>
            </div>

            {/* Venue Filter Pill */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              {HAHITANTSOA_VENUES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVenue(v.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedVenue === v.id
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>

            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500 py-1" aria-hidden="true">
              <div>Lun</div>
              <div>Mar</div>
              <div>Mer</div>
              <div>Jeu</div>
              <div>Ven</div>
              <div>Sam</div>
              <div>Dim</div>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1.5" aria-label="Calendrier de disponibilité interactif">
              {Array.from({ length: startingDayOffset }).map((_, index) => (
                <div key={`empty-${index}`} aria-hidden="true" className="h-16 rounded-xl bg-transparent" />
              ))}

              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = selectedDate === dateStr;
                const isToday = todayISO === dateStr;

                const venueOcc = getVenueOccupancyForDay(dateStr);
                const titanDrafts = getTitanReservationsForDay(dateStr);
                const isClosed = closedDays.some((c) => c.date === dateStr);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    aria-label={`Date ${day} ${MONTH_NAMES[currentMonth]} ${currentYear}`}
                    className={`h-16 p-1.5 rounded-xl border text-left flex flex-col justify-between transition-all relative ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/60 ring-2 ring-indigo-500 shadow-sm"
                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/90 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          isSelected
                            ? "text-indigo-600 dark:text-indigo-400"
                            : isToday
                              ? "text-indigo-600 font-black"
                              : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {day}
                      </span>

                      {/* Hahitantsoa Venue Dot */}
                      {venueOcc.status === "reserved" && (
                        <span title="Salle Hahitantsoa réservée" className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      )}
                      {venueOcc.status === "option" && (
                        <span title="Option Hahitantsoa en cours" className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      )}
                      {venueOcc.status === "free" && !isClosed && (
                        <span title="Salle libre" className="w-2 h-2 rounded-full bg-emerald-400/60" />
                      )}
                    </div>

                    {/* Titan active rentals count badge */}
                    <div className="space-y-0.5">
                      {titanDrafts.length > 0 && (
                        <span className="block text-[9px] font-bold px-1 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 truncate">
                          🔵 {titanDrafts.length} loc{titanDrafts.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {isClosed && (
                        <span className="block text-[9px] font-semibold text-slate-400 truncate">Fermé</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Helper Note */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <p className="flex items-center gap-2">
                <i className="fa-solid fa-hand-pointer text-indigo-500"></i>
                <span>Cliquez sur une date pour voir les dossiers en cours et l'inventaire matériel restant.</span>
              </p>
            </div>
          </div>

          {/* RIGHT: Detailed Date Inspection Panel */}
          <div className="lg:col-span-6 space-y-4 bg-slate-50/50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Selected Day Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date sélectionnée</span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-calendar-day text-indigo-600"></i>
                    {selectedDate}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <i className="fa-solid fa-boxes-stacked text-indigo-500"></i>
                    {availableCount} / {totalMaterialsCount} matériels dispo
                  </span>
                </div>
              </div>

              {/* 1. HAHITANTSOA VENUE OCCUPANCY CARD */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <i className="fa-solid fa-landmark text-amber-500"></i>
                    Statut Salle & Lieu (Hahitantsoa)
                  </h4>
                  {selectedDayOccupancy?.status === "reserved" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                      🔴 Réservée / Indisponible
                    </span>
                  )}
                  {selectedDayOccupancy?.status === "option" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      🟠 Option en cours
                    </span>
                  )}
                  {selectedDayOccupancy?.status === "free" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      🟢 100% Libre
                    </span>
                  )}
                </div>

                {selectedDayOccupancy?.status === "reserved" && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-rose-50/50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900">
                    <p className="font-semibold text-rose-800 dark:text-rose-300">
                      {getHahEventForSelectedDay?.event_name || "Événement confirmé"} ({getHahEventForSelectedDay?.public_reference || "Réservation confirmée"})
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Client : {getHahEventForSelectedDay?.customer_display_name || "Client Hahitantsoa"}
                    </p>
                  </div>
                )}

                {selectedDayOccupancy?.status === "free" && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Aucun événement réservé pour cette salle. Vous pouvez créer un devis ou confirmer une réservation pour cette date.
                  </p>
                )}
              </div>

              {/* 2. TITAN MULTI-CLIENT RENTALS & MATERIAL AVAILABILITY */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <i className="fa-solid fa-truck-ramp-box text-indigo-500"></i>
                    Matériels & Multi-Locations (Titan)
                  </h4>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {activeTitanReservationsOnSelectedDate.length} dossier{activeTitanReservationsOnSelectedDate.length > 1 ? "s" : ""} actif{activeTitanReservationsOnSelectedDate.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Active reservations pill ribbon */}
                {activeTitanReservationsOnSelectedDate.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                    <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300 mr-1 self-center">
                      Clients ce jour-là :
                    </span>
                    {activeTitanReservationsOnSelectedDate.map((res) => (
                      <span
                        key={res.id}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                      >
                        {res.public_reference} ({res.customer_display_name})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Aucune location Titan active pour cette date. L'ensemble du parc matériel est 100% disponible.
                  </p>
                )}

                {/* Material Search and Filter Tabs */}
                <div className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                      <input
                        type="text"
                        placeholder="Rechercher un matériel (ex: Chaises, Tente)..."
                        value={materialSearchQuery}
                        onChange={(e) => setMaterialSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setMaterialFilterTab("all")}
                      className={`px-2 py-1 rounded-md transition ${
                        materialFilterTab === "all"
                          ? "bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                      }`}
                    >
                      Tous ({totalMaterialsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaterialFilterTab("available")}
                      className={`px-2 py-1 rounded-md transition ${
                        materialFilterTab === "available"
                          ? "bg-emerald-600 text-white"
                          : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
                      }`}
                    >
                      ✓ Disponibles ({availableCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaterialFilterTab("reserved")}
                      className={`px-2 py-1 rounded-md transition ${
                        materialFilterTab === "reserved"
                          ? "bg-indigo-600 text-white"
                          : "text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400"
                      }`}
                    >
                      En usage ({reservedCount})
                    </button>
                  </div>

                  {/* Materials List */}
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {isLoadingDayDetails ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        <i className="fa-solid fa-spinner fa-spin mr-1"></i> Chargement des stocks…
                      </p>
                    ) : filteredMaterials.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        Aucun matériel correspondant à ce filtre.
                      </p>
                    ) : (
                      filteredMaterials.map((mat) => (
                        <div
                          key={mat.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block sm:inline">{mat.name}</span>
                            {hasConfirmationsOnSelectedDate ? (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 sm:ml-2">
                                Stock disponible : {mat.availableStock}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 sm:ml-2">
                                Stock total : {mat.totalStock}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                            {/* Code couleur location Titan */}
                            {mat.titanReservedQty > 0 ? (
                              <span
                                className="px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                                title="Partie du stock en usage pour location Titan"
                              >
                                <i className="fa-solid fa-truck text-[9px]"></i>
                                <span>{mat.titanReservedQty} en location</span>
                              </span>
                            ) : (mat.isInUsage && activeTitanReservationsOnSelectedDate.length > 0 && mat.hahReservedQty === 0) ? (
                              <span
                                className="px-2 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[10px] border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                                title="En usage pour location Titan"
                              >
                                <i className="fa-solid fa-truck text-[9px]"></i>
                                <span>En location</span>
                              </span>
                            ) : null}

                            {/* Code couleur événementiel Hahitantsoa */}
                            {mat.hahReservedQty > 0 ? (
                              <span
                                className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                                title="Partie du stock en usage pour événement Hahitantsoa"
                              >
                                <i className="fa-solid fa-landmark text-[9px]"></i>
                                <span>{mat.hahReservedQty} en événementiel</span>
                              </span>
                            ) : (mat.isInUsage && activeHahDraftsOnSelectedDate.length > 0 && mat.titanReservedQty === 0) ? (
                              <span
                                className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                                title="En usage pour événement Hahitantsoa"
                              >
                                <i className="fa-solid fa-landmark text-[9px]"></i>
                                <span>En événementiel</span>
                              </span>
                            ) : null}

                            {/* Statut disponibilité */}
                            {!mat.isInUsage ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 text-[10px]">
                                ✓ {mat.availableStock} dispo
                              </span>
                            ) : mat.availableStock > 0 ? (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] border border-emerald-200 dark:border-emerald-800">
                                ✓ {mat.availableStock} dispo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-[10px]">
                                Épuisé
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                Période choisie : <span className="font-bold text-slate-800 dark:text-slate-200">{selectedDate}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectDateAndNavigate?.(selectedDate, "titan");
                  }}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-plus"></i>
                  <span>Nouveau devis Titan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectDateAndNavigate?.(selectedDate, "hahitantsoa");
                  }}
                  disabled={selectedDayOccupancy?.status === "reserved"}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 ${
                    selectedDayOccupancy?.status === "reserved"
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  }`}
                >
                  <i className="fa-solid fa-landmark"></i>
                  <span>Nouveau devis Hahitantsoa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
