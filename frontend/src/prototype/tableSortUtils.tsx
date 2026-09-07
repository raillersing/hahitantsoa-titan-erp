import React, { useState, useCallback, useMemo } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig<K extends string = string> {
  key: K | null;
  direction: SortDirection;
}

export type SortValueExtractor<T> = (item: T) => string | number | boolean | Date | null | undefined;

/**
 * Calculates the next sort direction following the standard 3-state cycle:
 * Unsorted / Different Column -> Ascending -> Descending -> Unsorted (Reset)
 */
export function getNextSortDirection<K extends string>(
  currentKey: K | null,
  targetKey: K,
  currentDirection: SortDirection,
  defaultDirection: "asc" | "desc" = "asc"
): SortDirection {
  if (currentKey !== targetKey || currentDirection === null) {
    return defaultDirection;
  }
  if (currentDirection === "asc") {
    return "desc";
  }
  return null;
}

/**
 * Sorts an array of items based on the provided sort configuration and value extractors.
 * Handles strings (natural French collation + accents), numbers, dates, booleans, and null/undefined values.
 * Null/undefined values are consistently sorted to the end regardless of sort direction.
 */
export function sortData<T, K extends string = string>(
  data: T[],
  sortConfig: SortConfig<K>,
  extractors?: Partial<Record<K, SortValueExtractor<T>>>,
  tieBreaker?: (a: T, b: T) => number
): T[] {
  if (!sortConfig.key || !sortConfig.direction || data.length <= 1) {
    return data;
  }

  const { key, direction } = sortConfig;
  const factor = direction === "asc" ? 1 : -1;
  const extractor = extractors?.[key];

  return [...data].sort((a, b) => {
    const valA = extractor ? extractor(a) : (a as Record<string, any>)[key];
    const valB = extractor ? extractor(b) : (b as Record<string, any>)[key];

    // Push null / undefined / empty string to the bottom in both directions
    const isEmptyA = valA === null || valA === undefined || valA === "";
    const isEmptyB = valB === null || valB === undefined || valB === "";

    if (isEmptyA && isEmptyB) return 0;
    if (isEmptyA) return 1;
    if (isEmptyB) return -1;

    // Date comparison
    if (valA instanceof Date && valB instanceof Date) {
      const diff = valA.getTime() - valB.getTime();
      if (diff !== 0) return diff * factor;
    }

    // Numerical comparison
    if (typeof valA === "number" && typeof valB === "number") {
      const diff = valA - valB;
      if (diff !== 0) return diff * factor;
    }

    // Boolean comparison
    if (typeof valA === "boolean" && typeof valB === "boolean") {
      const diff = valA === valB ? 0 : valA ? 1 : -1;
      if (diff !== 0) return diff * factor;
    }

    // String comparison with natural French sorting (accents + numeric collation)
    if (typeof valA === "string" && typeof valB === "string") {
      const diff = valA.localeCompare(valB, "fr", { numeric: true, sensitivity: "base" });
      if (diff !== 0) return diff * factor;
    }

    // Fallback comparison via string conversion
    const strDiff = String(valA).localeCompare(String(valB), "fr", { numeric: true, sensitivity: "base" });
    if (strDiff !== 0) return strDiff * factor;

    // Tie-breaker
    if (tieBreaker) {
      return tieBreaker(a, b);
    }
    return 0;
  });
}

/**
 * Reusable React Hook for managing sortable table state.
 */
export function useTableSort<T, K extends string = string>({
  initialKey = null,
  initialDirection = null,
  extractors,
  tieBreaker,
}: {
  initialKey?: K | null;
  initialDirection?: SortDirection;
  extractors?: Partial<Record<K, SortValueExtractor<T>>>;
  tieBreaker?: (a: T, b: T) => number;
} = {}) {
  const [sortConfig, setSortConfig] = useState<SortConfig<K>>({
    key: initialKey,
    direction: initialDirection,
  });

  const handleSort = useCallback((key: K) => {
    setSortConfig((prev) => {
      const nextDir = getNextSortDirection(prev.key, key, prev.direction);
      return {
        key: nextDir === null ? null : key,
        direction: nextDir,
      };
    });
  }, []);

  const resetSort = useCallback(() => {
    setSortConfig({ key: null, direction: null });
  }, []);

  const sortItems = useCallback(
    (items: T[]) => sortData(items, sortConfig, extractors, tieBreaker),
    [sortConfig, extractors, tieBreaker]
  );

  return {
    sortConfig,
    handleSort,
    resetSort,
    sortItems,
  };
}

export interface SortableHeaderProps<K extends string = string> {
  label: React.ReactNode;
  sortKey: K;
  currentSortKey: K | null;
  currentDirection: SortDirection;
  onSort: (key: K) => void;
  className?: string;
  align?: "left" | "center" | "right";
  title?: string;
  children?: React.ReactNode;
}

/**
 * Accessible, styled sortable column header component.
 * Displays interactive hover state, active sort arrow icons, and aria-sort attribute.
 */
export function SortableHeader<K extends string = string>({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  className = "",
  align = "left",
  title,
  children,
}: SortableHeaderProps<K>) {
  const isActive = currentSortKey === sortKey && currentDirection !== null;
  const direction = isActive ? currentDirection : null;

  const alignClass =
    align === "right"
      ? "justify-end text-right"
      : align === "center"
      ? "justify-center text-center"
      : "justify-start text-left";

  const labelText = typeof label === "string" ? label : String(sortKey);
  const tooltip =
    title ||
    (isActive
      ? `Trié par ${labelText} (${direction === "asc" ? "croissant" : "décroissant"}) — Cliquer pour ${
          direction === "asc" ? "trier par ordre décroissant" : "réinitialiser le tri"
        }`
      : `Trier par ${labelText}`);

  return (
    <th
      className={`p-4 font-bold border-b border-slate-200 dark:border-slate-700 select-none cursor-pointer group transition-colors hover:bg-slate-100/75 dark:hover:bg-slate-800/75 ${
        isActive ? "bg-slate-100/60 dark:bg-slate-800/60 text-slate-900 dark:text-white" : ""
      } ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"} ${className}`}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSort(sortKey);
        }
      }}
      tabIndex={0}
      role="columnheader"
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
      title={tooltip}
    >
      <div className={`inline-flex items-center gap-1.5 ${alignClass} w-full`}>
        <span>{children || label}</span>
        <span className="inline-flex items-center text-xs ml-1 flex-shrink-0" aria-hidden="true">
          {isActive ? (
            direction === "asc" ? (
              <i className="fas fa-arrow-up-short-wide text-tit-600 dark:text-tit-400 text-xs"></i>
            ) : (
              <i className="fas fa-arrow-down-wide-short text-tit-600 dark:text-tit-400 text-xs"></i>
            )
          ) : (
            <i className="fas fa-sort text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors text-xs"></i>
          )}
        </span>
      </div>
    </th>
  );
}
