import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  confirmHahitantsoaEventDraft,
  closeHahitantsoaEventDraft,
  createHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstancePdf,
  getHahitantsoaEventDraft,
  getHahitantsoaEventDrafts,
  getHahitantsoaEventDraftConfirmationPreflight,
  getHahitantsoaEventDraftCloseoutSummary,
  getHahitantsoaEventDraftLifecycle,
  getHahitantsoaEventDraftDocumentInstances,
  getHahitantsoaEventDraftPayments,
  getHahitantsoaEventDraftAmendmentRequests,
  createHahitantsoaEventDraftAmendmentRequest,
  createHahitantsoaEventDraftAmendmentRequestLine,
  applyHahitantsoaEventDraftAmendmentRequest,
  getInventoryItems,
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
import PaymentRegistrationModal from "./PaymentRegistrationModal";
import {
  DraftConflictResolutionModal,
  type ConflictResolutionTarget,
} from "./DraftConflictResolutionModal";
import type {
  Customer,
  DocumentInstance,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftConfirmationPreflight,
  HahitantsoaEventCloseoutSummary,
  HahitantsoaEventDraftAmendmentRequest,
  InventoryItem,
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

  // Conflict management states
  const [conflictedWithEvent, setConflictedWithEvent] = useState<HahitantsoaEventDraft | null>(null);
  const [competingDrafts, setCompetingDrafts] = useState<HahitantsoaEventDraft[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictModalTarget, setConflictModalTarget] = useState<ConflictResolutionTarget | null>(null);
  const [conflictModalTab, setConflictModalTab] = useState<"reschedule" | "waitlist" | "cancel">("reschedule");

  // Form states
  const [signatureExceptionReason, setSignatureExceptionReason] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentKindSelection, setPaymentKindSelection] = useState<"deposit" | "installment_1" | "installment_2" | "caution">("deposit");
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Amendment Studio states (5-step interactive wizard)
  const [showAmendmentModal, setShowAmendmentModal] = useState(false);
  const [amendmentStep, setAmendmentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amendmentNotes, setAmendmentNotes] = useState("");
  const [amendmentStartAt, setAmendmentStartAt] = useState("");
  const [amendmentEndAt, setAmendmentEndAt] = useState("");
  const [amendmentEventType, setAmendmentEventType] = useState("wedding");
  const [amendmentNightOption, setAmendmentNightOption] = useState<"day" | "night_opt1" | "night_opt2">("day");
  const [amendmentRentalType, setAmendmentRentalType] = useState("bare");
  const [amendmentGuestCount, setAmendmentGuestCount] = useState(100);
  const [amendmentSpaceRentalAmount, setAmendmentSpaceRentalAmount] = useState(1500000);
  const [amendmentVenueName, setAmendmentVenueName] = useState("Grande Salle Hahitantsoa");
  const [amendmentLocationDetails, setAmendmentLocationDetails] = useState("");
  const [amendmentServiceNotes, setAmendmentServiceNotes] = useState("");
  const [amendmentSelectedServices, setAmendmentSelectedServices] = useState<Record<string, boolean>>({});
  const [amendmentQuantities, setAmendmentQuantities] = useState<Record<string, number>>({});
  const [amendmentAddedLines, setAmendmentAddedLines] = useState<
    Array<{
      inventory_item_id: string;
      inventory_item_name: string;
      inventory_item_kind: "material" | "article" | "material_pack";
      quantity: number;
      unit_rental_price: number;
      notes: string;
    }>
  >([]);
  const [catalogItems, setCatalogItems] = useState<InventoryItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [autoApplyAmendment, setAutoApplyAmendment] = useState(true);

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

  const toConflictTarget = useCallback((targetDraft: HahitantsoaEventDraft, conflictingWithRef?: string, conflictingWithName?: string): ConflictResolutionTarget => {
    return {
      id: targetDraft.id,
      category: "hahitantsoa",
      title: targetDraft.event_name || targetDraft.public_reference,
      customerName: targetDraft.customer_display_name || "Client",
      startAt: targetDraft.start_at,
      endAt: targetDraft.end_at,
      location: targetDraft.venue_name || "Salle principale",
      conflictingWith: conflictingWithRef,
      conflictingWithEventName: conflictingWithName,
      raw: targetDraft,
    };
  }, []);

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
      const [nextPreflight, nextDocuments, nextPayments, allDrafts] = await Promise.all([
        getHahitantsoaEventDraftConfirmationPreflight(param).catch(() => null),
        getHahitantsoaEventDraftDocumentInstances(param).catch(() => []),
        getHahitantsoaEventDraftPayments(param).catch(() => []),
        getHahitantsoaEventDrafts().catch(() => [] as HahitantsoaEventDraft[]),
      ]);

      setPreflight(nextPreflight);
      setDocuments(nextDocuments);
      setPayments(nextPayments);

      // Conflict detection for current draft
      const draftVenue = (eventDraft.venue_name || "Salle principale").trim().toLowerCase();
      const draftStart = new Date(eventDraft.start_at);
      const draftEnd = new Date(eventDraft.end_at);

      if (eventDraft.status !== "confirmed") {
        const conflict = allDrafts.find((other) => {
          if (other.id === eventDraft.id || other.status !== "confirmed") return false;
          const otherVenue = (other.venue_name || "Salle principale").trim().toLowerCase();
          const oStart = new Date(other.start_at);
          const oEnd = new Date(other.end_at);
          return otherVenue === draftVenue && oStart < draftEnd && oEnd > draftStart;
        });
        setConflictedWithEvent(conflict || null);
        setCompetingDrafts([]);
      } else {
        const competing = allDrafts.filter((other) => {
          if (other.id === eventDraft.id || other.status === "confirmed") return false;
          const otherVenue = (other.venue_name || "Salle principale").trim().toLowerCase();
          const oStart = new Date(other.start_at);
          const oEnd = new Date(other.end_at);
          return otherVenue === draftVenue && oStart < draftEnd && oEnd > draftStart;
        });
        setConflictedWithEvent(null);
        setCompetingDrafts(competing);
      }

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

  const openAmendmentModal = async () => {
    if (!draft) return;
    setAmendmentStep(1);
    setAmendmentReason("");
    setAmendmentNotes("");
    setAmendmentStartAt(draft.start_at ? draft.start_at.slice(0, 16) : "");
    setAmendmentEndAt(draft.end_at ? draft.end_at.slice(0, 16) : "");
    setAmendmentEventType(draft.event_type || "wedding");
    setAmendmentNightOption(
      draft.event_type?.includes("night_opt2")
        ? "night_opt2"
        : draft.event_type?.includes("night")
          ? "night_opt1"
          : "day",
    );
    setAmendmentRentalType(draft.rental_type || "bare");
    setAmendmentGuestCount(draft.guest_count || 100);
    setAmendmentSpaceRentalAmount(Number(draft.space_rental_amount || 1500000));
    setAmendmentVenueName(draft.venue_name || "Grande Salle Hahitantsoa");
    setAmendmentLocationDetails(draft.location_details || "");
    setAmendmentServiceNotes(draft.service_notes || "");
    setAmendmentSelectedServices({
      sono: draft.service_notes?.toLowerCase().includes("sono") || false,
      menage:
        draft.service_notes?.toLowerCase().includes("m\u00e9nage") ||
        draft.service_notes?.toLowerCase().includes("nettoyage") ||
        false,
      security: draft.service_notes?.toLowerCase().includes("s\u00e9curit\u00e9") || false,
      traiteur: draft.service_notes?.toLowerCase().includes("traiteur") || false,
      groupe_elec: draft.service_notes?.toLowerCase().includes("groupe") || false,
      deco: draft.service_notes?.toLowerCase().includes("d\u00e9co") || false,
    });
    setAmendmentQuantities(Object.fromEntries(draft.lines.map((l) => [l.id, l.quantity])));
    setAmendmentAddedLines([]);
    setCatalogSearch("");
    setAutoApplyAmendment(true);
    setShowAmendmentModal(true);

    if (catalogItems.length === 0) {
      try {
        const items = await getInventoryItems();
        setCatalogItems(items);
      } catch {
        // Fallback or ignore
      }
    }
  };

  const filteredCatalogItems = useMemo(() => {
    if (!catalogSearch.trim()) return catalogItems.slice(0, 8);
    const q = catalogSearch.toLowerCase();
    return catalogItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.kind.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [catalogItems, catalogSearch]);

  const amendmentFinancialPreview = useMemo(() => {
    const nightSupplement =
      amendmentNightOption === "night_opt1"
        ? 250000
        : amendmentNightOption === "night_opt2"
          ? 500000
          : 0;
    const newSpace = (Number(amendmentSpaceRentalAmount) || 0) + nightSupplement;
    const oldSpace = Number(draft?.space_rental_amount || 0);

    const oldLinesTotal = (draft?.lines || []).reduce((sum, l) => {
      const p = Number(
        l.unit_rental_price ||
          (l.total_price && l.quantity ? Number(l.total_price) / l.quantity : 0) ||
          5000,
      );
      return sum + l.quantity * p;
    }, 0);

    const newExistingLinesTotal = (draft?.lines || []).reduce((sum, l) => {
      const p = Number(
        l.unit_rental_price ||
          (l.total_price && l.quantity ? Number(l.total_price) / l.quantity : 0) ||
          5000,
      );
      const q =
        amendmentQuantities[l.id] !== undefined ? amendmentQuantities[l.id] : l.quantity;
      return sum + q * p;
    }, 0);

    const newAddedLinesTotal = amendmentAddedLines.reduce((sum, l) => {
      return sum + l.quantity * l.unit_rental_price;
    }, 0);

    const newLinesTotal = newExistingLinesTotal + newAddedLinesTotal;
    const oldTotal =
      Number(draft?.payment_schedule?.total_amount) ||
      Number(draft?.total_amount) ||
      oldSpace + oldLinesTotal;
    const newTotal = newSpace + newLinesTotal;
    const delta = newTotal - oldTotal;

    return {
      oldSpace,
      newSpace,
      nightSupplement,
      oldLinesTotal,
      newLinesTotal,
      oldTotal,
      newTotal,
      delta,
    };
  }, [
    amendmentNightOption,
    amendmentSpaceRentalAmount,
    draft,
    amendmentQuantities,
    amendmentAddedLines,
  ]);

  const submitAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!param || !draft) return;
    if (!amendmentReason.trim()) {
      setError("Le motif de l'avenant est obligatoire.");
      setAmendmentStep(1);
      return;
    }
    setBusy("amendment");
    setError(null);
    setActionNotice(null);
    try {
      // Build effective service notes
      const activeServices = Object.entries(amendmentSelectedServices)
        .filter(([, checked]) => checked)
        .map(([key]) => {
          switch (key) {
            case "sono":
              return "Sonorisation & DJ";
            case "menage":
              return "Ménage & Nettoyage";
            case "security":
              return "Sécurité & Gardiennage";
            case "traiteur":
              return "Espace Traiteur";
            case "groupe_elec":
              return "Groupe électrogène de secours";
            case "deco":
              return "Décoration florale";
            default:
              return key;
          }
        });
      const combinedServiceNotes = [
        activeServices.length > 0 ? `Services: ${activeServices.join(", ")}` : "",
        amendmentServiceNotes.trim(),
      ]
        .filter(Boolean)
        .join(" | ");

      const nightSupplement =
        amendmentNightOption === "night_opt1"
          ? 250000
          : amendmentNightOption === "night_opt2"
            ? 500000
            : 0;
      const effectiveSpaceAmount = amendmentSpaceRentalAmount + nightSupplement;

      const eventTypeWithOption =
        amendmentNightOption !== "day"
          ? `${amendmentEventType}_${amendmentNightOption}`
          : amendmentEventType;

      const res = await createHahitantsoaEventDraftAmendmentRequest(param, {
        reason: amendmentReason.trim(),
        notes: amendmentNotes.trim(),
        changed_start_at: amendmentStartAt ? new Date(amendmentStartAt).toISOString() : null,
        changed_end_at: amendmentEndAt ? new Date(amendmentEndAt).toISOString() : null,
        changed_event_type: eventTypeWithOption,
        changed_rental_type: amendmentRentalType,
        changed_guest_count: Number(amendmentGuestCount) || 100,
        changed_space_rental_amount: String(effectiveSpaceAmount),
        changed_venue_name: amendmentVenueName.trim(),
        changed_location_details: amendmentLocationDetails.trim(),
        changed_service_notes: combinedServiceNotes,
        changed_notes: amendmentNotes.trim(),
      });

      const amendmentId = res.amendment_request.id;

      // 1. Process modified existing lines
      for (const line of draft.lines) {
        const qty = amendmentQuantities[line.id];
        if (qty !== undefined && qty !== line.quantity) {
          await createHahitantsoaEventDraftAmendmentRequestLine(param, amendmentId, {
            inventory_item_id: line.inventory_item_id,
            quantity: qty,
            notes: line.notes || "",
          });
        }
      }

      // 2. Process added catalog lines
      for (const added of amendmentAddedLines) {
        if (added.quantity > 0) {
          await createHahitantsoaEventDraftAmendmentRequestLine(param, amendmentId, {
            inventory_item_id: added.inventory_item_id,
            quantity: added.quantity,
            notes: added.notes || "",
          });
        }
      }

      // 3. Auto-apply if requested and eligible
      if (autoApplyAmendment) {
        try {
          await applyHahitantsoaEventDraftAmendmentRequest(param, amendmentId);
          setActionNotice("Avenant officiel validé et appliqué au dossier avec succès.");
        } catch {
          setActionNotice("Demande d'avenant enregistrée (application différée).");
        }
      } else {
        setActionNotice("La demande d'avenant a été enregistrée avec succès.");
      }

      setShowAmendmentModal(false);
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
      .filter(
        (p) =>
          p.payment_kind === "deposit" &&
          (p.payment_status === "confirmed" || p.payment_status === "reconciled"),
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const totalPaidAmount = useMemo(() => {
    return payments
      .filter((p) => p.payment_status === "confirmed" || p.payment_status === "reconciled")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  const totalDossierAmount = useMemo(() => {
    const fromSchedule = Number(draft?.payment_schedule?.total_amount);
    if (fromSchedule && !isNaN(fromSchedule) && fromSchedule > 0) return fromSchedule;
    const fromDraft = Number(draft?.total_amount);
    if (fromDraft && !isNaN(fromDraft) && fromDraft > 0) return fromDraft;
    const spaceAmount = Number(draft?.space_rental_amount || 0);
    const linesAmount = (draft?.lines || []).reduce(
      (sum, l) => sum + Number(l.total_price || 0),
      0,
    );
    const sum = spaceAmount + linesAmount;
    return sum > 0 ? sum : 0;
  }, [draft]);

  const requiredDepositAmount = useMemo(() => {
    const fromSchedule = Number(draft?.payment_schedule?.deposit_amount);
    if (fromSchedule && !isNaN(fromSchedule) && fromSchedule > 0) return fromSchedule;
    const fromDraft = Number(draft?.required_deposit_amount);
    if (fromDraft && !isNaN(fromDraft) && fromDraft > 0) return fromDraft;
    return totalDossierAmount > 0 ? Math.round(totalDossierAmount * 0.5) : 0;
  }, [draft, totalDossierAmount]);

  const remainingDepositAmount = Math.max(requiredDepositAmount - confirmedDepositAmount, 0);
  const remainingTotalAmount = Math.max(totalDossierAmount - totalPaidAmount, 0);

  const effectiveSchedule = useMemo(() => {
    if (draft?.payment_schedule) {
      return draft.payment_schedule;
    }
    if (totalDossierAmount <= 0) return null;
    const dep = Math.round(totalDossierAmount * 0.5);
    const inst1 = Math.round(totalDossierAmount * 0.25);
    const inst2 = Math.max(0, totalDossierAmount - dep - inst1);
    return {
      space_rental_amount: String(draft?.space_rental_amount || 0),
      logistics_amount: "0.00",
      total_amount: String(totalDossierAmount),
      deposit_amount: String(dep),
      first_installment_amount: String(inst1),
      first_installment_due_on: draft?.start_at
        ? new Date(new Date(draft.start_at).getTime() - 30 * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10)
        : "",
      second_installment_amount: String(inst2),
      second_installment_due_on: draft?.start_at
        ? new Date(new Date(draft.start_at).getTime() - 10 * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10)
        : "",
      remaining_after_deposit: String(totalDossierAmount - dep),
    };
  }, [draft, totalDossierAmount]);

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
              onClick={() => void openAmendmentModal()}
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

      {/* ── Conflict Alert Banner (for draft in conflict with confirmed event) ── */}
      {conflictedWithEvent && (
        <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                    Conflit de disponibilité bloquant
                  </span>
                </div>
                <h3 className="text-base font-black text-rose-950 dark:text-rose-100 mt-1">
                  Créneau déjà réservé et confirmé par un autre événement
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 leading-relaxed">
                  La salle <strong className="underline">{draft.venue_name || "Salle principale"}</strong> est déjà occupée sur ce créneau par la réservation confirmée <strong className="underline">{conflictedWithEvent.public_reference}</strong> ({conflictedWithEvent.event_name || "Événement"} — {conflictedWithEvent.customer_display_name}). Ce devis ne peut pas être confirmé en l'état.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setConflictModalTarget(toConflictTarget(draft, conflictedWithEvent.public_reference, conflictedWithEvent.event_name));
                  setConflictModalTab("reschedule");
                  setShowConflictModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
              >
                <i className="fa-solid fa-arrows-rotate"></i>
                Relocaliser / Reporter la date
              </button>
              <button
                type="button"
                onClick={() => {
                  setConflictModalTarget(toConflictTarget(draft, conflictedWithEvent.public_reference, conflictedWithEvent.event_name));
                  setConflictModalTab("waitlist");
                  setShowConflictModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs transition"
              >
                <i className="fa-regular fa-clock text-amber-500"></i>
                Mettre en attente
              </button>
              <button
                type="button"
                onClick={() => {
                  setConflictModalTarget(toConflictTarget(draft, conflictedWithEvent.public_reference, conflictedWithEvent.event_name));
                  setConflictModalTab("cancel");
                  setShowConflictModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-rose-50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 shadow-2xs transition"
              >
                <i className="fa-solid fa-trash-can text-rose-500"></i>
                Supprimer le devis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Competing Drafts Info Banner (for confirmed event with competing drafts) ── */}
      {competingDrafts.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-md shrink-0">
              <i className="fa-solid fa-circle-exclamation"></i>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                  {competingDrafts.length} Devis concurrent(s) non confirmés
                </span>
              </div>
              <h3 className="text-sm font-black text-amber-950 dark:text-amber-100 mt-1">
                Dossiers / Devis concurrents enregistrés sur ce créneau
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                Cet événement est confirmé ferme sur la salle <strong className="underline">{draft.venue_name || "Salle principale"}</strong>. Les options suivantes sont bloquées en conflit et peuvent être arbitrées (relocalisation, attente ou annulation) :
              </p>

              <div className="mt-3 space-y-2">
                {competingDrafts.map((comp) => (
                  <div key={comp.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {comp.public_reference} — {comp.event_name || "Devis"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 font-semibold">
                          Option en conflit
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Client : <strong className="text-slate-700 dark:text-slate-300">{comp.customer_display_name}</strong> • Créneau : {formatDateFr(comp.start_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConflictModalTarget(toConflictTarget(comp, draft.public_reference, draft.event_name));
                          setConflictModalTab("reschedule");
                          setShowConflictModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition"
                      >
                        <i className="fa-solid fa-bolt text-[11px]"></i>
                        Arbitrer / Relocaliser
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate("hahitantsoa-draft-detail", comp.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition"
                      >
                        Voir dossier <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
            {effectiveSchedule && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Deposit */}
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-700">1. Acompte Signature</span>
                      {confirmedDepositAmount >= Number(effectiveSchedule.deposit_amount) ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Réglé</span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">En cours</span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(effectiveSchedule.deposit_amount)}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">À la réservation</span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((confirmedDepositAmount / (Number(effectiveSchedule.deposit_amount) || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Payé : {formatMoney(confirmedDepositAmount)}</span>
                  </div>
                </div>

                {/* 2. 1st Installment */}
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-indigo-700 block">2. 1ère Tranche (M-1)</span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(effectiveSchedule.first_installment_amount)}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Échéance : {formatDateFr(effectiveSchedule.first_installment_due_on)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((Math.max(totalPaidAmount - confirmedDepositAmount, 0) / (Number(effectiveSchedule.first_installment_amount) || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Payé : {formatMoney(Math.min(Math.max(totalPaidAmount - confirmedDepositAmount, 0), Number(effectiveSchedule.first_installment_amount)))}</span>
                  </div>
                </div>

                {/* 3. 2nd Installment */}
                <div className="rounded-xl border border-indigo-100 bg-white/90 p-3 text-xs flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-indigo-700 block">3. Solde (J-10)</span>
                    <p className="text-sm font-black text-slate-900 mt-0.5">{formatMoney(effectiveSchedule.second_installment_amount)}</p>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Échéance : {formatDateFr(effectiveSchedule.second_installment_due_on)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min((Math.max(totalPaidAmount - confirmedDepositAmount - Number(effectiveSchedule.first_installment_amount), 0) / (Number(effectiveSchedule.second_installment_amount) || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">Payé : {formatMoney(Math.max(totalPaidAmount - confirmedDepositAmount - Number(effectiveSchedule.first_installment_amount), 0))}</span>
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
              <p className="mt-0.5 whitespace-pre-line">{draft.service_notes}</p>
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
                      onClick={() => void openAmendmentModal()}
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
      {showPaymentModal && draft && (
        <PaymentRegistrationModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          domain="hahitantsoa"
          draftId={param || draft.id}
          draftReference={draft.public_reference || `HAH-${draft.id.slice(0, 8)}`}
          proformaReference={draft.public_reference}
          customerName={draft.customer_display_name || customer?.display_name || "Client"}
          customerPhone={customer?.phone}
          customerAddress={customer?.address}
          eventDateLabel={draft.start_at ? formatDateFr(draft.start_at) : undefined}
          totalAmount={totalDossierAmount}
          paidAmount={totalPaidAmount}
          requiredDepositAmount={requiredDepositAmount}
          cautionAmount={0}
          existingPayments={payments.map((p) => ({
            id: p.id,
            date: p.paid_at || p.created_at,
            method: p.payment_method,
            amount: Number(p.amount),
            note: p.notes || p.payment_kind,
            reference: p.external_reference || undefined,
            receipt_document: p.receipt_document,
            payment_status: p.payment_status,
            payment_kind: p.payment_kind,
          }))}
          onPaymentRecorded={async () => {
            await load();
            setActionNotice("Versement enregistré et confirmé avec succès.");
          }}
          initialAmount={depositAmount || undefined}
          initialPaymentKind={paymentKindSelection}
        />
      )}

      {/* ── Complete 5-Step Amendment Studio Modal ───────────────────────── */}
      {showAmendmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
                  </span>
                  Studio d'Avenant Événementiel
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dossier <strong className="text-slate-700">{draft.public_reference}</strong> · {draft.event_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAmendmentModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Fermer le studio d'avenant"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-5 gap-2 border-b border-slate-100 pb-4 shrink-0">
              {[
                { step: 1, label: "1. Motif & Traçabilité", icon: "fa-file-lines" },
                { step: 2, label: "2. Dates & Formules", icon: "fa-calendar-days" },
                { step: 3, label: "3. Espaces & Services", icon: "fa-map-location-dot" },
                { step: 4, label: "4. Matériel & Articles", icon: "fa-boxes-stacked" },
                { step: 5, label: "5. Bilan & Validation", icon: "fa-scale-balanced" },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setAmendmentStep(s.step as 1 | 2 | 3 | 4 | 5)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl text-center transition-all ${
                    amendmentStep === s.step
                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                      : amendmentStep > s.step
                        ? "bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100"
                        : "bg-slate-50 text-slate-400 font-medium hover:bg-slate-100 hover:text-slate-600"
                  }`}
                >
                  <i className={`fa-solid ${s.icon} text-sm`}></i>
                  <span className="text-[11px] truncate w-full">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Step Body (Scrollable) */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-4">
              {/* ── STEP 1: Motif & Justification ───────────────────────────── */}
              {amendmentStep === 1 && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs text-indigo-900 flex items-start gap-3">
                    <i className="fa-solid fa-shield-halved text-indigo-600 text-base mt-0.5"></i>
                    <div>
                      <p className="font-bold">Traçabilité légale & conformité contractuelle</p>
                      <p className="text-slate-600 mt-0.5">
                        Cet avenant générera un acte officiel d'avenant horodaté venant amender le contrat initial. Indiquez avec précision le motif et le contexte de la demande.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Motif de l'avenant *
                      <input
                        type="text"
                        required
                        value={amendmentReason}
                        onChange={(e) => setAmendmentReason(e.target.value)}
                        placeholder="Ex: Rajout de 50 chaises et extension soirée jusqu'à minuit"
                        className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Précisions / Justification opérationnelle
                      <textarea
                        rows={3}
                        value={amendmentNotes}
                        onChange={(e) => setAmendmentNotes(e.target.value)}
                        placeholder="Détaillez les accords convenus avec le client ou les contraintes logistiques..."
                        className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Dates, Horaires, Formules & Convives ─────────────── */}
              {amendmentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Date & Heure Début (Installation)
                        <input
                          type="datetime-local"
                          value={amendmentStartAt}
                          onChange={(e) => setAmendmentStartAt(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium"
                        />
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Date & Heure Fin (Fin Prestation)
                        <input
                          type="datetime-local"
                          value={amendmentEndAt}
                          onChange={(e) => setAmendmentEndAt(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Formule & Option Nocturne */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                      Formule & Option Nocturne
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div
                        onClick={() => setAmendmentNightOption("day")}
                        className={`cursor-pointer rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                          amendmentNightOption === "day"
                            ? "border-amber-400 bg-amber-50/70 shadow-xs ring-1 ring-amber-400"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            ☀️ Fête de Jour
                          </span>
                          {amendmentNightOption === "day" && (
                            <i className="fa-solid fa-circle-check text-amber-600"></i>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Jusqu'à 18h00 / Standard</p>
                        <span className="text-xs font-bold text-slate-700 mt-2">Tarif de base</span>
                      </div>

                      <div
                        onClick={() => setAmendmentNightOption("night_opt1")}
                        className={`cursor-pointer rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                          amendmentNightOption === "night_opt1"
                            ? "border-indigo-500 bg-indigo-50/70 shadow-xs ring-1 ring-indigo-500"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                            🌙 Nuit Option 1
                          </span>
                          {amendmentNightOption === "night_opt1" && (
                            <i className="fa-solid fa-circle-check text-indigo-600"></i>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Jusqu'à minuit (00h00)</p>
                        <span className="text-xs font-bold text-indigo-600 mt-2">+ 250 000 Ar</span>
                      </div>

                      <div
                        onClick={() => setAmendmentNightOption("night_opt2")}
                        className={`cursor-pointer rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                          amendmentNightOption === "night_opt2"
                            ? "border-purple-500 bg-purple-50/70 shadow-xs ring-1 ring-purple-500"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-950 text-sm flex items-center gap-1.5">
                            🌌 Nuit Option 2
                          </span>
                          {amendmentNightOption === "night_opt2" && (
                            <i className="fa-solid fa-circle-check text-purple-600"></i>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Jusqu'à 05h00 du matin</p>
                        <span className="text-xs font-bold text-purple-600 mt-2">+ 500 000 Ar</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Type d'événement
                        <select
                          value={amendmentEventType}
                          onChange={(e) => setAmendmentEventType(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium"
                        >
                          <option value="wedding">Mariage</option>
                          <option value="engagement">Fiançailles / Vodiadidy</option>
                          <option value="civil_wedding">Mariage civil</option>
                          <option value="birthday">Anniversaire / Fête de famille</option>
                          <option value="corporate">Séminaire / Entreprise</option>
                          <option value="other">Autre événement</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Type de location
                        <select
                          value={amendmentRentalType}
                          onChange={(e) => setAmendmentRentalType(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium"
                        >
                          <option value="bare">Location nue</option>
                          <option value="logistics">Avec logistique / installation</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase">
                        Nombre de convives
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="number"
                            min="10"
                            step="10"
                            value={amendmentGuestCount}
                            onChange={(e) => setAmendmentGuestCount(Math.max(1, Number(e.target.value)))}
                            className="block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-center"
                          />
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Tarif Location Espace de Base (Ar)
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={amendmentSpaceRentalAmount}
                        onChange={(e) => setAmendmentSpaceRentalAmount(Math.max(0, Number(e.target.value)))}
                        className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold"
                      />
                    </label>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Hors supplément nocturne éventuel ({formatMoney(amendmentNightOption === "night_opt1" ? 250000 : amendmentNightOption === "night_opt2" ? 500000 : 0)}).
                    </span>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Espaces & Services ──────────────────────────────── */}
              {amendmentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Lieu / Espace principal
                      <input
                        type="text"
                        value={amendmentVenueName}
                        onChange={(e) => setAmendmentVenueName(e.target.value)}
                        placeholder="Ex: Grande Salle Hahitantsoa & Pelouse"
                        className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Détails d'implantation & Accès
                      <input
                        type="text"
                        value={amendmentLocationDetails}
                        onChange={(e) => setAmendmentLocationDetails(e.target.value)}
                        placeholder="Ex: Chapiteau côté piscine, buffet salle haute"
                        className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                      Prestations & Services Événementiels
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { key: "sono", label: "Sonorisation & DJ", icon: "fa-music" },
                        { key: "menage", label: "Ménage & Nettoyage", icon: "fa-broom" },
                        { key: "security", label: "Sécurité & Gardiennage", icon: "fa-shield-halved" },
                        { key: "traiteur", label: "Espace Traiteur", icon: "fa-utensils" },
                        { key: "groupe_elec", label: "Groupe électrogène", icon: "fa-bolt" },
                        { key: "deco", label: "Décoration florale", icon: "fa-seedling" },
                      ].map((srv) => {
                        const active = Boolean(amendmentSelectedServices[srv.key]);
                        return (
                          <button
                            key={srv.key}
                            type="button"
                            onClick={() =>
                              setAmendmentSelectedServices({
                                ...amendmentSelectedServices,
                                [srv.key]: !active,
                              })
                            }
                            className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold text-left transition-all ${
                              active
                                ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <span
                              className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs ${
                                active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              <i className={`fa-solid ${srv.icon}`}></i>
                            </span>
                            <span className="flex-1 truncate">{srv.label}</span>
                            {active && <i className="fa-solid fa-check text-indigo-600 text-xs"></i>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Consignes particulières pour les services
                      <textarea
                        rows={2}
                        value={amendmentServiceNotes}
                        onChange={(e) => setAmendmentServiceNotes(e.target.value)}
                        placeholder="Ex: Branchements spécifiques sonorisation 380V..."
                        className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-medium"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Matériel & Articles du Catalogue ─────────────────── */}
              {amendmentStep === 4 && (
                <div className="space-y-4">
                  {/* Existing lines */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase block mb-2">
                      Articles actuels dans le dossier :
                    </span>
                    <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white">
                      {draft.lines.map((line) => {
                        const currentQty =
                          amendmentQuantities[line.id] !== undefined
                            ? amendmentQuantities[line.id]
                            : line.quantity;
                        const unitP = Number(
                          line.unit_rental_price ||
                            (line.total_price && line.quantity
                              ? Number(line.total_price) / line.quantity
                              : 0) ||
                            5000,
                        );
                        return (
                          <div
                            key={line.id}
                            className="flex items-center justify-between p-3 text-xs gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                  {line.inventory_item_name}
                                </span>
                                {itemKindBadge(line.inventory_item_kind)}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {formatMoney(unitP)} / unité · Total: {formatMoney(currentQty * unitP)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setAmendmentQuantities({
                                    ...amendmentQuantities,
                                    [line.id]: Math.max(0, currentQty - 1),
                                  })
                                }
                                className="h-7 w-7 rounded-lg border border-slate-300 bg-slate-50 font-bold hover:bg-slate-100 flex items-center justify-center text-slate-700"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={currentQty}
                                onChange={(e) =>
                                  setAmendmentQuantities({
                                    ...amendmentQuantities,
                                    [line.id]: Math.max(0, Number(e.target.value)),
                                  })
                                }
                                className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-center font-bold text-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setAmendmentQuantities({
                                    ...amendmentQuantities,
                                    [line.id]: currentQty + 1,
                                  })
                                }
                                className="h-7 w-7 rounded-lg border border-slate-300 bg-slate-50 font-bold hover:bg-slate-100 flex items-center justify-center text-slate-700"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Added new lines from catalog */}
                  <div>
                    <span className="text-xs font-bold text-slate-700 uppercase block mb-2">
                      Ajouter de nouveaux articles du catalogue :
                    </span>
                    <div className="relative mb-3">
                      <input
                        type="text"
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        placeholder="Rechercher par nom d'article, table, chaise, tente, déco..."
                        className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <i className="fa-solid fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                    </div>

                    {filteredCatalogItems.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-3">
                        {filteredCatalogItems.map((catItem) => {
                          const alreadyInDraft = draft.lines.some(
                            (l) => l.inventory_item_id === catItem.id,
                          );
                          const alreadyAdded = amendmentAddedLines.some(
                            (l) => l.inventory_item_id === catItem.id,
                          );
                          return (
                            <div
                              key={catItem.id}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs gap-2"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">{catItem.name}</p>
                                <span className="text-[10px] text-slate-400">
                                  {formatMoney(catItem.rental_price || 5000)} / unité
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={alreadyInDraft || alreadyAdded}
                                onClick={() => {
                                  setAmendmentAddedLines([
                                    ...amendmentAddedLines,
                                    {
                                      inventory_item_id: catItem.id,
                                      inventory_item_name: catItem.name,
                                      inventory_item_kind: catItem.kind,
                                      quantity: 1,
                                      unit_rental_price: Number(catItem.rental_price || 5000),
                                      notes: "",
                                    },
                                  ]);
                                }}
                                className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-50"
                              >
                                {alreadyInDraft || alreadyAdded ? "Déjà inclus" : "+ Ajouter"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {amendmentAddedLines.length > 0 && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                        <span className="text-xs font-bold text-emerald-800 uppercase block">
                          Nouveaux articles ajoutés via cet avenant :
                        </span>
                        {amendmentAddedLines.map((line, idx) => (
                          <div
                            key={line.inventory_item_id}
                            className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-200 text-xs gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 truncate">{line.inventory_item_name}</p>
                              <span className="text-[10px] text-slate-500">
                                {formatMoney(line.unit_rental_price)} · Total: {formatMoney(line.quantity * line.unit_rental_price)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) => {
                                  const val = Math.max(1, Number(e.target.value));
                                  const updated = [...amendmentAddedLines];
                                  updated[idx].quantity = val;
                                  setAmendmentAddedLines(updated);
                                }}
                                className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-center font-bold"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setAmendmentAddedLines(
                                    amendmentAddedLines.filter((_, i) => i !== idx),
                                  );
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1"
                              >
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── STEP 5: Bilan Financier & Confirmation ──────────────────── */}
              {amendmentStep === 5 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                      <span>Bilan Comparatif Financier (Avant / Après)</span>
                      <span className="text-indigo-600 font-mono">Dossier {draft.public_reference}</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-white p-3 border border-slate-200">
                        <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                          Espace & Formule Nocturne
                        </span>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-slate-500 line-through">
                            {formatMoney(amendmentFinancialPreview.oldSpace)}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {formatMoney(amendmentFinancialPreview.newSpace)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-3 border border-slate-200">
                        <span className="text-slate-400 font-semibold block uppercase text-[10px]">
                          Matériels & Articles
                        </span>
                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-slate-500 line-through">
                            {formatMoney(amendmentFinancialPreview.oldLinesTotal)}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {formatMoney(amendmentFinancialPreview.newLinesTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-indigo-900 text-white p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-300 uppercase block">
                          Nouveau Total Dossier TTC
                        </span>
                        <span className="text-lg font-black">{formatMoney(amendmentFinancialPreview.newTotal)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase block">
                          Impact Financier (Delta)
                        </span>
                        <span
                          className={`text-sm font-black px-2.5 py-0.5 rounded-full ${
                            amendmentFinancialPreview.delta > 0
                              ? "bg-emerald-500 text-white"
                              : amendmentFinancialPreview.delta < 0
                                ? "bg-amber-400 text-amber-950"
                                : "bg-slate-700 text-slate-200"
                          }`}
                        >
                          {amendmentFinancialPreview.delta > 0
                            ? `+ ${formatMoney(amendmentFinancialPreview.delta)}`
                            : amendmentFinancialPreview.delta < 0
                              ? `- ${formatMoney(Math.abs(amendmentFinancialPreview.delta))}`
                              : "0 Ar (Inchangé)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3 bg-white flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="autoApply"
                      checked={autoApplyAmendment}
                      onChange={(e) => setAutoApplyAmendment(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="autoApply" className="text-xs text-slate-700 cursor-pointer">
                      <strong className="block text-slate-900">Appliquer directement l'avenant</strong>
                      Mettre à jour immédiatement les lignes, tarifs et générer l'acte d'avenant contractuel.
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
              <span className="text-xs text-slate-400 font-medium">
                Étape {amendmentStep} sur 5
              </span>

              <div className="flex items-center gap-2">
                {amendmentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setAmendmentStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    ← Précédent
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowAmendmentModal(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>

                {amendmentStep < 5 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (amendmentStep === 1 && !amendmentReason.trim()) {
                        setError("Le motif de l'avenant est obligatoire.");
                        return;
                      }
                      setError(null);
                      setAmendmentStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5);
                    }}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
                  >
                    Suivant →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => void submitAmendment(e)}
                    disabled={busy !== null}
                    className="rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {busy === "amendment" ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin"></i> Traitement...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-check"></i> Valider et Créer l'Avenant
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Conflict Arbitration & Rescheduling Modal ────────────────────── */}
      <DraftConflictResolutionModal
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        event={conflictModalTarget}
        initialTab={conflictModalTab}
        onResolved={load}
      />
    </div>
  );
}
