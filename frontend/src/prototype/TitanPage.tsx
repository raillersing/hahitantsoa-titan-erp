import React, { useEffect, useMemo, useState } from "react";
import BrandIdentity from "./BrandIdentity";
import { LoadingSpinner, EmptyState } from "../components";
import { getReservationDrafts } from "../api";
import type { ReservationDraft } from "../types";

const TITAN_KINDS = new Set(["material", "article", "material_pack"]);

interface TitanPageProps {
  onNavigate: (scope: any, param?: string) => void;
  canSensitiveWrite?: boolean;
}

type FilterKey = "all" | "en_cours" | "a_preparer" | "sorties";

function isTitanDraft(draft: ReservationDraft): boolean {
  if (draft.lines.length === 0) return false;
  return draft.lines.every((line: { inventory_item_kind: string }) => TITAN_KINDS.has(line.inventory_item_kind));
}

function formatStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return (
        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
          À préparer
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

function formatDateRange(startAt: string, endAt: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
  const start = startAt ? new Date(startAt).toLocaleDateString("fr-FR", opts) : "—";
  const end = endAt ? new Date(endAt).toLocaleDateString("fr-FR", opts) : "—";
  return `${start} → ${end}`;
}

function formatLinesSummary(lines: ReservationDraft["lines"]): string {
  if (lines.length === 0) return "—";
  return lines
    .map((l: { inventory_item_name: string; quantity: number }) => `${l.inventory_item_name} × ${l.quantity}`)
    .join(", ");
}

export default function TitanPage({ onNavigate, canSensitiveWrite = false }: TitanPageProps) {
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
      .then((data: ReservationDraft[]) => {
        setDrafts(data.filter(isTitanDraft) as ReservationDraft[]);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement des réservations Titan.");
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
        r.customer_display_name.toLowerCase().includes(q);
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "en_cours"
            ? r.status === "confirmed" && !r.cancelled_at
            : filter === "a_preparer"
              ? r.status === "draft"
              : filter === "sorties"
                ? r.status === "confirmed" && r.confirmed_at
                : true;
      return matchesSearch && matchesFilter;
    });
  }, [search, filter, drafts]);

  const filterButtons: { key: FilterKey; label: string }[] = [
    { key: "all", label: "Toutes" },
    { key: "en_cours", label: "En cours" },
    { key: "a_preparer", label: "À préparer" },
    { key: "sorties", label: "Sorties" },
  ];

  return (
    <div className="page active space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <BrandIdentity brand="titan" className="module-brand" />
          <h1 className="text-2xl font-bold text-slate-800">
            <i className="fa-solid fa-box text-indigo-600 mr-2"></i>Réservations Titan
          </h1>
          <p className="text-sm text-slate-500 mt-1">Location de matériel uniquement — Aucun local ni service</p>
        </div>
        {canSensitiveWrite && (
          <button onClick={() => onNavigate("reservation-new", "titan")} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <i className="fa-solid fa-plus mr-2"></i>Nouvelle location
          </button>
        )}
      </div>

      {/* Règle Titan alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <i className="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5"></i>
        <div>
          <p className="text-sm font-semibold text-amber-800">Règle Titan — Pure location de matériel</p>
          <p className="text-xs text-amber-700 mt-1">
            Ce module n'accepte que les articles de type <strong>material</strong>, <strong>article</strong> et{" "}
            <strong>material_pack</strong>. Les locaux, salles, services et prestations annexes sont exclus du périmètre Titan.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase">Filtres :</span>
            {filterButtons.map((f) => (
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
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Rechercher par référence ou client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <LoadingSpinner message="Chargement des réservations Titan..." />}

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
              Liste des locations
              <span className="ml-2 text-sm font-normal text-slate-400">
                {filtered.length} résultat(s)
              </span>
            </h2>
          </div>

          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                <th className="px-4 py-3 text-left font-medium rounded-tl-lg">N°</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Date location</th>
                <th className="px-4 py-3 text-left font-medium">Articles</th>
                <th className="px-4 py-3 text-center font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium rounded-tr-lg">Actions</th>
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
                      className="flex items-center gap-2 group"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {r.customer_display_name
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <span className="text-slate-700 group-hover:text-indigo-600 group-hover:underline">
                        {r.customer_display_name}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateRange(r.start_at, r.end_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={formatLinesSummary(r.lines)}>
                    {formatLinesSummary(r.lines)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {formatStatusBadge(r.status)}
                  </td>
                  <td className="px-4 py-3 text-right rounded-tr-lg">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onNavigate("reservation-detail", r.id)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Voir les détails"
                      >
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      {r.status === "draft" && canSensitiveWrite && (
                        <button
                          onClick={() => onNavigate("reservation-detail", r.id)}
                          className="text-slate-400 hover:text-green-600 transition-colors"
                          title="Confirmer la réservation"
                        >
                          <i className="fa-solid fa-check-circle"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <EmptyState
                      message="Aucune réservation Titan ne correspond à votre recherche."
                      icon="fa-box-open"
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
