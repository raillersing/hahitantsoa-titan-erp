import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  confirmHahitantsoaEventDraft,
  closeHahitantsoaEventDraft,
  createHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstancePdf,
  getHahitantsoaEventDraft,
  getHahitantsoaEventDraftConfirmationPreflight,
  getHahitantsoaEventDraftCloseoutSummary,
  getHahitantsoaEventDraftLifecycle,
  getHahitantsoaEventDraftDocumentInstances,
  getHahitantsoaEventDraftPayments,
  getHahitantsoaEventDraftAmendmentRequests,
  createHahitantsoaEventDraftAmendmentRequest,
  createHahitantsoaEventDraftAmendmentRequestLine,
  getCustomer,
  markHahitantsoaEventDraftContractSigned,
  markHahitantsoaEventDraftRequiredDepositReceived,
  recordConfirmedDeposit,
} from "../api";
import DocumentArtifactPreviewPanel from "../DocumentArtifactPreviewPanel";
import { DocumentPreview } from "./DocumentPreview";
import { printDocumentHtml } from "./DocumentCanvasViewer";
import PaymentWhatsAppReminderButton from "../PaymentWhatsAppReminderButton";
import LifecycleTimeline from "./LifecycleTimeline";
import type {
  Customer,
  DocumentInstance,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftConfirmationPreflight,
  HahitantsoaEventCloseoutSummary,
  HahitantsoaEventDraftAmendmentRequest,
  LifecycleSummary,
  Payment,
  PaymentMethod,
} from "../types";

type Props = {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
  onBack?: () => void;
};

export type HahitantsoaActiveTab =
  | "contrat"
  | "prep"
  | "sortie"
  | "retour"
  | "casse"
  | "caution"
  | "avenants";

type PreviewModalState = {
  title: string;
  documentInstanceId?: string | null;
  templateKey?: string;
  type?: string;
} | null;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatMoney(value: number | string | undefined | null, fallback = "0 Ar"): string {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "string" ? parseFloat(value.replace(/\s/g, "").replace(/,/g, ".")) : Number(value);
  if (Number.isNaN(num)) return fallback;
  return `${num.toLocaleString("fr-FR")} Ar`;
}

function formatDateFr(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTimeFr(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function eventTypeLabel(type?: string): string {
  switch (type) {
    case "wedding": return "Mariage";
    case "engagement": return "Fiançailles / Vodiadidy";
    case "civil_wedding": return "Mariage civil";
    case "other": return "Autre événement";
    default: return type ? type : "Événement";
  }
}

function rentalTypeLabel(type?: string): string {
  switch (type) {
    case "bare": return "Location nue";
    case "logistics": return "Avec logistique / installation";
    default: return type ? type : "Standard";
  }
}

function itemKindBadge(kind: string) {
  switch (kind) {
    case "material_pack":
      return <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">Pack Mobilier / Déco</span>;
    case "material":
      return <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Matériel</span>;
    case "article":
      return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Article</span>;
    default:
      return <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Prestation / Service</span>;
  }
}

export default function HahitantsoaEventDraftDetailPage({ onNavigate, param, onBack }: Props) {
  const [draft, setDraft] = useState<HahitantsoaEventDraft | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [preflight, setPreflight] = useState<HahitantsoaEventDraftConfirmationPreflight | null>(null);
  const [documents, setDocuments] = useState<DocumentInstance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [amendments, setAmendments] = useState<HahitantsoaEventDraftAmendmentRequest[]>([]);
  const [closeoutSummary, setCloseoutSummary] = useState<HahitantsoaEventCloseoutSummary | null>(null);
  const [lifecycleSummary, setLifecycleSummary] = useState<LifecycleSummary | null>(null);
  const [lifecycleError, setLifecycleError] = useState(false);
  const [activeTab, setActiveTab] = useState<HahitantsoaActiveTab>("contrat");
  const [previewModal, setPreviewModal] = useState<PreviewModalState>(null);

  // Form states
  const [signatureExceptionReason, setSignatureExceptionReason] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentKindSelection, setPaymentKindSelection] = useState<"deposit" | "installment_1" | "installment_2" | "caution">("deposit");
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amendmentNotes, setAmendmentNotes] = useState("");
  const [amendmentQuantities, setAmendmentQuantities] = useState<Record<string, number>>({});

  // Operational states for logistics
  const [prepCheckedItems, setPrepCheckedItems] = useState<Record<string, boolean>>({});
  const [returnCheckedItems, setReturnCheckedItems] = useState<Record<string, { returned: number; status: "conforme" | "degrade" | "manquant" }>>({});
  const [breakageDeductions, setBreakageDeductions] = useState<Record<string, { qty: number; unitCost: number; notes: string }>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const depositRecordingKeyRef = useRef<string | null>(null);
  const closeoutKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!param) {
      setError("Aucun identifiant de dossier Hahitantsoa fourni.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const eventDraft = await getHahitantsoaEventDraft(param);
      setDraft(eventDraft);

      // Load parallel details
      const [nextPreflight, nextDocuments, nextPayments] = await Promise.all([
        getHahitantsoaEventDraftConfirmationPreflight(param).catch(() => null),
        getHahitantsoaEventDraftDocumentInstances(param).catch(() => []),
        getHahitantsoaEventDraftPayments(param).catch(() => []),
      ]);

      setPreflight(nextPreflight);
      setDocuments(nextDocuments);
      setPayments(nextPayments);

      // Customer details
      if (eventDraft.customer_id) {
        try {
          const cust = await getCustomer(eventDraft.customer_id);
          setCustomer(cust);
        } catch {
          setCustomer(null);
        }
      }

      // Amendments
      try {
        const nextAmendments = await getHahitantsoaEventDraftAmendmentRequests(param);
        setAmendments(nextAmendments);
      } catch {
        setAmendments([]);
      }

      // Lifecycle
      try {
        const nextLifecycle = await getHahitantsoaEventDraftLifecycle(param);
        setLifecycleSummary(nextLifecycle);
        setLifecycleError(false);
      } catch {
        setLifecycleSummary(null);
        setLifecycleError(true);
      }

      // Closeout
      if (eventDraft.status === "confirmed") {
        try {
          const summary = await getHahitantsoaEventDraftCloseoutSummary(param);
          setCloseoutSummary(summary);
        } catch {
          setCloseoutSummary(null);
        }
      } else {
        setCloseoutSummary(null);
      }

      // Default deposit amount calculation
      setDepositAmount((current) => {
        if (current) return current;
        const requiredAmount = Number(eventDraft.required_deposit_amount || "0");
        const confirmedAmount = nextPayments
          .filter((p) => p.payment_kind === "deposit" && (p.payment_status === "confirmed" || p.payment_status === "reconciled"))
          .reduce((total, p) => total + Number(p.amount), 0);
        return Math.max(requiredAmount - confirmedAmount, 0).toFixed(2);
      });
    } catch (err) {
      setError(errorMessage(err, "Erreur lors du chargement du dossier Hahitantsoa."));
    } finally {
      setLoading(false);
    }
  }, [param]);

  useEffect(() => {
    void load();
  }, [load]);

  const recordDeposit = async () => {
    if (!param) return;
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Saisissez un montant de paiement supérieur à zéro.");
      return;
    }
    setBusy("deposit");
    setError(null);
    setActionNotice(null);
    const idempotencyKey = depositRecordingKeyRef.current ?? crypto.randomUUID();
    depositRecordingKeyRef.current = idempotencyKey;
    try {
      const result = await recordConfirmedDeposit({
        hahitantsoa_event_draft: param,
        payment_method: paymentMethod || "cash",
        amount: amount.toFixed(2),
        notes: paymentNotes || `Versement (${paymentKindSelection}) enregistré depuis le dossier Hahitantsoa.`,
        idempotency_key: idempotencyKey,
      });
      depositRecordingKeyRef.current = null;
      setDepositAmount("");
      setPaymentNotes("");
      setShowPaymentModal(false);
      setActionNotice(result.replayed ? "Le paiement déjà enregistré a été repris sans doublon." : "Paiement enregistré et confirmé avec succès.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible d'enregistrer le paiement."));
    } finally {
      setBusy(null);
    }
  };

  const markContractSigned = async () => {
    if (!param) return;
    setBusy("contract");
    setError(null);
    setActionNotice(null);
    try {
      await markHahitantsoaEventDraftContractSigned(param);
      setActionNotice("Le contrat a été marqué comme signé.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible de marquer le contrat comme signé."));
    } finally {
      setBusy(null);
    }
  };

  const markExistingDepositReceived = async () => {
    if (!param) return;
    setBusy("existing-deposit");
    setError(null);
    setActionNotice(null);
    try {
      await markHahitantsoaEventDraftRequiredDepositReceived(param);
      setActionNotice("L'acompte déjà confirmé a été rattaché au dossier.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible de rattacher l'acompte déjà confirmé."));
    } finally {
      setBusy(null);
    }
  };

  const confirmDraft = async () => {
    if (!param) return;
    setBusy("confirm");
    setError(null);
    setActionNotice(null);
    try {
      await confirmHahitantsoaEventDraft(param);
      setActionNotice("Le dossier Hahitantsoa est confirmé avec succès.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible de confirmer le dossier Hahitantsoa."));
    } finally {
      setBusy(null);
    }
  };

  const closeoutDraft = async () => {
    if (!param || closeoutSummary?.closeout_status === "closed") return;
    if (closeoutSummary?.signature_exception_required && !signatureExceptionReason.trim()) {
      setError("Indiquez le motif durable de l'exception de signature avant de clôturer.");
      return;
    }
    setBusy("closeout");
    setError(null);
    setActionNotice(null);
    const idempotencyKey = closeoutKeyRef.current ?? crypto.randomUUID();
    closeoutKeyRef.current = idempotencyKey;
    try {
      const summary = await closeHahitantsoaEventDraft(param, idempotencyKey, signatureExceptionReason.trim());
      closeoutKeyRef.current = null;
      setCloseoutSummary(summary);
      setActionNotice(summary.replayed ? "La clôture déjà enregistrée a été rechargée." : "Le dossier événement est clôturé avec succès.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Le dossier n'est pas encore prêt pour la clôture."));
    } finally {
      setBusy(null);
    }
  };

  const generateDocument = async (templateKey: string, label: string) => {
    if (!param) return;
    setBusy(`generate-${templateKey}`);
    setError(null);
    setActionNotice(null);
    try {
      const doc = await createHahitantsoaEventDraftDocumentInstance(param, { template_key: templateKey });
      await generateHahitantsoaEventDraftDocumentInstance(param, doc.id);
      await generateHahitantsoaEventDraftDocumentInstancePdf(param, doc.id);
      setActionNotice(`${label} généré avec succès.`);
      await load();
      setPreviewModal({
        title: label,
        documentInstanceId: doc.id,
        templateKey,
      });
    } catch (err) {
      setError(errorMessage(err, `Impossible de générer ${label}.`));
    } finally {
      setBusy(null);
    }
  };

  const submitAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!param || !draft) return;
    if (!amendmentReason.trim()) {
      setError("Le motif de l'avenant est obligatoire.");
      return;
    }
    setBusy("amendment");
    setError(null);
    setActionNotice(null);
    try {
      const res = await createHahitantsoaEventDraftAmendmentRequest(param, {
        reason: amendmentReason.trim(),
        notes: amendmentNotes.trim(),
      });

      const amendmentId = res.amendment_request.id;
      for (const line of draft.lines) {
        const qty = amendmentQuantities[line.id];
        if (qty !== undefined && qty !== line.quantity) {
          await createHahitantsoaEventDraftAmendmentRequestLine(param, amendmentId, {
            inventory_item_id: line.inventory_item_id,
            quantity: qty,
            notes: line.notes,
          });
        }
      }

      setShowAmendmentModal(false);
      setAmendmentReason("");
      setAmendmentNotes("");
      setActionNotice("La demande d'avenant a été enregistrée avec succès.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible de créer la demande d'avenant."));
    } finally {
      setBusy(null);
    }
  };

  // Financial calculations
  const confirmedDepositAmount = useMemo(() => {
    return payments
      .filter((p) => p.payment_kind === "deposit" && (p.payment_status === "confirmed" || p.payment_status === "reconciled"))
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const totalPaidAmount = useMemo(() => {
    return payments
      .filter((p) => p.payment_status === "confirmed" || p.payment_status === "reconciled")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const requiredDepositAmount = Number(draft?.required_deposit_amount || "0");
  const remainingDepositAmount = Math.max(requiredDepositAmount - confirmedDepositAmount, 0);
  const totalDossierAmount = draft?.payment_schedule ? Number(draft.payment_schedule.total_amount) : 0;
  const remainingTotalAmount = Math.max(totalDossierAmount - totalPaidAmount, 0);

  // Caution calculation: 1 000 000 Ar standard
  const standardCautionAmount = 1000000;
  const totalDamageCost = useMemo(() => {
    return Object.values(breakageDeductions).reduce((sum, item) => sum + item.qty * item.unitCost, 0);
  }, [breakageDeductions]);
  const refundableCautionBalance = Math.max(standardCautionAmount - totalDamageCost, 0);

  // Document maps
  const docMap = useMemo(() => {
    const map = new Map<string, DocumentInstance>();
    for (const doc of documents) {
      map.set(doc.template_key, doc);
    }
    return map;
  }, [documents]);

  const contractDoc = docMap.get("hahitantsoa.contract.v1");
  const proformaDoc = docMap.get("hahitantsoa.proforma.v1");
  const dischargeDoc = docMap.get("hahitantsoa.liability_release.v1");
  const prepSheetDoc = docMap.get("hahitantsoa.preparation_sheet.v1");
  const internalPrepDoc = docMap.get("shared.preparation_sheet.v1");
  const deliveryNoteDoc = docMap.get("hahitantsoa.delivery_note.v1");
  const returnNoteDoc = docMap.get("shared.return_note.v1");
  const breakageDoc = docMap.get("hahitantsoa.breakage_repair_invoice.v1");
  const refundReceiptDoc = docMap.get("shared.payment_refund_receipt.v1");
  const amendmentDoc = docMap.get("hahitantsoa.contract_amendment.v1");
  const invoiceDoc = docMap.get("hahitantsoa.invoice.v1");

  const contractExists = Boolean(contractDoc && (contractDoc.status === "generated" || contractDoc.status === "issued"));
  const contractSigned = preflight?.prerequisite_status.contract.truth_present ?? false;
  const depositConfirmed = preflight?.prerequisite_status.deposit.truth_present ?? false;
  const availabilityValidated = preflight?.unavailable_line_count === 0;
  const canRecordDeposit = !depositConfirmed && (confirmedDepositAmount === 0 || confirmedDepositAmount < requiredDepositAmount);
  const canMarkExistingDeposit = !depositConfirmed && confirmedDepositAmount > 0 && confirmedDepositAmount >= requiredDepositAmount;

  if (loading) return <div role="status" className="page active p-8 text-slate-500">Chargement du dossier événement Hahitantsoa…</div>;

  if (!draft) {
    return (
      <div className="page active mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">Dossier introuvable</h1>
          <p className="mt-2 text-rose-600">{error || "Le dossier Hahitantsoa n'est pas accessible."}</p>
          <button className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700" onClick={() => (onBack ? onBack() : onNavigate("hahitantsoa"))}>
            ← Retour aux dossiers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page active mx-auto max-w-6xl space-y-6 pb-16">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <button className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors" onClick={() => (onBack ? onBack() : onNavigate("hahitantsoa"))}>
            <i className="fa-solid fa-arrow-left"></i> Retour aux dossiers Hahitantsoa
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900">{draft.public_reference}</h1>
            <span className="text-lg font-medium text-slate-400">·</span>
            <span className="text-lg font-bold text-slate-700">{draft.event_name}</span>
            {draft.status === "confirmed" ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                <i className="fa-solid fa-circle-check mr-1 text-emerald-600"></i> Confirmée
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                <i className="fa-solid fa-clock mr-1 text-amber-600"></i> En attente / Brouillon
              </span>
            )}
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              {eventTypeLabel(draft.event_type)}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {rentalTypeLabel(draft.rental_type)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <i className="fa-solid fa-calendar-days mr-1.5 text-slate-400"></i>
            Du {formatDateTimeFr(draft.start_at)} au {formatDateTimeFr(draft.end_at)}
            {draft.venue_name && <span className="ml-3"><i className="fa-solid fa-location-dot mr-1.5 text-rose-500"></i>{draft.venue_name}</span>}
          </p>
        </div>

        {/* Action button bar */}
        <div className="flex flex-wrap items-center gap-2">
          {draft.status === "draft" && !contractExists && (
            <button
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm"
              disabled={busy !== null}
              onClick={() => void generateDocument("hahitantsoa.contract.v1", "Contrat officiel")}
            >
              <i className="fa-solid fa-file-contract"></i> Générer le contrat officiel
            </button>
          )}

          {draft.status === "draft" && contractExists && !contractSigned && (
            <button
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition-all text-sm"
              disabled={busy !== null}
              onClick={() => void markContractSigned()}
            >
              <i className="fa-solid fa-signature"></i> Marquer le contrat signé
            </button>
          )}

          {draft.status === "draft" && canMarkExistingDeposit && (
            <button
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all text-sm"
              disabled={busy !== null}
              onClick={() => void markExistingDepositReceived()}
            >
              <i className="fa-solid fa-receipt"></i> Valider l'acompte déjà confirmé
            </button>
          )}

          {draft.status === "draft" && preflight?.can_confirm && (
            <button
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all text-sm"
              disabled={busy !== null}
              onClick={() => void confirmDraft()}
            >
              <i className="fa-solid fa-check-double"></i> Confirmer la réservation
            </button>
          )}

          {draft.status === "confirmed" && (
            <button
              type="button"
              onClick={() => setShowAmendmentModal(true)}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 text-sm transition-all"
            >
              <i className="fa-solid fa-pen-to-square"></i> Demander un avenant
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 font-semibold text-white shadow-sm hover:bg-slate-800 text-sm transition-all"
          >
            <i className="fa-solid fa-plus"></i> Enregistrer versement
          </button>

          <PaymentWhatsAppReminderButton draftId={param || draft.id} businessScope="hahitantsoa" />
        </div>
      </div>

      {/* ── Alerts & Notices ──────────────────────────────────────────────── */}
      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center gap-3"><i className="fa-solid fa-triangle-exclamation text-lg"></i><span>{error}</span></div>}
      {actionNotice && <div aria-live="polite" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-3"><i className="fa-solid fa-circle-check text-lg"></i><span>{actionNotice}</span></div>}

      {/* ── Lifecycle Timeline ────────────────────────────────────────────── */}
      {lifecycleSummary && <LifecycleTimeline summary={lifecycleSummary} />}
      {lifecycleError && !lifecycleSummary && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Parcours opérationnel indisponible. Actualisez le dossier après avoir vérifié votre accès.
        </div>
      )}

      {/* ── Section 1 : Fiche Client & Synthèse Financière Harmonisée ──────── */}
      <div className="grid gap-6 md:grid-cols-12">
        {/* Customer Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-user text-indigo-600"></i> Fiche Client
              </h2>
              {draft.customer_id && (
                <button
                  type="button"
                  onClick={() => onNavigate("customer", draft.customer_id)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Voir fiche <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </button>
              )}
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-bold text-slate-900 text-base">{draft.customer_display_name}</p>
                {customer?.representative_name && <p className="text-xs font-semibold text-slate-500 uppercase">{customer.representative_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div>
                  <span className="font-semibold text-slate-400 block">Téléphone :</span>
                  {customer?.phone || "—"}
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block">Email :</span>
                  {customer?.email || "—"}
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block">Adresse :</span>
                  {customer?.address || "—"}
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block">Invités prévus :</span>
                  {draft.guest_count ? `${draft.guest_count} personnes` : "Non spécifié"}
                </div>
              </div>
              {draft.notes && (
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 mt-2 border border-slate-100">
                  <span className="font-bold text-slate-700 block mb-0.5">Notes dossier :</span>
                  {draft.notes}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Créé le {formatDateFr(draft.created_at)}</span>
            <span>Réf client : {draft.customer_id?.slice(0, 8)}</span>
          </div>
        </div>

        {/* Financial & Multi-installment Card */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-white p-6 shadow-sm md:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-indigo-100/60 pb-3 mb-4">
              <h2 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                <i className="fa-solid fa-coins text-amber-500"></i> Synthèse Financière & Échéancier
              </h2>
              <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Échéancier 3 Tranches + Caution
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5 mb-4">
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Dossier</span>
                <span className="text-sm font-black text-slate-900">{formatMoney(totalDossierAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Acompte Requis</span>
                <span className="text-sm font-black text-amber-600">{formatMoney(requiredDepositAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Perçu</span>
                <span className="text-sm font-black text-emerald-600">{formatMoney(totalPaidAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Reste à Régler</span>
                <span className={`text-sm font-black ${remainingTotalAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {formatMoney(remainingTotalAmount)}
                </span>
              </div>
            </div>

            {/* 3-tier multi-installment schedule boxes with progress bars */}
            {draft.payment_schedule && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Deposit */}
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700">1. Acompte Signature</span>
                      {confirmedDepositAmount >= Number(draft.payment_schedule.deposit_amount) ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Réglé</span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">En cours</span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(draft.payment_schedule.deposit_amount)}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">À la réservation</span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((confirmedDepositAmount / (Number(draft.payment_schedule.deposit_amount) || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Payé : {formatMoney(confirmedDepositAmount)}</span>
                  </div>
                </div>

                {/* 2. 1st Installment */}
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-indigo-700 block">2. 1ère Tranche (M-1)</span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(draft.payment_schedule.first_installment_amount)}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Échéance : {formatDateFr(draft.payment_schedule.first_installment_due_on)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((Math.max(totalPaidAmount - confirmedDepositAmount, 0) / (Number(draft.payment_schedule.first_installment_amount) || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Payé : {formatMoney(Math.min(Math.max(totalPaidAmount - confirmedDepositAmount, 0), Number(draft.payment_schedule.first_installment_amount)))}</span>
                  </div>
                </div>

                {/* 3. 2nd Installment */}
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-indigo-700 block">3. Solde (J-10)</span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(draft.payment_schedule.second_installment_amount)}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Échéance : {formatDateFr(draft.payment_schedule.second_installment_due_on)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((Math.max(totalPaidAmount - confirmedDepositAmount - Number(draft.payment_schedule.first_installment_amount), 0) / (Number(draft.payment_schedule.second_installment_amount) || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Payé : {formatMoney(Math.max(totalPaidAmount - confirmedDepositAmount - Number(draft.payment_schedule.first_installment_amount), 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Inline quick deposit recording for unconfirmed draft */}
          {draft.status === "draft" && canRecordDeposit && (
            <div className="mt-4 pt-3 border-t border-indigo-100/60 flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-700 flex-1 min-w-[160px]">
                Montant de l'acompte (Ar)
                <input
                  aria-describedby="deposit-help"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold text-slate-900"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Montant"
                />
              </label>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                disabled={busy !== null}
                onClick={() => void recordDeposit()}
              >
                {busy === "deposit" ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : <i className="fa-solid fa-check mr-1"></i>}
                Enregistrer et confirmer l'acompte
              </button>
              <span id="deposit-help" className="w-full text-[11px] text-slate-500">
                Montant restant requis : {formatMoney(remainingDepositAmount)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2 : Tableau Détaillé des Articles & Lignes Événement ────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-boxes-stacked text-indigo-600"></i> Matériel, Mobilier & Prestations de l'Événement
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lieu de réception : <span className="font-semibold text-slate-700">{draft.venue_name || "Non spécifié"}</span>
              {draft.space_rental_amount && <span> · Forfait salle : <strong className="text-slate-900">{formatMoney(draft.space_rental_amount)}</strong></span>}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
            {draft.lines.length} ligne(s) d'articles
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Désignation / Article</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4 text-center">Quantité</th>
                <th className="py-3 px-4">Notes d'installation / Emplacement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Highlight venue line if present */}
              {draft.venue_name && (
                <tr key="venue-line" className="bg-indigo-50/30">
                  <td className="py-3 px-4 font-bold text-indigo-950 flex items-center gap-2">
                    <i className="fa-solid fa-landmark text-indigo-600"></i>
                    <span>Location Salle / Espace : {draft.venue_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">Salle de réception</span>
                  </td>
                  <td className="py-3 px-4 text-center font-bold">1 événement</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{draft.location_details || "Mise à disposition complète de l'espace"}</td>
                </tr>
              )}

              {draft.lines.length === 0 ? (
                <tr key="empty-lines">
                  <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                    Aucune ligne d'article ou de mobilier associée à ce dossier.
                  </td>
                </tr>
              ) : (
                draft.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {line.inventory_item_name}
                    </td>
                    <td className="py-3 px-4">
                      {itemKindBadge(line.inventory_item_kind)}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">
                      {line.quantity}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {line.notes || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {draft.service_notes && (
          <div className="mt-4 rounded-xl bg-amber-50/60 border border-amber-200/60 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <i className="fa-solid fa-bell-concierge text-amber-600 text-sm mt-0.5"></i>
            <div>
              <span className="font-bold block">Prestations de services & traiteur associées</span>
              <p className="mt-0.5">{draft.service_notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3 : Onglets Opérationnels Hahitantsoa (Documents, Préparation, Sortie, Retour, Casse, Caution, Avenants) ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 overflow-x-auto">
          {[
            { id: "contrat", label: "Documents & Devis", icon: "fa-file-signature" },
            { id: "prep", label: "Préparation", icon: "fa-clipboard-check" },
            { id: "sortie", label: "Sortie / Livraison", icon: "fa-truck-fast" },
            { id: "retour", label: "Retour / Restitution", icon: "fa-rotate-left" },
            { id: "casse", label: "Casse & Pertes", icon: "fa-heart-crack" },
            { id: "caution", label: "Caution & Solde", icon: "fa-money-bill-transfer" },
            { id: "avenants", label: "Avenants", icon: "fa-pen-ruler" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-indigo-600 bg-white text-indigo-700 shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
              }`}
            >
              <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? "text-indigo-600" : "text-slate-400"}`}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── 1. Onglet Documents & Devis ───────────────────────────────── */}
          {activeTab === "contrat" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Documents & Pièces contractuelles</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Centralisation des pièces administratives, devis, bons et reçus</p>
                </div>
                <span className="text-xs font-bold text-slate-600">{documents.length} document(s) enregistré(s)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Proforma */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-base">
                        <i className="fa-solid fa-file-invoice"></i>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                        {proformaDoc ? proformaDoc.status : "Brouillon"}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Proforma / Devis</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {proformaDoc ? `Émis le ${formatDateFr(proformaDoc.prepared_at || proformaDoc.created_at)}` : "Disponible à l'aperçu"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({
                        title: "Proforma / Devis Hahitantsoa",
                        documentInstanceId: proformaDoc?.id,
                        templateKey: "hahitantsoa.proforma.v1",
                        type: "proforma",
                      })}
                      className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-eye text-indigo-600"></i> Aperçu
                    </button>
                  </div>
                </div>

                {/* Contrat */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-file-contract"></i>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${contractSigned ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {contractSigned ? "Signé" : contractDoc ? "Généré" : "Non généré"}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Contrat Officiel</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {contractDoc ? `Généré le ${formatDateFr(contractDoc.prepared_at || contractDoc.created_at)}` : "Disponible à l'aperçu"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({
                        title: "Contrat Officiel Hahitantsoa",
                        documentInstanceId: contractDoc?.id,
                        templateKey: "hahitantsoa.contract.v1",
                        type: "contrat",
                      })}
                      className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-eye text-amber-600"></i> Aperçu
                    </button>
                    {!contractDoc && (
                      <button
                        type="button"
                        onClick={() => void generateDocument("hahitantsoa.contract.v1", "Contrat officiel")}
                        disabled={busy !== null}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Générer
                      </button>
                    )}
                  </div>
                </div>

                {/* Décharge de responsabilité */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-shield-halved"></i>
                      </div>
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                        {dischargeDoc ? dischargeDoc.status : "Modèle officiel"}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Décharge de Responsabilité</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {dischargeDoc ? `Généré le ${formatDateFr(dischargeDoc.prepared_at || dischargeDoc.created_at)}` : "Disponible à l'aperçu"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({
                        title: "Décharge de Responsabilité",
                        documentInstanceId: dischargeDoc?.id,
                        templateKey: "hahitantsoa.liability_release.v1",
                        type: "decharge",
                      })}
                      className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-eye text-teal-600"></i> Aperçu
                    </button>
                    {!dischargeDoc && (
                      <button
                        type="button"
                        onClick={() => void generateDocument("hahitantsoa.liability_release.v1", "Décharge de responsabilité")}
                        disabled={busy !== null}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        Générer
                      </button>
                    )}
                  </div>
                </div>

                {/* Facture finale */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-file-invoice-dollar"></i>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                        {invoiceDoc ? invoiceDoc.status : "Facture"}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Facture Officielle</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {invoiceDoc ? `Émise le ${formatDateFr(invoiceDoc.prepared_at || invoiceDoc.created_at)}` : "Disponible à l'aperçu"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({
                        title: "Facture Officielle Hahitantsoa",
                        documentInstanceId: invoiceDoc?.id,
                        templateKey: "hahitantsoa.invoice.v1",
                        type: "facture",
                      })}
                      className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-eye text-blue-600"></i> Aperçu
                    </button>
                  </div>
                </div>

                {/* Bon de préparation interne */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-boxes-packing"></i>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                        {internalPrepDoc ? "Généré" : "Magasin"}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Bon de Préparation Interne</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {internalPrepDoc ? `Généré le ${formatDateFr(internalPrepDoc.prepared_at || internalPrepDoc.created_at)}` : "Rassemblement magasinier"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({
                        title: "Bon de Préparation Interne (Logistique & Magasin)",
                        documentInstanceId: internalPrepDoc?.id,
                        templateKey: "shared.preparation_sheet.v1",
                        type: "bon_preparation",
                      })}
                      className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-eye text-indigo-600"></i> Aperçu
                    </button>
                    {!internalPrepDoc && (
                      <button
                        type="button"
                        onClick={() => void generateDocument("shared.preparation_sheet.v1", "Bon de préparation interne")}
                        disabled={busy !== null}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Générer
                      </button>
                    )}
                  </div>
                </div>

                {/* Checking de passation */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-clipboard-check"></i>
                      </div>
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                        {prepSheetDoc ? "Généré" : "Passation"}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Checking de Passation</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {prepSheetDoc ? `Généré le ${formatDateFr(prepSheetDoc.prepared_at || prepSheetDoc.created_at)}` : "Pointage & passation sur site"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({
                        title: "Checking de Passation Hahitantsoa",
                        documentInstanceId: prepSheetDoc?.id,
                        templateKey: "hahitantsoa.preparation_sheet.v1",
                        type: "fiche_preparation",
                      })}
                      className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-eye text-purple-600"></i> Aperçu
                    </button>
                    {!prepSheetDoc && (
                      <button
                        type="button"
                        onClick={() => void generateDocument("hahitantsoa.preparation_sheet.v1", "Checking de passation")}
                        disabled={busy !== null}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        Générer
                      </button>
                    )}
                  </div>
                </div>

                {/* Bon de livraison */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-truck"></i>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        {deliveryNoteDoc ? deliveryNoteDoc.status : "Livraison"}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Bon de Livraison / Sortie</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {deliveryNoteDoc ? `Généré le ${formatDateFr(deliveryNoteDoc.prepared_at || deliveryNoteDoc.created_at)}` : "Mise à disposition"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({
                        title: "Bon de Livraison Hahitantsoa",
                        documentInstanceId: deliveryNoteDoc?.id,
                        templateKey: "hahitantsoa.delivery_note.v1",
                        type: "bon_livraison",
                      })}
                      className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                    >
                      <i className="fa-solid fa-eye text-emerald-600"></i> Aperçu
                    </button>
                    {!deliveryNoteDoc && (
                      <button
                        type="button"
                        onClick={() => void generateDocument("hahitantsoa.delivery_note.v1", "Bon de livraison")}
                        disabled={busy !== null}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Générer
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Historique des versements avec bouton reçu de paiement officiel */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <i className="fa-solid fa-receipt text-indigo-600"></i> Reçus et Justificatifs des Paiements Encaissés
                  </h4>
                  <span className="text-xs font-bold text-slate-700">{payments.length} règlement(s)</span>
                </div>

                {payments.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-4">Aucun versement enregistré pour ce dossier.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Mode</th>
                          <th className="py-2.5 px-3 text-right">Montant</th>
                          <th className="py-2.5 px-3">Statut</th>
                          <th className="py-2.5 px-3 text-center">Reçu Officiel</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((p, idx) => (
                          <tr key={p.id || `payment-${idx}`} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-3 font-semibold">{formatDateFr(p.paid_at || p.created_at)}</td>
                            <td className="py-2.5 px-3 capitalize">{p.payment_kind || "Acompte"}</td>
                            <td className="py-2.5 px-3 capitalize">{p.payment_method || "Espèces"}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatMoney(p.amount)}</td>
                            <td className="py-2.5 px-3">
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                {p.payment_status || "Confirmé"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setPreviewModal({
                                  title: `Reçu de paiement (${formatMoney(p.amount)})`,
                                  documentInstanceId: p.receipt_document?.id,
                                  templateKey: "hahitantsoa.payment_receipt.v1",
                                  type: "recu_paiement",
                                })}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 font-bold text-indigo-700 hover:bg-indigo-100 transition-colors text-[11px]"
                              >
                                <i className="fa-solid fa-receipt text-indigo-600"></i> Reçu
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 2. Onglet Préparation ─────────────────────────────────────── */}
          {activeTab === "prep" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <i className="fa-solid fa-box-open text-indigo-600"></i> Préparation Logistique & Pointage Matériel
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fiche de préparation pour les magasiniers et le personnel avant l'événement ou le départ
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Bon de préparation interne */}
                  <button
                    type="button"
                    onClick={() => setPreviewModal({
                      title: "Bon de Préparation Interne (Logistique & Magasin)",
                      documentInstanceId: internalPrepDoc?.id,
                      templateKey: "shared.preparation_sheet.v1",
                      type: "bon_preparation",
                    })}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 font-bold text-indigo-700 hover:bg-indigo-50 text-xs shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-boxes-packing text-indigo-600"></i> Aperçu Bon Préparation
                  </button>
                  {!internalPrepDoc && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void generateDocument("shared.preparation_sheet.v1", "Bon de préparation interne")}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 text-xs shadow-sm transition-colors"
                    >
                      <i className="fa-solid fa-plus"></i> Générer Bon Interne
                    </button>
                  )}

                  {/* Checking de passation */}
                  <button
                    type="button"
                    onClick={() => setPreviewModal({
                      title: "Checking de Passation Hahitantsoa",
                      documentInstanceId: prepSheetDoc?.id,
                      templateKey: "hahitantsoa.preparation_sheet.v1",
                      type: "fiche_preparation",
                    })}
                    className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 py-2 font-bold text-purple-700 hover:bg-purple-50 text-xs shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-clipboard-check text-purple-600"></i> Aperçu Checking Passation
                  </button>
                  {!prepSheetDoc && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void generateDocument("hahitantsoa.preparation_sheet.v1", "Checking de passation")}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 font-bold text-white hover:bg-purple-700 disabled:opacity-50 text-xs shadow-sm transition-colors"
                    >
                      <i className="fa-solid fa-plus"></i> Générer Passation
                    </button>
                  )}
                </div>
              </div>

              {/* Checklist table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center">Vérifié</th>
                      <th className="py-3 px-4">Article / Matériel</th>
                      <th className="py-3 px-4">Catégorie</th>
                      <th className="py-3 px-4 text-center">Quantité demandée</th>
                      <th className="py-3 px-4">Emplacement / Consignes</th>
                      <th className="py-3 px-4">État de préparation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draft.lines.map((line) => {
                      const isChecked = Boolean(prepCheckedItems[line.id]);
                      return (
                        <tr key={line.id} className={isChecked ? "bg-emerald-50/40" : "hover:bg-slate-50"}>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => setPrepCheckedItems({ ...prepCheckedItems, [line.id]: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">{line.inventory_item_name}</td>
                          <td className="py-3 px-4">{itemKindBadge(line.inventory_item_kind)}</td>
                          <td className="py-3 px-4 text-center font-black text-slate-900 text-sm">{line.quantity}</td>
                          <td className="py-3 px-4 text-slate-500">{line.notes || "Zone de stockage standard"}</td>
                          <td className="py-3 px-4">
                            {isChecked ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 flex items-center gap-1 w-fit">
                                <i className="fa-solid fa-check text-[10px]"></i> Prêt / Rassemblé
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 flex items-center gap-1 w-fit">
                                <i className="fa-solid fa-hourglass-half text-[10px]"></i> À préparer
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 3. Onglet Sortie / Livraison ──────────────────────────────── */}
          {activeTab === "sortie" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <i className="fa-solid fa-truck-fast text-indigo-600"></i> Sortie / Livraison du Matériel et Remise des Clés
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Émission du bon de livraison / passation et suivi de la remise des clés, des articles et de l'espace
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModal({
                      title: "Bon de Livraison / Sortie Hahitantsoa",
                      documentInstanceId: deliveryNoteDoc?.id,
                      templateKey: "hahitantsoa.delivery_note.v1",
                      type: "bon_livraison",
                    })}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3.5 py-2 font-bold text-emerald-700 hover:bg-emerald-50 text-xs shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-eye text-emerald-600"></i> Aperçu Bon de Sortie / Livraison
                  </button>
                  {!deliveryNoteDoc && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void generateDocument("hahitantsoa.delivery_note.v1", "Bon de livraison")}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50 text-xs shadow-sm transition-colors"
                    >
                      <i className="fa-solid fa-truck"></i> Émettre le Bon
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <i className="fa-solid fa-location-dot text-rose-500"></i> Détails de Mise à Disposition & Remise des Clés
                  </h4>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p><strong className="text-slate-800">Lieu / Salle :</strong> {draft.venue_name || "Locaux de l'entreprise"}</p>
                    <p><strong className="text-slate-800">Horaires :</strong> Du {formatDateTimeFr(draft.start_at)} au {formatDateTimeFr(draft.end_at)}</p>
                    <p><strong className="text-slate-800">Détails d'accès :</strong> {draft.location_details || "Standard"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <i className="fa-solid fa-signature text-teal-600"></i> Signature et Responsables
                  </h4>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p><strong className="text-slate-800">Client / Réceptionnaire :</strong> {draft.customer_display_name}</p>
                    <p><strong className="text-slate-800">État du Bon :</strong> {deliveryNoteDoc ? "Généré et prêt pour signature" : "En attente d'émission"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. Onglet Retour / Restitution ────────────────────────────── */}
          {activeTab === "retour" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <i className="fa-solid fa-rotate-left text-indigo-600"></i> Retour de Matériel & Restitution (État des Lieux de Sortie)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Contrôle de l'état des articles retournés et état des lieux de sortie après l'événement
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModal({
                      title: "Bon de Retour Officiel",
                      documentInstanceId: returnNoteDoc?.id,
                      templateKey: "shared.return_note.v1",
                      type: "bon_retour",
                    })}
                    className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 font-bold text-blue-700 hover:bg-blue-50 text-xs shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-eye text-blue-600"></i> Aperçu Bon de Retour
                  </button>
                  {!returnNoteDoc && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void generateDocument("shared.return_note.v1", "Bon de retour")}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50 text-xs shadow-sm transition-colors"
                    >
                      <i className="fa-solid fa-rotate-left"></i> Émettre le Bon
                    </button>
                  )}
                </div>
              </div>

              {/* Inspection list */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Article</th>
                      <th className="py-3 px-4 text-center">Quantité louée</th>
                      <th className="py-3 px-4 text-center">Quantité retournée</th>
                      <th className="py-3 px-4">État au retour</th>
                      <th className="py-3 px-4">Remarques</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draft.lines.map((line) => {
                      const returnState = returnCheckedItems[line.id] || { returned: line.quantity, status: "conforme" };
                      return (
                        <tr key={line.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">{line.inventory_item_name}</td>
                          <td className="py-3 px-4 text-center font-bold">{line.quantity}</td>
                          <td className="py-3 px-4 text-center">
                            <input
                              type="number"
                              min="0"
                              max={line.quantity}
                              value={returnState.returned}
                              onChange={(e) => setReturnCheckedItems({
                                ...returnCheckedItems,
                                [line.id]: { ...returnState, returned: Number(e.target.value) },
                              })}
                              className="w-16 rounded border border-slate-300 px-2 py-1 text-center font-bold"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={returnState.status}
                              onChange={(e) => setReturnCheckedItems({
                                ...returnCheckedItems,
                                [line.id]: { ...returnState, status: e.target.value as any },
                              })}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold"
                            >
                              <option value="conforme">Conforme / Intact</option>
                              <option value="degrade">Dégradé / Cassé</option>
                              <option value="manquant">Manquant / Perdu</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-slate-400">R.A.S.</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 5. Onglet Casse & Pertes ───────────────────────────────────── */}
          {activeTab === "casse" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <i className="fa-solid fa-heart-crack text-rose-500"></i> Casse & Pertes de Matériel (Grille Tarifaire)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Grille tarifaire et évaluation de casse selon le barème officiel ou devis de réparation
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModal({
                      title: "Facture de Casse / Remise en État",
                      documentInstanceId: breakageDoc?.id,
                      templateKey: "hahitantsoa.breakage_repair_invoice.v1",
                      type: "facture_casse",
                    })}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 font-bold text-rose-700 hover:bg-rose-50 text-xs shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-eye text-rose-600"></i> Aperçu Facture de Casse
                  </button>
                  {!breakageDoc && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void generateDocument("hahitantsoa.breakage_repair_invoice.v1", "Facture de casse")}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-50 text-xs shadow-sm transition-colors"
                    >
                      <i className="fa-solid fa-file-invoice-dollar"></i> Émettre Facture Casse
                    </button>
                  )}
                </div>
              </div>

              {/* Breakage pricing table */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">Articles nécessitant un dédommagement selon la grille tarifaire</span>
                  <span className="text-sm font-black text-rose-600">Total Casse : {formatMoney(totalDamageCost)}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Article</th>
                        <th className="py-2.5 px-3 text-center">Quantité cassée/perdue</th>
                        <th className="py-2.5 px-3 text-right">Tarif unitaire casse (Ar)</th>
                        <th className="py-2.5 px-3 text-right">Total (Ar)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draft.lines.map((line) => {
                        const deduction = breakageDeductions[line.id] || { qty: 0, unitCost: 25000, notes: "" };
                        return (
                          <tr key={line.id}>
                            <td className="py-2.5 px-3 font-semibold">{line.inventory_item_name}</td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max={line.quantity}
                                value={deduction.qty}
                                onChange={(e) => setBreakageDeductions({
                                  ...breakageDeductions,
                                  [line.id]: { ...deduction, qty: Number(e.target.value) },
                                })}
                                className="w-16 rounded border border-slate-300 px-2 py-1 text-center font-bold"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={deduction.unitCost}
                                onChange={(e) => setBreakageDeductions({
                                  ...breakageDeductions,
                                  [line.id]: { ...deduction, unitCost: Number(e.target.value) },
                                })}
                                className="w-24 rounded border border-slate-300 px-2 py-1 text-right font-bold"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                              {formatMoney(deduction.qty * deduction.unitCost)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. Onglet Caution & Solde ─────────────────────────────────── */}
          {activeTab === "caution" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <i className="fa-solid fa-money-bill-transfer text-indigo-600"></i> Suivi de la Caution & Restitution
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Imputation automatique des casses sur la caution et restitution du solde au client
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModal({
                      title: "Reçu de Remboursement de Caution",
                      documentInstanceId: refundReceiptDoc?.id,
                      templateKey: "shared.payment_refund_receipt.v1",
                      type: "recu_remboursement",
                    })}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 font-bold text-indigo-700 hover:bg-indigo-50 text-xs shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-eye text-indigo-600"></i> Aperçu Reçu de Remboursement
                  </button>
                  {!refundReceiptDoc && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void generateDocument("shared.payment_refund_receipt.v1", "Reçu de remboursement")}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 text-xs shadow-sm transition-colors"
                    >
                      <i className="fa-solid fa-receipt"></i> Émettre Reçu Restitution
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs font-bold text-slate-500 block uppercase">Caution Déposée</span>
                  <span className="text-lg font-black text-slate-900 mt-1 block">{formatMoney(standardCautionAmount)}</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Dépôt initial</span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs font-bold text-slate-500 block uppercase">Déduction Casses & Pertes</span>
                  <span className="text-lg font-black text-rose-600 mt-1 block">− {formatMoney(totalDamageCost)}</span>
                  <span className="text-[11px] text-slate-400 mt-1 block">Selon constat</span>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <span className="text-xs font-bold text-emerald-800 block uppercase">Solde Caution Restituable</span>
                  <span className="text-lg font-black text-emerald-700 mt-1 block">{formatMoney(refundableCautionBalance)}</span>
                  <span className="text-[11px] text-emerald-600 mt-1 block">À rembourser au client</span>
                </div>
              </div>

              {/* Clôture opérationnelle du dossier (R7) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 mt-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-slate-800 text-sm">Clôture opérationnelle du dossier (R7)</h4>
                  {closeoutSummary?.closeout_status === "closed" ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      <i className="fa-solid fa-lock mr-1"></i> Dossier Clôturé
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      <i className="fa-solid fa-lock-open mr-1"></i> À clôturer
                    </span>
                  )}
                </div>

                {closeoutSummary ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                        <span className="font-bold text-slate-500 block">Événements logistiques incomplets</span>
                        <span className="text-sm font-black text-slate-900 mt-0.5 block">{closeoutSummary.incomplete_logistics_event_count}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                        <span className="font-bold text-slate-500 block">Retours non réglés</span>
                        <span className="text-sm font-black text-slate-900 mt-0.5 block">{closeoutSummary.unresolved_return_count}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                        <span className="font-bold text-slate-500 block">Factures ouvertes</span>
                        <span className="text-sm font-black text-slate-900 mt-0.5 block">{closeoutSummary.open_invoice_count}</span>
                      </div>
                    </div>

                    {closeoutSummary.signature_exception_required && closeoutSummary.closeout_status !== "closed" && (
                      <label className="mt-3 block text-xs font-medium text-slate-700">
                        Motif durable de l'exception de signature
                        <textarea
                          value={signatureExceptionReason}
                          onChange={(e) => setSignatureExceptionReason(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-xs"
                          rows={2}
                          aria-describedby="signature-exception-help"
                        />
                        <span id="signature-exception-help" className="mt-1 block text-[11px] text-slate-500">
                          Ce motif durable est conservé dans la preuve de clôture auditée.
                        </span>
                      </label>
                    )}

                    {closeoutSummary.closeout_status === "open" && (
                      <button
                        type="button"
                        onClick={() => void closeoutDraft()}
                        disabled={busy !== null}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        <i className={`fas ${busy === "closeout" ? "fa-spinner fa-spin" : "fa-lock"}`} />
                        Clôturer le dossier
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-slate-500 text-xs">
                    Le résumé de clôture sera disponible une fois le dossier confirmé.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 7. Onglet Avenants ─────────────────────────────────────────── */}
          {activeTab === "avenants" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <i className="fa-solid fa-pen-ruler text-indigo-600"></i> Demandes d'avenant et modifications contractuelles
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Modifications d'articles, d'horaires ou de prestations validées</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModal({
                      title: "Avenant Officiel de Contrat",
                      documentInstanceId: amendmentDoc?.id,
                      templateKey: "hahitantsoa.contract_amendment.v1",
                      type: "avenant",
                    })}
                    className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3.5 py-2 font-bold text-indigo-700 hover:bg-indigo-50 text-xs shadow-2xs transition-colors"
                  >
                    <i className="fa-solid fa-eye text-indigo-600"></i> Aperçu Avenant
                  </button>
                  {draft.status === "confirmed" && (
                    <button
                      type="button"
                      onClick={() => setShowAmendmentModal(true)}
                      className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-plus"></i> Nouvel avenant
                    </button>
                  )}
                </div>
              </div>

              {amendments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500 text-sm">
                  <i className="fa-solid fa-pen-ruler text-3xl text-slate-300 block mb-2"></i>
                  Aucun avenant enregistré pour cet événement.
                </div>
              ) : (
                <div className="space-y-3">
                  {amendments.map((am) => (
                    <div key={am.id} className="rounded-xl border border-slate-200 p-4 bg-white shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900 text-sm">{am.reason}</span>
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 capitalize">
                          {am.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{am.notes || "Aucune note additionnelle."}</p>
                      <div className="mt-2 text-[11px] text-slate-400">
                        {am.lines.length} ligne(s) modifiée(s) · Demandé le {formatDateFr(am.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Document Preview Modal (Artifact or Live Authentic Draft Preview) ── */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-file-lines text-indigo-600"></i> {previewModal.title}
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
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <i className="fa-solid fa-print"></i> Imprimer
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-100/50">
              {previewModal.documentInstanceId ? (
                <DocumentArtifactPreviewPanel documentInstanceId={previewModal.documentInstanceId} />
              ) : (
                <DocumentPreview
                  domain="hahitantsoa"
                  hahitantsoaEventDraftId={draft.id}
                  template={{ templateKey: previewModal.templateKey }}
                  type={previewModal.type}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Recording Modal ───────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-money-bill-transfer text-indigo-600"></i> Enregistrer un versement
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Tranche / Échéance associée
                  <select
                    value={paymentKindSelection}
                    onChange={(e) => setPaymentKindSelection(e.target.value as any)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  >
                    <option value="deposit">Acompte Réservation</option>
                    <option value="installment_1">1ère Tranche (M-1)</option>
                    <option value="installment_2">2ème Tranche / Solde (J-10)</option>
                    <option value="caution">Caution Événement</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Montant (Ar) *
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Montant du règlement"
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Mode de règlement
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  >
                    <option value="cash">Espèces</option>
                    <option value="mobile_money">Mobile Money (Mvola / Orange / Airtel)</option>
                    <option value="bank_transfer">Virement Bancaire</option>
                    <option value="cheque">Chèque</option>
                    <option value="other">Autre</option>
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Notes / Référence du versement
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Ex: Réf virement ou note interne"
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void recordDeposit()}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "deposit" ? "Enregistrement..." : "Confirmer le versement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Amendment Request Modal ───────────────────────────────────────── */}
      {showAmendmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-indigo-600"></i> Demander un avenant d'événement
              </h3>
              <button
                type="button"
                onClick={() => setShowAmendmentModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={submitAmendment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Motif de l'avenant *
                  <input
                    type="text"
                    required
                    value={amendmentReason}
                    onChange={(e) => setAmendmentReason(e.target.value)}
                    placeholder="Ex: Rajout de tables et prolongation horaire"
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Notes / Précisions
                  <textarea
                    rows={2}
                    value={amendmentNotes}
                    onChange={(e) => setAmendmentNotes(e.target.value)}
                    placeholder="Précisions sur les modifications demandées..."
                    className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ajuster les quantités :</span>
                {draft.lines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-slate-800">{line.inventory_item_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">(Actuel: {line.quantity})</span>
                      <input
                        type="number"
                        min="0"
                        defaultValue={line.quantity}
                        onChange={(e) => setAmendmentQuantities({
                          ...amendmentQuantities,
                          [line.id]: Number(e.target.value),
                        })}
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAmendmentModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busy !== null}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy === "amendment" ? "Enregistrement..." : "Soumettre l'avenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
