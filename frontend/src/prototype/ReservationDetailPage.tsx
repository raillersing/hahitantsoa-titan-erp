import React, { useState, useEffect, useRef } from "react";
import { AppScope } from "../App";
import DocumentArtifactPreviewPanel from "../DocumentArtifactPreviewPanel";
import { DocumentPreview } from "./DocumentPreview";
import { printDocumentHtml } from "./DocumentCanvasViewer";
import { DocumentPreviewDispatcher } from "../documents/document-preview-dispatcher";
import { ProspectConversionAssistant } from "./ProspectConversionAssistant";
import PaymentWhatsAppReminderButton from "../PaymentWhatsAppReminderButton";
import LifecycleTimeline from "./LifecycleTimeline";
import {
  getReservationDraft,
  getCustomer,
  getReservationDraftDocumentInstances,
  markReservationDraftContractSigned,
  confirmReservationDraft,
  convertProformaToContract,
  createReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstance,
  voidProforma,
  getPayments,
  recordConfirmedDeposit,
  createReservationDraftAmendment,
  closeReservationDraft,
  getReservationDraftCloseoutSummary,
  getReservationDraftLifecycle,
} from "../api";
import type { LifecycleSummary, ReservationCloseoutSummary, ReservationDraft, Customer, DocumentInstance, Payment } from "../types";

/* ── inline helpers ────────────────────────────────────────────────── */

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

type PreviewDoc =
  | "proforma"
  | "facture"
  | "contrat"
  | "annexes"
  | "bon_livraison"
  | "fiche_preparation"
  | "bon_retour"
  | "facture_casse"
  | "recu_remboursement"
  | "avenant"
  | "recu_paiement"
  | null;

type PreviewModalState = {
  title: string;
  documentInstanceId?: string | null;
  templateKey?: string;
  type?: string;
} | null;

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
  const [showAmendmentForm, setShowAmendmentForm] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amendmentNotes, setAmendmentNotes] = useState("");
  const [amendmentStartAt, setAmendmentStartAt] = useState("");
  const [amendmentEndAt, setAmendmentEndAt] = useState("");
  const [amendmentQuantities, setAmendmentQuantities] = useState<Record<string, number>>({});
  const [amendmentStep, setAmendmentStep] = useState(1);
  const [payments, setPayments] = useState<
    {
      id: string;
      date: string;
      method: string;
      amount: number;
      note: string;
      reference?: string;
      receipt_document?: DocumentInstance | null;
    }[]
  >([]);
  const depositRecordingKeyRef = useRef<string | null>(null);
  const [closeoutSummary, setCloseoutSummary] = useState<ReservationCloseoutSummary | null>(null);
  const [lifecycleSummary, setLifecycleSummary] = useState<LifecycleSummary | null>(null);
  const [lifecycleError, setLifecycleError] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>(null);

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
        try {
          const paymentRecords = await getPayments(d.id);
          if (!cancelled) {
            setPayments(paymentRecords
              .filter((payment: Payment) =>
                payment.payment_status === "confirmed" || payment.payment_status === "reconciled",
              )
              .map((payment: Payment) => ({
              id: payment.id,
              date: payment.paid_at || payment.created_at,
              method: payment.payment_method,
              amount: Number(payment.amount),
              note: payment.notes || payment.payment_kind,
              reference: payment.external_reference || undefined,
              receipt_document: payment.receipt_document,
              })));
          }
        } catch {
          // Non-fatal: payment loading failure does not hide the dossier.
        }
        try {
          const summary = await getReservationDraftCloseoutSummary(d.id);
          if (!cancelled) setCloseoutSummary(summary);
        } catch {
          // Non-fatal: closeout access may be unavailable for the current role.
        }
        try {
          const summary = await getReservationDraftLifecycle(d.id);
          if (!cancelled) {
            setLifecycleSummary(summary);
            setLifecycleError(false);
          }
        } catch {
          if (!cancelled) setLifecycleError(true);
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
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc>(null);
  const [showConversionAssistant, setShowConversionAssistant] =
    useState(false);
  const preparationStep = lifecycleSummary?.steps.find((step) => step.key === "preparation");
  const preparationReady = preparationStep?.status === "done";

  const showToast = (
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshLifecycle = async (reservationDraftId: string) => {
    try {
      setLifecycleSummary(await getReservationDraftLifecycle(reservationDraftId));
      setLifecycleError(false);
    } catch {
      // Keep the last successfully loaded operational context on a transient refresh failure.
      setLifecycleError(true);
    }
  };

  const closePreview = () => setPreviewDoc(null);

  const openAmendmentWizard = () => {
    setAmendmentStep(1);
    setAmendmentReason("");
    setAmendmentNotes("");
    setAmendmentStartAt("");
    setAmendmentEndAt("");
    setAmendmentQuantities({});
    setShowAmendmentForm(true);
  };

  const amendmentStepTitles = ["Motif", "Période", "Articles", "Résumé"];

  const goToNextAmendmentStep = () => {
    if (amendmentStep === 1 && !amendmentReason.trim()) return;
    setAmendmentStep((current) => Math.min(4, current + 1));
  };

  const handleCreateTitanAmendment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setActionLoading("amendment");
    try {
      await createReservationDraftAmendment(draft.id, {
        reason: amendmentReason.trim(),
        notes: amendmentNotes.trim(),
        changed_start_at: amendmentStartAt ? new Date(amendmentStartAt).toISOString() : undefined,
        changed_end_at: amendmentEndAt ? new Date(amendmentEndAt).toISOString() : undefined,
        changed_lines: draft.lines.map((line) => ({
          inventory_item_id: line.inventory_item_id,
          quantity: amendmentQuantities[line.id] ?? line.quantity,
          notes: line.notes,
        })),
      });
      setShowAmendmentForm(false);
      setAmendmentReason("");
      setAmendmentNotes("");
      setAmendmentStartAt("");
      setAmendmentEndAt("");
      setAmendmentQuantities({});
      showToast("Avenant Titan généré et prêt à être imprimé.", "success");
      const instances = await getReservationDraftDocumentInstances(draft.id);
      setDocumentInstances(instances);
    } catch (err: any) {
      showToast(err?.message || "Erreur lors de la génération de l'avenant.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  /* ── action handlers (real API) ───────────────────────────────── */
  const handleContractSigned = async () => {
    if (!draft) return;
    setActionLoading("contract");
    try {
      const result = await markReservationDraftContractSigned(draft.id);
      setDraft(result.reservation_draft);
      await refreshLifecycle(draft.id);
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
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Saisissez un montant d'acompte supérieur à zéro.");
      }
      const idempotencyKey = depositRecordingKeyRef.current ?? crypto.randomUUID();
      depositRecordingKeyRef.current = idempotencyKey;
      const result = await recordConfirmedDeposit({
        reservation_draft: draft.id,
        payment_method: "cash",
        amount: amount.toFixed(2),
        notes: "Acompte enregistré depuis le dossier Titan.",
        idempotency_key: idempotencyKey,
      });
      const [updatedDraft, paymentRecords] = await Promise.all([
        getReservationDraft(draft.id),
        getPayments(draft.id),
      ]);
      setDraft(updatedDraft);
      await refreshLifecycle(draft.id);
      setPayments(paymentRecords
        .filter((payment: Payment) =>
          payment.payment_status === "confirmed" || payment.payment_status === "reconciled",
        )
        .map((payment: Payment) => ({
          id: payment.id,
          date: payment.paid_at || payment.created_at,
          method: payment.payment_method,
          amount: Number(payment.amount),
          note: payment.notes || payment.payment_kind,
          reference: payment.external_reference || undefined,
        })));
      depositRecordingKeyRef.current = null;
      setDepositAmount("");
      showToast(
        result.replayed ? "L'acompte déjà enregistré a été repris sans doublon." : "Acompte enregistré et confirmé.",
        "success",
      );
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
      await refreshLifecycle(draft.id);
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

  const handleCloseout = async () => {
    if (!draft || closeoutSummary?.closeout_status === "closed") return;
    setActionLoading("closeout");
    try {
      const summary = await closeReservationDraft(draft.id, `reservation-closeout-${draft.id}`);
      setCloseoutSummary(summary);
      await refreshLifecycle(draft.id);
      showToast(summary.replayed ? "Clôture déjà enregistrée, résumé rechargé." : "Dossier clôturé avec succès.", "success");
    } catch (err: any) {
      showToast(err?.message || "Le dossier n'est pas encore prêt pour la clôture.", "error");
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
      (di.document_type?.toLowerCase() === "proforma" ||
        di.template_key?.toLowerCase().includes("proforma")) &&
      di.status !== "voided",
  );
  const titanContractInstance = documentInstances.find(
    (documentInstance) =>
      documentInstance.template_key === "titan.material_contract.v1" ||
      documentInstance.template_key === "titan.material_amendment.v1",
  );
  const contractWarnings = titanContractInstance?.contract_warnings ?? [];

  const previewArtifact = previewDoc
    ? documentInstances.find((documentInstance) => {
        if (!['prepared', 'generated', 'issued'].includes(documentInstance.status)) return false;
        if (previewDoc === "annexes") {
          return documentInstance.template_key === "hahitantsoa.contract.v1";
        }
        return (
          documentInstance.document_type.toLowerCase() === previewDoc ||
          documentInstance.template_key.toLowerCase().includes(previewDoc)
        );
      })
    : undefined;

  const handleGenerateProforma = async () => {
    if (!draftId) return;
    setActionLoading("generate-proforma");
    try {
      // Determine template key based on scope
      const templateKey =
        domain?.toLowerCase() === "titan" || Boolean(draft?.start_at)
          ? "titan.proforma.v1"
          : "hahitantsoa.proforma.v1";
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
    type: customer?.party_type === "company" ? "Entreprise" : "Particulier",
    party_type: customer?.party_type || "individual",
    address: customer?.address || "",
    email: customer?.email || "",
    phone: customer?.phone || "",
    civilite: customer?.civilite || "",
    birthDate: customer?.birth_date || "",
    birthPlace: customer?.birth_place || "",
    idType: customer?.id_type || "Carte d’Identité Nationale",
    idNumber: customer?.id_number || "",
    idIssueDate: customer?.id_issue_date || "",
    idIssuePlace: customer?.id_issue_place || "",
    idDuplicataDate: customer?.id_duplicata_date || "",
    idDuplicataPlace: customer?.id_duplicata_place || "",
    nif: customer?.nif || "",
    stat: customer?.stat || "",
    rcs: customer?.rcs || "",
    repFirstName: customer?.representative_name || "",
    repRole: customer?.representative_role || "Gérant(e)",
  };

  const safeAmount = safeNumber(draft?.total_amount);
  const subtotalAmount = safeNumber(draft?.subtotal_amount);
  const deliveryFeeAmount = safeNumber(draft?.delivery_fee);
  const discountAmount = safeNumber(draft?.discount_amount);
  const commercialSubTotal = subtotalAmount + deliveryFeeAmount;
  const paidAmount = payments.reduce((total, payment) => total + payment.amount, 0);
  const remainingAmount = Math.max(0, safeAmount - paidAmount);
  const requiredDepositAmount =
    safeNumber(draft?.required_deposit_amount) || Math.round(safeAmount * 0.25);

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
        price: safeNumber(l.unit_rental_price),
      })) || [];

  const services: never[] = [];

  const isProspectProforma = customer?.lifecycle_status === "prospect";

  const reservationDate = draft?.start_at || "";
  const eventDate = draft?.end_at || "";
  const publicRef = draft?.public_reference || draftId;
  const draftStatus = draft?.status || "draft";

  const [depositAmount, setDepositAmount] = useState("");

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

      {lifecycleSummary && <LifecycleTimeline summary={lifecycleSummary} />}
      {lifecycleError && !lifecycleSummary && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Parcours opérationnel indisponible. Actualisez le dossier après avoir vérifié votre accès.
        </div>
      )}

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

      {/* ── Section 1 : Fiche Client & Synthèse Financière Harmonisée ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <i className="fa-solid fa-user-tie text-indigo-600"></i> Fiche Client
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {docClient.type}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Nom complet / Raison sociale</span>
                <span
                  className="font-bold text-slate-800 hover:text-indigo-600 hover:underline cursor-pointer"
                  onClick={() => onNavigate("customer", draft.customer_id)}
                >
                  {displayName}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-slate-400 block">Téléphone</span>
                  <span className="font-medium text-slate-700">{customer?.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Email</span>
                  <span className="font-medium text-slate-700 truncate block">{customer?.email || "—"}</span>
                </div>
              </div>
              {customer?.address && (
                <div>
                  <span className="text-xs text-slate-400 block">Adresse</span>
                  <span className="text-slate-600">{customer.address}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
                <div>
                  <span className="text-xs text-slate-400 block">Début location</span>
                  <span className="font-semibold text-slate-700">{formatDateFr(reservationDate)}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Fin location</span>
                  <span className="font-semibold text-slate-700">{formatDateFr(eventDate)}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Créé le {formatDateFr(draft.created_at)}</span>
            <span>Réf : {publicRef}</span>
          </div>
        </div>

        {/* Financial & Milestone Schedule Card */}
        <div className="lg:col-span-7 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-indigo-100/60 pb-3 mb-4">
              <h3 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                <i className="fa-solid fa-coins text-amber-500"></i> Synthèse Financière & Échéancier
              </h3>
              <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Échéancier Titan (25% + Solde + Caution)
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5 mb-4">
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Dossier</span>
                <span className="text-sm font-black text-slate-900">{formatMoney(safeAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Acompte Requis</span>
                <span className="text-sm font-black text-amber-600">{formatMoney(requiredDepositAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Perçu</span>
                <span className="text-sm font-black text-emerald-600">{formatMoney(paidAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Reste à Régler</span>
                <span className={`text-sm font-black ${remainingAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {formatMoney(remainingAmount)}
                </span>
              </div>
            </div>

            {/* Commercial breakdown details */}
            <div className="rounded-xl border border-slate-100 bg-white p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Sous-total location</span>
                <span className="font-medium text-slate-700">{formatMoney(subtotalAmount)}</span>
              </div>
              {deliveryFeeAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Livraison</span>
                  <span className="font-medium text-slate-700">{formatMoney(deliveryFeeAmount)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">
                    Remise{draft?.discount_reason ? ` — ${draft.discount_reason}` : ""}
                  </span>
                  <span className="font-medium text-emerald-700">− {formatMoney(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                <span className="font-bold text-slate-700">Total TTC</span>
                <span className="font-bold text-slate-900">{formatMoney(safeAmount)}</span>
              </div>
            </div>

            {/* 3-tier milestone schedule boxes with progress bars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* 1. Deposit 25% */}
              <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-700">1. Acompte (25%)</span>
                    {paidAmount >= requiredDepositAmount ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Réglé</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">En cours</span>
                    )}
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(requiredDepositAmount)}</p>
                  <span className="text-[10px] text-slate-500 block mt-0.5">À la confirmation</span>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min((paidAmount / (requiredDepositAmount || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Payé : {formatMoney(Math.min(paidAmount, requiredDepositAmount))}
                  </span>
                </div>
              </div>

              {/* 2. Balance before delivery (J-5) */}
              <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-700">2. Solde (75%)</span>
                    {remainingAmount <= 0 ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Soldé</span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">Avant départ</span>
                    )}
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(Math.max(0, safeAmount - requiredDepositAmount))}</p>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Échéance : J-5 avant livraison</span>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-teal-600 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (Math.max(0, paidAmount - requiredDepositAmount) /
                            (Math.max(1, safeAmount - requiredDepositAmount))) *
                            100,
                          100,
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Payé : {formatMoney(Math.max(0, paidAmount - requiredDepositAmount))}
                  </span>
                </div>
              </div>

              {/* 3. Caution / Dépôt de garantie */}
              <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-700">3. Caution Dépôt</span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">Restituable</span>
                  </div>
                  <p className="text-sm font-black text-slate-900 mt-0.5">Chèque / Espèces</p>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Exigée à la prise en charge</span>
                </div>
                <div className="mt-2 pt-1 border-t border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Restitution après retour & contrôle</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payments table ────────────────────────────────────────── */}
      {payments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-receipt text-indigo-600"></i> Paiements & Règlements enregistrés
            </h3>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {payments.length} versement{payments.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 rounded-l-lg">Date</th>
                  <th className="text-left px-4 py-3">Mode</th>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-left px-4 py-3">Note</th>
                  <th className="text-center px-4 py-3">Reçu officiel</th>
                  <th className="text-right px-4 py-3 rounded-r-lg">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p, idx) => (
                  <tr
                    key={p.id || `payment-${idx}`}
                    className={
                      idx === payments.length - 1 && remainingAmount <= 0
                        ? "bg-emerald-50/50"
                        : ""
                    }
                  >
                    <td className="px-4 py-3 text-slate-600">{formatDateFr(p.date)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                        {p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                      {p.reference || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.note}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewModal({
                            title: `Reçu de versement - ${formatMoney(p.amount)}`,
                            documentInstanceId: p.receipt_document?.id || null,
                            templateKey: "titan.payment_receipt.v1",
                            type: "recu_paiement",
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <i className="fa-solid fa-file-invoice text-indigo-600"></i>
                        <span>Reçu</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">
                      + {formatMoney(p.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={5} className="px-4 py-3 text-right text-slate-700">
                    Reste dû
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600">
                    {formatMoney(remainingAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaymentWhatsAppReminderButton draftId={draftId} businessScope="titan" />

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
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-600">
                Montant de l'acompte
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  placeholder="Montant"
                  className="mt-1 block w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
                />
              </label>
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
                Enregistrer et confirmer l'acompte
              </button>
            </div>
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

          {draft.status === "confirmed" && closeoutSummary && (
            <div className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-800">Clôture opérationnelle</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Logistique terminée : {closeoutSummary.logistics.completed_count}/{closeoutSummary.logistics.event_count} · Retours réglés : {closeoutSummary.returns.settlement_validated_count}/{closeoutSummary.returns.settlement_count} · Factures ouvertes : {formatMoney(closeoutSummary.billing.open_amount)}
                  </p>
                </div>
                {closeoutSummary.closeout_status === "closed" ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-700">Dossier clôturé</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCloseout()}
                    disabled={actionLoading === "closeout"}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    <i className={`fas ${actionLoading === "closeout" ? "fa-spinner fa-spin" : "fa-lock"} mr-2`} />Clôturer le dossier
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">La clôture est vérifiée et enregistrée par le backend. Si une étape manque, le bouton affichera le blocage exact sans modifier le dossier.</p>
            </div>
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
                label: "Documents & Devis",
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
              {
                id: "avenants",
                label: "Avenants",
                icon: "fa-pen-to-square",
              },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
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
                <h4 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
                  <span>Documents & Pièces contractuelles</span>
                  <span className="text-xs text-slate-500 font-normal">Aperçus et documents générés</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1. Proforma */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-file-invoice"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Devis / Proforma</p>
                            <p className="text-xs text-slate-500">
                              {proformaInstance
                                ? `Généré le ${formatDateFr(proformaInstance.prepared_at || proformaInstance.created_at)}`
                                : "Aperçu disponible"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Devis / Facture Proforma Titan",
                              documentInstanceId: proformaInstance?.id || null,
                              templateKey: "titan.proforma.v1",
                              type: "proforma",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du proforma"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>

                      {/* Validity status badge */}
                      {proformaInstance && (
                        <div className="mb-3">
                          {proformaInstance.status === "voided" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-600">
                              <i className="fa-solid fa-ban"></i> Annulé
                            </span>
                          ) : proformaInstance.valid_until ? (
                            (() => {
                              const isExpired = new Date(proformaInstance.valid_until!) < new Date();
                              return (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                      isExpired ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    <i className={`fa-solid ${isExpired ? "fa-clock" : "fa-check-circle"}`}></i>
                                    {isExpired ? "Expiré" : "Valide"}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    Jusqu'au {formatDateFr(proformaInstance.valid_until)}
                                  </span>
                                </div>
                              );
                            })()
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700">
                              <i className="fa-solid fa-info-circle"></i> Permanent
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Convert / Void buttons */}
                    {proformaInstance && proformaInstance.status !== "voided" && (
                      <div className="flex gap-2 pt-2 border-t border-slate-200 mt-2">
                        <button
                          type="button"
                          onClick={handleConvertToContract}
                          disabled={
                            actionLoading === "convert-contract" ||
                            (proformaInstance.valid_until
                              ? new Date(proformaInstance.valid_until) < new Date()
                              : false)
                          }
                          className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          {actionLoading === "convert-contract" ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fa-solid fa-file-contract"></i>
                          )}
                          Convertir en contrat
                        </button>
                        <button
                          type="button"
                          onClick={handleVoidProforma}
                          disabled={actionLoading === "void-proforma"}
                          className="px-2.5 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold shadow-xs hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          {actionLoading === "void-proforma" ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fa-solid fa-ban"></i>
                          )}
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 2. Contrat Titan */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-file-contract"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Contrat de location</p>
                            <p className="text-xs text-slate-500">
                              {draft.contract_signed_at ? "Contrat signé" : "En attente de signature"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Contrat de location Titan",
                              documentInstanceId: titanContractInstance?.id || null,
                              templateKey: "titan.material_contract.v1",
                              type: "contrat",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du contrat"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        {draft.contract_signed_at
                          ? `Signé le ${formatDateFr(draft.contract_signed_at)}`
                          : "Contrat officiel avec conditions générales de location"}
                      </p>
                    </div>
                  </div>

                  {/* 3. Facture */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-file-invoice-dollar"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Facture définitive</p>
                            <p className="text-xs text-slate-500">Règlement & facturation</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Facture de location Titan",
                              templateKey: "titan.invoice.v1",
                              type: "facture",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu de la facture"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Facturation officielle avec détail de la TVA et des règlements perçus.
                      </p>
                    </div>
                  </div>

                  {/* 4. Bon de préparation */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-box-open"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Bon de préparation</p>
                            <p className="text-xs text-slate-500">Magasin & préparation stock</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Bon de préparation matériel",
                              templateKey: "shared.preparation_sheet.v1",
                              type: "fiche_preparation",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du bon de préparation"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Fiche de préparation magasinier avec quantités à rassembler et vérifier.
                      </p>
                    </div>
                  </div>

                  {/* 5. Bon de livraison / Sortie */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-truck-fast"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Bon de livraison / Sortie</p>
                            <p className="text-xs text-slate-500">Remise matériel & transport</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Bon de livraison / Sortie Titan",
                              templateKey: "titan.delivery_note.v1",
                              type: "bon_livraison",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du bon de livraison"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Document de passation et prise en charge signé à la sortie des articles.
                      </p>
                    </div>
                  </div>

                  {/* 6. Bon de retour */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-rotate-left"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Bon de retour</p>
                            <p className="text-xs text-slate-500">Restitution & contrôle</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Bon de retour / Restitution",
                              templateKey: "shared.return_note.v1",
                              type: "bon_retour",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du bon de retour"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Constat contradictoire des quantités retournées et de l'état du matériel.
                      </p>
                    </div>
                  </div>

                  {/* 7. Facture de casse */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-heart-crack"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Facture casse & pertes</p>
                            <p className="text-xs text-slate-500">Dégradations constatées</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Facture de casse et dégradation",
                              templateKey: "titan.breakage_repair_invoice.v1",
                              type: "facture_casse",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu de la facture de casse"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Facture de dédommagement calculée sur la grille officielle des casses.
                      </p>
                    </div>
                  </div>

                  {/* 8. Récépissé remboursement caution */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-money-bill-transfer"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Récépissé de caution</p>
                            <p className="text-xs text-slate-500">Remboursement / Solde</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Récépissé de remboursement de caution",
                              templateKey: "shared.payment_refund_receipt.v1",
                              type: "recu_remboursement",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du récépissé de caution"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Attestation officielle de restitution de la caution après clôture sans litige.
                      </p>
                    </div>
                  </div>

                  {/* 9. Avenant */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg">
                            <i className="fa-solid fa-pen-to-square"></i>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">Avenant de location</p>
                            <p className="text-xs text-slate-500">Modification contractuelle</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewModal({
                              title: "Avenant au contrat de location",
                              templateKey: "titan.material_amendment.v1",
                              type: "avenant",
                            })
                          }
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu de l'avenant"
                        >
                          <i className="fa-solid fa-eye text-base"></i>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Modification des dates ou quantités d'articles jusqu'au jour du départ.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-200 mt-2">
                      <button
                        type="button"
                        onClick={openAmendmentWizard}
                        className="w-full py-1.5 px-3 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold shadow-xs hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-plus"></i> Créer un avenant
                      </button>
                    </div>
                  </div>
                </div>

                {contractWarnings.length > 0 && (
                  <div
                    className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                    role="status"
                  >
                    <p className="font-bold flex items-center gap-2">
                      <i className="fa-solid fa-triangle-exclamation text-amber-600"></i>
                      Informations contractuelles à compléter
                    </p>
                    <p className="mt-1 text-xs">
                      Le contrat reste générable. Complétez ces informations dès que possible.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                      {contractWarnings.map((warning) => (
                        <li key={warning.code}>{warning.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === "prep" && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800">Préparation matériel & Magasin</h4>
                    <p className="text-xs text-slate-500">Rassemblement et contrôle avant expédition</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          title: "Bon de préparation matériel (Magasin)",
                          templateKey: "shared.preparation_sheet.v1",
                          type: "fiche_preparation",
                        })
                      }
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-file-lines text-indigo-600"></i>
                      <span>Aperçu Bon de préparation</span>
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      onClick={() => onNavigate("stock-preparation")}
                    >
                      <i className="fa-solid fa-check-double"></i>
                      <span>Ouvrir la préparation réelle</span>
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 mb-4 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-blue-900 block mb-1">Statut actuel</span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        preparationReady ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {preparationReady ? "Prêt à être expédié" : "À préparer en magasin"}
                    </span>
                  </div>
                </div>

                <table className="w-full text-sm text-left border-collapse bg-white rounded-xl overflow-hidden border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
                      <th className="p-3 font-semibold">Article</th>
                      <th className="p-3 font-semibold text-center">Qté demandée</th>
                      <th className="p-3 font-semibold text-center">Qté préparée</th>
                      <th className="p-3 font-semibold text-right">Disponibilité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{m.name}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{m.quantity}</td>
                        <td className="p-3 text-center">
                          <span className="text-slate-500 text-xs">À renseigner dans la préparation réelle</span>
                        </td>
                        <td className="p-3 text-right text-emerald-600 font-semibold text-xs">
                          <i className="fa-solid fa-circle-check mr-1"></i> En stock
                        </td>
                      </tr>
                    ))}
                    {materials.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 italic">
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
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800">Sortie / Livraison du matériel</h4>
                    <p className="text-xs text-slate-500">Expédition, transport et décharge de livraison</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          title: "Bon de livraison / Sortie Titan",
                          templateKey: "titan.delivery_note.v1",
                          type: "bon_livraison",
                        })
                      }
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-file-lines text-indigo-600"></i>
                      <span>Aperçu Bon de livraison</span>
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      onClick={() => onNavigate("logistics-dispatch")}
                    >
                      <i className="fa-solid fa-truck"></i>
                      <span>Ouvrir le planning sortie</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Date de début de location
                    </label>
                    <p className="text-sm font-semibold text-slate-800">{formatDateFr(reservationDate)}</p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Responsable remise
                    </label>
                    <p className="text-sm text-slate-500">Enregistré lors de la validation logistique</p>
                  </div>
                </div>

                <table className="w-full text-sm text-left mb-6 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
                      <th className="p-3">Article</th>
                      <th className="p-3 text-center">Qté</th>
                      <th className="p-3">État au départ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{m.name}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{m.quantity}</td>
                        <td className="p-3 text-slate-500 text-xs">Constaté au départ réel</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "retour" && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800">Retour / Restitution du matériel</h4>
                    <p className="text-xs text-slate-500">Contrôle quantitatif et qualitatif au retour</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          title: "Bon de retour / Restitution Titan",
                          templateKey: "shared.return_note.v1",
                          type: "bon_retour",
                        })
                      }
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-file-lines text-indigo-600"></i>
                      <span>Aperçu Bon de retour</span>
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      onClick={() => onNavigate("logistics-returns", `titan:${draft.id}`)}
                    >
                      <i className="fa-solid fa-circle-check"></i>
                      <span>Ouvrir le retour réel</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Retour prévu le
                    </label>
                    <div className="font-semibold text-slate-800">{formatDateFr(eventDate)}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Retour réel le
                    </label>
                    <div className="font-semibold text-slate-500">Enregistré au retour réel</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-rose-500 uppercase mb-1">
                      Retard / Pénalité
                    </label>
                    <div className="font-bold text-rose-600">Calculé après validation</div>
                  </div>
                </div>

                <table className="w-full text-sm text-left mb-6 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase">
                      <th className="p-3">Article</th>
                      <th className="p-3 text-center">Attendus</th>
                      <th className="p-3 text-center">Retournés</th>
                      <th className="p-3">État au retour</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-800">{m.name}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{m.quantity}</td>
                        <td className="p-3 text-center">
                          <span className="text-slate-500">À saisir dans le retour réel</span>
                        </td>
                        <td className="p-3">
                          <span className="text-slate-500">État enregistré dans le retour réel</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "casse" && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-rose-900 text-base">Casse & Pertes constatées</h4>
                    <p className="mt-1 text-xs text-rose-800">
                      Règlement et facturation des articles dégradés ou non restitués selon la grille officielle.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          title: "Facture casse & dégradation Titan",
                          templateKey: "titan.breakage_repair_invoice.v1",
                          type: "facture_casse",
                        })
                      }
                      className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-file-invoice text-rose-600"></i>
                      <span>Aperçu Facture casse</span>
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800 transition cursor-pointer shadow-xs"
                      onClick={() => onNavigate("breakage-loss", `titan:${draft.id}`)}
                    >
                      <i className="fas fa-arrow-up-right-from-square mr-1.5" />
                      Ouvrir le règlement casse
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "caution" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-blue-900 text-base">Caution & Solde de fin de location</h4>
                    <p className="mt-1 text-xs text-blue-800">
                      Suivi du dépôt de garantie, déduction des éventuelles dégradations et restitution du solde.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          title: "Récépissé de remboursement de caution",
                          templateKey: "shared.payment_refund_receipt.v1",
                          type: "recu_remboursement",
                        })
                      }
                      className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-file-invoice text-blue-600"></i>
                      <span>Aperçu Récépissé remboursement</span>
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 transition cursor-pointer shadow-xs"
                      onClick={() => onNavigate("caution", `titan:${draft.id}`)}
                    >
                      <i className="fas fa-arrow-up-right-from-square mr-1.5" />
                      Ouvrir la caution réelle
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "avenants" && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-indigo-950 text-base">Avenants au contrat de location</h4>
                    <p className="mt-1 text-xs text-indigo-800">
                      Modifications contractuelles des articles, des dates ou des conditions de location.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewModal({
                          title: "Avenant au contrat de location Titan",
                          templateKey: "titan.material_amendment.v1",
                          type: "avenant",
                        })
                      }
                      className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <i className="fa-solid fa-file-lines text-indigo-600"></i>
                      <span>Aperçu Avenant</span>
                    </button>
                    <button
                      type="button"
                      onClick={openAmendmentWizard}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-plus"></i>
                      Nouvel avenant Titan
                    </button>
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
                type="button"
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
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                type="button"
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
                className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition-colors bg-slate-50 text-left"
                type="button"
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
      {showAmendmentForm && domain === "Titan" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowAmendmentForm(false)}
        >
          <form
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleCreateTitanAmendment}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Titan Rental</p>
                <h3 className="text-xl font-bold text-slate-800">Nouvel avenant Titan</h3>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setShowAmendmentForm(false)}
                aria-label="Fermer"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="flex items-center gap-2 mb-6" aria-label="Étapes de l’avenant">
              {amendmentStepTitles.map((title, index) => {
                const stepNumber = index + 1;
                const active = amendmentStep === stepNumber;
                const complete = amendmentStep > stepNumber;
                return (
                  <React.Fragment key={title}>
                    <button
                      type="button"
                      onClick={() => stepNumber <= amendmentStep && setAmendmentStep(stepNumber)}
                      className={`flex items-center gap-2 text-xs font-semibold ${active ? "text-indigo-700" : complete ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-indigo-600 text-white" : complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {complete ? <i className="fa-solid fa-check" aria-hidden="true"></i> : stepNumber}
                      </span>
                      <span className="hidden sm:inline">{title}</span>
                    </button>
                    {stepNumber < amendmentStepTitles.length && <div className={`h-px flex-1 ${amendmentStep > stepNumber ? "bg-emerald-300" : "bg-slate-200"}`}></div>}
                  </React.Fragment>
                );
              })}
            </div>

            {amendmentStep === 1 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Pourquoi modifier le contrat ?</h4>
                  <p className="mt-1 text-sm text-slate-500">Décrivez la demande du client avant de choisir les éléments à modifier.</p>
                </div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="amendment-reason">
                  Motif de l’avenant <span className="text-rose-600">*</span>
                  <input
                    id="amendment-reason"
                    required
                    value={amendmentReason}
                    onChange={(event) => setAmendmentReason(event.target.value)}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                    placeholder="Ex. modification des articles loués"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700" htmlFor="amendment-notes">
                  Détails complémentaires
                  <textarea
                    id="amendment-notes"
                    value={amendmentNotes}
                    onChange={(event) => setAmendmentNotes(event.target.value)}
                    className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm min-h-24"
                    placeholder="Précisions à faire apparaître dans l’avenant"
                  />
                </label>
              </div>
            )}

            {amendmentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Modifier la période de location</h4>
                  <p className="mt-1 text-sm text-slate-500">Les dates et heures seront contrôlées par le backend avant application.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="amendment-start-at">
                    Nouvelle date et heure de début
                    <input
                      id="amendment-start-at"
                      type="datetime-local"
                      value={amendmentStartAt}
                      onChange={(event) => setAmendmentStartAt(event.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="amendment-end-at">
                    Nouvelle date et heure de fin
                    <input
                      id="amendment-end-at"
                      type="datetime-local"
                      value={amendmentEndAt}
                      onChange={(event) => setAmendmentEndAt(event.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                    />
                  </label>
                </div>
              </div>
            )}

            {amendmentStep === 3 && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Modifier les articles loués</h4>
                  <p className="mt-1 text-sm text-slate-500">Ajustez les quantités. La disponibilité sera revalidée lors de l’enregistrement.</p>
                </div>
                {draft?.lines && draft.lines.length > 0 ? (
                  <div className="space-y-2 border border-slate-200 rounded-xl p-4">
                    {draft.lines.map((line) => (
                      <label key={line.id} className="flex items-center justify-between gap-3 rounded-lg border-b border-slate-100 py-3 text-sm text-slate-600 last:border-0">
                        <span>{line.inventory_item_name}<small className="ml-2 text-slate-400">(actuel : {line.quantity})</small></span>
                        <input
                          aria-label={`Quantité ${line.inventory_item_name}`}
                          type="number"
                          min="1"
                          value={amendmentQuantities[line.id] ?? line.quantity}
                          onChange={(event) => setAmendmentQuantities((current) => ({
                            ...current,
                            [line.id]: Math.max(1, Number(event.target.value) || 1),
                          }))}
                          className="w-24 border border-slate-300 rounded-lg p-2 text-center"
                        />
                      </label>
                    ))}
                  </div>
                ) : <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Aucun article actif dans cette réservation.</p>}
              </div>
            )}

            {amendmentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-800">Vérifier l’avenant</h4>
                  <p className="mt-1 text-sm text-slate-500">Vérifiez les changements avant de générer le document.</p>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
                  <div><dt className="font-semibold text-slate-500">Motif</dt><dd className="text-slate-800">{amendmentReason || "Non renseigné"}</dd></div>
                  <div><dt className="font-semibold text-slate-500">Période</dt><dd className="text-slate-800">{amendmentStartAt || "Date initiale"} → {amendmentEndAt || "Date initiale"}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Articles</dt><dd className="text-slate-800">{draft?.lines?.length ?? 0} ligne(s), quantités vérifiées</dd></div>
                  {amendmentNotes && <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">Détails</dt><dd className="whitespace-pre-wrap text-slate-800">{amendmentNotes}</dd></div>}
                </dl>
              </div>
            )}

            <div className="flex justify-between gap-3 mt-7 pt-5 border-t border-slate-200">
              <button
                type="button"
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
                onClick={() => setShowAmendmentForm(false)}
              >
                Annuler
              </button>
              <div className="flex gap-3">
                {amendmentStep > 1 && (
                  <button type="button" className="px-4 py-2 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100" onClick={() => setAmendmentStep((current) => current - 1)}>
                    <i className="fa-solid fa-arrow-left mr-2" aria-hidden="true"></i>Retour
                  </button>
                )}
                {amendmentStep < 4 ? (
                  <button type="button" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60" onClick={goToNextAmendmentStep} disabled={amendmentStep === 1 && !amendmentReason.trim()}>
                    Continuer<i className="fa-solid fa-arrow-right ml-2" aria-hidden="true"></i>
                  </button>
                ) : (
                  <button type="submit" disabled={actionLoading === "amendment"} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                    {actionLoading === "amendment" ? "Génération…" : "Générer l’avenant"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Document Preview Modal (Artifact or Live Authentic Draft Preview) ── */}
      {(previewModal || previewDoc) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 shrink-0">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-file-lines text-indigo-600"></i>
                <span>
                  {previewModal?.title ||
                    (previewDoc === "proforma"
                      ? "Devis / Facture Proforma"
                      : previewDoc === "contrat"
                        ? "Contrat de location Titan"
                        : previewDoc === "facture"
                          ? "Facture définitive"
                          : previewDoc === "fiche_preparation"
                            ? "Bon de préparation matériel"
                            : previewDoc === "bon_livraison"
                              ? "Bon de livraison / Sortie"
                              : previewDoc === "bon_retour"
                                ? "Bon de retour / Restitution"
                                : previewDoc === "facture_casse"
                                  ? "Facture de casse et dégradation"
                                  : previewDoc === "recu_remboursement"
                                    ? "Récépissé de remboursement de caution"
                                    : previewDoc === "avenant"
                                      ? "Avenant au contrat de location"
                                      : previewDoc === "recu_paiement"
                                        ? "Reçu de versement"
                                        : "Aperçu du document")}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const modal = document.querySelector(".fixed.inset-0.z-50");
                    const iframe = modal?.querySelector("iframe");
                    if (iframe?.srcdoc) {
                      printDocumentHtml(iframe.srcdoc);
                    } else if (iframe?.contentWindow) {
                      iframe.contentWindow.focus();
                      iframe.contentWindow.print();
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                >
                  <i className="fa-solid fa-print"></i> Imprimer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewModal(null);
                    setPreviewDoc(null);
                  }}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Fermer"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-100/50">
              {previewModal?.documentInstanceId ? (
                <DocumentArtifactPreviewPanel documentInstanceId={previewModal.documentInstanceId} />
              ) : previewArtifact ? (
                <DocumentArtifactPreviewPanel documentInstanceId={previewArtifact.id} />
              ) : (
                <DocumentPreview
                  domain="titan"
                  reservationDraftId={draft.id}
                  template={{ templateKey: previewModal?.templateKey }}
                  type={previewModal?.type || (previewDoc === "contrat" ? "contrat" : previewDoc || undefined)}
                />
              )}
            </div>
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
