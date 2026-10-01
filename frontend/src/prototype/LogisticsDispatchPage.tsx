import React, { useState, useEffect, useMemo } from "react";
import {
  completeLogisticsPassation,
  createLogisticsEvent,
  createReturnOperation,
  getHahitantsoaEventDrafts,
  getLogisticsEvents,
  getReservationDrafts,
  getReturnOperations,
  transitionLogisticsEvent,
  updateLogisticsEventSignature,
} from "../api";
import type {
  HahitantsoaEventDraft,
  InventoryReturnOperation,
  InventoryReturnOperationCreatePayload,
  LogisticsEvent,
  ReservationDraft,
} from "../types";

const eventTypeLabels: Record<string, string> = {
  delivery: "Livraison Titan",
  pickup: "Prélèvement",
  preparation: "Préparation",
  handover: "Remise",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  planned: {
    label: "Planifié",
    className: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400",
  },
  dispatched: {
    label: "En cours",
    className: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400",
  },
  completed: {
    label: "Terminé",
    className: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400",
  },
};

export default function LogisticsDispatchPage({ onNavigate }: { onNavigate: (scope: any, param?: string) => void }) {
  const [events, setEvents] = useState<LogisticsEvent[]>([]);
  const [returnOperations, setReturnOperations] = useState<InventoryReturnOperation[]>([]);
  const [reservationDrafts, setReservationDrafts] = useState<ReservationDraft[]>([]);
  const [hahiDrafts, setHahiDrafts] = useState<HahitantsoaEventDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tous");
  const [toast, setToast] = React.useState<{message: string, type: 'info'|'success'|'warning'|'error'} | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [signatureEvent, setSignatureEvent] = useState<LogisticsEvent | null>(null);
  const [clientSignerName, setClientSignerName] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      getLogisticsEvents(controller.signal),
      getReturnOperations(controller.signal).catch(() => []),
      getReservationDrafts(undefined, controller.signal).catch(() => []),
      getHahitantsoaEventDrafts(undefined, controller.signal).catch(() => []),
    ])
      .then(([eventsData, returnsData, resDrafts, hDrafts]) => {
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        setReturnOperations(Array.isArray(returnsData) ? returnsData : []);
        setReservationDrafts(Array.isArray(resDrafts) ? resDrafts : []);
        setHahiDrafts(Array.isArray(hDrafts) ? hDrafts : []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message || "Erreur lors du chargement des événements logistiques.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const showToast = (message: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
    setToast({message, type});
    setTimeout(() => setToast(null), 3000);
  };

  const handleStartReturn = async (evt: LogisticsEvent) => {
    if (busyEventId === evt.id) return;
    setBusyEventId(evt.id);
    try {
      const payload: InventoryReturnOperationCreatePayload = {
        logistics_event: evt.id,
        reservation_draft: evt.reservation_draft || undefined,
        hahitantsoa_event_draft: evt.hahitantsoa_event_draft || undefined,
        notes: `Retour initialisé depuis l'événement logistique ${evt.id.slice(0, 8)}.`,
        lines: (evt.item_lines || []).map((line) => ({
          inventory_item: line.inventory_item,
          expected_quantity: line.quantity,
          returned_quantity: line.quantity,
          damaged_quantity: 0,
          missing_quantity: 0,
          condition_status: "intact",
          notes: "",
        })),
      };
      const created = await createReturnOperation(payload);
      setReturnOperations((current) => [...current, created]);
      showToast("Opération de retour initialisée avec succès. Redirection vers les retours...", "success");
      onNavigate(
        "logistics-returns",
        evt.reservation_draft
          ? `titan:${evt.reservation_draft}`
          : evt.hahitantsoa_event_draft
            ? `hahitantsoa:${evt.hahitantsoa_event_draft}`
            : undefined
      );
    } catch (err: any) {
      showToast(err?.message || "Impossible d'initialiser l'opération de retour.", "error");
    } finally {
      setBusyEventId(null);
    }
  };

  const transitionEvent = async (event: LogisticsEvent, newStatus: "dispatched" | "completed") => {
    setBusyEventId(event.id);
    try {
      const updated = await transitionLogisticsEvent(event.id, {
        new_status: newStatus,
        notes: newStatus === "dispatched" ? "Sortie lancée depuis le planning logistique." : "Opération logistique terminée depuis le planning logistique.",
      });
      setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
      showToast(newStatus === "dispatched" ? "Sortie lancée et enregistrée." : "Opération terminée et enregistrée.", "success");
    } catch (err: any) {
      showToast(err?.message || "Impossible de mettre à jour l’opération.", "error");
    } finally {
      setBusyEventId(null);
    }
  };

  const saveClientSignature = async () => {
    if (!signatureEvent || !clientSignerName.trim()) {
      showToast("Le nom du signataire est obligatoire.", "error");
      return;
    }
    setBusyEventId(signatureEvent.id);
    try {
      const updated = await updateLogisticsEventSignature(signatureEvent.id, {
        signature_status: "received",
        signed_by_client_name: clientSignerName.trim(),
      });
      setEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSignatureEvent(null);
      setClientSignerName("");
      showToast("Signature client enregistrée.", "success");
    } catch (err: any) {
      showToast(err?.message || "Impossible d’enregistrer la signature.", "error");
    } finally {
      setBusyEventId(null);
    }
  };

  const completePassation = async (event: LogisticsEvent) => {
    setBusyEventId(event.id);
    try {
      const result = await completeLogisticsPassation(event.id, {
        notes: "Passation finalisée depuis le planning logistique.",
      });
      setEvents((current) => current.map((item) => item.id === result.event.id ? result.event : item));
      showToast("Passation finalisée : bon de livraison et sortie de stock enregistrés.", "success");
    } catch (err: any) {
      showToast(err?.message || "Impossible de finaliser la passation.", "error");
    } finally {
      setBusyEventId(null);
    }
  };

  const pendingConfirmedDrafts = useMemo(() => {
    const existingDraftIds = new Set(
      events.map((e) => e.reservation_draft || e.hahitantsoa_event_draft).filter(Boolean)
    );
    const titanPending = reservationDrafts
      .filter((d) => d.status === "confirmed" && !existingDraftIds.has(d.id))
      .map((d) => ({
        id: d.id,
        reference: d.public_reference,
        customerName: d.customer_display_name,
        domain: "titan" as const,
        date: d.start_at,
        itemCount: d.lines?.length || 0,
      }));
    const hahiPending = hahiDrafts
      .filter((d) => d.status === "confirmed" && !existingDraftIds.has(d.id))
      .map((d) => ({
        id: d.id,
        reference: d.public_reference,
        customerName: d.customer_display_name || d.event_name,
        domain: "hahitantsoa" as const,
        date: d.start_at,
        itemCount: d.lines?.length || 0,
      }));
    return [...titanPending, ...hahiPending];
  }, [events, reservationDrafts, hahiDrafts]);

  const handleCreateDispatchFromDraft = async (item: {
    id: string;
    domain: "titan" | "hahitantsoa";
    reference: string;
  }) => {
    if (busyEventId === item.id) return;
    setBusyEventId(item.id);
    try {
      const created = await createLogisticsEvent({
        reservation_draft: item.domain === "titan" ? item.id : undefined,
        hahitantsoa_event_draft: item.domain === "hahitantsoa" ? item.id : undefined,
        event_type: "delivery",
        operation: "outbound",
        notes: `Expédition créée depuis le planning logistique pour le dossier ${item.reference}.`,
      });
      setEvents((curr) => [created, ...curr]);
      showToast(`Ordre d'expédition créé pour ${item.reference}.`, "success");
    } catch (err: any) {
      showToast(err?.message || "Impossible de créer l'ordre d'expédition.", "error");
    } finally {
      setBusyEventId(null);
    }
  };

  const filteredData = events.filter(e => {
    if (filter === "Tous") return true;
    if (filter === "Livraison") return e.event_type === "delivery";
    if (filter === "Prélèvement") return e.event_type === "pickup";
    return true;
  });

  const formatDate = (isoDate: string | null): string => {
    if (!isoDate) return "—";
    try {
      return new Date(isoDate).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoDate;
    }
  };

  const resolveDossierRef = (evt: LogisticsEvent): string => {
    if (evt.dossier_reference && evt.dossier_reference.trim().length > 0) {
      return evt.dossier_reference;
    }
    if (evt.reservation_draft) {
      const match = reservationDrafts.find((d) => d.id === evt.reservation_draft);
      if (match?.public_reference) return match.public_reference;
    }
    if (evt.hahitantsoa_event_draft) {
      const match = hahiDrafts.find((d) => d.id === evt.hahitantsoa_event_draft);
      if (match?.public_reference) return match.public_reference;
    }
    return "Dossier en cours";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <i className="fas fa-spinner fa-spin text-xl"></i>
          <span className="font-medium">Chargement des événements logistiques…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-4xl mb-4">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-2">
            Erreur de chargement
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button
            className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700"
            onClick={() => {
              setLoading(true);
              setError(null);
              getLogisticsEvents()
                .then((data) => {
                  setEvents(data);
                  setLoading(false);
                })
                .catch((err) => {
                  setError(err.message || "Erreur lors du chargement.");
                  setLoading(false);
                });
            }}
          >
            <i className="fas fa-redo mr-2"></i>Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            {["Tous", "Livraison", "Prélèvement"].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:bg-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        {pendingConfirmedDrafts.length > 0 && (
          <div className="m-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/80 dark:border-indigo-800 dark:bg-indigo-950/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-extrabold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                  <i className="fas fa-calendar-check text-indigo-600" />
                  Dossiers confirmés à expédier / livrer ({pendingConfirmedDrafts.length})
                </h3>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Ces réservations sont confirmées mais leur ordre de livraison/sortie n'a pas encore été ouvert.
                </p>
              </div>
            </div>
            <div className="divide-y divide-indigo-200/60 dark:divide-indigo-800/60">
              {pendingConfirmedDrafts.map((d) => (
                <div key={d.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                      Dossier : {d.reference}
                    </span>
                    <span className={`ml-2 px-2 py-0.5 text-xs font-bold rounded-full ${
                      d.domain === "hahitantsoa"
                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                    }`}>
                      {d.domain === "hahitantsoa" ? "Hahitantsoa" : "Titan"}
                    </span>
                    <span className="ml-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                      • Client : {d.customerName || "—"} • {d.itemCount} article(s) • Prévu le {formatDate(d.date)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                    disabled={busyEventId === d.id}
                    onClick={() => void handleCreateDispatchFromDraft(d)}
                  >
                    <i className={`fas ${busyEventId === d.id ? "fa-spinner fa-spin" : "fa-truck-fast"}`} />
                    <span>Créer l'ordre de sortie / livraison</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {filteredData.map(evt => {
            const statusInfo = statusConfig[evt.status] || { label: evt.status, className: "" };
            return (
              <div key={evt.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {evt.delivery_note_reference ? (
                        <>
                          <span className="font-mono font-black text-lg text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 px-3 py-0.5 rounded-lg flex items-center gap-1.5 shadow-xs">
                            <i className="fas fa-file-invoice text-amber-600 dark:text-amber-400 text-sm"></i>
                            <span>BL : {evt.delivery_note_reference}</span>
                          </span>
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span>Dossier :</span>
                            <span
                              className="text-tit-600 dark:text-tit-400 hover:underline cursor-pointer font-bold font-mono"
                              onClick={() => {
                                if (evt.domain === "hahitantsoa" || evt.hahitantsoa_event_draft) {
                                  onNavigate("h-event-draft-detail", evt.hahitantsoa_event_draft || undefined);
                                } else if (evt.reservation_draft) {
                                  onNavigate("reservation-detail", evt.reservation_draft);
                                }
                              }}
                            >
                              {resolveDossierRef(evt)}
                            </span>
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <i className="fas fa-truck-ramp-box text-slate-500"></i>
                            <span>Ordre de sortie</span>
                          </span>
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span>• Dossier :</span>
                            <span
                              className="text-tit-600 dark:text-tit-400 hover:underline cursor-pointer font-bold font-mono text-base"
                              onClick={() => {
                                if (evt.domain === "hahitantsoa" || evt.hahitantsoa_event_draft) {
                                  onNavigate("h-event-draft-detail", evt.hahitantsoa_event_draft || undefined);
                                } else if (evt.reservation_draft) {
                                  onNavigate("reservation-detail", evt.reservation_draft);
                                }
                              }}
                            >
                              {resolveDossierRef(evt)}
                            </span>
                          </span>
                        </div>
                      )}
                      {evt.domain && (
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                          evt.domain === "hahitantsoa"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                        }`}>
                          {evt.domain === "hahitantsoa" ? "Hahitantsoa" : "Titan"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-bold">
                        <i className="fas fa-user mr-2 text-slate-400"></i>
                        Client : {evt.customer_name || evt.contact_name || "—"}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        <i className="fas fa-truck mr-2 text-slate-400"></i>
                        {eventTypeLabels[evt.event_type] || evt.event_type}
                      </p>
                      {evt.contact_phone && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                          <i className="fas fa-phone mr-2 text-slate-400"></i>
                          {evt.contact_phone}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                        <i className="fas fa-clock mr-2 text-slate-400"></i>
                        Prévu le : {formatDate(evt.scheduled_at)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
                
                {evt.item_lines && evt.item_lines.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="p-3">Article remis</th>
                          <th className="p-3 text-right">Quantité</th>
                          <th className="p-3">État initial constaté</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {evt.item_lines.map(item => (
                          <tr key={item.id} className="bg-white dark:bg-slate-800">
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{item.inventory_item_name}</td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-100 text-right">{item.quantity}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">{item.notes || item.inventory_item_kind}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {evt.event_type === "handover" && evt.status === "completed" && evt.signature_required && !evt.signature_received && evt.signature_status !== "received" && (
                      <button
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700"
                        onClick={() => {
                          setSignatureEvent(evt);
                          setClientSignerName(evt.signed_by_client_name || "");
                        }}
                      >
                        <i className="fas fa-signature mr-2"></i>Enregistrer la signature
                      </button>
                    )}
                    {evt.event_type === "handover" && evt.status === "completed" && evt.signature_required && evt.signature_status === "received" && !evt.signature_received && (
                      <button
                        className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium rounded-lg text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                        disabled={busyEventId === evt.id}
                        onClick={() => void completePassation(evt)}
                      >
                        <i className={`fas ${busyEventId === evt.id ? "fa-spinner fa-spin" : "fa-file-signature"} mr-2`}></i>Finaliser la passation et le BL
                      </button>
                    )}
                    {evt.signature_received && (
                      <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        <i className="fas fa-check-circle mr-2"></i>BL et sortie de stock enregistrés
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {evt.delivery_note_reference && (
                      <button
                        type="button"
                        className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold rounded-lg text-sm flex items-center gap-2 transition cursor-pointer"
                        onClick={() => {
                          if (evt.domain === "hahitantsoa" || evt.hahitantsoa_event_draft) {
                            onNavigate("h-event-draft-detail", evt.hahitantsoa_event_draft || undefined);
                          } else if (evt.reservation_draft) {
                            onNavigate("reservation-detail", evt.reservation_draft);
                          }
                        }}
                      >
                        <i className="fas fa-file-invoice text-amber-600"></i>
                        <span>BL : {evt.delivery_note_reference}</span>
                      </button>
                    )}
                    {(() => {
                      const isCompletedOutbound =
                        (evt.status === "completed" || evt.signature_received) &&
                        (evt.event_type === "delivery" || evt.event_type === "handover");
                      if (!isCompletedOutbound) return null;

                      const existingReturn = returnOperations.find((r) => r.logistics_event === evt.id);
                      if (existingReturn) {
                        return (
                          <button
                            type="button"
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-lg text-sm flex items-center gap-2 transition"
                            onClick={() =>
                              onNavigate(
                                "logistics-returns",
                                evt.reservation_draft
                                  ? `titan:${evt.reservation_draft}`
                                  : evt.hahitantsoa_event_draft
                                    ? `hahitantsoa:${evt.hahitantsoa_event_draft}`
                                    : undefined
                              )
                            }
                          >
                            <i className="fas fa-boxes-packing text-tit-600" />
                            <span>Voir le retour ({existingReturn.status === "validated" ? "validé" : "en cours"})</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          type="button"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm flex items-center gap-2 shadow-sm transition"
                          disabled={busyEventId === evt.id}
                          onClick={() => void handleStartReturn(evt)}
                        >
                          <i className={`fas ${busyEventId === evt.id ? "fa-spinner fa-spin" : "fa-arrow-rotate-left"} mr-1`} />
                          <span>Démarrer le retour</span>
                        </button>
                      );
                    })()}
                    <button
                      className="px-4 py-2 bg-tit-600 text-white font-bold rounded-lg hover:bg-tit-700"
                      disabled={busyEventId === evt.id || !["planned", "dispatched"].includes(evt.status)}
                      onClick={() => void transitionEvent(evt, evt.status === "planned" ? "dispatched" : "completed")}
                    >
                      <i className={`fas ${busyEventId === evt.id ? "fa-spinner fa-spin" : "fa-check"} mr-2`}></i>{evt.status === "planned" ? "Démarrer la sortie" : evt.status === "dispatched" ? "Marquer terminé" : "Opération terminée"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              Aucun événement logistique dans cette vue.
            </div>
          )}
        </div>
      </div>

      {signatureEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
          <form
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signature-dialog-title"
            onSubmit={(event) => {
              event.preventDefault();
              void saveClientSignature();
            }}
          >
            <h2 id="signature-dialog-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">Signature de la passation</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Saisissez le nom figurant sur le document signé avant de finaliser le bon de livraison.</p>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="client-signer-name">Nom du signataire client</label>
            <input
              id="client-signer-name"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={clientSignerName}
              onChange={(event) => setClientSignerName(event.target.value)}
              autoFocus
              required
            />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="rounded-lg px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" onClick={() => setSignatureEvent(null)}>Annuler</button>
              <button type="submit" className="rounded-lg bg-tit-600 px-4 py-2 font-bold text-white hover:bg-tit-700" disabled={busyEventId === signatureEvent.id}>Enregistrer</button>
            </div>
          </form>
        </div>
      )}
      
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg font-medium animate-fade-in z-50 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 
          toast.type === 'warning' ? 'bg-amber-500 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          'bg-slate-800 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
