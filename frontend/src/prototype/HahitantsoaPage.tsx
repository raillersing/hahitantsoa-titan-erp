import React, { useEffect, useMemo, useState } from "react";
import BrandIdentity from "./BrandIdentity";
import { LoadingSpinner, EmptyState } from "../components";
import {
  getHahitantsoaDiscoveryItems,
  getReservationDrafts,
} from "../api";
import type {
  HahitantsoaDiscoveryItem,
  ReservationDraft,
} from "../types";

interface HahitantsoaPageProps {
  onNavigate: (scope: any, param?: string) => void;
  canSensitiveWrite?: boolean;
}

type FilterKey = "all" | "draft" | "confirmed" | "cancelled";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "draft", label: "En attente" },
  { key: "confirmed", label: "Confirmées" },
  { key: "cancelled", label: "Annulées" },
];

function formatStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
          En attente
        </span>
      );
    case "confirmed":
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
          Confirmée
        </span>
      );
    case "cancelled":
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
          Annulée
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
          {status}
        </span>
      );
  }
}

function formatDate(iso: string | undefined | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function initialsColor(name: string) {
  const colors = [
    { bg: "bg-indigo-100", text: "text-indigo-700" },
    { bg: "bg-amber-100", text: "text-amber-700" },
    { bg: "bg-emerald-100", text: "text-emerald-700" },
    { bg: "bg-rose-100", text: "text-rose-700" },
    { bg: "bg-sky-100", text: "text-sky-700" },
  ];
  const idx =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    colors.length;
  return colors[idx];
}

export default function HahitantsoaPage({
  onNavigate,
  canSensitiveWrite = false,
}: HahitantsoaPageProps) {
  const [drafts, setDrafts] = useState<ReservationDraft[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<
    HahitantsoaDiscoveryItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [draftsData, discoveryData] = await Promise.all([
          getReservationDrafts(undefined, controller.signal),
          getHahitantsoaDiscoveryItems(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setDrafts(draftsData);
          setDiscoveryItems(discoveryData.items);
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          setError(
            err.message ||
              "Erreur lors du chargement des réservations Hahitantsoa."
          );
          setLoading(false);
        }
      }
    }

    void loadData();
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drafts.filter((r) => {
      const matchesSearch =
        !q ||
        r.public_reference.toLowerCase().includes(q) ||
        r.customer_display_name.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ? true : r.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [search, filter, drafts]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: drafts.length };
    for (const d of drafts) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }
    return counts;
  }, [drafts]);

  return (
    <div className="page active space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <BrandIdentity brand="hahitantsoa" className="module-brand" />
          <h1 className="text-2xl font-bold text-slate-800">
            <i className="fa-solid fa-calendar-check text-indigo-600 mr-2"></i>
            Réservations Hahitantsoa
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestion des réservations événementielles avec suivi de workflow
          </p>
        </div>
        {canSensitiveWrite && (
          <button
            onClick={() => onNavigate("reservation-new", "hahitantsoa")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <i className="fa-solid fa-plus mr-2"></i>Nouvelle réservation
          </button>
        )}
      </div>

      {/* Discovery concepts banner */}
      {!loading && discoveryItems.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-4">
          <p className="text-xs font-semibold text-indigo-600 uppercase mb-2">
            Concepts Hahitantsoa
          </p>
          <div className="flex flex-wrap gap-2">
            {discoveryItems.map((item) => (
              <span
                key={item.concept}
                className="px-3 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 text-xs font-medium"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase mr-1">
              Filtres :
            </span>
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === f.key
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
                {statusCounts[f.key] != null && (
                  <span className="ml-1 opacity-70">
                    ({statusCounts[f.key]})
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="Rechercher par référence, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <LoadingSpinner message="Chargement des réservations Hahitantsoa…" />
      )}

      {/* Error */}
      {error && (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-rose-500 mb-3"></i>
          <p className="text-sm text-rose-600 font-medium">{error}</p>
        </div>
      )}

      {/* Data table */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              Liste des réservations
            </h2>
            <span className="text-sm text-slate-500">
              {filtered.length} résultat(s)
            </span>
          </div>

          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3 text-left font-medium rounded-tl-lg">
                  Réf.
                </th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">
                  Période
                </th>
                <th className="px-4 py-3 text-left font-medium">Articles</th>
                <th className="px-4 py-3 text-center font-medium">
                  Statut
                </th>
                <th className="px-4 py-3 text-center font-medium rounded-tr-lg">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const color = initialsColor(r.customer_display_name);
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          onNavigate("reservation-detail", r.id)
                        }
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {r.public_reference}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          onNavigate("customer", r.customer_id)
                        }
                        className="flex items-center gap-2 group"
                      >
                        <div
                          className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center ${color.text} text-xs font-bold`}
                        >
                          {initialsFromName(r.customer_display_name)}
                        </div>
                        <span className="text-slate-700 group-hover:text-indigo-600 group-hover:underline">
                          {r.customer_display_name}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(r.start_at)}
                      {r.end_at && (
                        <span className="text-slate-400">
                          {" "}
                          → {formatDate(r.end_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.lines.length} article(s)
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formatStatusBadge(r.status)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          onNavigate("reservation-detail", r.id)
                        }
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors"
                      >
                        <i className="fa-solid fa-eye text-[10px]"></i>
                        Voir détail
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState
                      message="Aucune réservation Hahitantsoa ne correspond à votre recherche."
                      icon="fa-calendar-xmark"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
