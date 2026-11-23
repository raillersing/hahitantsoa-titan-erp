import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { ApiError, getReportCategory, downloadTabularExport } from "../api";
import type { ReportCategory, ReportCategoryResponse, ReportKpi } from "../types";
import { LoadingSpinner } from "../components";
import { useOptionalAuth } from "../AuthContext";
import { reportCategoriesForUser } from "../capabilities";

interface ReportsDashboardProps {
  onNavigate: (scope: any, param?: string) => void;
}

const CATEGORIES: { key: ReportCategory; label: string; icon: string }[] = [
  { key: "reservations", label: "Réservations", icon: "fa-calendar-check" },
  { key: "sales_billing", label: "Ventes & Facturation", icon: "fa-file-invoice-dollar" },
  { key: "payments", label: "Paiements", icon: "fa-money-bill-wave" },
  { key: "prospects", label: "Prospects", icon: "fa-user-plus" },
  { key: "logistics", label: "Logistique", icon: "fa-truck" },
  { key: "inventory", label: "Inventaire", icon: "fa-boxes" },
  { key: "documents", label: "Documents", icon: "fa-file-alt" },
];

const PERIODS = [
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "quarter", label: "Trimestre" },
  { key: "year", label: "Année" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadReportCsv(data: ReportCategoryResponse): void {
  const rows = [
    ["Indicateur", "Valeur", "Valeur précédente", "Tendance (%)"],
    ...data.kpis.map((kpi) => [kpi.label, kpi.value, kpi.previous_value ?? "", kpi.trend_pct ?? ""]),
  ];
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\n")}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `rapport-${data.category}-${data.period}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatKpiValue(kpi: ReportKpi): string {
  const val = kpi.value;
  if (kpi.format === "money") {
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (Number.isNaN(num)) return String(val);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M Ar`;
    if (num >= 1_000) return `${Math.round(num / 1_000)}k Ar`;
    return `${Math.round(num)} Ar`;
  }
  if (kpi.format === "percent") {
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (Number.isNaN(num)) return String(val);
    return `${num.toFixed(1)}%`;
  }
  return String(val);
}

function trendBadgeClass(trend?: number): string {
  if (trend === undefined || trend === null) return "bg-slate-100 text-slate-500";
  if (trend > 0) return "bg-emerald-50 text-emerald-700";
  if (trend < 0) return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-500";
}

function trendIcon(trend?: number): string {
  if (trend === undefined || trend === null) return "fa-minus";
  if (trend > 0) return "fa-arrow-up";
  if (trend < 0) return "fa-arrow-down";
  return "fa-minus";
}

function formatReportErrorMessage(err: unknown): string {
  const status = err instanceof ApiError ? err.status : (err as { status?: number } | null)?.status;
  const rawMessage = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (
    status === 403 ||
    /do not have permission|forbidden|permission denied/i.test(rawMessage)
  ) {
    return "Vous n'avez pas l'autorisation de consulter cette catégorie de rapport.";
  }
  if (
    status === 401 ||
    /authentication credentials were not provided|unauthorized/i.test(rawMessage)
  ) {
    return "Votre session a expiré. Veuillez vous reconnecter pour consulter les rapports.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(rawMessage)) {
    return "Impossible de joindre le serveur pour charger les rapports. Vérifiez votre connexion et réessayez.";
  }
  if (
    (status !== undefined && status >= 500) ||
    /the requested data could not be loaded|internal server error|bad gateway|service unavailable/i.test(
      rawMessage,
    )
  ) {
    return "Erreur serveur lors du chargement des rapports. Veuillez réessayer.";
  }
  return rawMessage || "Erreur lors du chargement des rapports.";
}

function formatExportErrorMessage(err: unknown): string {
  const status = err instanceof ApiError ? err.status : (err as { status?: number } | null)?.status;
  const rawMessage = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (
    status === 401 ||
    status === 403 ||
    /do not have permission|forbidden|permission denied|unauthorized/i.test(rawMessage)
  ) {
    return "Vous n'avez pas l'autorisation d'exporter ce document.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(rawMessage)) {
    return "Impossible de joindre le serveur pour télécharger l'export. Vérifiez votre connexion et réessayez.";
  }
  if (
    (status !== undefined && status >= 500) ||
    /the requested data could not be loaded|internal server error|bad gateway|service unavailable/i.test(
      rawMessage,
    )
  ) {
    return "Erreur serveur lors du téléchargement de l'export. Veuillez réessayer.";
  }
  return rawMessage || "Erreur lors du téléchargement de l'export.";
}

export default function ReportsDashboard({ onNavigate }: ReportsDashboardProps) {
  const auth = useOptionalAuth();
  const sessionUser = auth?.state.status === "authenticated" ? auth.state.user : null;
  const sessionKey = auth
    ? sessionUser
      ? `${sessionUser.id}:${sessionUser.roles.join(",")}:${Array.isArray(sessionUser.reportCategories) ? sessionUser.reportCategories.join(",") : "legacy"}`
      : `status:${auth.state.status}`
    : "standalone";

  const availableCategories = useMemo(() => {
    if (!auth) return CATEGORIES;
    if (auth.state.status !== "authenticated") return [];
    const user = auth.state.user;
    if (Array.isArray(user.reportCategories)) {
      const allowed = reportCategoriesForUser(user);
      return CATEGORIES.filter((cat) => allowed.includes(cat.key));
    }
    if (user.is_staff || user.capabilities?.canSensitiveWrite) {
      return CATEGORIES;
    }
    return [];
  }, [auth]);

  const [selection, setSelection] = useState<{ sessionKey: string; category: ReportCategory } | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [data, setData] = useState<ReportCategoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Tabular accounting & operational exports state
  const [exportScope, setExportScope] = useState<string>("all");
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");
  const [exportPaymentMethod, setExportPaymentMethod] = useState<string>("all");
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const exportSeqRef = useRef(0);

  // Derive the effective category synchronously so no unauthorized default category
  // (such as "reservations") is ever requested on initial mount or account switch.
  const selectedCategory = selection?.sessionKey === sessionKey ? selection.category : null;
  const effectiveCategory: ReportCategory | null = useMemo(() => {
    if (availableCategories.length === 0) return null;
    if (selectedCategory && availableCategories.some((cat) => cat.key === selectedCategory)) {
      return selectedCategory;
    }
    return availableCategories[0].key;
  }, [availableCategories, selectedCategory]);

  // Invalidate any in-flight tabular export and reset export banners on session change or unmount.
  useEffect(() => {
    exportSeqRef.current += 1;
    setDownloadingType(null);
    setExportError(null);
    setExportSuccess(null);
    return () => {
      exportSeqRef.current += 1;
    };
  }, [sessionKey]);

  const handleTabularExport = async (type: "sales" | "payments" | "cautions" | "breakage") => {
    const exportId = ++exportSeqRef.current;
    setDownloadingType(type);
    setExportError(null);
    setExportSuccess(null);
    try {
      await downloadTabularExport(type, {
        scope: exportScope,
        start_date: exportStartDate || undefined,
        end_date: exportEndDate || undefined,
        method: type === "payments" ? exportPaymentMethod : undefined,
      });
      if (exportSeqRef.current !== exportId) return;
      setExportSuccess("Export téléchargé avec succès.");
    } catch (err: unknown) {
      if (exportSeqRef.current !== exportId) return;
      setExportError(formatExportErrorMessage(err));
    } finally {
      if (exportSeqRef.current === exportId) {
        setDownloadingType(null);
      }
    }
  };

  const retryLoad = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const requestId = ++requestSeqRef.current;
    abortControllerRef.current?.abort();

    if (!effectiveCategory) {
      abortControllerRef.current = null;
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setData(null);
    setLoading(true);
    setError(null);

    getReportCategory(effectiveCategory, period, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || requestSeqRef.current !== requestId) return;
        setData(response);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (
          controller.signal.aborted ||
          requestSeqRef.current !== requestId ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        setData(null);
        setError(formatReportErrorMessage(err));
        setLoading(false);
      });

    return () => {
      requestSeqRef.current += 1;
      controller.abort();
    };
  }, [effectiveCategory, period, sessionKey, reloadNonce]);

  return (
    <div className="page active space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Rapports &amp; BI</h2>
          <p className="text-sm text-slate-500">Analytique et rapports d'exploitation</p>
        </div>
        <div className="flex items-center gap-2" data-tutorial="reports-filter-date">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                period === p.key
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            data-tutorial="reports-export-btn"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => data && downloadReportCsv(data)}
            disabled={!data || loading}
          >
            <i className="fas fa-file-csv mr-2" aria-hidden="true"></i>
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {availableCategories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelection({ sessionKey, category: cat.key })}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              effectiveCategory === cat.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <i className={`fas ${cat.icon}`}></i>
            <span className="hidden sm:inline">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* No authorized category */}
      {!loading && !error && !effectiveCategory && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900" role="status">
          Aucune catégorie de rapport n'est autorisée pour votre session actuelle.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-slate-400">
          <LoadingSpinner />
          <p className="mt-3 text-sm">Chargement des indicateurs…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
          <i className="fas fa-exclamation-triangle text-red-500 text-lg mb-2"></i>
          <p className="text-red-700 text-sm mb-3">{error}</p>
          <button
            onClick={retryLoad}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
          >
            <i className="fas fa-redo mr-2"></i>Réessayer
          </button>
        </div>
      )}

      {/* KPI Grid */}
      {!loading && !error && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tutorial="reports-kpi-grid">
          {data.kpis.map((kpi) => (
            <div
              key={kpi.key}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="text-2xl font-bold text-slate-900">
                  {formatKpiValue(kpi)}
                </p>
                {kpi.trend_pct !== undefined && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${trendBadgeClass(kpi.trend_pct)}`}
                  >
                    <i className={`fas ${trendIcon(kpi.trend_pct)}`}></i>
                    {kpi.trend_pct > 0 ? "+" : ""}
                    {kpi.trend_pct}%
                  </span>
                )}
              </div>
              {kpi.previous_value !== undefined && (
                <p className="mt-1 text-xs text-slate-400">
                  Période précédente : {formatKpiValue({ ...kpi, value: kpi.previous_value })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && data && data.kpis.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-slate-400">
          <i className="fas fa-chart-bar text-3xl mb-3"></i>
          <p className="text-sm">Aucun indicateur disponible pour cette catégorie.</p>
        </div>
      )}

      {/* Section Exports Comptables & Opérationnels */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-file-excel text-emerald-600"></i>
              Exports Comptables &amp; Fiscaux (Tabulaires)
            </h3>
            <p className="text-sm text-slate-500">
              Extractions conformes aux normes malgaches (PCG 2005, TVA, isolation des cautions) au format CSV (séparateur point-virgule et encodage UTF-8 BOM pour Excel).
            </p>
          </div>
        </div>

        {/* Bannières de notification */}
        {exportError && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-exclamation-circle text-rose-500"></i>
              <span>{exportError}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportError(null)}
              className="text-rose-500 hover:text-rose-700"
              aria-label="Fermer"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {exportSuccess && (
          <div
            role="status"
            className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          >
            <div className="flex items-center gap-2">
              <i className="fas fa-check-circle text-emerald-500"></i>
              <span>{exportSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setExportSuccess(null)}
              className="text-emerald-500 hover:text-emerald-700"
              aria-label="Fermer"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {/* Filtres d'export */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <label htmlFor="export-start-date" className="block text-xs font-semibold text-slate-600 mb-1">
              Date de début
            </label>
            <input
              id="export-start-date"
              type="date"
              value={exportStartDate}
              onChange={(e) => setExportStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="export-end-date" className="block text-xs font-semibold text-slate-600 mb-1">
              Date de fin
            </label>
            <input
              id="export-end-date"
              type="date"
              value={exportEndDate}
              onChange={(e) => setExportEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="export-scope" className="block text-xs font-semibold text-slate-600 mb-1">
              Volet d'activité
            </label>
            <select
              id="export-scope"
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tous les volets</option>
              <option value="titan">Titan (Location pure)</option>
              <option value="hahitantsoa">Hahitantsoa (Événementiel)</option>
            </select>
          </div>

          <div>
            <label htmlFor="export-payment-method" className="block text-xs font-semibold text-slate-600 mb-1">
              Mode de règlement (Trésorerie)
            </label>
            <select
              id="export-payment-method"
              value={exportPaymentMethod}
              onChange={(e) => setExportPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tous les modes</option>
              <option value="cash">Espèces (Caisse)</option>
              <option value="bank_transfer">Virement Bancaire</option>
              <option value="mvola">MVola</option>
              <option value="orange_money">Orange Money</option>
              <option value="cheque">Chèque</option>
              <option value="versement">Versement</option>
            </select>
          </div>
        </div>

        {/* Grille des 4 exports */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Facturier des Ventes */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300 transition">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 font-semibold text-base">
                <i className="fas fa-file-invoice"></i>
                <h4>Facturier des Ventes</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Journal officiel des factures : NIF, STAT, HT, TVA 20%, TTC et statut d'apurement.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTabularExport("sales")}
              disabled={downloadingType !== null}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {downloadingType === "sales" ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Génération…</span>
                </>
              ) : (
                <>
                  <i className="fas fa-download"></i>
                  <span>Exporter Facturier</span>
                </>
              )}
            </button>
          </div>

          {/* Journal des Encaissements */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300 transition">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-base">
                <i className="fas fa-money-bill-wave"></i>
                <h4>Journal des Règlements</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Recettes et décaissements : acomptes, soldes, remboursements de caution et références bancaires.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTabularExport("payments")}
              disabled={downloadingType !== null}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {downloadingType === "payments" ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Génération…</span>
                </>
              ) : (
                <>
                  <i className="fas fa-download"></i>
                  <span>Exporter Règlements</span>
                </>
              )}
            </button>
          </div>

          {/* Balance des Cautions */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-300 transition">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600 font-semibold text-base">
                <i className="fas fa-shield-alt"></i>
                <h4>Balance des Cautions</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dépôts de garantie : montants reçus, retenues sur dégradations et reliquats à restituer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTabularExport("cautions")}
              disabled={downloadingType !== null}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50"
            >
              {downloadingType === "cautions" ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Génération…</span>
                </>
              ) : (
                <>
                  <i className="fas fa-download"></i>
                  <span>Exporter Cautions</span>
                </>
              )}
            </button>
          </div>

          {/* Registre de la Casse */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-rose-300 transition">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-600 font-semibold text-base">
                <i className="fas fa-exclamation-triangle"></i>
                <h4>Registre de la Casse</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Livre des dégradations et pertes : articles, quantités, barème et montants imputés.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleTabularExport("breakage")}
              disabled={downloadingType !== null}
              className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition disabled:opacity-50"
            >
              {downloadingType === "breakage" ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Génération…</span>
                </>
              ) : (
                <>
                  <i className="fas fa-download"></i>
                  <span>Exporter Casse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
