import React, { useEffect, useId, useRef, useState } from "react";

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

export interface AvailabilityDatePickerProps {
  /**
   * Current selected date value in ISO format (YYYY-MM-DD).
   */
  value?: string;
  /**
   * Alias for value (MockAvailabilityCalendar backward-compatibility).
   */
  selectedDate?: string;
  /**
   * Callback fired when a valid date is selected or typed.
   */
  onChange?: (dateStr: string) => void;
  /**
   * Alias for onChange (MockAvailabilityCalendar backward-compatibility).
   */
  onDateSelect?: (dateStr: string) => void;
  /**
   * Display mode: "popover" (sleek input with floating dropdown calendar) or "inline" (embedded full calendar widget).
   * Default is "popover".
   */
  mode?: "popover" | "inline";
  /**
   * Optional field label.
   */
  label?: string;
  /**
   * HTML ID for label association.
   */
  id?: string;
  /**
   * Form field name.
   */
  name?: string;
  /**
   * Input placeholder text.
   */
  placeholder?: string;
  /**
   * Whether the field is required.
   */
  required?: boolean;
  /**
   * Whether the input is disabled.
   */
  disabled?: boolean;
  /**
   * Whether the input is read-only.
   */
  readOnly?: boolean;
  /**
   * Additional container CSS classes.
   */
  className?: string;
  /**
   * Additional input element CSS classes.
   */
  inputClassName?: string;
  /**
   * Min allowed date (YYYY-MM-DD).
   */
  minDate?: string;
  /**
   * Max allowed date (YYYY-MM-DD).
   */
  maxDate?: string;
  /**
   * Allow past dates (default: false).
   */
  allowPast?: boolean;
  /**
   * Explicit list of disabled dates (YYYY-MM-DD).
   */
  disabledDates?: string[];
  /**
   * Show quick shortcut pills: "Aujourd'hui", "Demain", "Ce Samedi", "+1 mois".
   * Default: true.
   */
  showShortcuts?: boolean;
  /**
   * Shows authoritative Titan availability preview for the selected full day.
   */
  showAvailabilityPreview?: boolean;
  /**
   * Reads the selected venue's real occupancy for displayed months without changing Titan's rental flow.
   */
  showHahitantsoaVenueOccupancy?: boolean;
  /**
   * Venue name for Hahitantsoa venue occupancy checks.
   */
  venueName?: string;
  /**
   * Hint text below the input.
   */
  hint?: string;
  /**
   * Error message displayed below the input.
   */
  error?: string;
  /**
   * Custom aria-label for the input.
   */
  ariaLabel?: string;
  /**
   * Callback when calendar popover opens or closes.
   */
  onPopoverToggle?: (isOpen: boolean) => void;
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
  const overlaps = items.filter(
    (item) => Date.parse(item.start_at) < dayEnd && Date.parse(item.end_at) > dayStart,
  );
  return overlaps.some((item) => item.occupancy_status === "reserved")
    ? "reserved"
    : overlaps[0]?.occupancy_status;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "La disponibilité n'a pas pu être vérifiée. Réessayez.";
}

/**
 * Parses a date string in YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY format and returns normalized YYYY-MM-DD if valid.
 */
export function parseAndNormalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Pattern 1: YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
    return null;
  }

  // Pattern 2: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const frMatch = /^(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{4})$/.exec(trimmed);
  if (frMatch) {
    const day = Number(frMatch[1]);
    const month = Number(frMatch[2]);
    const year = Number(frMatch[3]);
    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12) {
      const maxDays = new Date(year, month, 0).getDate();
      if (day >= 1 && day <= maxDays) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
    return null;
  }

  return null;
}

function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return "";
  return isoDate;
}

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getThisSaturdayISO(): string {
  const d = new Date();
  const day = d.getDay(); // 0 is Sunday, 6 is Saturday
  const diff = day === 6 ? 7 : (6 - day);
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getNextMonthISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AvailabilityDatePicker({
  value,
  selectedDate: legacySelectedDate,
  onChange,
  onDateSelect: legacyOnDateSelect,
  mode = "popover",
  label,
  id: explicitId,
  name,
  placeholder = "AAAA-MM-JJ ou JJ/MM/AAAA",
  required = false,
  disabled = false,
  readOnly = false,
  className = "",
  inputClassName = "",
  minDate,
  maxDate,
  allowPast = false,
  disabledDates = [],
  showShortcuts = true,
  showAvailabilityPreview = false,
  showHahitantsoaVenueOccupancy = false,
  venueName,
  hint,
  error,
  ariaLabel,
  onPopoverToggle,
}: AvailabilityDatePickerProps) {
  const generatedId = useId();
  const inputId = explicitId || generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const effectiveSelectedDate = value !== undefined ? value : (legacySelectedDate ?? "");
  const effectiveOnChange = onChange || legacyOnDateSelect;

  const [inputValue, setInputValue] = useState<string>(formatDisplayDate(effectiveSelectedDate));
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputWarning, setInputWarning] = useState<string | null>(null);

  // Calendar navigation month/year
  const initialDate = effectiveSelectedDate ? new Date(`${effectiveSelectedDate}T00:00:00`) : new Date();
  const [currentMonth, setCurrentMonth] = useState<number>(
    isNaN(initialDate.getTime()) ? new Date().getMonth() : initialDate.getMonth(),
  );
  const [currentYear, setCurrentYear] = useState<number>(
    isNaN(initialDate.getTime()) ? new Date().getFullYear() : initialDate.getFullYear(),
  );

  // Availability queries
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [venueOccupancy, setVenueOccupancy] = useState<VenueOccupancyState>({ status: "idle" });
  const [venueOccupancyRetryAttempt, setVenueOccupancyRetryAttempt] = useState(0);

  // Keep input value in sync when external selected date changes
  useEffect(() => {
    setInputValue(formatDisplayDate(effectiveSelectedDate));
    if (effectiveSelectedDate) {
      const parsed = new Date(`${effectiveSelectedDate}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        setCurrentMonth(parsed.getMonth());
        setCurrentYear(parsed.getFullYear());
      }
    }
  }, [effectiveSelectedDate]);

  // Titan availability check
  useEffect(() => {
    if (!showAvailabilityPreview || !effectiveSelectedDate) {
      setAvailability({ status: "idle" });
      return;
    }

    let active = true;
    const { startAt, endAt } = selectedDayPeriod(effectiveSelectedDate);
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
      .catch((err: unknown) => {
        if (active) {
          setAvailability({ status: "error", message: errorMessage(err) });
        }
      });

    return () => {
      active = false;
    };
  }, [retryAttempt, effectiveSelectedDate, showAvailabilityPreview]);

  // Hahitantsoa venue occupancy check
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
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setVenueOccupancy({ status: "error", message: errorMessage(err) });
        }
      });

    return () => controller.abort();
  }, [currentMonth, currentYear, showHahitantsoaVenueOccupancy, venueName, venueOccupancyRetryAttempt]);

  // Outside click listener to dismiss popover
  useEffect(() => {
    if (mode !== "popover" || !isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        onPopoverToggle?.(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        onPopoverToggle?.(false);
        inputRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, mode, onPopoverToggle]);

  const togglePopover = () => {
    if (disabled || readOnly) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    onPopoverToggle?.(nextState);
  };

  const validateAndSelectDate = (dateStr: string) => {
    const today = getTodayISO();
    if (!allowPast && dateStr < today) {
      setInputWarning("Les dates passées ne sont pas autorisées.");
      return;
    }
    if (minDate && dateStr < minDate) {
      setInputWarning(`La date doit être postérieure ou égale au ${minDate}.`);
      return;
    }
    if (maxDate && dateStr > maxDate) {
      setInputWarning(`La date doit être antérieure ou égale au ${maxDate}.`);
      return;
    }
    if (disabledDates.includes(dateStr)) {
      setInputWarning("Cette date n'est pas sélectionnable.");
      return;
    }

    setInputWarning(null);
    setInputValue(dateStr);
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (!isNaN(parsed.getTime())) {
      setCurrentMonth(parsed.getMonth());
      setCurrentYear(parsed.getFullYear());
    }
    effectiveOnChange?.(dateStr);
    if (mode === "popover") {
      setIsOpen(false);
      onPopoverToggle?.(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setInputValue(raw);

    if (!raw.trim()) {
      setInputWarning(null);
      effectiveOnChange?.("");
      return;
    }

    const normalized = parseAndNormalizeDate(raw);
    if (normalized) {
      const today = getTodayISO();
      if (!allowPast && normalized < today) {
        setInputWarning("Date passée non autorisée");
        return;
      }
      if (minDate && normalized < minDate) {
        setInputWarning(`Minimum: ${minDate}`);
        return;
      }
      if (maxDate && normalized > maxDate) {
        setInputWarning(`Maximum: ${maxDate}`);
        return;
      }
      if (disabledDates.includes(normalized)) {
        setInputWarning("Date indisponible");
        return;
      }

      setInputWarning(null);
      const parsed = new Date(`${normalized}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        setCurrentMonth(parsed.getMonth());
        setCurrentYear(parsed.getFullYear());
      }
      effectiveOnChange?.(normalized);
    } else {
      setInputWarning(null);
    }
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      setInputWarning(null);
      effectiveOnChange?.("");
      return;
    }
    const normalized = parseAndNormalizeDate(inputValue);
    if (normalized) {
      setInputValue(normalized);
      validateAndSelectDate(normalized);
    } else {
      setInputWarning("Format de date invalide (attendu: AAAA-MM-JJ ou JJ/MM/AAAA)");
    }
  };

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

  const renderCalendarDays = () => {
    const days: React.ReactNode[] = [];
    for (let index = 0; index < startingDayOffset; index += 1) {
      days.push(<div key={`empty-${index}`} aria-hidden="true" className="py-2 text-transparent">0</div>);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isPast = !allowPast && new Date(`${dateStr}T00:00:00`) < today;
      const isMinDisabled = minDate ? dateStr < minDate : false;
      const isMaxDisabled = maxDate ? dateStr > maxDate : false;
      const isDisabled = disabledDates.includes(dateStr) || isMinDisabled || isMaxDisabled;
      const isSelected = effectiveSelectedDate === dateStr;
      const isCurrentDay = getTodayISO() === dateStr;

      const occupancyStatus =
        venueOccupancy.status === "loaded"
          ? occupancyStatusForDay(venueOccupancy.items, dateStr)
          : undefined;
      const isReserved = occupancyStatus === "reserved";
      const isUnavailable = isPast || isDisabled || isReserved;

      const style = isReserved
        ? "border-rose-300 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 cursor-not-allowed"
        : isPast || isDisabled
          ? "bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed"
        : isSelected
          ? "bg-indigo-600 text-white font-bold shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700"
          : occupancyStatus === "option"
            ? "border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60"
          : "bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-100 dark:border-slate-700/60";

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
          onClick={() => validateAndSelectDate(dateStr)}
          aria-pressed={isSelected}
          aria-label={`${day} ${MONTH_NAMES[currentMonth].toLowerCase()} ${currentYear}${occupancyLabel}`}
          className={`min-h-9 relative rounded-lg border text-xs font-medium transition-all ${style} ${
            isCurrentDay && !isSelected ? "ring-1 ring-indigo-400 font-bold" : ""
          }`}
        >
          {day}
          {isCurrentDay && !isSelected && (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full" />
          )}
        </button>,
      );
    }
    return days;
  };

  const calendarWidget = (
    <div className="space-y-3 font-sans">
      {/* Quick Shortcuts Bar */}
      {showShortcuts && (
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Raccourcis:</span>
          <button
            type="button"
            onClick={() => validateAndSelectDate(getTodayISO())}
            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-semibold transition"
          >
            Aujourd'hui
          </button>
          <button
            type="button"
            onClick={() => validateAndSelectDate(getTomorrowISO())}
            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-semibold transition"
          >
            Demain
          </button>
          <button
            type="button"
            onClick={() => validateAndSelectDate(getThisSaturdayISO())}
            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-semibold transition"
          >
            Ce Samedi
          </button>
          <button
            type="button"
            onClick={() => validateAndSelectDate(getNextMonthISO())}
            className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-semibold transition"
          >
            +1 mois
          </button>
        </div>
      )}

      {/* Month & Year Navigation Header */}
      <div className="flex justify-between items-center gap-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="Mois précédent"
          className="min-h-8 min-w-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300"
        >
          <i aria-hidden="true" className="fa-solid fa-chevron-left" />
        </button>
        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`${inputId}-calendar-month`}>
            Mois
          </label>
          <select
            id={`${inputId}-calendar-month`}
            value={currentMonth}
            onChange={(event) => setCurrentMonth(Number(event.target.value))}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {MONTH_NAMES.map((month, index) => (
              <option key={month} value={index}>
                {month}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`${inputId}-calendar-year`}>
            Année
          </label>
          <select
            id={`${inputId}-calendar-year`}
            value={currentYear}
            onChange={(event) => setCurrentYear(Number(event.target.value))}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {Array.from({ length: 10 }, (_, index) => new Date().getFullYear() + index).map(
              (year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ),
            )}
          </select>
        </div>
        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="Mois suivant"
          className="min-h-8 min-w-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300"
        >
          <i aria-hidden="true" className="fa-solid fa-chevron-right" />
        </button>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400" aria-hidden="true">
        <div>Lun</div>
        <div>Mar</div>
        <div>Mer</div>
        <div>Jeu</div>
        <div>Ven</div>
        <div>Sam</div>
        <div>Dim</div>
      </div>

      {/* Days Grid */}
      <div
        className="grid grid-cols-7 gap-1 text-center text-xs"
        aria-label="Calendrier de disponibilité"
      >
        {renderCalendarDays()}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2 text-[10px] text-slate-600 dark:text-slate-400 justify-center border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded" />
          <span>Libre / À vérifier</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-indigo-600 rounded" />
          <span>Sélectionnée</span>
        </div>
        {showHahitantsoaVenueOccupancy && (
          <>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded" />
              <span>Option</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 rounded" />
              <span>Réservée</span>
            </div>
          </>
        )}
      </div>

      {/* Live Venue Occupancy Info */}
      {showHahitantsoaVenueOccupancy && venueName !== undefined && (
        <div
          aria-live="polite"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 text-xs text-slate-700 dark:text-slate-300"
        >
          {venueOccupancy.status === "loading" && (
            <p className="flex items-center gap-1.5 text-slate-500">
              <i className="fa-solid fa-spinner fa-spin text-indigo-500"></i>
              Chargement des réservations de cette salle…
            </p>
          )}
          {venueOccupancy.status === "error" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-rose-700 dark:text-rose-400">
                Occupation de la salle non vérifiée : {venueOccupancy.message}
              </p>
              <button
                type="button"
                onClick={() => setVenueOccupancyRetryAttempt((attempt) => attempt + 1)}
                className="rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                Réessayer
              </button>
            </div>
          )}
          {venueOccupancy.status === "loaded" && (
            venueOccupancy.items.length > 0 ? (
              <p className="text-slate-600 dark:text-slate-300">
                Les dates réservées sont indisponibles. Les options restent sélectionnables jusqu'à la confirmation.
              </p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Aucune réservation enregistrée pour cette salle ce mois-ci.
              </p>
            )
          )}
        </div>
      )}

      {/* Live Titan Availability Info */}
      {showAvailabilityPreview && effectiveSelectedDate && (
        <div
          aria-live="polite"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-3 text-xs text-slate-700 dark:text-slate-300"
        >
          {availability.status === "loading" && (
            <p className="flex items-center gap-1.5 text-slate-500">
              <i className="fa-solid fa-spinner fa-spin text-indigo-500"></i>
              Vérification de la disponibilité réelle…
            </p>
          )}
          {availability.status === "error" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-rose-700 dark:text-rose-400">
                Disponibilité non vérifiée : {availability.message}
              </p>
              <button
                type="button"
                onClick={() => setRetryAttempt((attempt) => attempt + 1)}
                className="rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                Réessayer
              </button>
            </div>
          )}
          {availability.status === "loaded" && (
            availability.summary.available_item_count > 0 ? (
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check text-emerald-500"></i>
                  {availability.summary.available_item_count} ressource(s) Titan disponible(s) sur cette journée.
                </p>
                {availability.previews.length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {availability.previews.map((preview) => preview.inventory_item_name).join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                Aucune ressource Titan disponible sur cette journée.
              </p>
            )
          )}
          <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
            Cette indication ne bloque pas la date souhaitée et ne constitue pas une réservation.
          </p>
        </div>
      )}
    </div>
  );

  // Inline mode: render the full calendar directly inside a card container
  if (mode === "inline") {
    return (
      <div
        className={`bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 ${className}`}
      >
        {label && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              {label} {required && <span className="text-rose-500">*</span>}
            </span>
            {effectiveSelectedDate && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Sélection: {effectiveSelectedDate}
              </span>
            )}
          </div>
        )}
        {calendarWidget}
      </div>
    );
  }

  // Popover mode (default): modern input with direct typing + calendar popover dropdown
  return (
    <div ref={containerRef} className={`relative space-y-1 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={ariaLabel || label || "Date"}
          aria-invalid={Boolean(error || inputWarning)}
          className={`w-full pr-10 pl-3.5 py-2 text-xs rounded-xl border transition-all text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none ${
            error || inputWarning
              ? "border-rose-300 dark:border-rose-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              : "border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-50 dark:bg-slate-900" : ""} ${inputClassName}`}
        />

        <button
          type="button"
          onClick={togglePopover}
          disabled={disabled || readOnly}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="Ouvrir le calendrier interactif"
          title="Sélectionner sur le calendrier"
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${
            isOpen ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-700" : ""
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <i className="fa-solid fa-calendar-days text-xs"></i>
        </button>
      </div>

      {/* Validation warning or explicit error */}
      {(inputWarning || error) && (
        <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
          <span>{inputWarning || error}</span>
        </p>
      )}

      {/* Subtle Hint */}
      {hint && !inputWarning && !error && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      )}

      {/* Floating Popover Calendar */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Calendrier de sélection de date"
          className="absolute z-50 mt-1.5 left-0 w-80 sm:w-88 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {calendarWidget}
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onPopoverToggle?.(false);
              }}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
