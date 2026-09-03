import React, { useEffect, useState } from "react";

import {
  getHahitantsoaVenueOccupancy,
  getReservationAvailabilitySummary,
  getReservationAvailableItemPreviews,
} from "../api";
import type {
  HahitantsoaVenueOccupancy,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
} from "../types";

interface MockAvailabilityCalendarProps {
  onDateSelect?: (dateStr: string) => void;
  selectedDate?: string;
  allowPast?: boolean;
  disabledDates?: string[];
  /**
   * The calendar remains reusable for date-only forms. When enabled, it shows
   * the authoritative Titan availability preview for the selected full day.
   */
  showAvailabilityPreview?: boolean;
  /**
   * Hahitantsoa-only calendar overlay. It reads the selected venue's real
   * occupancy for the displayed month without changing Titan's rental flow.
   */
  showHahitantsoaVenueOccupancy?: boolean;
  venueName?: string;
}

type AvailabilityState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      summary: ReservationAvailabilitySummary;
      previews: ReservationAvailableItemPreview[];
    }
  | { status: "error"; message: string };

type VenueOccupancyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; items: HahitantsoaVenueOccupancy[] }
  | { status: "error"; message: string };

const monthNames = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
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

function occupancyStatusForDay(
  items: HahitantsoaVenueOccupancy[],
  dateStr: string,
): HahitantsoaVenueOccupancy["occupancy_status"] | undefined {
  const { startAt, endAt } = selectedDayPeriod(dateStr);
  const dayStart = Date.parse(startAt);
  const dayEnd = Date.parse(endAt);
  const overlaps = items.filter((item) => (
    Date.parse(item.start_at) < dayEnd && Date.parse(item.end_at) > dayStart
  ));
  return overlaps.some((item) => item.occupancy_status === "reserved")
    ? "reserved"
    : overlaps[0]?.occupancy_status;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "La disponibilité n'a pas pu être vérifiée. Réessayez.";
}

export function MockAvailabilityCalendar({
  onDateSelect,
  selectedDate,
  allowPast = false,
  disabledDates = [],
  showAvailabilityPreview = false,
  showHahitantsoaVenueOccupancy = false,
  venueName,
}: MockAvailabilityCalendarProps) {
  const currentDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [venueOccupancy, setVenueOccupancy] = useState<VenueOccupancyState>({ status: "idle" });
  const [venueOccupancyRetryAttempt, setVenueOccupancyRetryAttempt] = useState(0);

  useEffect(() => {
    if (!showAvailabilityPreview || !selectedDate) {
      setAvailability({ status: "idle" });
      return;
    }

    let active = true;
    const { startAt, endAt } = selectedDayPeriod(selectedDate);
    setAvailability({ status: "loading" });

    void Promise.all([
      getReservationAvailabilitySummary(startAt, endAt),
      getReservationAvailableItemPreviews(startAt, endAt),
    ])
      .then(([summary, previews]) => {
        if (active) {
          setAvailability({ status: "loaded", summary, previews });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAvailability({ status: "error", message: errorMessage(error) });
        }
      });

    return () => {
      active = false;
    };
  }, [retryAttempt, selectedDate, showAvailabilityPreview]);

  useEffect(() => {
    if (!showHahitantsoaVenueOccupancy || venueName === undefined) {
      setVenueOccupancy({ status: "idle" });
      return;
    }

    const controller = new AbortController();
    const { startAt, endAt } = displayedMonthPeriod(currentYear, currentMonth);
    setVenueOccupancy({ status: "loading" });

    void getHahitantsoaVenueOccupancy(startAt, endAt, venueName, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) {
          setVenueOccupancy({ status: "loaded", items: response.items });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setVenueOccupancy({ status: "error", message: errorMessage(error) });
        }
      });

    return () => controller.abort();
  }, [currentMonth, currentYear, showHahitantsoaVenueOccupancy, venueName, venueOccupancyRetryAttempt]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((previous) => previous - 1);
    } else {
      setCurrentMonth((previous) => previous - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((previous) => previous + 1);
    } else {
      setCurrentMonth((previous) => previous + 1);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startingDayOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renderDays = () => {
    const days: React.ReactNode[] = [];
    for (let index = 0; index < startingDayOffset; index += 1) {
      days.push(<div key={`empty-${index}`} aria-hidden="true" className="py-2 text-transparent">0</div>);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isPast = !allowPast && new Date(`${dateStr}T00:00:00`) < today;
      const isDisabled = disabledDates.includes(dateStr);
      const isSelected = selectedDate === dateStr;
      const occupancyStatus = venueOccupancy.status === "loaded"
        ? occupancyStatusForDay(venueOccupancy.items, dateStr)
        : undefined;
      const isReserved = occupancyStatus === "reserved";
      const isUnavailable = isPast || isDisabled || isReserved;
      const style = isReserved
        ? "border-rose-300 bg-rose-50 text-rose-700 cursor-not-allowed"
        : isPast || isDisabled
          ? "bg-slate-50 text-slate-300 cursor-not-allowed"
        : isSelected
          ? "bg-indigo-600 text-white font-bold shadow-md"
          : occupancyStatus === "option"
            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          : "bg-white hover:bg-slate-100 text-slate-700";
      const occupancyLabel = isReserved
        ? ", réservée pour cette salle"
        : occupancyStatus === "option"
          ? ", option en cours pour cette salle"
          : "";

      days.push(
        <button
          key={dateStr}
          type="button"
          disabled={isUnavailable}
          onClick={() => onDateSelect?.(dateStr)}
          aria-pressed={isSelected}
          aria-label={`${day} ${monthNames[currentMonth].toLowerCase()} ${currentYear}${occupancyLabel}`}
          className={`min-h-10 rounded border border-transparent text-sm ${style}`}
        >
          {day}
        </button>,
      );
    }
    return days;
  };

  return (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <button type="button" onClick={handlePrevMonth} aria-label="Mois précédent" className="min-h-10 px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-sm">
          <i aria-hidden="true" className="fa-solid fa-chevron-left" />
        </button>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="availability-calendar-month">Mois</label>
          <select id="availability-calendar-month" value={currentMonth} onChange={(event) => setCurrentMonth(Number(event.target.value))} className="bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800">
            {monthNames.map((month, index) => <option key={month} value={index}>{month}</option>)}
          </select>
          <label className="sr-only" htmlFor="availability-calendar-year">Année</label>
          <select id="availability-calendar-year" value={currentYear} onChange={(event) => setCurrentYear(Number(event.target.value))} className="bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold text-slate-800">
            {Array.from({ length: 10 }, (_, index) => currentDate.getFullYear() + index).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <button type="button" onClick={handleNextMonth} aria-label="Mois suivant" className="min-h-10 px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-sm">
          <i aria-hidden="true" className="fa-solid fa-chevron-right" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2" aria-hidden="true">
        <div className="font-semibold text-slate-500">Lun</div><div className="font-semibold text-slate-500">Mar</div><div className="font-semibold text-slate-500">Mer</div><div className="font-semibold text-slate-500">Jeu</div><div className="font-semibold text-slate-500">Ven</div><div className="font-semibold text-slate-500">Sam</div><div className="font-semibold text-slate-500">Dim</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm" aria-label="Calendrier de disponibilité">
        {renderDays()}
      </div>
      <div className="flex flex-wrap gap-4 mt-6 text-xs justify-center">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-slate-300 rounded" /> Date à vérifier</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-600 rounded" /> Date souhaitée</div>
        {showHahitantsoaVenueOccupancy && <>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-50 border border-amber-300 rounded" /> Option en cours</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-50 border border-rose-300 rounded" /> Date réservée</div>
        </>}
      </div>
      {showHahitantsoaVenueOccupancy && venueName !== undefined && (
        <div aria-live="polite" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {venueOccupancy.status === "loading" && <p>Chargement des réservations de cette salle…</p>}
          {venueOccupancy.status === "error" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-rose-700">Occupation de la salle non vérifiée : {venueOccupancy.message}</p>
              <button
                type="button"
                onClick={() => setVenueOccupancyRetryAttempt((attempt) => attempt + 1)}
                className="min-h-10 rounded border border-rose-200 bg-white px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Réessayer
              </button>
            </div>
          )}
          {venueOccupancy.status === "loaded" && (
            venueOccupancy.items.length > 0
              ? <p>Les dates réservées sont indisponibles. Les options restent sélectionnables jusqu'à la confirmation.</p>
              : <p>Aucune réservation enregistrée pour cette salle ce mois-ci.</p>
          )}
        </div>
      )}
      {showAvailabilityPreview && selectedDate && (
        <div aria-live="polite" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
          {availability.status === "loading" && <p>Vérification de la disponibilité réelle…</p>}
          {availability.status === "error" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-rose-700">Disponibilité non vérifiée : {availability.message}</p>
              <button
                type="button"
                onClick={() => setRetryAttempt((attempt) => attempt + 1)}
                className="min-h-10 rounded border border-rose-200 bg-white px-3 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Réessayer
              </button>
            </div>
          )}
          {availability.status === "loaded" && (
            availability.summary.available_item_count > 0 ? (
              <div>
                <p className="font-medium text-emerald-700">{availability.summary.available_item_count} ressource(s) Titan disponible(s) sur cette journée.</p>
                {availability.previews.length > 0 && <p className="mt-1 text-xs text-slate-500">{availability.previews.map((preview) => preview.inventory_item_name).join(", ")}</p>}
              </div>
            ) : <p className="font-medium text-amber-700">Aucune ressource Titan disponible sur cette journée.</p>
          )}
          <p className="mt-2 text-xs text-slate-500">Cette indication ne bloque pas la date souhaitée et ne constitue pas une réservation.</p>
        </div>
      )}
    </div>
  );
}
