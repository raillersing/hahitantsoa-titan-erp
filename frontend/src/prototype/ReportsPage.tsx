import React, { useState, useEffect, useCallback } from "react";
import { getReservationDrafts, getBillingInvoices, getPayments } from "../api";
import type { ReservationDraft, BillingInvoice, Payment } from "../types";

interface ReportsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

/* ── helpers ──────────────────────────────────────────────────── */
const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  confirmed: "bg-blue-50 text-blue-700",
  cancelled: "bg-red-50 text-red-700",
  open: "bg-amber-50 text-amber-700",
  settled: "bg-green-100 text-green-800",
  pending: "bg-amber-50 text-amber-700",
  confirmed_pay: "bg-green-100 text-green-800",
  failed: "bg-red-50 text-red-700",
  reconciled: "bg-blue-50 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  open: "Ouverte",
  settled: "Réglée",
  pending: "En attente",
  confirmed_pay: "Confirmé",
  failed: "Échoué",
  reconciled: "Rapproché",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  bank_transfer: "Virement",
  mobile_money: "Mobile Money",
  cheque: "Chèque",
  other: "Autre",
};

function fmt(v: number): string {
  return new Intl.NumberFormat("fr-MG", { style: "decimal" }).format(v) + " Ar";
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [, m] = key.split("-");
  return MONTHS[parseInt(m, 10) - 1];
}

/* ── component ────────────────────────────────────────────────── */
export default function ReportsPage({ onNavigate }: ReportsPageProps) {
  const [drafts, setDrafts] = useState<ReservationDraft[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  /* ── data loading ─────────────────────────────────────────────── */
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      const [draftData, invoiceData, paymentData] = await Promise.all([
        getReservationDrafts(undefined, controller.signal),
        getBillingInvoices(undefined, controller.signal),
        getPayments(undefined, controller.signal),
      ]);
      setDrafts(draftData);
      setInvoices(invoiceData);
      setPayments(paymentData);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Erreur lors du chargement des rapports.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ── computed analytics ───────────────────────────────────────── */
  const totalDrafts = drafts.length;
  const draftCount = drafts.filter((d) => d.status === "draft").length;
  const confirmedCount = drafts.filter((d) => d.status === "confirmed").length;
  const cancelledDraftCount = drafts.filter((d) => d.status === "cancelled").length;

  const totalInvoices = invoices.length;
  const openInvoices = invoices.filter((i) => i.invoice_status === "open").length;
  const settledInvoices = invoices.filter((i) => i.invoice_status === "settled").length;
  const totalRemaining = invoices.reduce((s, i) => s + parseFloat(i.remaining_balance || "0"), 0);

  const confirmedPayments = payments.filter((p) => p.payment_status === "confirmed" || p.payment_status === "reconciled");
  const totalPaidAmount = confirmedPayments.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);

  /* Monthly revenue chart data – group settled invoice amounts by month */
  const monthlyRevenueMap: Record<string, number> = {};
  for (const inv of invoices) {
    if (inv.invoice_status === "settled" && inv.settled_at) {
      const key = monthKey(inv.settled_at);
      monthlyRevenueMap[key] = (monthlyRevenueMap[key] || 0) + parseFloat(inv.amount_settled || inv.amount || "0");
    }
  }
  // Also include invoice amounts for open invoices by issued_at
  for (const inv of invoices) {
    if (inv.invoice_status === "open" && inv.issued_at) {
      const key = monthKey(inv.issued_at);
      monthlyRevenueMap[key] = (monthlyRevenueMap[key] || 0) + parseFloat(inv.remaining_balance || inv.amount || "0");
    }
  }
  const sortedMonthKeys = Object.keys(monthlyRevenueMap).sort();
  const maxRevenue = Math.max(...Object.values(monthlyRevenueMap), 1);

  /* Payment method breakdown */
  const methodCounts: Record<string, number> = {};
  for (const p of confirmedPayments) {
    methodCounts[p.payment_method] = (methodCounts[p.payment_method] || 0) + 1;
  }

  /* ── rendering ────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="page active space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Rapports & BI</h2>
          <p className="text-sm text-slate-500">Analytique et rapports d'exploitation</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
          <i className="fas fa-spinner fa-spin mr-2"></i>Chargement des rapports…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page active space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Rapports & BI</h2>
          <p className="text-sm text-slate-500">Analytique et rapports d'exploitation</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <i className="fas fa-exclamation-triangle text-red-500 text-lg mb-2"></i>
          <p className="text-red-700 text-sm mb-3">{error}</p>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
          >
            <i className="fas fa-redo mr-2"></i>Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page active space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Rapports & BI</h2>
          <p className="text-sm text-slate-500">Analytique et rapports d'exploitation</p>
        </div>
        <button
          onClick={loadAll}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
        >
          <i className="fas fa-sync-alt mr-2"></i>Actualiser
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Réservations */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <i className="fas fa-calendar-check text-lg"></i>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {totalDrafts} total
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{confirmedCount}</p>
          <p className="text-sm text-slate-500 mt-1">Confirmées</p>
          <div className="flex gap-2 mt-2 text-xs">
            <span className="text-amber-600">{draftCount} brouillons</span>
            <span className="text-red-500">{cancelledDraftCount} annulées</span>
          </div>
        </div>

        {/* Factures */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <i className="fas fa-file-invoice text-lg"></i>
            </div>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              {openInvoices} ouvertes
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{totalInvoices}</p>
          <p className="text-sm text-slate-500 mt-1">Factures émises</p>
          <p className="text-xs text-green-600 mt-1">{settledInvoices} réglées</p>
        </div>

        {/* Encaissements */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <i className="fas fa-coins text-lg"></i>
            </div>
            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
              {confirmedPayments.length} paiements
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{fmt(totalPaidAmount)}</p>
          <p className="text-sm text-slate-500 mt-1">Total encaissé</p>
        </div>

        {/* Solde restant */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <i className="fas fa-exclamation-circle text-lg"></i>
            </div>
            <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded-full">
              à recouvrer
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{fmt(totalRemaining)}</p>
          <p className="text-sm text-slate-500 mt-1">Solde restant</p>
          <p className="text-xs text-slate-400 mt-1">{openInvoices} factures en attente</p>
        </div>
      </div>

      {/* ── Charts Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bar chart: Monthly revenue */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            <i className="fas fa-chart-bar mr-2 text-indigo-500"></i>Revenus mensuels
          </h3>
          {sortedMonthKeys.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              Aucune donnée de revenu disponible
            </div>
          ) : (
            <div className="h-48 flex items-end justify-between gap-1 border-b border-slate-200 pb-2">
              {sortedMonthKeys.map((key, i) => {
                const pct = Math.round((monthlyRevenueMap[key] / maxRevenue) * 100);
                return (
                  <div key={key} className="flex flex-col items-center flex-1 min-w-0 group">
                    <div
                      className="w-full rounded-t-lg transition-all hover:opacity-80"
                      style={{
                        height: `${pct}%`,
                        backgroundColor: `hsl(234, 70%, ${50 + i * 3}%)`,
                      }}
                      title={fmt(monthlyRevenueMap[key])}
                    ></div>
                    <span className="text-[10px] text-slate-500 mt-1">{monthLabel(key)}</span>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white px-2 py-1 rounded whitespace-nowrap">
                      {fmt(monthlyRevenueMap[key])}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment method breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            <i className="fas fa-credit-card mr-2 text-emerald-500"></i>Modes de paiement
          </h3>
          {confirmedPayments.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              Aucun paiement confirmé
            </div>
          ) : (
            <ul className="space-y-3">
              {Object.entries(methodCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([method, count]) => {
                  const pct = Math.round((count / confirmedPayments.length) * 100);
                  return (
                    <li key={method}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          {METHOD_LABELS[method] || method}
                        </span>
                        <span className="text-xs text-slate-500">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Tables Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">
              <i className="fas fa-file-invoice mr-2 text-amber-500"></i>Dernières factures
            </h3>
          </div>
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aucune facture</div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {invoices.slice(0, 10).map((inv) => (
                <div key={inv.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {inv.source_kind === "reservation" ? "Réservation" : inv.source_kind}
                    </p>
                    <p className="text-xs text-slate-500">
                      Émise le {new Date(inv.issued_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{fmt(parseFloat(inv.amount || "0"))}</p>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.invoice_status] || "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABELS[inv.invoice_status] || inv.invoice_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent reservations */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">
              <i className="fas fa-calendar mr-2 text-indigo-500"></i>Dernières réservations
            </h3>
          </div>
          {drafts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Aucune réservation</div>
          ) : (
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {drafts.slice(0, 10).map((d) => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.customer_display_name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(d.start_at).toLocaleDateString("fr-FR")} — {new Date(d.end_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[d.status] || "bg-slate-100 text-slate-600"}`}>
                    {STATUS_LABELS[d.status] || d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Available Reports (kept from original) ─────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          <i className="fas fa-download mr-2 text-slate-400"></i>Rapports disponibles
        </h3>
        <ul className="space-y-3">
          <li
            className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition"
            onClick={() => showToast("Export PDF du bilan financier (mock)")}
          >
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-file-pdf text-rose-500"></i>
              <span className="text-sm font-medium text-slate-700">Bilan financier Q2</span>
            </div>
            <i className="fa-solid fa-download text-slate-400"></i>
          </li>
          <li
            className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition"
            onClick={() => showToast("Export Excel des clients actifs (mock)")}
          >
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-file-excel text-emerald-500"></i>
              <span className="text-sm font-medium text-slate-700">Export Clients Actifs</span>
            </div>
            <i className="fa-solid fa-download text-slate-400"></i>
          </li>
        </ul>
      </div>

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm z-50 flex items-center gap-3 animate-fade-in">
          <i className="fas fa-check-circle text-emerald-400"></i>
          {toast}
        </div>
      )}
    </div>
  );
}
