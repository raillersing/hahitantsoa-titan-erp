import React, { useState, useEffect } from "react";
import { AppScope } from "../App";
import { DocumentPreview } from "./DocumentPreview";
import { ProspectConversionAssistant } from "./ProspectConversionAssistant";
import {
  getReservationDraft,
  getCustomer,
  getReservationDraftDocumentInstances,
  markReservationDraftContractSigned,
  markReservationDraftRequiredDepositReceived,
  confirmReservationDraft,
  convertProformaToContract,
  createReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstance,
  voidProforma,
} from "../api";
import type { ReservationDraft, Customer, DocumentInstance } from "../types";

/* ── inline helpers (formerly from mockData) ──────────────────────── */

function safeNumber(
  value: number | string | undefined | null,
  fallback = 0,
): number {
  if (value === undefined || value === null || value === "") return fallback;
  const num =
    typeof value === "string"
      ? parseFloat(value.replace(/\s/g, "").replace(/,/g, "."))
      : Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function formatMoney(
  value: number | string | undefined | null,
  fallback = "0 Ar",
): string {
  const num =
    typeof value === "string"
      ? parseFloat(value.replace(/\s/g, "").replace(/,/g, "."))
      : Number(value);
  if (Number.isNaN(num)) return fallback;
  return `${num.toLocaleString("fr-FR")} Ar`;
}

function formatDateFr(dateStr: string | undefined): string {
  if (!dateStr) return "Date non renseignée";
  const parts = dateStr.split("-");
  if (parts.length >= 3) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2].substring(0, 2), 10);
    const months = [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ];
    if (month >= 1 && month <= 12 && !isNaN(day)) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      return `${dayStr} ${months[month - 1]} ${year}`;
    }
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

/* ── types ────────────────────────────────────────────────────────── */

type PreviewDoc = "proforma" | "facture" | "contrat" | "annexes" | null;

interface ReservationDetailPageProps {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
  onBack?: () => void;
  returnContext?: { from: string; param?: string } | null;
  /** "Titan" | "Hahitantsoa" – passed by the router / parent */
  domain?: string;
}

/* ── component ────────────────────────────────────────────────────── */

export default function ReservationDetailPage({
  onNavigate,
  param,
  onBack,
  returnContext,
  domain = "Titan",
}: ReservationDetailPageProps) {
  const draftId = param || "";

  /* ── data state ───────────────────────────────────────────────── */
  const [draft, setDraft] = useState<ReservationDraft | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documentInstances, setDocumentInstances] = useState<DocumentInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ── fetch on mount ───────────────────────────────────────────── */
  useEffect(() => {
    if (!draftId) {
      setError("Aucun identifiant de réservation fourni.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const d = await getReservationDraft(draftId);
        if (cancelled) return;
        setDraft(d);

        // Fetch the linked customer
        if (d.customer_id) {
          try {
            const c = await getCustomer(d.customer_id);
            if (!cancelled) setCustomer(c);
          } catch {
            // Non-fatal: customer fetch failed
          }
        }

        // Fetch document instances (proforma, contract, etc.)
        try {
          const instances = await getReservationDraftDocumentInstances(d.id);
          if (!cancelled) setDocumentInstances(instances);
        } catch {
          // Non-fatal: document instances fetch failed
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.message || "Erreur lors du chargement de la réservation.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  /* ── local UI state ───────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState("contrat");
  const [prepStatus, setPrepStatus] = useState("à préparer");
  const [returnStatus, setReturnStatus] = useState("Bon état");
  const [prepQty1, setPrepQty1] = useState(100);
  const [prepQty2, setPrepQty2] = useState(10);
  const [returnQty1, setReturnQty1] = useState(98);
  const [returnQty2, setReturnQty2] = useState(10);
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc>(null);
  const [showConversionAssistant, setShowConversionAssistant] =
    useState(false);

  const showToast = (
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const closePreview = () => setPreviewDoc(null);

  /* ── action handlers (real API) ───────────────────────────────── */
  const handleContractSigned = async () => {
    if (!draft) return;
    setActionLoading("contract");
    try {
      const result = await markReservationDraftContractSigned(draft.id);
      setDraft(result.reservation_draft);
      showToast("Contrat marqué comme signé.", "success");
    } catch (err: any) {
      showToast(
        err?.message || "Erreur lors de la signature du contrat.",
        "error",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDepositReceived = async () => {
    if (!draft) return;
    setActionLoading("deposit");
    try {
      const result = await markReservationDraftRequiredDepositReceived(
        draft.id,
      );
      setDraft(result.reservation_draft);
      showToast("Acompte enregistré comme reçu.", "success");
    } catch (err: any) {
      showToast(
        err?.message || "Erreur lors de l'enregistrement de l'acompte.",
        "error",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirm = async () => {
    if (!draft) return;
    setActionLoading("confirm");
    try {
      const result = await confirmReservationDraft(draft.id);
      setDraft(result.reservation_draft);
      if (result.blocked_item_count > 0) {
        showToast(
          `Réservation confirmée (${result.blocked_item_count} article(s) en conflit).`,
          "warning",
        );
      } else {
        showToast("Réservation confirmée avec succès.", "success");
      }
    } catch (err: any) {
      showToast(
        err?.message || "Erreur lors de la confirmation.",
        "error",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleConversionSuccess = (_updatedClient: any, _payment: any) => {
    setShowConversionAssistant(false);
    showToast(
      "Conversion réussie. Redirection vers le dossier confirmé...",
      "success",
    );
    setTimeout(() => {
      onNavigate("reservation-detail", draftId);
    }, 1500);
  };

  /* ── proforma action handlers ────────────────────────────────── */
  const proformaInstance = documentInstances.find(
    (di) =>
      di.template_key.startsWith("PROFORMA") &&
      di.status !== "voided",
  );

  const handleGenerateProforma = async () => {
    if (!draftId) return;
    setActionLoading("generate-proforma");
    try {
      // Determine template key based on scope
      const templateKey = draft?.start_at ? "PROFORMA-TITAN" : "PROFORMA-HAH";
      const instance = await createReservationDraftDocumentInstance(draftId, {
        template_key: templateKey,
      });
      await generateReservationDraftDocumentInstance(draftId, instance.id);
      // Refresh document list
      const docs = await getReservationDraftDocumentInstances(draftId);
      setDocumentInstances(docs);
      showToast("Proforma généré avec succès.", "success");
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de la génération du proforma.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConvertToContract = async () => {
    if (!proformaInstance) return;
    setActionLoading("convert-contract");
    try {
      const result = await convertProformaToContract(proformaInstance.id);
      setDocumentInstances((prev) =>
        prev.map((di) => (di.id === result.id ? result : di)),
      );
      showToast("Proforma converti en contrat avec succès.", "success");
    } catch (err: any) {
      showToast(
        err?.message || "Erreur lors de la conversion en contrat.",
        "error",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoidProforma = async () => {
    if (!proformaInstance) return;
    const reason = window.prompt("Raison de l'annulation du proforma (optionnel) :");
    if (reason === null) return; // User cancelled the prompt
    setActionLoading("void-proforma");
    try {
      const result = await voidProforma(proformaInstance.id, reason);
      setDocumentInstances((prev) =>
        prev.map((di) => (di.id === result.id ? result : di)),
      );
      showToast("Proforma annulé avec succès.", "success");
    } catch (err: any) {
      showToast(
        err?.message || "Erreur lors de l'annulation du proforma.",
        "error",
      );
    } finally {
      setActionLoading(null);
    }
  };

  /* ── derived data ─────────────────────────────────────────────── */
  const displayName =
    draft?.customer_display_name || customer?.display_name || "Client";

  const docClient = {
    name: displayName,
    type: customer?.party_type || "Particulier",
    address: customer?.address || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    idNumber: "",
    idIssueDate: "",
    idIssuePlace: "",
    nif: "",
    stat: "",
    rcs: "",
    repFirstName: "",
    repRole: "",
  };

  const safeAmount = 0; // Prices not available on draft lines
  const paidAmount = 0;
  const remainingAmount = 0;

  const materials =
    draft?.lines
      ?.filter(
        (l) =>
          l.inventory_item_kind === "article" ||
          l.inventory_item_kind === "material" ||
          l.inventory_item_kind === "material_pack",
      )
      .map((l) => ({
        id: `${draft.id}-${l.inventory_item_name}`,
        name: l.inventory_item_name,
        designation: l.inventory_item_name,
        quantity: safeNumber(l.quantity, 1),
        price: 0,
      })) || [];

  const services =
    draft?.lines
      ?.filter((l) => l.inventory_item_kind !== "material" && l.inventory_item_kind !== "article" && l.inventory_item_kind !== "material_pack")
      .map((l) => ({
        id: `${draft.id}-${l.inventory_item_name}`,
        name: l.inventory_item_name,
        quantity: safeNumber(l.quantity, 1),
        price: 0,
      })) || [];

  const isProspectProforma = customer?.lifecycle_status === "prospect";

  const reservationDate = draft?.start_at || "";
  const eventDate = draft?.end_at || "";
  const publicRef = draft?.public_reference || draftId;
  const draftStatus = draft?.status || "draft";

  const [payments, setPayments] = useState<
    {
      id: string;
      date: string;
      method: string;
      amount: number;
      note: string;
      reference?: string;
    }[]
  >([]);

  /* ── loading / error states ───────────────────────────────────── */
  if (loading) {
    return (
      <div className="page active space-y-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <i className="fa-solid fa-spinner fa-spin-pulse text-3xl text-indigo-500 mb-4 block"></i>
          <p className="text-slate-500 font-medium">
            Chargement de la réservation…
          </p>
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page active space-y-6 max-w-5xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="text-center bg-white rounded-2xl border border-slate-100 p-10 shadow-sm">
          <i className="fa-solid fa-circle-exclamation text-4xl text-red-400 mb-4 block"></i>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Erreur de chargement
          </h2>
          <p className="text-slate-500 mb-6">
            {error || "Réservation introuvable."}
          </p>
          <button
            onClick={() => (onBack ? onBack() : onNavigate("dashboard"))}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  /* ── prospect proforma view ───────────────────────────────────── */
  if (isProspectProforma) {
    return (
      <div className="page active space-y-6 max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() =>
                onBack ? onBack() : onNavigate("dashboard")
              }
              className="text-slate-500 hover:text-indigo-600 mb-2 flex items-center gap-2 text-sm font-medium"
              aria-label="Retour"
            >
              <i className="fa-solid fa-arrow-left"></i>
              {returnContext?.from === "customer"
                ? `Retour à la fiche ${displayName}`
                : "Retour"}
            </button>
            <h2 className="text-2xl font-bold text-slate-800">
              Proforma prospect — {publicRef}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Prospect non confirmé
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Résumé de la demande
            </h3>
            <p className="text-slate-600 mb-1">
              <span className="font-medium text-slate-700">
                Client / Prospect :
              </span>{" "}
              {displayName}
            </p>
            <p className="text-slate-600 mb-1">
              <span className="font-medium text-slate-700">
                Référence :
              </span>{" "}
              {publicRef}
            </p>
            <p className="text-slate-600 mb-4">
              <span className="font-medium text-slate-700">
                Date prévue :
              </span>{" "}
              {formatDateFr(reservationDate)}
            </p>
            <p className="text-slate-500 italic text-sm">
              Cette proforma ne crée aucun paiement, contrat, facture ou
              réservation confirmée.
            <button
              onClick={handleGenerateProforma}
              disabled={actionLoading === "generate-proforma"}
              className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
            >
              {actionLoading === "generate-proforma" ? (
                <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Génération...</>
              ) : (
                <><i className="fa-solid fa-file-invoice mr-2"></i>Générer le proforma</>
              )}
            </button>
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-md font-bold text-blue-800 mb-1">
                Prochaine étape commerciale
              </h3>
              <p className="text-sm text-blue-700">
                Disponible après paiement/acompte et complétion des
                informations légales (CIN, NIF/STAT, etc.).
              </p>
            </div>
            <div className="flex gap-4">
              {customer && (
                <button
                  onClick={() => onNavigate("customer", customer.id)}
                  className="px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 shadow-sm transition-colors whitespace-nowrap"
                >
                  Retour à la fiche prospect
                </button>
              )}
              <button
                onClick={() => setShowConversionAssistant(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium whitespace-nowrap shadow-sm transition-colors"
              >
                <i className="fa-solid fa-check-circle mr-2"></i>{" "}
                Confirmer avec acompte
              </button>
            </div>
          </div>
        </div>

        {showConversionAssistant && customer && (
          <ProspectConversionAssistant
            client={customer as any}
            proformaAmount={0}
            onCancel={() => setShowConversionAssistant(false)}
            onSuccess={handleConversionSuccess}
          />
        )}
      </div>
    );
  }

  /* ── main reservation detail view ─────────────────────────────── */
  return (
    <div className="page active space-y-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={() => (onBack ? onBack() : onNavigate("dashboard"))}
            className="text-slate-500 hover:text-indigo-600 mb-2 flex items-center gap-2 text-sm font-medium"
            aria-label="Retour"
          >
            <i className="fa-solid fa-arrow-left"></i>
            {returnContext?.from === "customer"
              ? `Retour à la fiche ${displayName}`
              : returnContext?.from === "reservations"
                ? "Retour à toutes les réservations"
                : returnContext?.from === "titan"
                  ? "Retour aux réservations Titan"
                  : returnContext?.from === "hahitantsoa"
                    ? "Retour aux réservations Hahitantsoa"
                    : "Retour au tableau de bord"}
          </button>
          <h2 className="text-2xl font-bold text-slate-800">
            Réservation {publicRef}
          </h2>
          <p className="text-sm text-slate-500">
            État d'avancement, ressources, documents, paiements et actions
            sensibles.
          </p>
        </div>
      </div>

      {/* ── status badge ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
            draftStatus === "confirmed"
              ? "bg-emerald-100 text-emerald-700"
              : draftStatus === "cancelled"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
          }`}
        >
          {draftStatus === "confirmed"
            ? "Confirmée"
            : draftStatus === "cancelled"
              ? "Annulée"
              : "Brouillon"}
        </span>
        {draft.contract_signed_at && (
          <span className="text-xs text-emerald-600 font-medium">
            <i className="fa-solid fa-check-circle mr-1"></i> Contrat signé
          </span>
        )}
        {draft.required_deposit_received_at && (
          <span className="text-xs text-emerald-600 font-medium">
            <i className="fa-solid fa-check-circle mr-1"></i> Acompte reçu
          </span>
        )}
      </div>

      {/* ── stepper ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
        {[
          "Proforma",
          "Contrat",
          "Acompte",
          "Confirmée",
          "Sortie",
          "Retour",
        ].map((step, idx) => {
          const isDone =
            (step === "Contrat" && !!draft.contract_signed_at) ||
            (step === "Acompte" && !!draft.required_deposit_received_at) ||
            (step === "Confirmée" && draftStatus === "confirmed") ||
            (idx === 0); // proforma always done
          const isActive =
            (step === "Contrat" && !draft.contract_signed_at) ||
            (step === "Acompte" &&
              !!draft.contract_signed_at &&
              !draft.required_deposit_received_at) ||
            (step === "Confirmée" &&
              draftStatus === "draft" &&
              !!draft.required_deposit_received_at);
          return (
            <React.Fragment key={step}>
              <div className="flex items-center space-x-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${
                    isDone && !isActive
                      ? "bg-indigo-600 text-white"
                      : isActive
                        ? "bg-indigo-100 text-indigo-700 border border-indigo-600"
                        : "border-2 border-slate-300 text-slate-500"
                  }`}
                >
                  {isDone && !isActive ? (
                    <i className="fa-solid fa-check"></i>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`font-semibold ${isDone ? "text-slate-900" : "text-slate-400"}`}
                >
                  {step}
                </span>
              </div>
              {idx < 5 && (
                <div
                  className={`h-0.5 min-w-[20px] flex-1 mx-4 ${isDone && !isActive ? "bg-indigo-600" : "bg-slate-200"}`}
                ></div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── info cards grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            {draft.notes || publicRef}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Client
              </label>
              <div
                className="text-sm text-slate-800 font-medium hover:text-indigo-600 hover:underline cursor-pointer"
                onClick={() =>
                  onNavigate("customer", draft.customer_id)
                }
              >
                {displayName}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Téléphone
              </label>
              <div className="text-sm text-slate-800 font-medium">
                {customer?.phone || "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Email
              </label>
              <div className="text-sm text-slate-800 font-medium">
                {customer?.email || "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Type
              </label>
              <div className="text-sm text-slate-800 font-medium">
                {docClient.type}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Date de début
              </label>
              <div className="text-sm text-slate-800 font-medium">
                {formatDateFr(reservationDate)}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Date de fin
              </label>
              <div className="text-sm text-slate-800 font-medium">
                {formatDateFr(eventDate)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Résumé financier
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">Total TTC</span>
              <span className="font-bold text-slate-800">
                {formatMoney(safeAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <span className="text-sm text-slate-500">
                Montant perçu
              </span>
              <span className="font-bold text-emerald-600">
                {formatMoney(paidAmount)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-rose-600">
                Reste à payer
              </span>
              <span className="font-bold text-rose-600">
                {formatMoney(remainingAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── payments table ────────────────────────────────────────── */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">
            Paiements en tranches
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 rounded-l-lg">
                    Date
                  </th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-left px-4 py-3">Note</th>
                  <th className="text-left px-4 py-3">Justificatif</th>
                  <th className="text-right px-4 py-3 rounded-r-lg">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={
                      idx === payments.length - 1 && remainingAmount <= 0
                        ? "bg-emerald-50/50"
                        : ""
                    }
                  >
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateFr(p.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        {p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {p.reference || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.note}</td>
                    <td className="px-4 py-3 text-indigo-600 cursor-pointer hover:underline text-xs">
                      <i className="fa-solid fa-download mr-1"></i>
                      Reçu
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">
                      + {formatMoney(p.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50">
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-right font-bold text-slate-700"
                  >
                    Reste dû
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">
                    {formatMoney(remainingAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── action buttons row ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">
          Actions sur la réservation
        </h3>
        <div className="flex flex-wrap gap-4">
          {!draft.contract_signed_at && (
            <button
              onClick={handleContractSigned}
              disabled={actionLoading === "contract"}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === "contract" ? (
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fa-solid fa-file-signature mr-2"></i>
              )}
              Marquer contrat signé
            </button>
          )}

          {draft.contract_signed_at && !draft.required_deposit_received_at && (
            <button
              onClick={handleDepositReceived}
              disabled={actionLoading === "deposit"}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === "deposit" ? (
                <i className="fa-solid fa-spinner fa-spin mr-2"></i>
              ) : (
                <i className="fa-solid fa-money-bill-transfer mr-2"></i>
              )}
              Marquer acompte reçu
            </button>
          )}

          {draftStatus === "draft" &&
            draft.contract_signed_at &&
            draft.required_deposit_received_at && (
              <button
                onClick={handleConfirm}
                disabled={actionLoading === "confirm"}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading === "confirm" ? (
                  <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fa-solid fa-check-circle mr-2"></i>
                )}
                Confirmer la réservation
              </button>
            )}
        </div>
      </div>

      {/* ── tabbed section (Titan domain) ─────────────────────────── */}
      {domain === "Titan" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mt-6 overflow-hidden">
          <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50">
            {[
              {
                id: "contrat",
                label: "Contrat & Proforma",
                icon: "fa-file-signature",
              },
              { id: "prep", label: "Préparation", icon: "fa-box-open" },
              {
                id: "sortie",
                label: "Sortie / Livraison",
                icon: "fa-truck-fast",
              },
              {
                id: "retour",
                label: "Retour / Restitution",
                icon: "fa-rotate-left",
              },
              { id: "casse", label: "Casse & Pertes", icon: "fa-heart-crack" },
              {
                id: "caution",
                label: "Caution & Solde",
                icon: "fa-money-bill-transfer",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "contrat" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">
                  Documents du dossier
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-left">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">
                          <i className="fa-solid fa-file-invoice"></i>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            Proforma
                          </p>
                          <p className="text-xs text-slate-500">
                            {proformaInstance
                              ? `Généré le ${formatDateFr(proformaInstance.prepared_at || proformaInstance.created_at)}`
                              : "Aucun proforma disponible"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPreviewDoc("proforma")}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Aperçu du proforma"
                      >
                        <i className="fa-solid fa-eye"></i>
                      </button>
                    </div>

                    {/* Validity status badge */}
                    {proformaInstance && (
                      <div className="mb-3">
                        {proformaInstance.status === "voided" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-600">
                            <i className="fa-solid fa-ban"></i>
                            Annulé
                          </span>
                        ) : proformaInstance.valid_until ? (
                          (() => {
                            const isExpired = new Date(proformaInstance.valid_until!) < new Date();
                            return (
                              <div className="flex items-center gap-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                    isExpired
                                      ? "bg-red-100 text-red-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  <i className={`fa-solid ${isExpired ? "fa-clock" : "fa-check-circle"}`}></i>
                                  {isExpired ? "Expiré" : "Valide"}
                                </span>
                                <span className="text-xs text-slate-500">
                                  Valide jusqu'au {formatDateFr(proformaInstance.valid_until)}
                                </span>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            <i className="fa-solid fa-info-circle"></i>
                            Pas de date d'expiration
                          </span>
                        )}
                      </div>
                    )}

                    {/* Convert / Void buttons */}
                    {proformaInstance && proformaInstance.status !== "voided" && (
                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={handleConvertToContract}
                          disabled={
                            actionLoading === "convert-contract" ||
                            (proformaInstance.valid_until
                              ? new Date(proformaInstance.valid_until) < new Date()
                              : false)
                          }
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                        >
                          {actionLoading === "convert-contract" ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fa-solid fa-file-contract"></i>
                          )}
                          Convertir en contrat
                        </button>
                        <button
                          onClick={handleVoidProforma}
                          disabled={actionLoading === "void-proforma"}
                          className="px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold shadow-sm hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                        >
                          {actionLoading === "void-proforma" ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fa-solid fa-ban"></i>
                          )}
                          Annuler le proforma
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setPreviewDoc("contrat")}
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-amber-100 text-amber-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-file-contract"></i>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          Contrat Titan
                        </p>
                        <p className="text-xs text-slate-500">
                          Signé par le client
                        </p>
                      </div>
                    </div>
                    <i className="fa-solid fa-eye text-slate-400 hover:text-amber-600"></i>
                  </button>
                  <button
                    onClick={() => setPreviewDoc("facture")}
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-file-invoice-dollar"></i>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          Facture
                        </p>
                        <p className="text-xs text-slate-500">
                          Règlement final
                        </p>
                      </div>
                    </div>
                    <i className="fa-solid fa-eye text-slate-400 hover:text-emerald-600"></i>
                  </button>
                  <button
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-file-signature"></i>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          Avenant
                        </p>
                        <p className="text-xs text-slate-500">Non généré</p>
                      </div>
                    </div>
                  </button>
                  <button
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-truck"></i>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          Bon de livraison / Sortie
                        </p>
                        <p className="text-xs text-slate-500">
                          Généré à la sortie
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    className="border border-slate-200 rounded-lg p-4 flex items-center justify-between bg-slate-50 opacity-60 cursor-not-allowed text-left"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-rotate-left"></i>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          Bon de retour
                        </p>
                        <p className="text-xs text-slate-500">
                          Généré au retour
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "prep" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">
                  Préparation matériel
                </h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-bold text-blue-900 block mb-1">
                      Statut actuel
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        prepStatus === "Prêt"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {prepStatus}
                    </span>
                  </div>
                  {prepStatus !== "Prêt" && (
                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-blue-700"
                      onClick={() => {
                        setPrepStatus("Prêt");
                        showToast(
                          "Marqué comme prêt.",
                          "success",
                        );
                      }}
                    >
                      Marquer comme prêt
                    </button>
                  )}
                </div>
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="p-3 font-semibold rounded-tl-lg">
                        Article
                      </th>
                      <th className="p-3 font-semibold text-center">
                        Qté demandée
                      </th>
                      <th className="p-3 font-semibold text-center">
                        Qté préparée
                      </th>
                      <th className="p-3 font-semibold rounded-tr-lg">
                        Disponibilité
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m, idx) => (
                      <tr
                        key={m.id}
                        className="border-b border-slate-100"
                      >
                        <td className="p-3">{m.name}</td>
                        <td className="p-3 text-center font-medium">
                          {m.quantity}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={m.quantity}
                            step="1"
                            className="w-16 border rounded p-1 text-center"
                            value={idx === 0 ? prepQty1 : prepQty2}
                            onChange={(e) => {
                              const v = Math.max(
                                0,
                                Math.min(
                                  m.quantity,
                                  parseInt(e.target.value || "0", 10),
                                ),
                              );
                              if (idx === 0) setPrepQty1(v);
                              else setPrepQty2(v);
                            }}
                          />
                        </td>
                        <td className="p-3 text-emerald-600 font-medium">
                          <i className="fa-solid fa-check-circle mr-1"></i>{" "}
                          En stock
                        </td>
                      </tr>
                    ))}
                    {materials.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-3 text-center text-slate-400 italic"
                        >
                          Aucun matériel dans cette réservation.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "sortie" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                  Sortie / Livraison
                  <span className="text-sm font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    <i className="fa-solid fa-truck text-indigo-500 mr-2"></i>{" "}
                    Prélèvement par le client
                  </span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Date et heure de sortie
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                      defaultValue={reservationDate?.substring(0, 16) || ""}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Responsable remise
                    </label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                      placeholder="Nom du responsable"
                    />
                  </div>
                </div>

                <h5 className="font-bold text-slate-700 text-sm mb-3">
                  État initial des articles
                </h5>
                <table className="w-full text-sm text-left mb-6">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase">
                      <th className="p-2">Article</th>
                      <th className="p-2 text-center">Qté</th>
                      <th className="p-2">État de sortie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-slate-100"
                      >
                        <td className="p-2">{m.name}</td>
                        <td className="p-2 text-center font-medium">
                          {m.quantity}
                        </td>
                        <td className="p-2">
                          <select className="border border-slate-300 rounded p-1 text-xs w-full">
                            <option>Bon état</option>
                            <option>Usure normale</option>
                            <option>À signaler</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Preuves visuelles (Photos avant départ)
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">
                    <i className="fa-solid fa-camera text-2xl mb-2 block"></i>
                    <span className="text-sm">Ajouter une photo</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700"
                    onClick={() =>
                      showToast(
                        "Bon de livraison généré et sortie validée.",
                        "success",
                      )
                    }
                  >
                    Valider la sortie / Bon de livraison
                  </button>
                </div>
              </div>
            )}

            {activeTab === "retour" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">
                  Retour / Restitution
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                      Retour prévu le
                    </label>
                    <div className="font-semibold text-slate-800">
                      {formatDateFr(eventDate)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">
                      Retour réel le
                    </label>
                    <input
                      type="datetime-local"
                      className="w-full border border-slate-300 rounded p-1.5 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-rose-500 uppercase mb-1">
                      Retard calculé
                    </label>
                    <div className="font-bold text-rose-600">
                      0 jour(s)
                    </div>
                    <div className="text-xs text-rose-500 italic mt-0.5">
                      Pénalité 50% par jour si applicable.
                    </div>
                  </div>
                </div>

                <h5 className="font-bold text-slate-700 text-sm mb-3">
                  Contrôle des articles
                </h5>
                <table className="w-full text-sm text-left mb-6">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase">
                      <th className="p-2">Article</th>
                      <th className="p-2 text-center">Attendus</th>
                      <th className="p-2 text-center">Retournés</th>
                      <th className="p-2">État au retour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m, idx) => (
                      <tr
                        key={m.id}
                        className="border-b border-slate-100"
                      >
                        <td className="p-2">{m.name}</td>
                        <td className="p-2 text-center text-slate-500">
                          {m.quantity}
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={m.quantity}
                            step="1"
                            className="w-16 border rounded p-1 text-center"
                            value={idx === 0 ? returnQty1 : returnQty2}
                            onChange={(e) => {
                              const v = Math.max(
                                0,
                                Math.min(
                                  m.quantity,
                                  parseInt(e.target.value || "0", 10),
                                ),
                              );
                              if (idx === 0) setReturnQty1(v);
                              else setReturnQty2(v);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className="border border-slate-300 rounded p-1 text-xs w-full text-rose-600 font-medium"
                            value={
                              idx === 0 ? returnStatus : undefined
                            }
                            onChange={
                              idx === 0
                                ? (e) => setReturnStatus(e.target.value)
                                : undefined
                            }
                          >
                            <option className="text-slate-700">
                              Bon état
                            </option>
                            <option className="text-rose-600">
                              Cassé
                            </option>
                            <option className="text-orange-600">
                              Manquant
                            </option>
                            {idx === 0 && (
                              <option className="text-amber-600">
                                Sale / non lavé
                              </option>
                            )}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes / Constat
                  </label>
                  <textarea
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                    rows={2}
                    placeholder="Notes sur le retour..."
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-300"
                    onClick={() =>
                      showToast(
                        "État de retour provisoire sauvegardé.",
                        "info",
                      )
                    }
                  >
                    Enregistrer provisoire
                  </button>
                  <button
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700"
                    onClick={() => {
                      showToast("Retour validé.", "success");
                      setActiveTab("casse");
                    }}
                  >
                    Valider retour & Aller à Casse
                  </button>
                </div>
              </div>
            )}

            {activeTab === "casse" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-4">
                  Casse & Pertes constatées
                </h4>

                <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 mb-6">
                  <h5 className="font-bold text-rose-800 mb-4 border-b border-rose-200 pb-2">
                    Facturation des préjudices
                  </h5>

                  <table className="w-full text-sm text-left mb-4">
                    <thead>
                      <tr className="text-rose-700 text-xs uppercase">
                        <th className="p-2">Article concerné</th>
                        <th className="p-2 text-center">Qté</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 text-right">
                          Prix de casse unitaire
                        </th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-rose-100">
                        <td className="p-2 font-medium text-rose-900">
                          Chaise Napoleon
                        </td>
                        <td className="p-2 text-center text-rose-900">
                          2
                        </td>
                        <td className="p-2 text-rose-700">Manquant</td>
                        <td className="p-2 text-right">60 000 Ar</td>
                        <td className="p-2 text-right font-bold text-rose-900">
                          120 000 Ar
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="flex justify-end mt-4">
                    <div className="text-right">
                      <p className="text-sm text-rose-700">
                        Total préjudices à retenir :
                      </p>
                      <p className="text-2xl font-black text-rose-700">
                        120 000 Ar
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-sm text-amber-800">
                  <i className="fa-solid fa-circle-info mr-2"></i>
                  <strong>Rappel contrat :</strong> Ce montant sera
                  déduit du dépôt de garantie (caution). Si le préjudice
                  est supérieur à la caution, le client est tenu de
                  régler la différence sous 8 jours avec +100% de frais
                  si applicable.
                </div>
              </div>
            )}

            {activeTab === "caution" && (
              <div>
                <h4 className="font-bold text-slate-800 mb-6">
                  Traitement Caution & Solde de fin de location
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h5 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">
                      1. Bilan Financier
                    </h5>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Total de la location</span>
                        <span>{formatMoney(safeAmount)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Solde location</span>
                        <span className="text-emerald-600 font-medium">
                          {paidAmount > 0
                            ? "Réglé"
                            : "En attente"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                    <h5 className="font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">
                      2. Pénalités et Retenues
                    </h5>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Pénalités de retard (50%/j)</span>
                        <span>0 Ar</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Frais de casse / perte</span>
                        <span>0 Ar</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hahitantsoa docs view ─────────────────────────────────── */}
      {domain !== "Titan" && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Documents du dossier
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setPreviewDoc("proforma")}
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">
                    <i className="fa-solid fa-file-invoice"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Proforma
                    </p>
                    <p className="text-xs text-slate-500">
                      Généré le {formatDateFr(reservationDate)}
                    </p>
                  </div>
                </div>
                <i className="fa-solid fa-eye text-slate-400 hover:text-indigo-600"></i>
              </button>
              <button
                onClick={() => setPreviewDoc("contrat")}
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-amber-100 text-amber-600 flex items-center justify-center text-lg">
                    <i className="fa-solid fa-file-contract"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Contrat Hahitantsoa
                    </p>
                    <p className="text-xs text-slate-500">
                      Signé par le client
                    </p>
                  </div>
                </div>
                <i className="fa-solid fa-eye text-slate-400 hover:text-amber-600"></i>
              </button>
              <button
                onClick={() => setPreviewDoc("facture")}
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
                    <i className="fa-solid fa-file-invoice-dollar"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Facture
                    </p>
                    <p className="text-xs text-slate-500">
                      Règlement final
                    </p>
                  </div>
                </div>
                <i className="fa-solid fa-eye text-slate-400 hover:text-emerald-600"></i>
              </button>
              <button
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                onClick={() =>
                  showToast(
                    "À venir — nécessite raccordement API/PDF",
                    "info",
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg">
                    <i className="fa-solid fa-file-signature"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Avenant
                    </p>
                    <p className="text-xs text-slate-500">Non généré</p>
                  </div>
                </div>
              </button>
              <button
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                onClick={() =>
                  showToast(
                    "À venir — nécessite raccordement API/PDF",
                    "info",
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg">
                    <i className="fa-solid fa-truck"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Bon de livraison / Sortie
                    </p>
                    <p className="text-xs text-slate-500">
                      Généré à la sortie
                    </p>
                  </div>
                </div>
              </button>
              <button
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                onClick={() =>
                  showToast(
                    "À venir — nécessite raccordement API/PDF",
                    "info",
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-lg">
                    <i className="fa-solid fa-rotate-left"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Bon de retour
                    </p>
                    <p className="text-xs text-slate-500">
                      Généré au retour
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <h4 className="text-sm font-bold text-slate-800 mt-6 mb-4">
              Pièces contractuelles / Annexes du contrat
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setPreviewDoc("annexes")}
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-purple-50 text-left border-l-4 border-l-purple-500"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-white text-purple-600 flex items-center justify-center text-lg shadow-sm">
                    <i className="fa-solid fa-paperclip"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      Annexes Hahitantsoa
                    </p>
                    <p className="text-xs text-slate-500">
                      Plan, règlement, prix de casse
                    </p>
                  </div>
                </div>
                <i className="fa-solid fa-eye text-slate-400 hover:text-purple-600"></i>
              </button>
              <div className="p-4 flex flex-col justify-center text-sm text-slate-500">
                <span className="font-medium text-slate-600 mb-1">
                  <i className="fa-solid fa-info-circle text-blue-500 mr-1"></i>{" "}
                  Annexes intégrées au contrat Hahitantsoa
                </span>
                Les annexes font partie intégrante des conditions
                générales de location signées.
              </div>
            </div>
          </div>

          {/* ── reservation lines ──────────────────────────────────── */}
          {draft.lines && draft.lines.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">
                Lignes de réservation
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase bg-slate-50">
                    <th className="text-left px-4 py-3 rounded-l-lg">
                      Type
                    </th>
                    <th className="text-left px-4 py-3">
                      Désignation
                    </th>
                    <th className="text-center px-4 py-3">Qté</th>
                    <th className="text-right px-4 py-3 rounded-r-lg">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {draft.lines.map((line) => (
                    <tr
                      key={line.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">
                          {line.inventory_item_kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {line.inventory_item_name}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {line.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── info banner ───────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 text-sm text-blue-800 mt-6">
        <i className="fa-solid fa-info-circle text-blue-600"></i>
        <strong>Information :</strong> Toute modification après contrat
        passe par avenant.
      </div>

      {/* ── document preview modal ────────────────────────────────── */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                Aperçu{" "}
                {previewDoc === "proforma"
                  ? "Proforma"
                  : previewDoc === "facture"
                    ? "Facture"
                    : previewDoc === "contrat"
                      ? "Contrat"
                      : "Annexes"}
              </h3>
              <button
                onClick={closePreview}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            {previewDoc === "annexes" ? (
              <div className="space-y-8 text-sm text-slate-700 font-serif">
                <div className="text-center mb-8 border-b pb-4">
                  <h2 className="text-2xl font-bold mb-2 uppercase">
                    Annexes Contractuelles
                  </h2>
                  <p className="text-slate-500">
                    Mises à jour pour la réservation {publicRef}
                  </p>
                </div>

                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">
                    Annexe 1 : Règlement Intérieur Hahitantsoa
                  </h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>
                      L'accès aux cuisines est strictement réservé au
                      personnel autorisé et aux traiteurs agréés.
                    </li>
                    <li>
                      Le niveau sonore ne doit pas dépasser les limites
                      légales en vigueur après 22h00.
                    </li>
                    <li>
                      L'utilisation de feux d'artifice, de fumigènes
                      lourds ou de confettis en plastique est strictement
                      interdite sur tout le domaine.
                    </li>
                    <li>
                      Le locataire est responsable du nettoyage
                      préliminaire et de la gestion des déchets générés
                      par ses prestataires.
                    </li>
                  </ul>
                </section>

                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">
                    Annexe 2 : Plan de masse et Évacuation
                  </h4>
                  <p className="mb-2">
                    Le plan d'évacuation est affiché dans le hall principal
                    et doit être communiqué au responsable de la sécurité
                    de l'événement.
                  </p>
                  <div className="bg-slate-100 p-4 rounded text-center border border-slate-300 border-dashed">
                    [Aperçu du plan d'évacuation PDF/Image intégré ici
                    dans la version finale]
                  </div>
                </section>

                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">
                    Annexe 3 : Grille tarifaire des casses & pertes
                  </h4>
                  <p className="mb-2">
                    En cas de dommage ou de perte du matériel mis à
                    disposition, la facturation se fera selon la grille
                    suivante :
                  </p>
                  <table className="w-full text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="p-2 border border-slate-200">
                          Désignation
                        </th>
                        <th className="p-2 border border-slate-200">
                          Indemnité forfaitaire (Ar)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-slate-200">
                          Chaise Chiavari (casse/perte)
                        </td>
                        <td className="p-2 border border-slate-200 font-mono">
                          150 000
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-200">
                          Verre / Coupe (unité)
                        </td>
                        <td className="p-2 border border-slate-200 font-mono">
                          15 000
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-200">
                          Assiette de présentation
                        </td>
                        <td className="p-2 border border-slate-200 font-mono">
                          45 000
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-200">
                          Table ronde / rectangulaire
                        </td>
                        <td className="p-2 border border-slate-200 font-mono">
                          350 000
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section>
                  <h4 className="text-lg font-bold text-slate-900 mb-2 border-l-4 border-indigo-600 pl-3 bg-slate-50 py-1">
                    Annexe 4 : Liste des intervenants non autorisés
                  </h4>
                  <p className="mb-2">
                    Pour des raisons de qualité, de sécurité ou de litiges
                    antérieurs, les prestataires suivants ne sont pas admis
                    sur le domaine Hahitantsoa :
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-rose-700">
                    <li>
                      Prestataire Alpha (Sonorisation) - Dépassement
                      récurrent des décibels
                    </li>
                    <li>
                      Traiteur Beta - Non-respect des règles d'hygiène
                    </li>
                    <li>
                      Décorateur Gamma - Utilisation de matériaux
                      inflammables non homologués
                    </li>
                  </ul>
                  <p className="mt-2 text-xs text-slate-500 italic">
                    Cette liste est mise à jour mensuellement par la
                    direction technique.
                  </p>
                </section>
              </div>
            ) : (
              <DocumentPreview
                type={previewDoc === "contrat" ? "contrat" : previewDoc}
                domain={domain === "Titan" ? "titan" : "hahitantsoa"}
                client={docClient}
                date={reservationDate}
                refNumber={publicRef}
                eventDate={eventDate}
                materials={materials}
                services={services}
                totalAmount={safeAmount}
                subTotalAmount={safeAmount}
                paidAmount={paidAmount}
              />
            )}
          </div>
        </div>
      )}

      {/* ── toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium animate-fade-in z-50 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "warning"
                ? "bg-amber-500 text-white"
                : toast.type === "error"
                  ? "bg-red-600 text-white"
                  : "bg-slate-800 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
