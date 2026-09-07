import React, { useState } from "react";
import { AvailabilityDatePicker } from "../components";
import {
  cancelReservationDraft,
  deleteHahitantsoaEventDraft,
  updateHahitantsoaEventDraft,
  updateReservationDraft,
} from "../api";
import type { UnifiedPlanningEvent } from "./PlanningPage";

export interface ConflictResolutionTarget {
  id: string;
  category: "hahitantsoa" | "titan";
  title: string;
  customerName: string;
  startAt: Date | string;
  endAt: Date | string | null;
  location?: string;
  reference?: string;
  conflictingWith?: string;
  conflictingWithEventName?: string;
  raw?: any;
}

export interface DraftConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ConflictResolutionTarget | UnifiedPlanningEvent | null;
  initialTab?: "reschedule" | "waitlist" | "cancel";
  onResolved?: () => void | Promise<void>;
}

export function DraftConflictResolutionModal({
  isOpen,
  onClose,
  event,
  initialTab = "reschedule",
  onResolved,
}: DraftConflictResolutionModalProps) {
  if (!isOpen || !event) return null;

  const [activeTab, setActiveTab] = useState<"reschedule" | "waitlist" | "cancel">(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reschedule state
  const originalStartDate = event.startAt ? new Date(event.startAt) : new Date();
  const nextWeekDate = new Date(originalStartDate);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const inTwoWeeksDate = new Date(originalStartDate);
  inTwoWeeksDate.setDate(inTwoWeeksDate.getDate() + 14);

  const [newStartDate, setNewStartDate] = useState(nextWeekDate.toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(() => {
    if (!event.startAt) return "08:00";
    const d = new Date(event.startAt);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  });
  const [endTime, setEndTime] = useState(() => {
    if (!event.endAt) return "20:00";
    const d = new Date(event.endAt);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  });

  // Waitlist state
  const [waitlistNotes, setWaitlistNotes] = useState(
    `Demande mise en attente pour ${event.customerName}. Date initiale souhaitée : ${originalStartDate.toLocaleDateString("fr-FR")} (occupée par ${event.conflictingWith || "réservation ferme"}).`,
  );

  // Cancellation state
  const [cancellationReason, setCancellationReason] = useState(
    `Date indisponible - Réservée par ${event.conflictingWith || "une autre confirmation"}. Client n'a pas souhaité de report.`,
  );

  const handleApplyReschedule = async (targetDateStr: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const startIso = `${targetDateStr}T${startTime}:00Z`;
      const endIso = `${targetDateStr}T${endTime}:00Z`;

      if (event.category === "hahitantsoa" && event.raw?.id) {
        await updateHahitantsoaEventDraft(event.raw.id, {
          start_at: startIso,
          end_at: endIso,
          notes: event.raw.notes
            ? `${event.raw.notes} | Relocalisé depuis le ${originalStartDate.toLocaleDateString("fr-FR")} vers le ${new Date(targetDateStr).toLocaleDateString("fr-FR")}`
            : `Relocalisé depuis le ${originalStartDate.toLocaleDateString("fr-FR")}`,
        });
      } else if (event.category === "titan" && event.raw?.id) {
        await updateReservationDraft(event.raw.id, {
          start_at: startIso,
          end_at: endIso,
        });
      }

      setSuccessMessage("Le dossier a été relocalisé avec succès vers la nouvelle date.");
      setTimeout(async () => {
        if (onResolved) await onResolved();
        onClose();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de la relocalisation du devis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveWaitlist = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (event.category === "hahitantsoa" && event.raw?.id) {
        await updateHahitantsoaEventDraft(event.raw.id, {
          notes: `${event.raw.notes || ""} [LISTE D'ATTENTE] ${waitlistNotes}`.trim(),
        });
      } else if (event.category === "titan" && event.raw?.id) {
        await updateReservationDraft(event.raw.id, {
          notes: `${event.raw.notes || ""} [LISTE D'ATTENTE] ${waitlistNotes}`.trim(),
        });
      }
      setSuccessMessage("Le dossier a été basculé en liste d'attente.");
      setTimeout(async () => {
        if (onResolved) await onResolved();
        onClose();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de la mise en liste d'attente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelDraft = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer/annuler définitivement ce devis en conflit ?")) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (event.category === "hahitantsoa" && event.raw?.id) {
        await deleteHahitantsoaEventDraft(event.raw.id);
      } else if (event.category === "titan" && event.raw?.id) {
        await cancelReservationDraft(event.raw.id, {
          reason: cancellationReason || "Conflit planning résolu",
        });
      }
      setSuccessMessage("Le devis en conflit a été supprimé ou annulé.");
      setTimeout(async () => {
        if (onResolved) await onResolved();
        onClose();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Échec de la suppression du devis.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header with warning styling */}
        <div className="p-6 bg-rose-500/10 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/40">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                  Arbitrage & Relocalisation
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  Conflit de disponibilité — {event.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Client : <strong className="text-slate-900 dark:text-white">{event.customerName}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition shadow-xs"
              title="Fermer"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Conflict detail alert */}
          <div className="mt-4 p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/80 text-xs text-slate-700 dark:text-slate-200 flex items-start gap-3 shadow-xs">
            <i className="fa-solid fa-circle-info text-rose-500 mt-0.5 text-sm shrink-0"></i>
            <div>
              <p className="font-semibold text-rose-900 dark:text-rose-300">
                La salle « {event.location || "Salle principale"} » est déjà réservée de manière ferme.
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Le dossier confirmé <strong>{event.conflictingWith || "Dossier Ferme"}</strong> bloque la confirmation de cette demande pour le{" "}
                <strong>{originalStartDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("reschedule")}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === "reschedule"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            }`}
          >
            <i className="fa-solid fa-calendar-day"></i>
            <span>1. Relocaliser (Changer de date)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("waitlist")}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === "waitlist"
                ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            }`}
          >
            <i className="fa-solid fa-hourglass-half"></i>
            <span>2. Mettre en attente</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cancel")}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeTab === "cancel"
                ? "bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            }`}
          >
            <i className="fa-solid fa-ban"></i>
            <span>3. Annuler le devis</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-check"></i>
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: RESCHEDULE */}
          {activeTab === "reschedule" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Suggestions de dates disponibles proches :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewStartDate(nextWeekDate.toISOString().slice(0, 10));
                    }}
                    className={`p-3 rounded-2xl border text-left text-xs transition flex items-center justify-between ${
                      newStartDate === nextWeekDate.toISOString().slice(0, 10)
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <i className="fa-solid fa-calendar-check text-indigo-600"></i>
                        Samedi suivant (+7j)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {nextWeekDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                      Libre
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewStartDate(inTwoWeeksDate.toISOString().slice(0, 10));
                    }}
                    className={`p-3 rounded-2xl border text-left text-xs transition flex items-center justify-between ${
                      newStartDate === inTwoWeeksDate.toISOString().slice(0, 10)
                        ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold"
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <i className="fa-solid fa-calendar-check text-indigo-600"></i>
                        Dans 2 semaines (+14j)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {inTwoWeeksDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                      Libre
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nouvelle date précise
                  </label>
                  <AvailabilityDatePicker
                    value={newStartDate}
                    onChange={(d) => d && setNewStartDate(d)}
                    placeholder="Sélectionner..."
                    ariaLabel="Nouvelle date"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Heure début
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Heure fin
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyReschedule(newStartDate)}
                  disabled={isLoading || !newStartDate}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 transition flex items-center gap-2"
                >
                  {isLoading ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-check"></i>
                  )}
                  <span>Appliquer la nouvelle date</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WAITLIST */}
          {activeTab === "waitlist" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                La demande reste enregistrée dans le registre des prospects en tant que <strong>Liste d'attente</strong>. Si le dossier confirmé <em>{event.conflictingWith}</em> venait à se désister ou changer de date, vous serez notifié.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes de suivi prospect / arbitrage :
                </label>
                <textarea
                  rows={3}
                  value={waitlistNotes}
                  onChange={(e) => setWaitlistNotes(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleSaveWaitlist}
                  disabled={isLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md disabled:opacity-50 transition flex items-center gap-2"
                >
                  {isLoading ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-hourglass-half"></i>
                  )}
                  <span>Enregistrer en liste d'attente</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CANCEL */}
          {activeTab === "cancel" && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-200">
                <i className="fa-solid fa-triangle-exclamation mr-1.5 text-rose-600"></i>
                Cette action supprimera définitivement le devis brouillon <strong>{event.reference || event.title}</strong> du planning.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motif d'annulation / clôture :
                </label>
                <textarea
                  rows={2}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Garder le devis
                </button>
                <button
                  type="button"
                  onClick={handleCancelDraft}
                  disabled={isLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md disabled:opacity-50 transition flex items-center gap-2"
                >
                  {isLoading ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <i className="fa-solid fa-trash"></i>
                  )}
                  <span>Confirmer la suppression</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
