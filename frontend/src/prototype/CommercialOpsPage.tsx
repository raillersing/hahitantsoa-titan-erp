import React, { useState, useEffect } from "react";
import { AppScope } from "../App";
import { DocumentPreview } from "./DocumentPreview";
import { getBillingInvoices } from "../api";
import type { BillingInvoice, BillingInvoiceStatus } from "../types";
import { LoadingSpinner } from "../components";

interface CommercialOpsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

/* ---------- helpers ---------- */

function formatAmount(value: string | number): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value || "0");
  return new Intl.NumberFormat("fr-MG").format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-MG", { dateStyle: "medium" }).format(new Date(iso));
}

function documentTypeLabel(invoice: BillingInvoice): string {
  const type = invoice.document_instance?.document_type?.toLowerCase() ?? "";
  if (type === "proforma") return "Proforma";
  if (type === "facture") return "Facture";
  if (type === "contrat") return "Contrat";
  if (type === "recu" || type === "reçu") return "Reçu";
  return invoice.document_instance?.template_label || type || "Document";
}

function documentTypeBadgeClass(invoice: BillingInvoice): string {
  const type = invoice.document_instance?.document_type?.toLowerCase() ?? "";
  if (type === "proforma") return "bg-blue-100 text-blue-700";
  if (type === "facture") return "bg-rose-100 text-rose-700";
  if (type === "contrat") return "bg-violet-100 text-violet-700";
  if (type === "recu" || type === "reçu") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(status: BillingInvoiceStatus): string {
  switch (status) {
    case "open":
      return "En attente";
    case "settled":
      return "Payée";
    case "cancelled":
      return "Annulée";
    default:
      return status;
  }
}

function statusBadgeClass(status: BillingInvoiceStatus): string {
  switch (status) {
    case "open":
      return "bg-amber-100 text-amber-700";
    case "settled":
      return "bg-green-100 text-green-700";
    case "cancelled":
      return "bg-red-100 text-red-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

/* ---------- component ---------- */

export default function CommercialOpsPage({ onNavigate }: CommercialOpsPageProps) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<BillingInvoice | null>(null);
  const [filter, setFilter] = useState<"Toutes" | "Proformas" | "Factures" | "Reçus">("Toutes");

  /* --- data fetch --- */
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getBillingInvoices(controller.signal)
      .then((data) => {
        setInvoices(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setError(err?.message || "Erreur lors du chargement des documents.");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  /* --- filter --- */
  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "Toutes") return true;
    const type = inv.document_instance?.document_type?.toLowerCase() ?? "";
    if (filter === "Proformas") return type === "proforma";
    if (filter === "Factures") return type === "facture";
    if (filter === "Reçus") return type === "recu" || type === "reçu";
    return true;
  });

  /* --- loading / error --- */
  if (loading) {
    return <LoadingSpinner message="Chargement des documents commerciaux…" />;
  }

  if (error) {
    return (
      <div className="page active space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Documents Commerciaux</h2>
          <p className="text-sm text-slate-500 mb-6">Proformas, factures, reçus et échéances de paiement</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center">
          <i className="fa-solid fa-triangle-exclamation text-red-400 text-3xl mb-3"></i>
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  /* --- render --- */
  return (
    <div className="page active space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Documents Commerciaux</h2>
        <p className="text-sm text-slate-500 mb-6">Proformas, factures, reçus et échéances de paiement</p>
      </div>

      {/* ---- documents table ---- */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-6">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Documents récents ({filteredInvoices.length})
            </h3>
            <div className="flex gap-1">
              {(["Toutes", "Proformas", "Factures", "Reçus"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => onNavigate("cashbox")}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
          >
            <i className="fa-solid fa-cash-register mr-1"></i> Caisse
          </button>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-10">
            <i className="fa-solid fa-file-invoice text-slate-300 text-3xl mb-2"></i>
            <p className="text-sm text-slate-500">Aucun document trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 rounded-tl-lg">N°</th>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Montant</th>
                <th className="text-left px-3 py-2">Statut</th>
                <th className="text-left px-3 py-2 rounded-tr-lg">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => {
                const doc = inv.document_instance;
                const ref =
                  doc?.reservation_public_reference || inv.id.slice(0, 8);
                const clientName = doc?.customer_display_name || "—";
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedFacture(inv)}
                  >
                    <td className="px-3 py-3 font-mono text-xs text-slate-600 hover:text-indigo-600">
                      {ref}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{clientName}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${documentTypeBadgeClass(inv)}`}
                      >
                        {documentTypeLabel(inv)}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800">
                      {formatAmount(inv.amount)} Ar
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadgeClass(inv.invoice_status)}`}
                      >
                        {statusLabel(inv.invoice_status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatDate(inv.issued_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- timeline ---- */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Timeline des échéances</h3>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>

          <div className="relative flex items-start gap-4 mb-6">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center z-10 shrink-0">
              <i className="fa-solid fa-file-invoice text-indigo-600 text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">J-30 — Proforma envoyé</p>
              <p className="text-xs text-slate-500">Le client reçoit le proforma. Délai de réponse : 15 jours.</p>
            </div>
          </div>

          <div className="relative flex items-start gap-4 mb-6">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center z-10 shrink-0">
              <i className="fa-solid fa-file-signature text-amber-600 text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">J-10 — Contrat signé + Acompte</p>
              <p className="text-xs text-slate-500">50% d'acompte minimum requis pour confirmation.</p>
            </div>
          </div>

          <div className="relative flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center z-10 shrink-0">
              <i className="fa-solid fa-check text-green-600 text-xs"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">J-3 — Confirmation finale</p>
              <p className="text-xs text-slate-500">Revalidation disponibilités, attribution durable, audit transaction.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- document preview modal ---- */}
      {selectedFacture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
            <button
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800"
              onClick={() => setSelectedFacture(null)}
            >
              <i className="fa-solid fa-xmark fa-xl"></i>
            </button>
            <div className="p-8">
              <DocumentPreview
                type={
                  (selectedFacture.document_instance?.document_type?.toLowerCase() as
                    | "proforma"
                    | "facture"
                    | "contrat"
                    | "recu") || "facture"
                }
                domain="hahitantsoa"
                client={{
                  name: selectedFacture.document_instance?.customer_display_name || "",
                  phone: selectedFacture.document_instance?.customer_phone || "",
                }}
                date={formatDate(selectedFacture.issued_at)}
                refNumber={
                  selectedFacture.document_instance?.reservation_public_reference ||
                  selectedFacture.id.slice(0, 8)
                }
                eventDate="—"
                totalAmount={Number.parseFloat(selectedFacture.amount || "0")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
