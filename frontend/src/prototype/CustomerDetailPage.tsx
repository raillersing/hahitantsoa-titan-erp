import React, { useEffect, useRef, useState } from "react";
import {
  ApiError,
  convertProspectToClient,
  deleteAttachment,
  deleteCustomer,
  downloadAttachment,
  getCustomer,
  getCustomerAttachments,
  getCustomerTimeline,
  transitionProspectStatus,
  updateCustomer,
  uploadAttachment,
} from "../api";
import type { Customer as ApiCustomer, UploadedAttachment, CommercialTimelineEvent } from "../types";
import { ProspectConversionAssistant } from "./ProspectConversionAssistant";
type Client = {
  id: string; reference?: string; initials: string; name: string; email: string; phone: string;
  type: "Particulier" | "Entreprise"; status: "Client" | "Prospect";
  colorClass: string; address?: string; notes?: string;
  prospectStatus?: string;
  prospectStatusChangedAt?: string | null;
  prospectStatusReason?: string;
  prospectNextFollowUp?: string | null;
  idType?: string; idNumber?: string; idIssueDate?: string; idIssuePlace?: string;
  idDuplicataDate?: string; idDuplicataPlace?: string; birthDate?: string;
  nif?: string; stat?: string; rcs?: string; repFirstName?: string; repRole?: string;
};
type ReservationSummary = { id: string; title: string; date: string; amount: number | null; status: string; type: string };
type CommercialHistorySummary = {
  reservations: ReservationSummary[];
  agendaEvents: CommercialTimelineEvent[];
  documentCount: number;
  invoiceCount: number;
  paymentCount: number;
  logisticsCount: number;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
};
type PendingAttachment = { id: string; file: File; category: string };
type AttachmentPreview = {
  attachment: UploadedAttachment;
  url: string | null;
  kind: "image" | "pdf" | "unsupported";
};
interface CustomerDetailPageProps {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
  onBack?: () => void;
  returnContext?: { from: string; param?: string } | null;
  canSensitiveWrite?: boolean;
}

function metadataRecord(event: CommercialTimelineEvent): Record<string, unknown> {
  return event.metadata && typeof event.metadata === "object" ? event.metadata : {};
}

function metadataString(event: CommercialTimelineEvent, key: string): string | null {
  const value = metadataRecord(event)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metadataAmount(event: CommercialTimelineEvent): number {
  const value = metadataRecord(event).amount;
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(amount) ? amount : 0;
}

function metadataAmountOrNull(event: CommercialTimelineEvent): number | null {
  const value = metadataRecord(event).amount;
  if (value === undefined || value === null || value === "") return null;
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(amount) ? amount : null;
}

function summarizeCommercialTimeline(events: CommercialTimelineEvent[]): CommercialHistorySummary {
  const reservations = events
    .filter((event) => event.type === "reservation")
    .map((event) => {
      const reservationId = metadataString(event, "reservation_draft_id") ?? metadataString(event, "public_reference") ?? event.title;
      const scope = metadataString(event, "business_scope");
      return {
        id: reservationId,
        title: event.title,
        date: metadataString(event, "start_at") ?? event.date,
        amount: metadataAmountOrNull(event),
        status: metadataString(event, "status") ?? "Non précisé",
        type: scope === "hahitantsoa" ? "Hahitantsoa" : scope === "titan" ? "Titan" : "Non précisé",
      };
    });
  const invoiceEvents = events.filter((event) => event.type === "invoice");
  const paymentEvents = events.filter((event) => event.type === "payment");
  const totalBilled = invoiceEvents.reduce((total, event) => total + metadataAmount(event), 0);
  const totalPaid = paymentEvents.reduce((total, event) => {
    const status = metadataString(event, "status");
    return status === "confirmed" || status === "reconciled" ? total + metadataAmount(event) : total;
  }, 0);

  return {
    reservations,
    agendaEvents: events.filter((event) => ["follow_up", "visit", "visit_reminder"].includes(event.type)),
    documentCount: events.filter((event) => event.type === "proforma").length,
    invoiceCount: invoiceEvents.length,
    paymentCount: paymentEvents.length,
    logisticsCount: events.filter((event) => event.type === "logistics").length,
    totalBilled,
    totalPaid,
    totalDue: Math.max(totalBilled - totalPaid, 0),
  };
}

export default function CustomerDetailPage({ onNavigate, param, onBack, returnContext, canSensitiveWrite = false }: CustomerDetailPageProps) {
  const clientId = param || "CUST-001";
  const emptyClient: Client = { id: clientId, initials: "…", name: "", email: "", phone: "", type: "Particulier", status: "Client", colorClass: "bg-slate-100 text-slate-600" };
  const [client, setClient] = useState<Client>(emptyClient);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [attachmentCategory, setAttachmentCategory] = useState("CIN");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentActionError, setAttachmentActionError] = useState<string | null>(null);
  const [previewingAttachmentId, setPreviewingAttachmentId] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [attachmentPreviewError, setAttachmentPreviewError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const attachmentPreviewCloseRef = useRef<HTMLButtonElement>(null);
  const attachmentPreviewTriggerRef = useRef<HTMLButtonElement>(null);
  const attachmentPreviewRequestRef = useRef<AbortController | null>(null);
  const [showConversionAssistant, setShowConversionAssistant] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<CommercialTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const commercialHistory = summarizeCommercialTimeline(timelineEvents);
  const { reservations, totalBilled, totalPaid, totalDue } = commercialHistory;

  const mapApiCustomer = (customer: ApiCustomer): Client => ({
    id: customer.id,
    reference: customer.public_reference,
    initials: customer.display_name.slice(0, 2).toUpperCase(),
    name: customer.display_name,
    email: customer.email,
    phone: customer.phone,
    type: customer.party_type === "company" ? "Entreprise" : "Particulier",
    status: customer.lifecycle_status === "prospect" ? "Prospect" : "Client",
    colorClass: customer.lifecycle_status === "prospect" ? "bg-blue-100 text-blue-700" : customer.party_type === "company" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700",
    address: customer.address,
    notes: customer.notes,
    prospectStatus: customer.prospect_status,
    prospectStatusChangedAt: customer.prospect_status_changed_at,
    prospectStatusReason: customer.prospect_status_reason,
    prospectNextFollowUp: customer.prospect_next_follow_up,
    idType: customer.id_type,
    idNumber: customer.id_number,
    idIssueDate: customer.id_issue_date || "",
    idIssuePlace: customer.id_issue_place,
    idDuplicataDate: customer.id_duplicata_date || "",
    idDuplicataPlace: customer.id_duplicata_place,
    birthDate: customer.birth_date || "",
    nif: customer.nif,
    stat: customer.stat,
    rcs: customer.rcs,
    repFirstName: customer.representative_name,
    repRole: customer.representative_role,
  });

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    void getCustomer(clientId, controller.signal).then((customer) => {
      setClient(mapApiCustomer(customer));
    }).catch((error: unknown) => {
      if ((error as { name?: string }).name === "AbortError") return;
      if (error instanceof ApiError && error.status === 404) setLoadError("Cette fiche client est introuvable.");
      else if (error instanceof ApiError && error.status === 403) setLoadError("Vous n’avez pas accès à cette fiche client.");
      else if (error instanceof ApiError && error.status === 401) setLoadError("Votre session a expiré. Reconnectez-vous puis réessayez.");
      else setLoadError("Impossible de charger cette fiche client. Vérifiez votre connexion puis réessayez.");
    }).finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [clientId, retryKey]);

  useEffect(() => {
    const controller = new AbortController();
    setTimelineLoading(true);
    setTimelineError(null);
    void getCustomerTimeline(clientId, controller.signal).then((data) => {
      setTimelineEvents(data);
    }).catch((error: unknown) => {
      if ((error as { name?: string }).name === "AbortError") return;
      setTimelineError("Impossible de charger la chronologie commerciale.");
    }).finally(() => setTimelineLoading(false));
    return () => controller.abort();
  }, [clientId, retryKey]);

  useEffect(() => {
    const controller = new AbortController();
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    void getCustomerAttachments(clientId, controller.signal).then(setAttachments).catch((error: unknown) => {
      if ((error as { name?: string }).name === "AbortError") return;
      setAttachmentsError("Impossible de charger les pièces jointes. Réessayez.");
    }).finally(() => setAttachmentsLoading(false));
    return () => controller.abort();
  }, [clientId, retryKey]);

  useEffect(() => {
    if (previewingAttachmentId || attachmentPreview || attachmentPreviewError) {
      attachmentPreviewCloseRef.current?.focus();
    }
  }, [previewingAttachmentId, attachmentPreview, attachmentPreviewError]);

  const [editFeedback, setEditFeedback] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const handleCustomerDelete = async () => {
    if (!canSensitiveWrite || deletePending) return;
    if (!window.confirm(`Supprimer la fiche client « ${client.name} » ?`)) return;
    setDeletePending(true);
    setEditFeedback(null);
    try {
      await deleteCustomer(client.id);
      onNavigate("customers");
    } catch (error: unknown) {
      setEditFeedback(error instanceof ApiError && error.status === 403
        ? "Vous n’êtes pas autorisé à supprimer cette fiche client."
        : error instanceof Error ? error.message : "La suppression a échoué.");
    } finally {
      setDeletePending(false);
    }
  };

  const handleSave = async () => {
    if (!canSensitiveWrite || isSaving) return;
    setIsSaving(true);
    setEditFeedback(null);
    try {
      const updated = await updateCustomer(client.id, {
        display_name: client.name.trim(),
        email: client.email,
        phone: client.phone,
        address: client.address,
        id_type: client.idType,
        id_number: client.idNumber,
        id_issue_date: client.idIssueDate || null,
        id_issue_place: client.idIssuePlace,
        id_duplicata_date: client.idDuplicataDate || null,
        id_duplicata_place: client.idDuplicataPlace,
        birth_date: client.birthDate || null,
        nif: client.nif,
        stat: client.stat,
        rcs: client.rcs,
        representative_name: client.repFirstName,
        representative_role: client.repRole,
        notes: client.notes,
      });
      setClient(mapApiCustomer(updated));
      setIsEditing(false);
      setEditFeedback("Modifications enregistrées.");
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403) setEditFeedback("Vous n’êtes pas autorisé à modifier cette fiche.");
      else if (error instanceof ApiError && error.status === 404) setEditFeedback("Cette fiche client est introuvable.");
      else setEditFeedback("La modification n’a pas pu être enregistrée. Réessayez.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleAttachmentSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !canSensitiveWrite || uploadingAttachment) return;
    setAttachmentActionError(null);
    setPendingAttachments((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, category: attachmentCategory })),
    ]);
  };

  const handleSaveAttachments = async () => {
    if (!canSensitiveWrite || uploadingAttachment || pendingAttachments.length === 0) return;
    setUploadingAttachment(true);
    setAttachmentActionError(null);
    const uploaded: UploadedAttachment[] = [];
    try {
      for (const pending of pendingAttachments) {
        uploaded.push(await uploadAttachment(pending.file, pending.category, { customerId: clientId }));
      }
      setAttachments((current) => [...uploaded.reverse(), ...current]);
      setPendingAttachments([]);
    } catch (error: unknown) {
      setAttachmentActionError(error instanceof ApiError ? error.message : "Une ou plusieurs pièces jointes n’ont pas pu être enregistrées. Vérifiez la liste et réessayez.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAttachmentDownload = async (attachment: UploadedAttachment) => {
    setAttachmentActionError(null);
    try {
      const blob = await downloadAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setAttachmentActionError(error instanceof ApiError ? error.message : "Le téléchargement a échoué.");
    }
  };

  const closeAttachmentPreview = () => {
    attachmentPreviewRequestRef.current?.abort();
    attachmentPreviewRequestRef.current = null;
    if (attachmentPreview?.url) URL.revokeObjectURL(attachmentPreview.url);
    setPreviewingAttachmentId(null);
    setAttachmentPreview(null);
    setAttachmentPreviewError(null);
    attachmentPreviewTriggerRef.current?.focus();
  };

  const handleAttachmentPreview = async (
    attachment: UploadedAttachment,
    trigger: HTMLButtonElement,
  ) => {
    attachmentPreviewRequestRef.current?.abort();
    if (attachmentPreview?.url) URL.revokeObjectURL(attachmentPreview.url);
    const controller = new AbortController();
    attachmentPreviewRequestRef.current = controller;
    attachmentPreviewTriggerRef.current = trigger;
    setPreviewingAttachmentId(attachment.id);
    setAttachmentPreview({ attachment, url: null, kind: "unsupported" });
    setAttachmentPreviewError(null);
    try {
      const blob = await downloadAttachment(attachment.id, controller.signal);
      if (controller.signal.aborted) return;
      const contentType = (blob.type || attachment.content_type).toLowerCase();
      const kind = contentType === "application/pdf"
        ? "pdf"
        : contentType.startsWith("image/")
          ? "image"
          : "unsupported";
      const url = kind === "unsupported" ? null : URL.createObjectURL(blob);
      setAttachmentPreview({ attachment, url, kind });
    } catch (error: unknown) {
      if ((error as { name?: string }).name === "AbortError") return;
      setAttachmentPreviewError(error instanceof ApiError ? error.message : "L’aperçu n’a pas pu être chargé.");
    } finally {
      if (attachmentPreviewRequestRef.current === controller) {
        attachmentPreviewRequestRef.current = null;
        setPreviewingAttachmentId(null);
      }
    }
  };

  const handleAttachmentDelete = async (attachment: UploadedAttachment) => {
    if (!canSensitiveWrite) return;
    if (!window.confirm(`Supprimer la pièce jointe « ${attachment.original_name} » ?`)) return;
    setAttachmentActionError(null);
    try {
      await deleteAttachment(attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    } catch (error: unknown) {
      setAttachmentActionError(error instanceof ApiError ? error.message : "La suppression a échoué.");
    }
  };


  let reqType = "Non spécifiée";
  let reqVolet = "Indéfini";
  let reqDate = "Aucune";
  if (client.status === 'Prospect' && client.notes && client.notes.startsWith('Demande :')) {
    const lines = client.notes.split('\n');
    reqType = lines[0]?.split(': ')[1] || reqType;
    reqVolet = lines[1]?.split(': ')[1] || reqVolet;
    reqDate = lines[2]?.split(': ')[1] || reqDate;
  }
  const linkedProforma = reservations.find((reservation) => reservation.status === "Proforma");

  if (isLoading) {
    return <div className="page active max-w-7xl mx-auto"><div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Chargement de la fiche client…</div></div>;
  }
  if (loadError) {
    return <div className="page active max-w-7xl mx-auto"><div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between"><span>{loadError}</span><button className="underline font-semibold" onClick={() => setRetryKey((value) => value + 1)}>Réessayer</button></div></div>;
  }

  return (
    <div className="page active space-y-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onBack ? onBack() : onNavigate("customers")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Retour">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Fiche {client.status === 'Prospect' ? 'prospect' : 'client'} — {client.name}</h2>
            <p className="text-sm text-slate-500">Détails, historique et documents liés</p>
          </div>
        </div>
      </div>

      {client.status === 'Prospect' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <i className="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
          <div>
            <h4 className="font-semibold text-blue-800 text-sm">Prospect : ce contact a demandé un tarif, une disponibilité ou une visite, mais n'a pas encore confirmé de réservation.</h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Demande actuelle : {reqType}</li>
              <li>• Volet d'intérêt : Hahitantsoa / Indécis</li>
              <li>• Date souhaitée : Août 2026</li>
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne de gauche: Actions et Infos Rapides */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center text-center">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 ${client.colorClass}`}>
              {client.initials}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{client.name}</h3>

            <div className="flex items-center gap-2 mt-2 mb-6">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{client.type}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${client.status === 'Prospect' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{client.status}</span>
            </div>

            {client.status === 'Prospect' ? (
              <div className="w-full flex justify-center text-xs text-slate-500 italic mb-2">
                Conversion via Demande commerciale
              </div>
            ) : canSensitiveWrite ? (
              <>
                <button className="w-full px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 mb-2 transition-colors" onClick={() => onNavigate("reservation-new", client.id)}>
                  <i className="fa-solid fa-plus mr-2"></i> Nouvelle réservation
                </button>
                <button type="button" className="w-full px-4 py-2 border border-rose-200 text-rose-600 font-medium text-sm rounded-lg hover:bg-rose-50 transition-colors" disabled={deletePending} onClick={() => void handleCustomerDelete()}>
                  {deletePending ? "Suppression…" : "Supprimer la fiche client"}
                </button>
              </>
            ) : null}
          </div>

          {/* Pipeline Commercial compact (prospects uniquement) */}
          {client.status === 'Prospect' ? (
            <div className="space-y-4">
              {/* Statut actuel */}
              {client.prospectStatus && (
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      client.prospectStatus === 'new' ? 'bg-slate-100 text-slate-600' :
                      client.prospectStatus === 'contact_attempted' ? 'bg-orange-100 text-orange-700' :
                      client.prospectStatus === 'contacted' ? 'bg-blue-100 text-blue-700' :
                      client.prospectStatus === 'qualified' ? 'bg-indigo-100 text-indigo-700' :
                      client.prospectStatus === 'proforma_sent' ? 'bg-violet-100 text-violet-700' :
                      client.prospectStatus === 'to_recall' ? 'bg-yellow-100 text-yellow-700' :
                      client.prospectStatus === 'converted' ? 'bg-green-100 text-green-700' :
                      client.prospectStatus === 'disqualified' ? 'bg-red-100 text-red-700' :
                      client.prospectStatus === 'lost' ? 'bg-red-200 text-red-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {client.prospectStatus === 'new' ? 'Nouveau' :
                       client.prospectStatus === 'contact_attempted' ? 'Tentative de contact' :
                       client.prospectStatus === 'contacted' ? 'Contacté' :
                       client.prospectStatus === 'qualified' ? 'Qualifié' :
                       client.prospectStatus === 'proforma_sent' ? 'Proforma envoyée' :
                       client.prospectStatus === 'to_recall' ? 'À relancer' :
                       client.prospectStatus === 'converted' ? 'Converti' :
                       client.prospectStatus === 'disqualified' ? 'Non qualifié' :
                       client.prospectStatus === 'lost' ? 'Perdu' : client.prospectStatus}
                    </span>
                    {client.prospectStatusChangedAt && (
                      <span className="text-xs text-slate-400">Depuis {new Date(client.prospectStatusChangedAt).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                  {client.prospectStatusReason && (
                    <p className="text-sm text-slate-700 mb-3">{client.prospectStatusReason}</p>
                  )}

                  {/* Action recommandée */}
                  {client.prospectStatus && !['converted', 'lost', 'disqualified'].includes(client.prospectStatus) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <i className="fa-solid fa-lightbulb text-amber-600 text-xs"></i>
                        <span className="text-[10px] font-bold text-amber-800 uppercase">Action recommandée</span>
                      </div>
                      <p className="text-sm text-amber-700 font-medium">
                        {client.prospectStatus === 'new' ? 'Premier contact (appel/email)' :
                         client.prospectStatus === 'contact_attempted' ? 'Tenter un autre canal' :
                         client.prospectStatus === 'contacted' ? 'Qualifier le besoin et le budget' :
                         client.prospectStatus === 'qualified' ? 'Envoyer proforma personnalisée' :
                         client.prospectStatus === 'proforma_sent' ? 'Relancer après 3-5 jours' :
                         client.prospectStatus === 'to_recall' ? 'Relancer avec nouvelle offre' : 'Suivre le prospect'}
                      </p>
                      {client.prospectNextFollowUp && (
                        <span className="text-xs text-amber-600">Limite : {new Date(client.prospectNextFollowUp).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <i className="fa-solid fa-pen-to-square mr-2"></i> Modifier le statut
                  </button>
                </div>
              )}

              {/* Historique compact */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">Historique</h3>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5"></div>
                  <div>
                    <div className="text-sm text-slate-800">
                      <span className="font-semibold">{client.prospectStatus ? (client.prospectStatus === 'new' ? 'Nouveau' : client.prospectStatus === 'contact_attempted' ? 'Tentative de contact' : client.prospectStatus === 'contacted' ? 'Contacté' : client.prospectStatus === 'qualified' ? 'Qualifié' : client.prospectStatus === 'proforma_sent' ? 'Proforma envoyée' : client.prospectStatus === 'to_recall' ? 'À relancer' : client.prospectStatus === 'converted' ? 'Converti' : client.prospectStatus === 'disqualified' ? 'Non qualifié' : client.prospectStatus === 'lost' ? 'Perdu' : client.prospectStatus) : 'Nouveau'}</span>
                    </div>
                    <div className="text-xs text-slate-400">{client.prospectStatusChangedAt ? new Date(client.prospectStatusChangedAt).toLocaleDateString('fr-FR') : 'Date inconnue'}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Situation financière</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total facturé</span>
                  <span className="text-sm font-semibold text-slate-800">{totalBilled.toLocaleString('fr-FR')} Ar</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total payé</span>
                  <span className="text-sm font-semibold text-emerald-600">{totalPaid.toLocaleString('fr-FR')} Ar</span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800">Reste à payer</span>
                  <span className={`text-lg font-bold ${totalDue > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{totalDue.toLocaleString('fr-FR')} Ar</span>
                </div>
              </div>
            </div>
          )}

          {/* Pièces jointes client/prospect */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Pièces jointes</h3>
                <p className="mt-1 text-xs text-slate-500">Documents associés à cette fiche client. Enregistrement automatique dans le dossier {client.reference || "du client"}.</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="customer-attachment-category" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Type de document</label>
                <select
                  id="customer-attachment-category"
                  value={attachmentCategory}
                  onChange={(event) => setAttachmentCategory(event.target.value)}
                  disabled={!canSensitiveWrite || uploadingAttachment}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                >
                  <option value="CIN">CIN / Passeport</option>
                  <option value="Justificatif domicile">Justificatif domicile</option>
                  <option value="NIF">NIF</option>
                  <option value="STAT">STAT</option>
                  <option value="RCS">RCS</option>
                  <option value="Logo">Logo</option>
                  <option value="Autre">Autre</option>
                </select>
                </div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleAttachmentSelected}
                  className="sr-only"
                  aria-label="Sélectionner une pièce jointe"
                />
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={!canSensitiveWrite || uploadingAttachment}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <i className="fa-solid fa-plus" aria-hidden="true"></i>
                  Ajouter
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">Formats acceptés : PDF, JPG, PNG ou WEBP · 10 Mo maximum.</p>
            {pendingAttachments.length > 0 && (
              <div className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-indigo-900">{pendingAttachments.length} pièce(s) sélectionnée(s), non encore enregistrée(s)</p>
                  <button type="button" onClick={() => void handleSaveAttachments()} disabled={uploadingAttachment} className="min-h-11 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:bg-slate-400">
                    {uploadingAttachment ? "Enregistrement…" : "Enregistrer les pièces jointes"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1">
                  {pendingAttachments.map((pending) => (
                    <li key={pending.id} className="flex items-center justify-between gap-2 text-xs text-indigo-800">
                      <span className="truncate" title={pending.file.name}>{pending.file.name} · {pending.category}</span>
                      <button type="button" className="min-h-11 px-2 font-semibold underline" onClick={() => setPendingAttachments((current) => current.filter((item) => item.id !== pending.id))}>Retirer</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {uploadingAttachment && <p className="mb-3 text-xs text-indigo-600" role="status" aria-live="polite">Téléversement en cours…</p>}
            {(attachmentsError || attachmentActionError) && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                {attachmentsError || attachmentActionError}
                {attachmentsError && <button type="button" className="ml-2 font-semibold underline" onClick={() => setRetryKey((value) => value + 1)}>Réessayer</button>}
              </div>
            )}
            {attachmentsLoading ? (
              <p className="text-sm text-slate-500">Chargement des pièces jointes…</p>
            ) : attachments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                <p className="text-sm font-medium text-slate-700">Aucune pièce jointe enregistrée</p>
                <p className="mt-1 text-xs text-slate-500">Choisissez un type de document puis cliquez sur « Ajouter ».</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left text-sm font-medium text-indigo-700 hover:underline disabled:cursor-wait disabled:text-slate-500"
                        title={`Afficher un aperçu de ${attachment.original_name}`}
                        aria-label={`Afficher un aperçu de ${attachment.original_name}`}
                        aria-busy={previewingAttachmentId === attachment.id}
                        onClick={(event) => void handleAttachmentPreview(attachment, event.currentTarget)}
                      >
                        {attachment.original_name}
                      </button>
                      <p className="text-xs text-slate-500"><span className="font-medium text-slate-700">{attachment.category}</span> · {Math.ceil(attachment.size_bytes / 1024)} Ko</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" className="min-h-11 rounded-lg px-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:underline" onClick={() => void handleAttachmentDownload(attachment)}>Télécharger le fichier</button>
                      {canSensitiveWrite && <button type="button" className="min-h-11 rounded-lg px-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:underline" onClick={() => void handleAttachmentDelete(attachment)}>Supprimer</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Colonne de droite : Coordonnées, Historique, Agenda */}
        <div className="lg:col-span-2 space-y-6">
          {/* Coordonnées */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Coordonnées principales</h3>
              <div className="flex items-center gap-3">
                {isEditing && (
                  <button onClick={handleCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Annuler</button>
                )}
                <button onClick={() => isEditing ? void handleSave() : setIsEditing(true)} disabled={isSaving || (!isEditing && !canSensitiveWrite)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:text-slate-400">
                  {isSaving ? "Enregistrement…" : isEditing ? "Enregistrer" : canSensitiveWrite ? "Modifier" : "Modification non autorisée"}
                </button>
              </div>
            </div>
            {editFeedback && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">{editFeedback}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {client.type === "Particulier" ? (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nom complet</label>
                    {isEditing ? (
                      <input type="text" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                    {isEditing ? (
                      <input type="email" value={client.email} onChange={e => setClient({ ...client, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.email || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Téléphone</label>
                    {isEditing ? (
                      <input type="tel" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.phone}</div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Adresse</label>
                    {isEditing ? (
                      <input type="text" value={client.address || ""} onChange={e => setClient({ ...client, address: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Adresse du client" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.address || "Non renseignée"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CIN / Passeport</label>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select value={client.idType || "CIN"} onChange={e => setClient({ ...client, idType: e.target.value as any })} className="w-1/3 border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          <option value="CIN">CIN</option>
                          <option value="Passeport">Passeport</option>
                        </select>
                        <input type="text" value={client.idNumber || ""} onChange={e => setClient({ ...client, idNumber: e.target.value })} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Numéro" />
                      </div>
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">
                        {client.idNumber ? `${client.idType || "CIN"} ${client.idNumber}` : "Non renseigné"}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Délivré le</label>
                    {isEditing ? (
                      <input type="date" value={client.idIssueDate || ""} onChange={e => setClient({ ...client, idIssueDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.idIssueDate || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Délivré à</label>
                    {isEditing ? (
                      <input type="text" value={client.idIssuePlace || ""} onChange={e => setClient({ ...client, idIssuePlace: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.idIssuePlace || "Non renseigné"}</div>
                    )}
                  </div>
                  {(isEditing || client.idDuplicataDate || client.idDuplicataPlace) && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Duplicata du (Date)</label>
                        {isEditing ? (
                          <input type="date" value={client.idDuplicataDate || ""} onChange={e => setClient({ ...client, idDuplicataDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        ) : (
                          <div className="text-sm text-slate-800 font-medium">{client.idDuplicataDate || "Non renseigné"}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Duplicata à (Lieu)</label>
                        {isEditing ? (
                          <input type="text" value={client.idDuplicataPlace || ""} onChange={e => setClient({ ...client, idDuplicataPlace: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        ) : (
                          <div className="text-sm text-slate-800 font-medium">{client.idDuplicataPlace || "Non renseigné"}</div>
                        )}
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date de naissance</label>
                    {isEditing ? (
                      <input type="date" value={client.birthDate || ""} onChange={e => setClient({ ...client, birthDate: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.birthDate || "Non renseignée"}</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Raison sociale</label>
                    {isEditing ? (
                      <input type="text" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.name}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email Pro</label>
                    {isEditing ? (
                      <input type="email" value={client.email} onChange={e => setClient({ ...client, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.email || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Téléphone Pro</label>
                    {isEditing ? (
                      <input type="tel" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.phone}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">NIF</label>
                    {isEditing ? (
                      <input type="text" value={client.nif || ""} onChange={e => setClient({ ...client, nif: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.nif || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">STAT</label>
                    {isEditing ? (
                      <input type="text" value={client.stat || ""} onChange={e => setClient({ ...client, stat: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.stat || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">RCS</label>
                    {isEditing ? (
                      <input type="text" value={client.rcs || ""} onChange={e => setClient({ ...client, rcs: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.rcs || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Représentant</label>
                    {isEditing ? (
                      <input type="text" value={client.repFirstName || ""} onChange={e => setClient({ ...client, repFirstName: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nom du représentant" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.repFirstName || "Non renseigné"}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fonction représentant</label>
                    {isEditing ? (
                      <input type="text" value={client.repRole || ""} onChange={e => setClient({ ...client, repRole: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    ) : (
                      <div className="text-sm text-slate-800 font-medium">{client.repRole || "Non renseignée"}</div>
                    )}
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Notes internes</label>
                {isEditing ? (
                  <textarea value={client.notes || ""} onChange={e => setClient({ ...client, notes: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20" placeholder="Remarques..." />
                ) : (
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">{client.notes || "Aucune note."}</div>
                )}
              </div>
            </div>
          </div>

          {/* Pipeline Timeline — pleine largeur dans la colonne principale */}
          {client.status === 'Prospect' && client.prospectStatus && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Pipeline commercial</h3>
                {client.prospectStatusChangedAt && (
                  <span className="text-[10px] text-slate-400">Mis à jour {new Date(client.prospectStatusChangedAt).toLocaleDateString('fr-FR')}</span>
                )}
              </div>

              {(() => {
                const steps = [
                  { key: 'new', label: 'Nouveau', short: 'Nouveau' },
                  { key: 'contact_attempted', label: 'Tentative', short: 'Tentative' },
                  { key: 'contacted', label: 'Contacté', short: 'Contacté' },
                  { key: 'qualified', label: 'Qualifié', short: 'Qualifié' },
                  { key: 'proforma_sent', label: 'Proforma', short: 'Proforma' },
                  { key: 'to_recall', label: 'Relance', short: 'Relance' },
                  { key: 'converted', label: 'Converti', short: 'Converti' },
                  { key: 'lost', label: 'Perdu', short: 'Perdu' },
                  { key: 'disqualified', label: 'Disqualifié', short: 'Disqualifié' },
                ];
                const currentIdx = steps.findIndex(s => s.key === client.prospectStatus);
                const progressWidth = currentIdx >= 0 ? ((currentIdx) / (steps.length - 1)) * 100 : 0;

                return (
                  <div className="relative">
                    <div className="flex items-center relative">
                      <div className="absolute top-[18px] left-0 right-0 h-[3px] bg-slate-200 z-0 rounded-full"></div>
                      <div className="absolute top-[18px] left-0 h-[3px] bg-indigo-500 z-0 rounded-full" style={{ width: `${progressWidth}%` }} />
                      {steps.map((step, idx) => {
                        const isDone = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        const isTerminal = ['lost', 'disqualified'].includes(step.key);
                        const isSuccess = step.key === 'converted';
                        return (
                          <div key={step.key} className="relative z-10 flex flex-col items-center flex-1">
                            <div className={`w-10 h-10 rounded-full border-[3px] flex items-center justify-center shadow-sm transition-all ${
                              isDone ? 'bg-green-500 border-green-500' :
                              isCurrent ? (isTerminal ? 'bg-rose-500 border-rose-500' : isSuccess ? 'bg-emerald-500 border-emerald-500' : 'bg-indigo-600 border-indigo-600') :
                              'bg-white border-slate-300'
                            }`}>
                              {isDone ? (
                                <i className="fa-solid fa-check text-white text-sm"></i>
                              ) : isCurrent ? (
                                <span className="text-white text-xs font-bold">{idx + 1}</span>
                              ) : (
                                <span className="text-slate-400 text-xs font-semibold">{idx + 1}</span>
                              )}
                            </div>
                            <span className={`text-[10px] mt-2 text-center leading-tight w-16 ${
                              isCurrent ? 'font-bold text-indigo-700' :
                              isDone ? 'font-medium text-green-600' :
                              'text-slate-400'
                            }`}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Demande Commerciale (Prospect) */}
          {client.status === 'Prospect' && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Demande commerciale</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Demande actuelle</span>
                  <span className="font-semibold text-slate-800">{reqType}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Volet d'intérêt</span>
                  <span className="font-semibold text-slate-800">{reqVolet}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Date souhaitée</span>
                  <span className="font-semibold text-slate-800">{reqDate}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium mb-1">Dernier échange</span>
                  <span className="font-semibold text-slate-800">Aujourd'hui</span>
                </div>
              </div>

              <div className="space-y-4">
                {linkedProforma && (
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-solid fa-file-invoice text-indigo-500"></i> Proforma liée
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{linkedProforma.id} • {linkedProforma.amount === null ? "Montant non renseigné" : `${linkedProforma.amount.toLocaleString('fr-FR')} Ar`} • Brouillon</p>
                    </div>
                    <button onClick={() => onNavigate("reservation-detail", linkedProforma.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
                      Voir proforma
                    </button>
                  </div>
                )}

                {reqType === 'Disponibilité demandée' && (
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-regular fa-calendar-check text-emerald-500"></i> Disponibilité demandée
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{reqVolet} • {reqDate} • À vérifier</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onNavigate("planning")} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap">
                        Voir calendrier disponibilité
                      </button>
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg whitespace-nowrap">Vérification via le planning</span>
                    </div>
                  </div>
                )}

                {reqType === 'Visite demandée' && (
                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <i className="fa-regular fa-calendar-check text-emerald-500"></i> Visite demandée
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{reqVolet} • Date souhaitée : {reqDate}</p>
                    </div>
                    <button onClick={() => onNavigate("planning")} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap">
                      Voir agenda de visite
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agenda / Relances */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Agenda commercial / Relances</h3>
              <span className="text-xs text-slate-500">{commercialHistory.agendaEvents.length} événement(s)</span>
            </div>
            {commercialHistory.agendaEvents.length === 0 ? (
              <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg text-center">Aucune relance ou visite planifiée.</div>
            ) : (
              <div className="space-y-3">
                {commercialHistory.agendaEvents.map((event, index) => (
                  <div key={`${event.type}-${event.date}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden="true">
                      <i className={event.type === "follow_up" ? "fa-solid fa-phone" : "fa-regular fa-calendar-check"}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{event.title}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(event.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        {event.description ? ` — ${event.description}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Résumé des ressources commerciales liées */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6" aria-labelledby="customer-commercial-summary-title">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 id="customer-commercial-summary-title" className="text-lg font-bold text-slate-800">Activité commerciale liée</h3>
                <p className="text-xs text-slate-500 mt-1">Synthèse issue de la chronologie commerciale du client.</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("commercial-ops")}
                className="min-h-11 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Ouvrir Commercial Ops
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Documents", commercialHistory.documentCount],
                ["Factures", commercialHistory.invoiceCount],
                ["Paiements", commercialHistory.paymentCount],
                ["Logistique", commercialHistory.logisticsCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-medium text-slate-500">{label}</div>
                  <div className="mt-1 text-xl font-bold text-slate-800">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chronologie commerciale unifiée */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Chronologie commerciale</h3>
            {timelineLoading ? (
              <div className="py-8 text-center text-slate-500">Chargement...</div>
            ) : timelineError ? (
              <div className="py-8 text-center text-red-600">{timelineError}</div>
            ) : timelineEvents.length === 0 ? (
              <div className="py-8 text-center text-slate-500">Aucun événement dans la chronologie.</div>
            ) : (
              <div className="space-y-4">
                {timelineEvents.map((evt, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1.5" />
                      {idx < timelineEvents.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 min-h-[2rem]" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="text-xs text-slate-500 font-medium">
                        {new Date(evt.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{evt.title}</div>
                      <div className="text-sm text-slate-600">{evt.description}</div>
                      {evt.type && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wide">
                          {evt.type}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique des dossiers */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Historique des dossiers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase border-b border-slate-100">
                    <th className="text-left pb-3 font-semibold">Dossier</th>
                    <th className="text-left pb-3 font-semibold">Volet</th>
                    <th className="text-left pb-3 font-semibold">Date prévue</th>
                    <th className="text-left pb-3 font-semibold">Statut</th>
                    <th className="text-right pb-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">Aucun dossier trouvé pour ce contact.</td>
                    </tr>
                  )}
                  {reservations.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4">
                        <button onClick={() => onNavigate("reservation-detail", res.id)} className="min-h-11 text-left group">
                          <div className="font-medium text-indigo-600 group-hover:underline">{res.id}</div>
                          <div className="text-xs text-slate-500">{res.title}</div>
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${res.type === 'Hahitantsoa' ? 'bg-hah-100 text-hah-700' : 'bg-tit-100 text-tit-700'}`}>{res.type}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{new Date(res.date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">{res.status}</span>
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-800">
                        {res.amount === null ? "—" : `${res.amount.toLocaleString('fr-FR')} Ar`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {(previewingAttachmentId || attachmentPreview || attachmentPreviewError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-attachment-preview-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeAttachmentPreview();
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h2 id="customer-attachment-preview-title" className="truncate text-base font-bold text-slate-800">
                  Aperçu de {attachmentPreview?.attachment.original_name || "la pièce jointe"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">Le fichier reste protégé et n’est pas rendu public.</p>
              </div>
              <button
                ref={attachmentPreviewCloseRef}
                type="button"
                className="min-h-11 min-w-11 rounded-lg px-3 text-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Fermer l’aperçu"
                onClick={closeAttachmentPreview}
              >
                ×
              </button>
            </div>
            <div className="min-h-64 overflow-auto bg-slate-100 p-4">
              {previewingAttachmentId ? (
                <p className="flex min-h-56 items-center justify-center text-sm text-slate-600" role="status" aria-live="polite">
                  Chargement de l’aperçu…
                </p>
              ) : attachmentPreviewError ? (
                <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-red-700" role="alert">{attachmentPreviewError}</p>
                  {attachmentPreview && <button type="button" className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={() => void handleAttachmentDownload(attachmentPreview.attachment)}>Télécharger le fichier</button>}
                </div>
              ) : attachmentPreview?.kind === "image" && attachmentPreview.url ? (
                <img src={attachmentPreview.url} alt={`Aperçu de ${attachmentPreview.attachment.original_name}`} className="mx-auto max-h-[65vh] max-w-full rounded-lg object-contain shadow-sm" />
              ) : attachmentPreview?.kind === "pdf" && attachmentPreview.url ? (
                <iframe src={attachmentPreview.url} title={`Aperçu de ${attachmentPreview.attachment.original_name}`} className="h-[65vh] min-h-[32rem] w-full rounded-lg bg-white" />
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-slate-700">L’aperçu n’est pas disponible pour ce format.</p>
                  {attachmentPreview && <button type="button" className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700" onClick={() => void handleAttachmentDownload(attachmentPreview.attachment)}>Télécharger le fichier</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showConversionAssistant && client.status === "Prospect" && (
        <ProspectConversionAssistant
          client={client as any}
          proformaAmount={linkedProforma?.amount || 0}
          onCancel={() => setShowConversionAssistant(false)}
          onSuccess={(updatedClient: any, _payment: any) => {
            setClient(updatedClient);
            setShowConversionAssistant(false);
            setRetryKey((prev) => prev + 1);
          }}
        />
      )}

      {/* Modal Modifier le statut prospect */}
      {showStatusModal && client.status === "Prospect" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Modifier le statut</h3>
            <p className="text-sm text-slate-500 mb-6">{client.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Nouveau statut</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  defaultValue={client.prospectStatus || 'new'}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    (document.getElementById('status-reason') as HTMLTextAreaElement).style.display =
                      ['disqualified', 'lost'].includes(newStatus) ? 'block' : 'none';
                  }}
                  id="status-select"
                >
                  <option value="new">Nouveau</option>
                  <option value="contact_attempted">Tentative de contact</option>
                  <option value="contacted">Contacté</option>
                  <option value="qualified">Qualifié</option>
                  <option value="proforma_sent">Proforma envoyée</option>
                  <option value="to_recall">À relancer</option>
                  <option value="converted">Converti</option>
                  <option value="disqualified">Non qualifié</option>
                  <option value="lost">Perdu</option>
                </select>
              </div>
              <div id="status-reason" style={{ display: 'none' }}>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Motif (obligatoire)</label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Pourquoi ce statut ?"
                  id="status-reason-input"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 font-medium text-sm rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    const select = document.getElementById('status-select') as HTMLSelectElement;
                    const reasonInput = document.getElementById('status-reason-input') as HTMLTextAreaElement;
                    const newStatus = select.value;
                    const reason = reasonInput?.value || '';
                    if (['disqualified', 'lost'].includes(newStatus) && !reason.trim()) {
                      alert('Un motif est obligatoire pour ce statut.');
                      return;
                    }
                    try {
                      const updated = await transitionProspectStatus(client.id, {
                        prospect_status: newStatus,
                        reason: reason || undefined,
                      });
                      setClient(mapApiCustomer(updated));
                      setShowStatusModal(false);
                    } catch {
                      alert('Erreur lors de la transition. Vérifiez les droits.');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
