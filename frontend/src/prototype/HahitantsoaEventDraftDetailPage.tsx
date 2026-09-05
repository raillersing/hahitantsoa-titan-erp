import React, { useCallback, useEffect, useRef, useState } from "react";
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

type ActiveTab = "contrat" | "paiements" | "logistique" | "cloture" | "avenants";

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
  const [activeTab, setActiveTab] = useState<ActiveTab>("contrat");
  const [selectedPreviewDocId, setSelectedPreviewDocId] = useState<string | null>(null);

  // Form states
  const [signatureExceptionReason, setSignatureExceptionReason] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amendmentNotes, setAmendmentNotes] = useState("");
  const [amendmentQuantities, setAmendmentQuantities] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const depositRecordingKeyRef = useRef<string | null>(null);
  const closeoutKeyRef = useRef<string | null>(null);
  const amendmentKeyRef = useRef<string | null>(null);

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
      setError("Saisissez un montant d'acompte supérieur à zéro.");
      return;
    }
    const requiredAmount = Number(draft?.required_deposit_amount || "0");
    const confirmedAmount = payments
      .filter((payment) => payment.payment_kind === "deposit" && (payment.payment_status === "confirmed" || payment.payment_status === "reconciled"))
      .reduce((total, payment) => total + Number(payment.amount), 0);
    const remainingAmount = Math.max(requiredAmount - confirmedAmount, 0);
    if (remainingAmount > 0 && amount < remainingAmount) {
      setError(`L'acompte restant à confirmer est de ${remainingAmount.toLocaleString("fr-FR")} Ar.`);
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
        notes: paymentNotes || "Acompte enregistré depuis le dossier Hahitantsoa.",
        idempotency_key: idempotencyKey,
      });
      depositRecordingKeyRef.current = null;
      setDepositAmount("");
      setPaymentNotes("");
      setActionNotice(result.replayed ? "L'acompte déjà enregistré a été repris sans doublon." : "Acompte enregistré et confirmé.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible d'enregistrer l'acompte."));
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

  const generateOfficialContract = async () => {
    if (!param) return;
    setBusy("generate-contract");
    setError(null);
    setActionNotice(null);
    try {
      const contractDoc = await createHahitantsoaEventDraftDocumentInstance(param, {
        template_key: "hahitantsoa.contract.v1",
      });
      await generateHahitantsoaEventDraftDocumentInstance(param, contractDoc.id);
      await generateHahitantsoaEventDraftDocumentInstancePdf(param, contractDoc.id);

      const hasDischarge = documents.some((d) => d.template_key === "hahitantsoa.liability_release.v1");
      if (!hasDischarge) {
        const dischargeDoc = await createHahitantsoaEventDraftDocumentInstance(param, {
          template_key: "hahitantsoa.liability_release.v1",
        });
        await generateHahitantsoaEventDraftDocumentInstance(param, dischargeDoc.id);
        await generateHahitantsoaEventDraftDocumentInstancePdf(param, dischargeDoc.id);
      }
      setActionNotice("Le contrat et la décharge officielle ont été générés avec succès.");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible de générer le contrat officiel."));
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

  const contractExists = documents.some(
    (document) => document.template_key === "hahitantsoa.contract.v1" && (document.status === "generated" || document.status === "issued"),
  );
  const dischargeExists = documents.some(
    (document) => document.template_key === "hahitantsoa.liability_release.v1" && (document.status === "generated" || document.status === "issued"),
  );
  const proformaDoc = documents.find((d) => d.template_key === "hahitantsoa.proforma.v1");
  const contractDoc = documents.find((d) => d.template_key === "hahitantsoa.contract.v1");
  const dischargeDoc = documents.find((d) => d.template_key === "hahitantsoa.liability_release.v1");

  const confirmedDepositAmount = payments
    .filter((payment) => payment.payment_kind === "deposit" && (payment.payment_status === "confirmed" || payment.payment_status === "reconciled"))
    .reduce((total, payment) => total + Number(payment.amount), 0);
  const totalPaidAmount = payments
    .filter((payment) => payment.payment_status === "confirmed" || payment.payment_status === "reconciled")
    .reduce((total, payment) => total + Number(payment.amount), 0);

  const requiredDepositAmount = Number(draft.required_deposit_amount || "0");
  const remainingDepositAmount = Math.max(requiredDepositAmount - confirmedDepositAmount, 0);
  const totalDossierAmount = draft.payment_schedule ? Number(draft.payment_schedule.total_amount) : 0;
  const remainingTotalAmount = Math.max(totalDossierAmount - totalPaidAmount, 0);

  const contractSigned = preflight?.prerequisite_status.contract.truth_present ?? false;
  const depositConfirmed = preflight?.prerequisite_status.deposit.truth_present ?? false;
  const availabilityValidated = preflight?.unavailable_line_count === 0;
  const canRecordDeposit = !depositConfirmed && (confirmedDepositAmount === 0 || confirmedDepositAmount < requiredDepositAmount);
  const canMarkExistingDeposit = !depositConfirmed && confirmedDepositAmount > 0 && confirmedDepositAmount >= requiredDepositAmount;

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
              onClick={() => void generateOfficialContract()}
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

      {/* ── Section 1 : Fiche Client & Synthèse Financière ─────────────────── */}
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

        {/* Financial & Schedule Card */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-white p-6 shadow-sm md:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-indigo-100/60 pb-3 mb-4">
              <h2 className="text-base font-bold text-indigo-950 flex items-center gap-2">
                <i className="fa-solid fa-coins text-amber-500"></i> Synthèse Financière & Échéancier
              </h2>
              <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                3 Tranches Hahitantsoa
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Total Dossier</span>
                <span className="text-base font-black text-slate-900">{formatMoney(totalDossierAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Acompte Requis</span>
                <span className="text-base font-black text-amber-600">{formatMoney(requiredDepositAmount)}</span>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">Reste à Régler</span>
                <span className={`text-base font-black ${remainingTotalAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {formatMoney(remainingTotalAmount)}
                </span>
              </div>
            </div>

            {/* 3-tier schedule boxes */}
            {draft.payment_schedule && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs">
                  <span className="font-bold text-indigo-700 block">1. Acompte Signature</span>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(draft.payment_schedule.deposit_amount)}</p>
                  <span className="text-[11px] text-slate-500 mt-1 block">À la réservation</span>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs">
                  <span className="font-bold text-indigo-700 block">2. 1ère Tranche</span>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(draft.payment_schedule.first_installment_amount)}</p>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Échéance : {formatDateFr(draft.payment_schedule.first_installment_due_on)}
                  </span>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs">
                  <span className="font-bold text-indigo-700 block">3. 2ème Tranche / Solde</span>
                  <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(draft.payment_schedule.second_installment_amount)}</p>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Échéance : {formatDateFr(draft.payment_schedule.second_installment_due_on)}
                  </span>
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
                <tr className="bg-indigo-50/30">
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
                <tr>
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
            <i className="fa-solid fa-bell-concierge text-base text-amber-600 mt-0.5"></i>
            <div>
              <span className="font-bold text-amber-950 block">Consignes de service & traiteur :</span>
              <p className="mt-0.5">{draft.service_notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3 : Onglets Opérationnels (5 Onglets) ──────────────────── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
          {[
            { id: "contrat" as const, label: "Documents & Devis", icon: "fa-file-signature" },
            { id: "paiements" as const, label: "Règlements & Reçus", icon: "fa-receipt" },
            { id: "logistique" as const, label: "Logistique & Salle", icon: "fa-truck-ramp-box" },
            { id: "cloture" as const, label: "Restitution & Clôture R7", icon: "fa-clipboard-check" },
            { id: "avenants" as const, label: `Avenants (${amendments.length})`, icon: "fa-pen-ruler" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-700 bg-white"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* ── Tab 1 : Documents & Devis ───────────────────────────────────── */}
          {activeTab === "contrat" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base">Documents contractuels et officiels</h3>
                <span className="text-xs text-slate-500">{documents.length} document(s) enregistré(s)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Proforma Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-base">
                        <i className="fa-solid fa-file-invoice"></i>
                      </div>
                      {proformaDoc && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          {proformaDoc.status}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Proforma / Devis Hahitantsoa</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {proformaDoc ? `Émis le ${formatDateFr(proformaDoc.prepared_at || proformaDoc.created_at)}` : "Non généré"}
                    </p>
                  </div>
                  {proformaDoc && (
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDocId(proformaDoc.id)}
                        className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fa-solid fa-eye text-indigo-600"></i> Aperçu
                      </button>
                    </div>
                  )}
                </div>

                {/* Contract Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-file-contract"></i>
                      </div>
                      {contractDoc && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${contractSigned ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {contractSigned ? "Signé" : "En attente signature"}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Contrat Officiel d'Événement</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {contractDoc ? `Généré le ${formatDateFr(contractDoc.prepared_at || contractDoc.created_at)}` : "Non généré"}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                    {contractDoc ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDocId(contractDoc.id)}
                        className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fa-solid fa-eye text-indigo-600"></i> Aperçu
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void generateOfficialContract()}
                        disabled={busy !== null}
                        className="flex-1 rounded-lg bg-indigo-600 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        Générer contrat
                      </button>
                    )}
                  </div>
                </div>

                {/* Discharge Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-base">
                        <i className="fa-solid fa-shield-halved"></i>
                      </div>
                      {dischargeDoc && (
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                          {dischargeDoc.status}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-900 text-sm">Décharge de Responsabilité</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {dischargeDoc ? `Généré le ${formatDateFr(dischargeDoc.prepared_at || dischargeDoc.created_at)}` : "Non généré"}
                    </p>
                  </div>
                  {dischargeDoc && (
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDocId(dischargeDoc.id)}
                        className="flex-1 rounded-lg bg-white border border-slate-200 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <i className="fa-solid fa-eye text-teal-600"></i> Aperçu
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Prerequisites checklist */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <h4 className="font-bold text-slate-800 text-xs uppercase mb-3 text-slate-500">Prérequis de confirmation</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <li className={`flex items-center gap-2 ${contractExists ? "text-emerald-700 font-semibold" : "text-amber-700"}`}>
                    <i className={`fa-solid ${contractExists ? "fa-circle-check" : "fa-circle-dot"}`}></i> Contrat officiel généré
                  </li>
                  <li className={`flex items-center gap-2 ${contractSigned ? "text-emerald-700 font-semibold" : "text-amber-700"}`}>
                    <i className={`fa-solid ${contractSigned ? "fa-circle-check" : "fa-circle-dot"}`}></i> Contrat signé par le client
                  </li>
                  <li className={`flex items-center gap-2 ${depositConfirmed ? "text-emerald-700 font-semibold" : "text-amber-700"}`}>
                    <i className={`fa-solid ${depositConfirmed ? "fa-circle-check" : "fa-circle-dot"}`}></i> Acompte contractuel confirmé
                  </li>
                  <li className={`flex items-center gap-2 ${availabilityValidated ? "text-emerald-700 font-semibold" : "text-amber-700"}`}>
                    <i className={`fa-solid ${availabilityValidated ? "fa-circle-check" : "fa-circle-dot"}`}></i> Disponibilité salle & articles validée
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Tab 2 : Règlements & Reçus ──────────────────────────────────── */}
          {activeTab === "paiements" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base">Historique des versements et règlements</h3>
                <span className="text-xs font-bold text-slate-700">Total encaissé : {formatMoney(totalPaidAmount)}</span>
              </div>

              {payments.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500 text-sm">
                  <i className="fa-solid fa-receipt text-3xl text-slate-300 block mb-2"></i>
                  Aucun versement enregistré pour ce dossier.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-700">
                    <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Mode</th>
                        <th className="py-2.5 px-4 text-right">Montant</th>
                        <th className="py-2.5 px-4">Statut</th>
                        <th className="py-2.5 px-4">Notes / Réf</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4 text-xs font-semibold">{formatDateFr(p.paid_at || p.created_at)}</td>
                          <td className="py-3 px-4 text-xs capitalize">{p.payment_kind || "Acompte"}</td>
                          <td className="py-3 px-4 text-xs capitalize">{p.payment_method || "Espèces"}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">{formatMoney(p.amount)}</td>
                          <td className="py-3 px-4">
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              {p.payment_status || "Confirmé"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">{p.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Tab 3 : Logistique & Salle ──────────────────────────────────── */}
          {activeTab === "logistique" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base">Coordination logistique et mise à disposition</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-location-dot text-rose-500"></i> Lieu & Espace
                  </h4>
                  <dl className="space-y-1.5 text-xs text-slate-600">
                    <div><dt className="font-semibold text-slate-700">Salle :</dt><dd>{draft.venue_name || "Non spécifié"}</dd></div>
                    <div><dt className="font-semibold text-slate-700">Détails d'accès :</dt><dd>{draft.location_details || "Standard"}</dd></div>
                    <div><dt className="font-semibold text-slate-700">Période d'occupation :</dt><dd>{formatDateTimeFr(draft.start_at)} → {formatDateTimeFr(draft.end_at)}</dd></div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                    <i className="fa-solid fa-clipboard-list text-indigo-600"></i> Préparation Matériel
                  </h4>
                  <p className="text-xs text-slate-600">
                    {draft.lines.length} équipement(s) à préparer et à vérifier avant l'événement.
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {draft.lines.slice(0, 4).map((l) => (
                      <li key={l.id} className="flex items-center gap-1.5">
                        <i className="fa-solid fa-check text-emerald-600 text-[10px]"></i>
                        <span>{l.quantity}x {l.inventory_item_name}</span>
                      </li>
                    ))}
                    {draft.lines.length > 4 && (
                      <li className="text-slate-400 italic">... et {draft.lines.length - 4} autre(s) article(s)</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab 4 : Restitution & Clôture R7 ────────────────────────────── */}
          {activeTab === "cloture" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base">Clôture opérationnelle du dossier (R7)</h3>
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
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                      <span className="font-bold text-slate-500 block">Événements logistiques incomplets</span>
                      <span className="text-base font-black text-slate-900 mt-1 block">{closeoutSummary.incomplete_logistics_event_count}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                      <span className="font-bold text-slate-500 block">Retours non réglés</span>
                      <span className="text-base font-black text-slate-900 mt-1 block">{closeoutSummary.unresolved_return_count}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                      <span className="font-bold text-slate-500 block">Factures ouvertes</span>
                      <span className="text-base font-black text-slate-900 mt-1 block">{closeoutSummary.open_invoice_count}</span>
                    </div>
                  </div>

                  {closeoutSummary.signature_exception_required && closeoutSummary.closeout_status !== "closed" && (
                    <label className="mt-4 block text-sm font-medium text-slate-700">
                      Motif durable de l'exception de signature
                      <textarea
                        value={signatureExceptionReason}
                        onChange={(e) => setSignatureExceptionReason(e.target.value)}
                        className="mt-1 block w-full rounded-xl border border-slate-300 p-3 text-xs"
                        rows={3}
                        aria-describedby="signature-exception-help"
                      />
                      <span id="signature-exception-help" className="mt-1 block text-xs text-slate-500">
                        Ce motif est conservé dans la preuve de clôture auditée.
                      </span>
                    </label>
                  )}

                  {closeoutSummary.closeout_status === "open" && (
                    <button
                      type="button"
                      onClick={() => void closeoutDraft()}
                      disabled={busy !== null}
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      <i className={`fas ${busy === "closeout" ? "fa-spinner fa-spin" : "fa-lock"}`} />
                      Clôturer le dossier
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500 text-sm">
                  Le résumé de clôture sera disponible une fois le dossier confirmé.
                </div>
              )}
            </div>
          )}

          {/* ── Tab 5 : Avenants ────────────────────────────────────────────── */}
          {activeTab === "avenants" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-base">Historique des avenants du dossier</h3>
                {draft.status === "confirmed" && (
                  <button
                    type="button"
                    onClick={() => setShowAmendmentModal(true)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i> Nouvel avenant
                  </button>
                )}
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

      {/* ── Document Preview Modal ────────────────────────────────────────── */}
      {selectedPreviewDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-file-lines text-indigo-600"></i> Aperçu du document
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPreviewDocId(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <DocumentArtifactPreviewPanel documentInstanceId={selectedPreviewDocId} />
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
