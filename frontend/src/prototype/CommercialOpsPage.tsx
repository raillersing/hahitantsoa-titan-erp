import React, { useState, useEffect, useMemo, useCallback } from "react";
import { AppScope } from "../App";
import DocumentArtifactPreviewPanel from "../DocumentArtifactPreviewPanel";
import {
  getBillingInvoices,
  getPayments,
  getReservationDrafts,
  getHahitantsoaEventDrafts,
  settleBillingInvoice,
  cancelBillingInvoice,
  issueBillingCreditNote,
  getBillingCreditNotes,
} from "../api";
import type {
  BillingInvoice,
  BillingInvoiceStatus,
  BillingCreditNote,
  Payment,
  ReservationDraft,
  HahitantsoaEventDraft,
} from "../types";
import { LoadingSpinner } from "../components";
import { PaymentRegistrationModal } from "./PaymentRegistrationModal";

interface CommercialOpsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatAmount(value: string | number | null | undefined): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(String(value || "0"));
  return new Intl.NumberFormat("fr-MG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-MG", { dateStyle: "medium" }).format(new Date(iso));
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-MG", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
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
  if (type === "proforma") return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
  if (type === "facture") return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800";
  if (type === "contrat") return "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800";
  if (type === "recu" || type === "reçu") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
}

function statusLabel(status: BillingInvoiceStatus): string {
  switch (status) {
    case "open":
      return "En attente";
    case "settled":
      return "Réglée";
    case "cancelled":
      return "Annulée";
    default:
      return status;
  }
}

function statusBadgeClass(status: BillingInvoiceStatus): string {
  switch (status) {
    case "open":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    case "settled":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    case "cancelled":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  }
}

function paymentMethodLabel(method: string): string {
  switch (method) {
    case "cash":
      return "Espèces (Caisse)";
    case "mobile_money":
      return "Mobile Money";
    case "bank_transfer":
      return "Virement bancaire";
    case "check":
      return "Chèque";
    case "card":
      return "Carte Bancaire";
    default:
      return method || "Autre";
  }
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function CommercialOpsPage({ onNavigate }: CommercialOpsPageProps) {
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"invoices" | "schedule" | "credit_notes" | "payments">("invoices");

  // Raw API Data
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [titanReservations, setTitanReservations] = useState<ReservationDraft[]>([]);
  const [hahitantsoaReservations, setHahitantsoaReservations] = useState<HahitantsoaEventDraft[]>([]);

  // Page State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<"all" | "hahitantsoa" | "titan">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "settled" | "cancelled">("all");
  const [docTypeFilter, setDocTypeFilter] = useState<"all" | "proforma" | "facture" | "contrat" | "recu">("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");

  // Interactive Modals
  const [selectedFacture, setSelectedFacture] = useState<BillingInvoice | null>(null);
  const [paymentModalTarget, setPaymentModalTarget] = useState<{
    domain: "titan" | "hahitantsoa";
    draftId: string;
    draftReference: string;
    proformaReference?: string;
    customerName: string;
    customerPhone?: string;
    totalAmount: number;
    paidAmount: number;
    eventDateLabel?: string;
    existingPayments: any[];
  } | null>(null);

  const [relanceTarget, setRelanceTarget] = useState<{
    dossierRef: string;
    clientName: string;
    clientPhone?: string;
    eventDate: string;
    remainingAmount: number;
    domainLabel: string;
  } | null>(null);

  const [creditNoteInvoice, setCreditNoteInvoice] = useState<BillingInvoice | null>(null);
  const [creditNoteAmount, setCreditNoteAmount] = useState("");
  const [creditNoteReason, setCreditNoteReason] = useState("");
  const [creditNoteNotes, setCreditNoteNotes] = useState("");
  const [creditNoteSubmitting, setCreditNoteSubmitting] = useState(false);
  const [creditNoteError, setCreditNoteError] = useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Load All Commercial Data
  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setError(null);

      const [invs, pays, titanDrafts, hahiDrafts] = await Promise.all([
        getBillingInvoices(signal),
        getPayments(signal).catch(() => []),
        getReservationDrafts(undefined, signal).catch(() => []),
        getHahitantsoaEventDrafts(undefined, signal).catch(() => []),
      ]);

      if (signal?.aborted) return;
      setInvoices(invs);
      setPayments(pays);
      setTitanReservations(titanDrafts);
      setHahitantsoaReservations(hahiDrafts);
      setLoading(false);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message || "Erreur lors du chargement des opérations commerciales.");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 4000);
    return () => clearTimeout(timer);
  }, [successToast]);

  /* -------------------------------------------------------------------------- */
  /* Computed KPIs                                                              */
  /* -------------------------------------------------------------------------- */

  const kpis = useMemo(() => {
    const totalInvoiced = invoices.reduce(
      (acc, inv) => acc + (Number.parseFloat(String(inv.amount)) || 0),
      0,
    );

    const totalCollected = payments
      .filter((p) => p.payment_status === "confirmed")
      .reduce((acc, p) => acc + (Number.parseFloat(String(p.amount)) || 0), 0);

    const settledInvoicesCount = invoices.filter((i) => i.invoice_status === "settled").length;
    const openInvoicesCount = invoices.filter((i) => i.invoice_status === "open").length;

    // Calculate total pending from reservations
    let totalDossiersValue = 0;
    let totalDossiersPaid = 0;
    let urgentScheduleCount = 0;

    const now = new Date();
    const allDossiers = [
      ...titanReservations.map((r) => ({ ...r, domain: "titan" as const })),
      ...hahitantsoaReservations.map((r) => ({ ...r, domain: "hahitantsoa" as const })),
    ];

    allDossiers.forEach((d) => {
      const tot = Number.parseFloat(String((d as any).total_amount || (d as any).space_rental_amount || "0"));
      totalDossiersValue += tot;

      // Find payments matching this draft
      const pays = payments.filter((p) =>
        d.domain === "titan"
          ? p.reservation_draft === d.id
          : p.hahitantsoa_event_draft === d.id,
      );
      const paid = pays.reduce((sum, p) => sum + (Number.parseFloat(String(p.amount)) || 0), 0);
      totalDossiersPaid += paid;

      const remaining = Math.max(0, tot - paid);
      if (remaining > 0 && d.start_at) {
        const eventDate = new Date(d.start_at);
        const diffDays = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) {
          urgentScheduleCount++;
        }
      }
    });

    const totalOutstanding = Math.max(0, totalInvoiced - totalCollected);
    const recoveryRate = totalInvoiced > 0 ? Math.min(100, Math.round((totalCollected / totalInvoiced) * 100)) : 100;

    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      settledInvoicesCount,
      openInvoicesCount,
      urgentScheduleCount,
      recoveryRate,
    };
  }, [invoices, payments, titanReservations, hahitantsoaReservations]);

  /* -------------------------------------------------------------------------- */
  /* Filtered Invoices                                                          */
  /* -------------------------------------------------------------------------- */

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const doc = inv.document_instance;
      const ref = (doc?.reservation_public_reference || inv.id || "").toLowerCase();
      const client = (doc?.customer_display_name || "").toLowerCase();
      const num = (inv.id || "").toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      if (query && !ref.includes(query) && !client.includes(query) && !num.includes(query)) {
        return false;
      }

      // Domain filter
      if (domainFilter !== "all") {
        const isHahi =
          ref.startsWith("h-") ||
          ref.startsWith("he-") ||
          (doc?.template_label || "").toLowerCase().includes("hahitantsoa");
        if (domainFilter === "hahitantsoa" && !isHahi) return false;
        if (domainFilter === "titan" && isHahi) return false;
      }

      // Status filter
      if (statusFilter !== "all" && inv.invoice_status !== statusFilter) {
        return false;
      }

      // Document type filter
      if (docTypeFilter !== "all") {
        const type = (doc?.document_type || "").toLowerCase();
        if (docTypeFilter === "proforma" && !type.includes("proforma")) return false;
        if (docTypeFilter === "facture" && !type.includes("facture")) return false;
        if (docTypeFilter === "contrat" && !type.includes("contrat")) return false;
        if (docTypeFilter === "recu" && !type.includes("recu") && !type.includes("reçu")) return false;
      }

      return true;
    });
  }, [invoices, searchQuery, domainFilter, statusFilter, docTypeFilter]);

  /* -------------------------------------------------------------------------- */
  /* Dynamic Schedule / Échéancier Real Calculations                           */
  /* -------------------------------------------------------------------------- */

  const scheduleItems = useMemo(() => {
    const items: Array<{
      id: string;
      domain: "titan" | "hahitantsoa";
      dossierRef: string;
      eventName: string;
      customerName: string;
      customerPhone?: string;
      eventDateIso: string;
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      depositRequired: number;
      depositPaid: boolean;
      daysRemaining: number;
      status: "overdue" | "urgent" | "planned" | "settled";
      rawDossier: any;
      existingPayments: any[];
    }> = [];

    const now = new Date();

    const processDossier = (d: any, domain: "titan" | "hahitantsoa") => {
      const tot = Number.parseFloat(String(d.total_amount || d.space_rental_amount || "0"));
      if (tot <= 0) return;

      const pays = payments.filter((p) =>
        domain === "titan" ? p.reservation_draft === d.id : p.hahitantsoa_event_draft === d.id,
      );
      const paid = pays.reduce((sum, p) => sum + (Number.parseFloat(String(p.amount)) || 0), 0);
      const remaining = Math.max(0, tot - paid);

      const requiredDep =
        Number.parseFloat(String(d.required_deposit_amount || "0")) || Math.round(tot * 0.5);

      const eventDate = d.start_at ? new Date(d.start_at) : null;
      const daysRemaining = eventDate
        ? Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let status: "overdue" | "urgent" | "planned" | "settled" = "planned";
      if (remaining <= 0) {
        status = "settled";
      } else if (daysRemaining < 0 || (daysRemaining <= 3 && paid < requiredDep)) {
        status = "overdue";
      } else if (daysRemaining <= 7) {
        status = "urgent";
      } else {
        status = "planned";
      }

      items.push({
        id: d.id,
        domain,
        dossierRef: d.public_reference || (domain === "titan" ? `TITAN-${d.id.slice(0, 4)}` : `H-${d.id.slice(0, 4)}`),
        eventName: d.event_name || d.notes || (domain === "titan" ? "Location matériel" : "Événement Hahitantsoa"),
        customerName: d.customer_display_name || "Client non spécifié",
        customerPhone: d.customer_phone || "",
        eventDateIso: d.start_at || "",
        totalAmount: tot,
        paidAmount: paid,
        remainingAmount: remaining,
        depositRequired: requiredDep,
        depositPaid: paid >= requiredDep,
        daysRemaining,
        status,
        rawDossier: d,
        existingPayments: pays,
      });
    };

    titanReservations.forEach((d) => processDossier(d, "titan"));
    hahitantsoaReservations.forEach((d) => processDossier(d, "hahitantsoa"));

    // Sort by urgency: overdue first, then urgent, then days remaining
    return items.sort((a, b) => {
      const rank = { overdue: 0, urgent: 1, planned: 2, settled: 3 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return a.daysRemaining - b.daysRemaining;
    });
  }, [titanReservations, hahitantsoaReservations, payments]);

  const filteredScheduleItems = useMemo(() => {
    return scheduleItems.filter((item) => {
      if (domainFilter !== "all" && item.domain !== domainFilter) return false;
      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        !item.dossierRef.toLowerCase().includes(q) &&
        !item.customerName.toLowerCase().includes(q) &&
        !item.eventName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [scheduleItems, domainFilter, searchQuery]);

  /* -------------------------------------------------------------------------- */
  /* Filtered Payments Journal                                                  */
  /* -------------------------------------------------------------------------- */

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (paymentMethodFilter !== "all" && p.payment_method !== paymentMethodFilter) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const ref = (p.external_reference || p.source_label || p.id || "").toLowerCase();
        const notes = (p.notes || "").toLowerCase();
        if (!ref.includes(q) && !notes.includes(q)) return false;
      }
      return true;
    });
  }, [payments, paymentMethodFilter, searchQuery]);

  /* -------------------------------------------------------------------------- */
  /* Actions                                                                    */
  /* -------------------------------------------------------------------------- */

  const handleSettleInvoice = async (inv: BillingInvoice) => {
    if (!window.confirm(`Confirmer le règlement intégral de la facture ${inv.id.slice(0, 8)} (${formatAmount(inv.amount)} Ar) ?`)) {
      return;
    }
    setActionLoadingId(inv.id);
    try {
      await settleBillingInvoice(inv.id, {
        payment: "",
        notes: "Règlement marqué manuellement depuis le Hub Commercial.",
      });
      setSuccessToast(`La facture #${inv.id.slice(0, 8)} a été marquée comme Réglée.`);
      await loadData();
    } catch (err: any) {
      alert(`Erreur lors du règlement : ${err?.message || "Échec de l'opération"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelInvoice = async (inv: BillingInvoice) => {
    const reason = window.prompt("Motif d'annulation de cette facture :");
    if (reason === null) return;

    setActionLoadingId(inv.id);
    try {
      await cancelBillingInvoice(inv.id, reason || "Annulation demandée par l'administrateur.");
      setSuccessToast(`La facture #${inv.id.slice(0, 8)} a été annulée.`);
      await loadData();
    } catch (err: any) {
      alert(`Erreur lors de l'annulation : ${err?.message || "Échec de l'opération"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleIssueCreditNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditNoteInvoice) return;
    setCreditNoteSubmitting(true);
    setCreditNoteError(null);

    try {
      await issueBillingCreditNote(creditNoteInvoice.id, {
        amount: creditNoteAmount,
        reason: creditNoteReason,
        notes: creditNoteNotes,
      });
      setSuccessToast(`Avoir de ${formatAmount(creditNoteAmount)} Ar émis avec succès pour la facture #${creditNoteInvoice.id.slice(0, 8)}.`);
      setCreditNoteInvoice(null);
      setCreditNoteAmount("");
      setCreditNoteReason("");
      setCreditNoteNotes("");
      await loadData();
    } catch (err: any) {
      setCreditNoteError(err?.message || "Erreur lors de l'émission de l'avoir.");
    } finally {
      setCreditNoteSubmitting(false);
    }
  };

  const handleOpenPaymentFromSchedule = (item: typeof scheduleItems[0]) => {
    setPaymentModalTarget({
      domain: item.domain,
      draftId: item.id,
      draftReference: item.dossierRef,
      proformaReference: item.dossierRef,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      totalAmount: item.totalAmount,
      paidAmount: item.paidAmount,
      eventDateLabel: formatDate(item.eventDateIso),
      existingPayments: item.existingPayments.map((p) => ({
        id: p.id,
        date: p.paid_at || p.created_at,
        amount: Number.parseFloat(p.amount) || 0,
        method: p.payment_method,
        reference: p.external_reference,
        note: p.notes,
      })),
    });
  };

  /* -------------------------------------------------------------------------- */
  /* Loading / Error States                                                     */
  /* -------------------------------------------------------------------------- */

  if (loading && invoices.length === 0) {
    return <LoadingSpinner message="Chargement du hub des opérations commerciales & factures…" />;
  }

  return (
    <div className="page active space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-slide-in">
          <i className="fa-solid fa-circle-check text-lg"></i>
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Header & Quick Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <i className="fa-solid fa-file-invoice-dollar text-indigo-600 dark:text-indigo-400"></i>
              Opérations Commerciales & Facturation
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Hub Financier & Recouvrement
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tableau de bord financier, factures, échéancier des règlements et créances clients
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          <button
            type="button"
            onClick={() => onNavigate("cashbox")}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-cash-register text-emerald-600"></i>
            Accéder à la Caisse
          </button>
          <button
            type="button"
            onClick={() => onNavigate("bank-settings")}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-building-columns text-indigo-600"></i>
            Coordonnées Bancaires
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            title="Rafraîchir les données"
          >
            <i className={`fa-solid fa-rotate-right ${loading ? "fa-spin" : ""}`}></i>
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-base"></i>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="font-bold underline cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Facturé */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Facturé TTC
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-file-invoice"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatAmount(kpis.totalInvoiced)}{" "}
              <span className="text-sm font-semibold text-slate-400">Ar</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {invoices.length} document(s) émis
            </p>
          </div>
        </div>

        {/* KPI 2: Total Encaissé */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Encaissé
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-circle-check"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{formatAmount(kpis.totalCollected)}{" "}
              <span className="text-sm font-semibold text-slate-400">Ar</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Taux de recouvrement : <strong>{kpis.recoveryRate}%</strong>
            </p>
          </div>
        </div>

        {/* KPI 3: Reste à Recouvrer */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Reste à Recouvrer
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {formatAmount(kpis.totalOutstanding)}{" "}
              <span className="text-sm font-semibold text-slate-400">Ar</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {kpis.openInvoicesCount} facture(s) en attente
            </p>
          </div>
        </div>

        {/* KPI 4: Échéances Urgentes */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Relances Urgentes (&lt;7j)
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg">
              <i className="fa-solid fa-bell"></i>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
              {kpis.urgentScheduleCount}{" "}
              <span className="text-sm font-semibold text-slate-400">dossier(s)</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Événements proches avec solde dû
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area with Modern Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Tab Navigation Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Tabs buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-bold overflow-x-auto w-full md:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("invoices")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === "invoices"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <i className="fa-solid fa-file-invoice"></i>
              Factures & Proformas ({filteredInvoices.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("schedule")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === "schedule"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <i className="fa-solid fa-calendar-check"></i>
              Échéancier & Relances
              {kpis.urgentScheduleCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {kpis.urgentScheduleCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("payments")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeTab === "payments"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <i className="fa-solid fa-money-bill-transfer"></i>
              Journal des Règlements ({filteredPayments.length})
            </button>
          </div>

          {/* Search bar & domain selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                type="text"
                placeholder="Rechercher client, réf, n°..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Domain filter */}
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden cursor-pointer"
            >
              <option value="all">Tous les domaines</option>
              <option value="hahitantsoa">Domaine Hahitantsoa</option>
              <option value="titan">Titan Rental</option>
            </select>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: Factures & Proformas                                              */}
        {/* ========================================================================= */}
        {activeTab === "invoices" && (
          <div>
            {/* Subfilters bar */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Statut :</span>
                {(["all", "open", "settled", "cancelled"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      statusFilter === st
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                    }`}
                  >
                    {st === "all" ? "Toutes" : statusLabel(st)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Type :</span>
                {(["all", "proforma", "facture", "contrat", "recu"] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setDocTypeFilter(tp)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      docTypeFilter === tp
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tp === "all" ? "Tous" : tp.charAt(0).toUpperCase() + tp.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices Table */}
            {filteredInvoices.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  <i className="fa-solid fa-file-invoice"></i>
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Aucun document de facturation trouvé
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Modifiez vos critères de recherche ou de filtre.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="py-3.5 px-4">N° Document</th>
                      <th className="py-3.5 px-4">Dossier / Événement</th>
                      <th className="py-3.5 px-4">Client</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4 text-right">Montant TTC</th>
                      <th className="py-3.5 px-4 text-center">Statut</th>
                      <th className="py-3.5 px-4">Émission</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredInvoices.map((inv) => {
                      const doc = inv.document_instance;
                      const ref = doc?.reservation_public_reference || inv.id.slice(0, 8);
                      const isHahi =
                        ref.startsWith("H-") ||
                        ref.startsWith("HE-") ||
                        (doc?.template_label || "").toLowerCase().includes("hahitantsoa");

                      return (
                        <tr
                          key={inv.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                            #{inv.id.slice(0, 8)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isHahi
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                }`}
                              >
                                {isHahi ? "Hahitantsoa" : "Titan"}
                              </span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                {ref}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {doc?.customer_display_name || "—"}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold border text-[10px] ${documentTypeBadgeClass(
                                inv,
                              )}`}
                            >
                              {documentTypeLabel(inv)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-sm text-slate-900 dark:text-white">
                            {formatAmount(inv.amount)}{" "}
                            <span className="text-xs font-normal text-slate-400">Ar</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full font-bold border text-[10px] ${statusBadgeClass(
                                inv.invoice_status,
                              )}`}
                            >
                              {statusLabel(inv.invoice_status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(inv.issued_at || doc?.created_at)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Document */}
                              <button
                                type="button"
                                onClick={() => setSelectedFacture(inv)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                title="Aperçu & Impression du document officiel"
                              >
                                <i className="fa-solid fa-eye text-[11px]"></i>
                                <span>Aperçu</span>
                              </button>

                              {/* Settle */}
                              {inv.invoice_status === "open" && (
                                <button
                                  type="button"
                                  disabled={actionLoadingId === inv.id}
                                  onClick={() => void handleSettleInvoice(inv)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Marquer comme réglée"
                                >
                                  <i className="fa-solid fa-check text-[11px]"></i>
                                  <span>Régler</span>
                                </button>
                              )}

                              {/* Issue Credit Note */}
                              {inv.invoice_status === "settled" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreditNoteInvoice(inv);
                                    setCreditNoteAmount(String(inv.amount || ""));
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="Émettre un avoir"
                                >
                                  <i className="fa-solid fa-receipt text-[11px]"></i>
                                  <span>Avoir</span>
                                </button>
                              )}

                              {/* Cancel */}
                              {inv.invoice_status === "open" && (
                                <button
                                  type="button"
                                  disabled={actionLoadingId === inv.id}
                                  onClick={() => void handleCancelInvoice(inv)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                                  title="Annuler cette facture"
                                >
                                  <i className="fa-solid fa-ban text-xs"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: Échéancier & Relances Réel                                        */}
        {/* ========================================================================= */}
        {activeTab === "schedule" && (
          <div className="p-6 space-y-4">
            <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
              <i className="fa-solid fa-info-circle text-indigo-600 dark:text-indigo-400 text-base mt-0.5"></i>
              <div>
                <p className="font-bold">Échéancier opérationnel basé sur les réservations réelles</p>
                <p className="mt-0.5 text-indigo-700 dark:text-indigo-300">
                  Suivez les versements attendus (Acompte 50% ou Solde 100%) selon la proximité de la date de l'événement et déclenchez un encaissement direct ou une relance client.
                </p>
              </div>
            </div>

            {filteredScheduleItems.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  <i className="fa-solid fa-calendar-check"></i>
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Aucune échéance en attente
                </p>
                <p className="text-xs text-slate-400 mt-1">Tous les dossiers sont à jour de règlement.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredScheduleItems.map((item) => {
                  const isUrgent = item.status === "urgent" || item.status === "overdue";

                  return (
                    <div
                      key={`${item.domain}-${item.id}`}
                      className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        item.status === "overdue"
                          ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                          : item.status === "urgent"
                            ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                            : item.status === "settled"
                              ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 opacity-80"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {/* Left Details */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.domain === "hahitantsoa"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            {item.domain === "hahitantsoa" ? "Hahitantsoa" : "Titan Rental"}
                          </span>
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                            {item.dossierRef}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {item.customerName}
                          </span>
                          {item.customerPhone && (
                            <span className="text-xs text-slate-500 font-mono">
                              ({item.customerPhone})
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {item.eventName}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <span>
                            <i className="fa-regular fa-calendar mr-1"></i>
                            Événement :{" "}
                            <strong>{formatDate(item.eventDateIso)}</strong>
                          </span>
                          <span>
                            {item.status === "overdue" ? (
                              <span className="text-rose-600 font-bold">
                                ⚠ Échéance critique ({item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)}j de retard` : "Imminente"})
                              </span>
                            ) : item.status === "urgent" ? (
                              <span className="text-amber-600 font-bold">
                                ⏳ Dans {item.daysRemaining} jour(s)
                              </span>
                            ) : item.status === "settled" ? (
                              <span className="text-emerald-600 font-bold">
                                ✓ Intégralement soldé
                              </span>
                            ) : (
                              <span>Dans {item.daysRemaining} jours</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Right Financial Breakdown & Actions */}
                      <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">
                            Devis TTC / Reste Dû
                          </p>
                          <p className="text-base font-black text-slate-900 dark:text-white">
                            {formatAmount(item.totalAmount)} Ar
                          </p>
                          <p
                            className={`text-xs font-bold ${
                              item.remainingAmount > 0
                                ? isUrgent
                                  ? "text-rose-600"
                                  : "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {item.remainingAmount > 0
                              ? `Reste : ${formatAmount(item.remainingAmount)} Ar`
                              : "Soldé (0 Ar)"}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          {item.remainingAmount > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenPaymentFromSchedule(item)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <i className="fa-solid fa-credit-card"></i>
                                <span>Encaisser</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setRelanceTarget({
                                    dossierRef: item.dossierRef,
                                    clientName: item.customerName,
                                    clientPhone: item.customerPhone,
                                    eventDate: formatDate(item.eventDateIso),
                                    remainingAmount: item.remainingAmount,
                                    domainLabel: item.domain === "hahitantsoa" ? "Domaine Hahitantsoa" : "Titan Rental",
                                  })
                                }
                                className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                                title="Générer un message de relance client"
                              >
                                <i className="fa-solid fa-paper-plane"></i>
                                <span>Relancer</span>
                              </button>
                            </>
                          )}

                          {item.remainingAmount <= 0 && (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold">
                              ✓ Réglé
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: Journal des Règlements                                            */}
        {/* ========================================================================= */}
        {activeTab === "payments" && (
          <div>
            {/* Payment method subfilter */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">Mode de paiement :</span>
              {[
                { id: "all", label: "Tous modes" },
                { id: "cash", label: "Espèces (Caisse)" },
                { id: "mobile_money", label: "Mobile Money" },
                { id: "bank_transfer", label: "Virement" },
                { id: "check", label: "Chèque" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethodFilter(m.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    paymentMethodFilter === m.id
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {filteredPayments.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Aucun règlement trouvé
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Les encaissements enregistrés apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="py-3.5 px-4">Date & Heure</th>
                      <th className="py-3.5 px-4">Dossier / Cible</th>
                      <th className="py-3.5 px-4">Mode de règlement</th>
                      <th className="py-3.5 px-4">Référence</th>
                      <th className="py-3.5 px-4">Notes & Motif</th>
                      <th className="py-3.5 px-4 text-right">Montant Encaissé</th>
                      <th className="py-3.5 px-4 text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredPayments.map((p) => {
                      const isCash = p.payment_method === "cash";

                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono whitespace-nowrap text-slate-700 dark:text-slate-300">
                            {formatDateTime(p.paid_at || p.created_at)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {p.source_label || (p.reservation_draft ? `TITAN-${p.reservation_draft.slice(0, 4)}` : p.hahitantsoa_event_draft ? `H-${p.hahitantsoa_event_draft.slice(0, 4)}` : `#${p.id.slice(0, 8)}`)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                              <i
                                className={`fa-solid ${
                                  isCash
                                    ? "fa-money-bill text-emerald-600"
                                    : p.payment_method === "mobile_money"
                                      ? "fa-mobile-screen text-amber-600"
                                      : "fa-building-columns text-indigo-600"
                                }`}
                              ></i>
                              {paymentMethodLabel(p.payment_method)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                            {p.external_reference || "—"}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                            {p.notes || "Versement validé"}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-sm text-emerald-600 dark:text-emerald-400">
                            +{formatAmount(p.amount)}{" "}
                            <span className="text-xs font-normal text-slate-400">Ar</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                p.payment_status === "confirmed"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              {p.payment_status === "confirmed" ? "Confirmé" : "En cours"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: Document Artifact Preview                                       */}
      {/* ========================================================================= */}
      {selectedFacture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
          onClick={() => setSelectedFacture(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-file-invoice"></i>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {documentTypeLabel(selectedFacture)} #{selectedFacture.id.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Client : {selectedFacture.document_instance?.customer_display_name || "—"} · Montant :{" "}
                    <strong>{formatAmount(selectedFacture.amount)} Ar</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFacture(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto bg-slate-50 dark:bg-slate-950">
              {selectedFacture.document_instance?.id ? (
                <DocumentArtifactPreviewPanel
                  documentInstanceId={selectedFacture.document_instance.id}
                />
              ) : (
                <div
                  className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/40 p-6 text-center text-sm text-amber-800 dark:text-amber-300"
                  role="alert"
                >
                  <i className="fa-solid fa-circle-info text-2xl mb-2 text-amber-500"></i>
                  <p className="font-bold">Facture comptable générée</p>
                  <p className="text-xs mt-1">
                    Montant : {formatAmount(selectedFacture.amount)} Ar · Statut :{" "}
                    {statusLabel(selectedFacture.invoice_status)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Relance Client Prête à l'Emploi                                 */}
      {/* ========================================================================= */}
      {relanceTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
          onClick={() => setRelanceTarget(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-indigo-600"></i>
                Relance Règlement Client
              </h3>
              <button
                type="button"
                onClick={() => setRelanceTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="text-slate-500">Dossier : <strong className="text-slate-900 dark:text-white font-mono">{relanceTarget.dossierRef}</strong></p>
                <p className="text-slate-500">Client : <strong className="text-slate-900 dark:text-white">{relanceTarget.clientName}</strong></p>
                <p className="text-slate-500">Date événement : <strong className="text-slate-900 dark:text-white">{relanceTarget.eventDate}</strong></p>
                <p className="text-slate-500">Reste à régler : <strong className="text-rose-600 font-black">{formatAmount(relanceTarget.remainingAmount)} Ar</strong></p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Message de relance suggéré (prêt à être copié / envoyé) :
                </label>
                <textarea
                  readOnly
                  rows={5}
                  value={`Bonjour ${relanceTarget.clientName},

Nous vous rappelons que le solde restant dû de ${formatAmount(relanceTarget.remainingAmount)} Ar pour votre dossier ${relanceTarget.dossierRef} (Événement prévu le ${relanceTarget.eventDate}) est à régler prochainement.

Modes de paiement acceptés :
• Espèces à notre bureau
• MVola / Mobile Money
• Virement bancaire

Merci pour votre confiance,
L'équipe ${relanceTarget.domainLabel}.`}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-sans text-xs focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {relanceTarget.clientPhone ? (
                  <a
                    href={`tel:${relanceTarget.clientPhone}`}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold flex items-center gap-1.5 text-xs"
                  >
                    <i className="fa-solid fa-phone"></i>
                    Appeler {relanceTarget.clientPhone}
                  </a>
                ) : <span />}

                <button
                  type="button"
                  onClick={() => {
                    const text = `Bonjour ${relanceTarget.clientName},\n\nNous vous rappelons que le solde restant dû de ${formatAmount(relanceTarget.remainingAmount)} Ar pour votre dossier ${relanceTarget.dossierRef} est à régler.\n\nMerci,\nL'équipe ${relanceTarget.domainLabel}.`;
                    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                      navigator.clipboard.writeText(text).catch(() => {});
                    }
                    setSuccessToast("Message de relance copié dans le presse-papier !");
                    setRelanceTarget(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 text-xs shadow-xs cursor-pointer"
                >
                  <i className="fa-solid fa-copy"></i>
                  Copier le message
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Émission d'Avoir                                                 */}
      {/* ========================================================================= */}
      {creditNoteInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
          onClick={() => setCreditNoteInvoice(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 dark:border-slate-800 animate-scale-up my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-receipt text-amber-600"></i>
                Émettre un Avoir / Note de Crédit
              </h3>
              <button
                type="button"
                onClick={() => setCreditNoteInvoice(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleIssueCreditNoteSubmit} className="p-6 space-y-4 text-xs">
              {creditNoteError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                  {creditNoteError}
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Facture d'origine :
                </label>
                <p className="font-mono font-bold text-slate-900 dark:text-white">
                  #{creditNoteInvoice.id.slice(0, 8)} ({formatAmount(creditNoteInvoice.amount)} Ar)
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Montant de l'avoir (Ar) * :
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Number.parseFloat(String(creditNoteInvoice.amount)) || undefined}
                  value={creditNoteAmount}
                  onChange={(e) => setCreditNoteAmount(e.target.value)}
                  placeholder="Ex: 200000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Motif de l'avoir * :
                </label>
                <input
                  type="text"
                  required
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                  placeholder="Ex: Réduction commerciale, annulation prestation, trop-perçu"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Notes internes :
                </label>
                <textarea
                  rows={3}
                  value={creditNoteNotes}
                  onChange={(e) => setCreditNoteNotes(e.target.value)}
                  placeholder="Précisions comptables..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreditNoteInvoice(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creditNoteSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creditNoteSubmitting && <i className="fa-solid fa-spinner fa-spin"></i>}
                  Émettre la note d'avoir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Payment Registration Modal Integration                          */}
      {/* ========================================================================= */}
      {paymentModalTarget && (
        <PaymentRegistrationModal
          isOpen={true}
          onClose={() => setPaymentModalTarget(null)}
          domain={paymentModalTarget.domain}
          draftId={paymentModalTarget.draftId}
          draftReference={paymentModalTarget.draftReference}
          proformaReference={paymentModalTarget.proformaReference}
          customerName={paymentModalTarget.customerName}
          customerPhone={paymentModalTarget.customerPhone}
          eventDateLabel={paymentModalTarget.eventDateLabel}
          totalAmount={paymentModalTarget.totalAmount}
          paidAmount={paymentModalTarget.paidAmount}
          requiredDepositAmount={Math.round(paymentModalTarget.totalAmount * 0.5)}
          existingPayments={paymentModalTarget.existingPayments}
          onPaymentRecorded={() => {
            setSuccessToast(`Versement enregistré avec succès pour ${paymentModalTarget.draftReference} !`);
            setPaymentModalTarget(null);
            void loadData();
          }}
        />
      )}
    </div>
  );
}
