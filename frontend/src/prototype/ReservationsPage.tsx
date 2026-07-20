import React, { useEffect, useMemo, useState } from "react";
import { AppScope } from "../App";
import { EmptyState, LoadingSpinner } from "../components";
import { getReservationDrafts } from "../api";
import type { ReservationDraft } from "../types";

interface ReservationsPageProps {
  onNavigate: (scope: AppScope, param?: string) => void;
  canSensitiveWrite?: boolean;
}

type FilterKey = "all" | "draft" | "confirmed" | "cancelled";

export default function ReservationsPage({ onNavigate, canSensitiveWrite = false }: ReservationsPageProps) {
  const [drafts, setDrafts] = useState<ReservationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getReservationDrafts(undefined, controller.signal)
      .then((data) => {
        setDrafts(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement des réservations.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drafts.filter((r) => {
      const matchesSearch =
        !q ||
        r.public_reference.toLowerCase().includes(q) ||
        r.customer_display_name.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ? true : r.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [search, filter, drafts]);

  const formatStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            Brouillon
          </span>
        );
      case "confirmed":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            Confirmée
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            Annulée
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const formatDateRange = (startAt: string, endAt: string) => {
    const start = startAt ? new Date(startAt).toLocaleDateString("fr-FR") : "—";
    const end = endAt ? new Date(endAt).toLocaleDateString("fr-FR") : "—";
    return `${start} → ${end}`;
  };

  return (
    <div className="page active space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Toutes les réservations</h1>
          <p className="text-sm text-slate-500 mt-1">Index consolidé Hahitantsoa + Titan</p>
        </div>
        {canSensitiveWrite && (
          <button
            onClick={() => onNavigate("reservation-new")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <i className="fa-solid fa-plus mr-2"></i>Nouvelle réservation
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Rechercher par référence, client, statut..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: "all", label: "Tous" },
              { key: "draft", label: "Brouillon" },
              { key: "confirmed", label: "Confirmée" },
              { key: "cancelled", label: "Annulée" },
            ] as { key: FilterKey; label: string }[]).map((f) => (
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
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span>
            <strong>{filtered.length}</strong> dossier(s)
          </span>
        </div>
      </div>

      {loading && (
        <LoadingSpinner message="Chargement des réservations..." />
      )}

      {error && (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-rose-500 mb-3"></i>
          <p className="text-sm text-rose-600 font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3 text-left font-medium rounded-tl-lg">Référence</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Date / Période</th>
                <th className="px-4 py-3 text-left font-medium">Articles</th>
                <th className="px-4 py-3 text-center font-medium rounded-tr-lg">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onNavigate("reservation-detail", r.id)}
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {r.public_reference}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onNavigate("customer", r.customer_id)}
                      className="text-left group"
                    >
                      <div className="font-medium text-slate-800 group-hover:text-indigo-600 group-hover:underline">
                        {r.customer_display_name}
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateRange(r.start_at, r.end_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.lines.length} article(s)
                  </td>
                  <td className="px-4 py-3 text-center rounded-tr-lg">
                    {formatStatusBadge(r.status)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <EmptyState
                      message="Aucune réservation ne correspond à votre recherche."
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
