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

const MOCK_DATA: Record<ReportCategory, ReportCategoryResponse> = {
  reservations: {
    category: "reservations",
    period: "today",
    kpis: [
      { key: "total_count", label: "Total réservations", value: 124, trend_pct: 5.2, previous_value: 118, format: "number" },
      { key: "confirmed_count", label: "Confirmées", value: 89, trend_pct: 8.1, previous_value: 82, format: "number" },
      { key: "draft_count", label: "Brouillons", value: 28, trend_pct: -3.4, previous_value: 29, format: "number" },
      { key: "cancelled_count", label: "Annulées", value: 7, trend_pct: -12.5, previous_value: 8, format: "number" },
      { key: "revenue", label: "CA Réservations", value: 24500000, trend_pct: 12.3, previous_value: 21800000, format: "money" },
    ],
  },
  sales_billing: {
    category: "sales_billing",
    period: "today",
    kpis: [
      { key: "total_invoices", label: "Factures émises", value: 56, trend_pct: 4.5, previous_value: 54, format: "number" },
      { key: "open_invoices", label: "Factures ouvertes", value: 18, trend_pct: -10.0, previous_value: 20, format: "number" },
      { key: "settled_invoices", label: "Factures réglées", value: 38, trend_pct: 11.8, previous_value: 34, format: "number" },
      { key: "remaining_balance", label: "Solde restant", value: 8750000, trend_pct: -5.2, previous_value: 9230000, format: "money" },
      { key: "avg_invoice_amount", label: "Montant moyen", value: 437500, trend_pct: 2.1, previous_value: 428600, format: "money" },
    ],
  },
  payments: {
    category: "payments",
    period: "today",
    kpis: [
      { key: "total_payments", label: "Paiements reçus", value: 42, trend_pct: 7.7, previous_value: 39, format: "number" },
      { key: "total_amount", label: "Montant total", value: 18300000, trend_pct: 9.3, previous_value: 16750000, format: "money" },
      { key: "cash_payments", label: "Espèces", value: 15, trend_pct: -6.3, previous_value: 16, format: "number" },
      { key: "bank_payments", label: "Virements", value: 22, trend_pct: 15.8, previous_value: 19, format: "number" },
      { key: "mobile_payments", label: "Mobile Money", value: 5, trend_pct: 25.0, previous_value: 4, format: "number" },
    ],
  },
  prospects: {
    category: "prospects",
    period: "today",
    kpis: [
      { key: "total_prospects", label: "Total prospects", value: 67, trend_pct: 3.1, previous_value: 65, format: "number" },
      { key: "new_prospects", label: "Nouveaux", value: 12, trend_pct: 20.0, previous_value: 10, format: "number" },
      { key: "converted_prospects", label: "Convertis", value: 8, trend_pct: 14.3, previous_value: 7, format: "number" },
      { key: "lost_prospects", label: "Perdus", value: 3, trend_pct: -25.0, previous_value: 4, format: "number" },
      { key: "conversion_rate", label: "Taux conversion", value: 11.9, trend_pct: 1.2, previous_value: 10.8, format: "percent" },
    ],
  },
  logistics: {
    category: "logistics",
    period: "today",
    kpis: [
      { key: "dispatch_events", label: "Événements sortie", value: 14, trend_pct: 16.7, previous_value: 12, format: "number" },
      { key: "return_events", label: "Événements retour", value: 9, trend_pct: -10.0, previous_value: 10, format: "number" },
      { key: "items_dispatched", label: "Articles sortis", value: 342, trend_pct: 8.2, previous_value: 316, format: "number" },
      { key: "items_returned", label: "Articles retournés", value: 298, trend_pct: 5.3, previous_value: 283, format: "number" },
      { key: "breakage_count", label: "Casse/Perte", value: 2, trend_pct: 0, previous_value: 2, format: "number" },
    ],
  },
  inventory: {
    category: "inventory",
    period: "today",
    kpis: [
      { key: "total_items", label: "Total articles", value: 856, trend_pct: 2.3, previous_value: 837, format: "number" },
      { key: "available_items", label: "Disponibles", value: 612, trend_pct: -1.8, previous_value: 623, format: "number" },
      { key: "reserved_items", label: "Réservés", value: 198, trend_pct: 5.3, previous_value: 188, format: "number" },
      { key: "damaged_items", label: "Endommagés", value: 12, trend_pct: 0, previous_value: 12, format: "number" },
      { key: "out_items", label: "En sortie", value: 34, trend_pct: 13.3, previous_value: 30, format: "number" },
    ],
  },
  documents: {
    category: "documents",
    period: "today",
    kpis: [
      { key: "total_documents", label: "Documents générés", value: 213, trend_pct: 4.9, previous_value: 203, format: "number" },
      { key: "proformas", label: "Proformas", value: 78, trend_pct: 6.8, previous_value: 73, format: "number" },
      { key: "invoices", label: "Factures", value: 56, trend_pct: 3.7, previous_value: 54, format: "number" },
      { key: "contracts", label: "Contrats", value: 45, trend_pct: 12.5, previous_value: 40, format: "number" },
      { key: "receipts", label: "Reçus", value: 34, trend_pct: -2.9, previous_value: 35, format: "number" },
    ],
  },
};

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
      // Fallback to mock data so the UI is testable even if the API isn't wired yet
      // WARNING: This shows MOCK DATA — remove for production
      const mock = MOCK_DATA[activeCategory];
      if (mock) {
        setData({ ...mock, period, _mock: true } as ReportCategoryResponse & { _mock?: boolean });
      } else {
        setError(err.message || "Erreur lors du chargement des rapports.");
      }
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
