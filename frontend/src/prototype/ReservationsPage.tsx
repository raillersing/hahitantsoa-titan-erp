import React, { useEffect, useMemo, useState } from "react";
import { AppScope } from "../App";
import { EmptyState, LoadingSpinner } from "../components";
import {
  ApiError,
  deleteHahitantsoaEventDraft,
  deleteReservationDraft,
  getHahitantsoaEventDrafts,
  getReservationDrafts,
} from "../api";
import type { HahitantsoaEventDraft, ReservationDraft } from "../types";

interface ReservationsPageProps {
  onNavigate: (scope: AppScope, param?: string) => void;
  canSensitiveWrite?: boolean;
  canSuperAdminDelete?: boolean;
}

type DomainFilterKey = "all" | "titan" | "hahitantsoa";
type StatusFilterKey = "all" | "draft" | "confirmed" | "cancelled";

export interface UnifiedReservationItem {
  id: string;
  domain: "titan" | "hahitantsoa";
  public_reference: string;
  customer_id: string;
  customer_display_name: string;
  start_at: string;
  end_at: string;
  status: string;
  line_count: number;
  venue_name?: string;
  event_name?: string;
  created_at?: string;
  raw: ReservationDraft | HahitantsoaEventDraft;
}

export default function ReservationsPage({
  onNavigate,
  canSensitiveWrite = false,
  canSuperAdminDelete = false,
}: ReservationsPageProps) {
  const [items, setItems] = useState<UnifiedReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<DomainFilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleDelete = async (item: UnifiedReservationItem) => {
    if (!canSuperAdminDelete || item.status !== "draft" || deletingId) return;
    if (!window.confirm(`Supprimer le brouillon ${item.public_reference} ?`)) return;
    setDeletingId(item.id);
    setActionError(null);
    try {
      if (item.domain === "hahitantsoa") {
        await deleteHahitantsoaEventDraft(item.id);
      } else {
        await deleteReservationDraft(item.id);
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      setActionError(
        error instanceof ApiError && error.status === 403
          ? "Vous n’avez pas l’autorisation de supprimer ce brouillon."
          : error instanceof Error
            ? error.message
            : "La suppression a échoué.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getReservationDrafts(undefined, controller.signal).catch((err) => {
        if (err.name === "AbortError") throw err;
        return [] as ReservationDraft[];
      }),
      getHahitantsoaEventDrafts(undefined, controller.signal).catch((err) => {
        if (err.name === "AbortError") throw err;
        return [] as HahitantsoaEventDraft[];
      }),
    ])
      .then(([titanData, hahitantsoaData]) => {
        const unified: UnifiedReservationItem[] = [
          ...titanData.map((r): UnifiedReservationItem => ({
            id: r.id,
            domain: "titan",
            public_reference: r.public_reference,
            customer_id: r.customer_id,
            customer_display_name: r.customer_display_name,
            start_at: r.start_at,
            end_at: r.end_at,
            status: r.status,
            line_count: r.lines?.length ?? 0,
            created_at: r.created_at,
            raw: r,
          })),
          ...hahitantsoaData.map((h): UnifiedReservationItem => ({
            id: h.id,
            domain: "hahitantsoa",
            public_reference: h.public_reference,
            customer_id: h.customer_id,
            customer_display_name: h.customer_display_name,
            start_at: h.start_at,
            end_at: h.end_at,
            status: h.status,
            line_count: h.lines?.length ?? 0,
            venue_name: h.venue_name,
            event_name: h.event_name,
            created_at: h.created_at,
            raw: h,
          })),
        ];

        unified.sort((a, b) => {
          const timeA = new Date(a.created_at || a.start_at || 0).getTime();
          const timeB = new Date(b.created_at || b.start_at || 0).getTime();
          return timeB - timeA;
        });

        setItems(unified);
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
    return items.filter((r) => {
      const matchesSearch =
        !q ||
        r.public_reference.toLowerCase().includes(q) ||
        r.customer_display_name.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.venue_name && r.venue_name.toLowerCase().includes(q)) ||
        (r.event_name && r.event_name.toLowerCase().includes(q));
      const matchesDomain =
        domainFilter === "all" ? true : r.domain === domainFilter;
      const matchesStatus =
        statusFilter === "all" ? true : r.status === statusFilter;
      return matchesSearch && matchesDomain && matchesStatus;
    });
  }, [search, domainFilter, statusFilter, items]);

  const titanCount = useMemo(
    () => items.filter((i) => i.domain === "titan").length,
    [items],
  );
  const hahitantsoaCount = useMemo(
    () => items.filter((i) => i.domain === "hahitantsoa").length,
    [items],
  );

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
          <p className="text-sm text-slate-500 mt-1">
            Index consolidé Hahitantsoa ({hahitantsoaCount}) + Titan ({titanCount})
          </p>
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
              placeholder="Rechercher par référence (ex: T-001/2026, H-001/2026), client, statut..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
          </div>

          {/* Domain tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 mr-1 uppercase">Volet :</span>
            {(
              [
                { key: "all", label: `Tous (${items.length})` },
                { key: "titan", label: `Titan (${titanCount})` },
                { key: "hahitantsoa", label: `Hahitantsoa (${hahitantsoaCount})` },
              ] as { key: DomainFilterKey; label: string }[]
            ).map((d) => (
              <button
                key={d.key}
                onClick={() => setDomainFilter(d.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  domainFilter === d.key
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: "all", label: "Tous statuts" },
                { key: "draft", label: "Brouillon" },
                { key: "confirmed", label: "Confirmée" },
                { key: "cancelled", label: "Annulée" },
              ] as { key: StatusFilterKey; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === f.key
                    ? "bg-indigo-100 text-indigo-700 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-600 border-t border-slate-100 pt-3">
          <span>
            <strong>{filtered.length}</strong> dossier(s) affiché(s)
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

      {actionError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3 text-left font-medium rounded-tl-lg">Volet & Référence</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Date / Période</th>
                <th className="px-4 py-3 text-left font-medium">Articles</th>
                <th className="px-4 py-3 text-center font-medium">Statut</th>
                {canSuperAdminDelete && (
                  <th className="px-4 py-3 text-right font-medium rounded-tr-lg">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const isHahitantsoa = r.domain === "hahitantsoa" || r.public_reference.startsWith("H-");
                return (
                  <tr key={`${r.domain}-${r.id}`} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isHahitantsoa ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Hahitantsoa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                            Titan
                          </span>
                        )}
                        <button
                          onClick={() =>
                            onNavigate(
                              "reservation-detail",
                              isHahitantsoa ? `hahitantsoa:${r.id}` : `titan:${r.id}`,
                            )
                          }
                          className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline cursor-pointer"
                        >
                          {r.public_reference}
                        </button>
                      </div>
                      {r.event_name && (
                        <p className="text-xs text-slate-500 mt-0.5 font-medium ml-1">
                          {r.event_name}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onNavigate("customer", r.customer_id)}
                        className="text-left group cursor-pointer"
                      >
                        <div className="font-medium text-slate-800 group-hover:text-indigo-600 group-hover:underline">
                          {r.customer_display_name}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateRange(r.start_at, r.end_at)}
                      {r.venue_name && (
                        <span className="block text-xs text-slate-400">
                          <i className="fa-solid fa-location-dot mr-1"></i>
                          {r.venue_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.line_count} article(s)
                    </td>
                    <td className="px-4 py-3 text-center">
                      {formatStatusBadge(r.status)}
                    </td>
                    {canSuperAdminDelete && (
                      <td className="px-4 py-3 text-right">
                        {r.status === "draft" ? (
                          <button
                            type="button"
                            className="font-semibold text-rose-600 hover:underline disabled:opacity-50 cursor-pointer"
                            disabled={deletingId === r.id}
                            onClick={() => void handleDelete(r)}
                          >
                            {deletingId === r.id ? "Suppression…" : "Supprimer"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Annulation requise</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canSuperAdminDelete ? 6 : 5} className="px-4 py-8">
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
