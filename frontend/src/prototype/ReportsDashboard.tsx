import React, { useEffect, useState, useCallback } from "react";
import { getReportCategory } from "../api";
import type { ReportCategory, ReportCategoryResponse, ReportKpi } from "../types";
import { LoadingSpinner } from "../components";

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

export default function ReportsDashboard({ onNavigate }: ReportsDashboardProps) {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>("reservations");
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [data, setData] = useState<ReportCategoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getReportCategory(activeCategory, period);
      setData(response);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setData(null);
        setError(err.message || "Erreur lors du chargement des rapports.");
      }
    } finally {
      setLoading(false);
    }
  }, [activeCategory, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="page active space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Rapports &amp; BI</h2>
          <p className="text-sm text-slate-500">Analytique et rapports d'exploitation</p>
        </div>
        <div className="flex items-center gap-2">
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
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeCategory === cat.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <i className={`fas ${cat.icon}`}></i>
            <span className="hidden sm:inline">{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-slate-400">
          <LoadingSpinner />
          <p className="mt-3 text-sm">Chargement des indicateurs…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-lg mb-2"></i>
          <p className="text-red-700 text-sm mb-3">{error}</p>
          <button
            onClick={loadData}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition"
          >
            <i className="fas fa-redo mr-2"></i>Réessayer
          </button>
        </div>
      )}

      {/* KPI Grid */}
      {!loading && !error && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </div>
  );
}
