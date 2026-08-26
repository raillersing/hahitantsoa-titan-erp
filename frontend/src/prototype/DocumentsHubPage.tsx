import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  getDocumentInstances,
  getDocumentArtifactHtml,
  getDocumentInstancePdfBlob,
} from "../api";
import type { DocumentInstanceListItem } from "../types";
import { LoadingSpinner, EmptyState } from "../components";

interface DocumentsHubPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

const DOCUMENT_TYPES = [
  { key: "", label: "Tous les types" },
  { key: "proforma", label: "Proforma" },
  { key: "invoice", label: "Facture" },
  { key: "contract", label: "Contrat" },
  { key: "delivery_note", label: "BL" },
  { key: "breakage_repair_invoice", label: "Casse" },
  { key: "amendment", label: "Avenant" },
  { key: "receipt", label: "Décharge" },
] as const;

const BUSINESS_SCOPES = [
  { key: "", label: "Tous" },
  { key: "titan", label: "Titan" },
  { key: "hahitantsoa", label: "Hahitantsoa" },
] as const;

const DATE_FILTERS = [
  { key: "", label: "Toutes dates" },
  { key: "this_month", label: "Ce mois" },
  { key: "this_quarter", label: "Ce trimestre" },
  { key: "year_2024", label: "2024" },
] as const;

const ITEMS_PER_PAGE = 10;

function getDateRange(filter: string): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  if (filter === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    return { from, to };
  }
  if (filter === "this_quarter") {
    const quarter = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split("T")[0];
    return { from, to };
  }
  if (filter === "year_2024") {
    return { from: "2024-01-01", to: "2024-12-31" };
  }
  return {};
}

function typeBadge(type: string): { icon: string; bg: string; text: string; label: string } {
  const t = type.toLowerCase();
  if (t === "proforma") return { icon: "P", bg: "bg-blue-100", text: "text-blue-700", label: "Proforma" };
  if (t === "invoice" || t === "facture") return { icon: "F", bg: "bg-emerald-100", text: "text-emerald-700", label: "Facture" };
  if (t === "contract" || t === "contrat") return { icon: "C", bg: "bg-indigo-100", text: "text-indigo-700", label: "Contrat" };
  if (t === "delivery_note" || t === "bl") return { icon: "B", bg: "bg-amber-100", text: "text-amber-700", label: "BL" };
  if (t === "breakage_loss" || t === "casse" || t === "breakage_repair_invoice") return { icon: "X", bg: "bg-red-100", text: "text-red-700", label: "Casse" };
  if (t === "amendment" || t === "avenant") return { icon: "A", bg: "bg-violet-100", text: "text-violet-700", label: "Avenant" };
  if (t === "receipt" || t === "decharge") return { icon: "D", bg: "bg-slate-100", text: "text-slate-700", label: "Décharge" };
  return { icon: "?", bg: "bg-slate-100", text: "text-slate-700", label: type };
}

function statusBadge(status: string): { className: string; label: string } {
  const s = status.toLowerCase();
  if (s === "prepared") return { className: "bg-slate-100 text-slate-700 border-slate-200", label: "Brouillon" };
  if (s === "generated") return { className: "bg-blue-50 text-blue-700 border-blue-200", label: "Généré" };
  if (s === "issued") return { className: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Émis" };
  if (s === "voided") return { className: "bg-red-50 text-red-700 border-red-200", label: "Annulé" };
  return { className: "bg-slate-100 text-slate-700 border-slate-200", label: status };
}

function scopeLabel(scope: string): string {
  if (scope === "titan") return "Titan";
  if (scope === "hahitantsoa") return "Hahitantsoa";
  return scope;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatAmount(amount?: string | number | null): string {
  if (amount == null) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  return `${n.toLocaleString("fr-FR")} Ar`;
}

export default function DocumentsHubPage({ onNavigate }: DocumentsHubPageProps) {
  const [docs, setDocs] = useState<DocumentInstanceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [previewDoc, setPreviewDoc] = useState<DocumentInstanceListItem | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewCloseButtonRef = useRef<HTMLButtonElement>(null);
  const lastPreviewTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loadDocs = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const dateRange = getDateRange(dateFilter);
      const data = await getDocumentInstances(
        {
          document_type: typeFilter || undefined,
          business_scope: scopeFilter || undefined,
          date_from: dateRange.from,
          date_to: dateRange.to,
          ordering: "-created_at",
        },
        controller.signal,
      );
      setDocs(data ?? []);
      setPage(1);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Erreur lors du chargement des documents.");
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [typeFilter, scopeFilter, dateFilter]);

  useEffect(() => {
    const cleanup = loadDocs();
    return () => { void cleanup.then((fn) => fn?.()); };
  }, [loadDocs]);

  const stats = useMemo(() => {
    const total = docs.length;
    const proformas = docs.filter((d) => d.document_type.toLowerCase() === "proforma").length;
    const invoices = docs.filter((d) => d.document_type.toLowerCase() === "invoice" || d.document_type.toLowerCase() === "facture").length;
    const pending = docs.filter((d) => d.status === "prepared" || d.status === "generated").length;
    return { total, proformas, invoices, pending };
  }, [docs]);

  const filteredDocs = useMemo(() => {
    let result = docs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.customer_display_name.toLowerCase().includes(q) ||
          d.reservation_public_reference.toLowerCase().includes(q) ||
          d.document_type.toLowerCase().includes(q) ||
          d.template_label.toLowerCase().includes(q),
      );
    }
    return result;
  }, [docs, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedDocs = filteredDocs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (!previewDoc) {
      setPreviewHtml(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    getDocumentArtifactHtml(previewDoc.id)
      .then((html) => {
        if (!cancelled) setPreviewHtml(html);
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Aperçu indisponible.");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [previewDoc]);

  useEffect(() => {
    if (!previewDoc) return;
    previewCloseButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreviewDoc(null);
        lastPreviewTriggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [previewDoc]);

  const openPreview = useCallback((doc: DocumentInstanceListItem, trigger?: HTMLButtonElement) => {
    lastPreviewTriggerRef.current = trigger ?? null;
    setPreviewDoc(doc);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewDoc(null);
    lastPreviewTriggerRef.current?.focus();
  }, []);

  const handlePdfDownload = useCallback(async (doc: DocumentInstanceListItem) => {
    try {
      const blob = await getDocumentInstancePdfBlob(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.reservation_public_reference || doc.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Impossible de télécharger le PDF.");
    }
  }, []);

  const handleOpenSource = useCallback(
    (doc: DocumentInstanceListItem) => {
      if (doc.reservation_draft_id) {
        onNavigate("reservation", doc.reservation_draft_id);
      } else if (doc.hahitantsoa_event_draft_id) {
        onNavigate("hahitantsoa-event", doc.hahitantsoa_event_draft_id);
      }
    },
    [onNavigate],
  );

  const statsCards = [
    { label: "Documents totaux", value: stats.total, color: "text-slate-900" },
    { label: "Proformas", value: stats.proformas, color: "text-indigo-600" },
    { label: "Factures", value: stats.invoices, color: "text-emerald-600" },
    { label: "En attente", value: stats.pending, color: "text-amber-600" },
  ];

  return (
    <div className="page active space-y-6 relative">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Hub Documentaire</h2>
          <p className="text-sm text-slate-500">Tous les documents en un coup d'œil</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              aria-label="Rechercher un document"
              placeholder="Rechercher client, référence, type…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
          <button
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            onClick={() => onNavigate("documents", "templates")}
          >
            <i className="fa-solid fa-plus mr-2"></i>Nouveau
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((s) => (
          <button
            type="button"
            key={s.label}
            className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm cursor-pointer hover:shadow-md transition"
            onClick={() => {
              if (s.label === "Proformas") setTypeFilter("proforma");
              else if (s.label === "Factures") setTypeFilter("invoice");
              else if (s.label === "En attente") { setTypeFilter(""); /* no status filter in UI, just visual */ }
              else setTypeFilter("");
            }}
            aria-label={`Filtrer par ${s.label}`}
          >
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-slate-500 mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-600 mr-1">Filtres:</span>
        {DOCUMENT_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTypeFilter(t.key); setPage(1); }}
            aria-pressed={typeFilter === t.key}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              typeFilter === t.key
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="w-px h-5 bg-slate-300 mx-1 hidden sm:inline-block"></span>
        {BUSINESS_SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setScopeFilter(s.key); setPage(1); }}
            aria-pressed={scopeFilter === s.key}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              scopeFilter === s.key
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="w-px h-5 bg-slate-300 mx-1 hidden sm:inline-block"></span>
        {DATE_FILTERS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => { setDateFilter(d.key); setPage(1); }}
            aria-pressed={dateFilter === d.key}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              dateFilter === d.key
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && <LoadingSpinner size="sm" message="Chargement des documents…" />}
      {!loading && error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button className="underline font-semibold" onClick={() => void loadDocs()}>Réessayer</button>
        </div>
      )}

      {/* Desktop table */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Documents récents</h3>
            <span className="text-xs text-slate-500">{filteredDocs.length} résultat(s)</span>
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold">
                  <th className="px-6 py-3 text-left">Type</th>
                  <th className="px-6 py-3 text-left">Référence</th>
                  <th className="px-6 py-3 text-left">Client</th>
                  <th className="px-6 py-3 text-left">Dossier source</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-right">Montant</th>
                  <th className="px-6 py-3 text-left">Statut</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDocs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8">
                      <EmptyState message="Aucun document trouvé." icon="fa-file-alt" />
                    </td>
                  </tr>
                )}
                {paginatedDocs.map((doc) => {
                  const tb = typeBadge(doc.document_type);
                  const sb = statusBadge(doc.status);
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`w-8 h-8 rounded-lg ${tb.bg} ${tb.text} flex items-center justify-center text-xs font-bold`}>
                            {tb.icon}
                          </span>
                          <span className="text-xs text-slate-500">{tb.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{doc.reservation_public_reference || "—"}</div>
                        <div className="text-xs text-slate-500">{scopeLabel(doc.business_scope)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{doc.customer_display_name || "—"}</div>
                        <div className="text-xs text-slate-500">{doc.customer_email || doc.customer_phone || ""}</div>
                      </td>
                      <td className="px-6 py-4">
                        {doc.reservation_draft_id || doc.hahitantsoa_event_draft_id ? (
                          <button
                            onClick={() => handleOpenSource(doc)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            Voir le dossier →
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(doc.created_at)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">{formatAmount(null)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${sb.className}`}>
                          {sb.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          type="button"
                          aria-label={`Aperçu de ${doc.reservation_public_reference || doc.document_type}`}
                          title="Aperçu"
                          onClick={(event) => openPreview(doc, event.currentTarget)}
                        >
                          <i className="fa-solid fa-eye"></i>
                        </button>
                        <button
                          className="mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          type="button"
                          aria-label={`Télécharger le PDF de ${doc.reservation_public_reference || doc.document_type}`}
                          title="PDF"
                          onClick={() => void handlePdfDownload(doc)}
                        >
                          <i className="fa-solid fa-file-pdf"></i>
                        </button>
                        <button
                          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          type="button"
                          aria-label="Ouvrir les modèles de documents"
                          title="Plus"
                          onClick={() => onNavigate("documents", "templates")}
                        >
                          <i className="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {paginatedDocs.length === 0 && (
              <div className="p-6">
                <EmptyState message="Aucun document trouvé." icon="fa-file-alt" />
              </div>
            )}
            {paginatedDocs.map((doc) => {
              const tb = typeBadge(doc.document_type);
              const sb = statusBadge(doc.status);
              return (
                <div key={doc.id} className="p-4 space-y-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-8 h-8 rounded-lg ${tb.bg} ${tb.text} flex items-center justify-center text-xs font-bold`}>
                        {tb.icon}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{tb.label}</div>
                        <div className="text-xs text-slate-500">{scopeLabel(doc.business_scope)}</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${sb.className}`}>
                      {sb.label}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Réf:</span>{" "}
                    <span className="font-medium text-slate-900">{doc.reservation_public_reference || "—"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-500">Client:</span>{" "}
                    <span className="font-medium text-slate-900">{doc.customer_display_name || "—"}</span>
                  </div>
                  <div className="text-sm text-slate-600">{formatDate(doc.created_at)}</div>
                  {(doc.reservation_draft_id || doc.hahitantsoa_event_draft_id) && (
                    <button
                      onClick={() => handleOpenSource(doc)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Voir le dossier →
                    </button>
                  )}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      type="button"
                      aria-label={`Aperçu de ${doc.reservation_public_reference || doc.document_type}`}
                      title="Aperçu"
                      onClick={(event) => openPreview(doc, event.currentTarget)}
                    >
                      <i className="fa-solid fa-eye"></i>
                    </button>
                    <button
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      type="button"
                      aria-label={`Télécharger le PDF de ${doc.reservation_public_reference || doc.document_type}`}
                      title="PDF"
                      onClick={() => void handlePdfDownload(doc)}
                    >
                      <i className="fa-solid fa-file-pdf"></i>
                    </button>
                    <button
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      type="button"
                      aria-label="Ouvrir les modèles de documents"
                      title="Plus"
                      onClick={() => onNavigate("documents", "templates")}
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {filteredDocs.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Affichage {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredDocs.length)} sur {filteredDocs.length} documents
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Page précédente"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === currentPage ? "page" : undefined}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      p === currentPage ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Page suivante"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document preview */}
      {previewDoc && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px]"
            aria-hidden="true"
            onClick={closePreview}
          />
          <div
            className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-4 lg:inset-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-instance-preview-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Document généré</p>
                <h3 id="document-instance-preview-title" className="truncate font-bold text-slate-900">Aperçu du document</h3>
                <p className="truncate text-xs text-slate-500">{previewDoc.reservation_public_reference || previewDoc.id}</p>
              </div>
              <button ref={previewCloseButtonRef} type="button" onClick={closePreview} aria-label="Fermer l’aperçu" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-h-0 overflow-auto bg-slate-100 p-3 sm:p-6">
                {previewLoading && <div className="flex min-h-full items-center justify-center"><LoadingSpinner size="sm" message="Chargement de l'aperçu…" /></div>}
                {previewError && <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert"><i className="fa-solid fa-circle-exclamation mr-2"></i>{previewError}</div>}
                {previewHtml && !previewLoading && !previewError && (
                  <div className={`document-preview-shell mx-auto min-h-full w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-6 ${previewDoc.template_key === "hahitantsoa.payment_receipt.v1" ? "document-preview-shell--thermal-receipt" : "max-w-[210mm]"}`}>
                    <div className="document-instance-artifact" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                )}
                {!previewHtml && !previewLoading && !previewError && <div className="flex min-h-full items-center justify-center"><EmptyState message="Aucun aperçu disponible pour ce document." icon="fa-file-alt" /></div>}
              </div>
              <aside className="max-h-56 overflow-y-auto border-t border-slate-200 bg-white p-4 sm:p-5 lg:max-h-none lg:border-l lg:border-t-0">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Informations</h4>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm lg:block lg:space-y-4">
                  <div><dt className="text-xs text-slate-500">Type</dt><dd className="mt-1 font-semibold text-slate-900">{typeBadge(previewDoc.document_type).label}</dd></div>
                  <div><dt className="text-xs text-slate-500">Volet</dt><dd className="mt-1 font-semibold text-slate-900">{scopeLabel(previewDoc.business_scope)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Client</dt><dd className="mt-1 break-words font-semibold text-slate-900">{previewDoc.customer_display_name || "—"}</dd></div>
                  <div><dt className="text-xs text-slate-500">Statut</dt><dd className="mt-1 font-semibold text-slate-900">{statusBadge(previewDoc.status).label}</dd></div>
                  <div><dt className="text-xs text-slate-500">Date</dt><dd className="mt-1 font-semibold text-slate-900">{formatDate(previewDoc.created_at)}</dd></div>
                </dl>
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-xs leading-5 text-slate-500">Le document est présenté sur un canvas de lecture. Le contenu et la mise en forme du modèle ne sont pas modifiés.</p>
                </div>
              </aside>
            </div>
            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
              <button
                type="button"
                className="min-h-11 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                onClick={() => void handlePdfDownload(previewDoc)}
              >
                <i className="fa-solid fa-file-pdf mr-2"></i>Télécharger PDF
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                onClick={closePreview}
              >
                Fermer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
