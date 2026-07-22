import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  cancelVisitAppointment,
  completeVisitAppointment,
  createVisitAppointment,
  getCustomers,
  getVisitAppointments,
  getVisitResponsibles,
  updateVisitAppointment,
} from "../api";
import type { Customer, VisitAppointment, VisitAppointmentPayload, VisitReason, VisitResponsible } from "../types";
import { EmptyState, LoadingSpinner } from "../components";

interface AgendaVisitorsPageProps {
  onNavigate: (scope: any, param?: string) => void;
}

type LoadState = "loading" | "loaded" | "error";
type CommercialFilter = "all" | "clients" | "prospects" | "providers" | "today";
type FormErrors = Partial<Record<keyof VisitAppointmentPayload, string>>;
type PendingAction = { appointment: VisitAppointment; kind: "complete" | "cancel" } | null;

const DEFAULT_LOCATION = "Local de l'entreprise";
const REASONS: Array<{ value: VisitReason; label: string }> = [
  { value: "simple_visit", label: "Simple visite" },
  { value: "prospect", label: "Prospect" },
  { value: "other", label: "Autres" },
];

function localDateTime(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function initialPayload(): VisitAppointmentPayload {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return {
    customer_id: "",
    reason: "simple_visit",
    scheduled_at: localDateTime(start.toISOString()),
    responsible_id: "",
    location: DEFAULT_LOCATION,
    notes: "",
  };
}

function formatReason(reason: VisitReason): string {
  return REASONS.find((item) => item.value === reason)?.label ?? reason;
}

function formatStatus(status: VisitAppointment["status"]): string {
  return status === "completed" ? "Terminée" : status === "cancelled" ? "Annulée" : "Planifiée";
}

function statusClass(status: VisitAppointment["status"]): string {
  return status === "completed"
    ? "bg-emerald-100 text-emerald-700"
    : status === "cancelled"
      ? "bg-slate-200 text-slate-700"
      : "bg-amber-100 text-amber-700";
}

function requestError(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue. Réessayez.";
}

function sameLocalDate(value: string | null | undefined, selected: string): boolean {
  if (!selected) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return localDateTime(value).slice(0, 10) === selected;
}

function displayActivity(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";
}

export default function AgendaVisitorsPage({ onNavigate }: AgendaVisitorsPageProps) {
  const [appointments, setAppointments] = useState<VisitAppointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [responsibles, setResponsibles] = useState<VisitResponsible[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commercialFilter, setCommercialFilter] = useState<CommercialFilter>("all");
  const [commercialSearch, setCommercialSearch] = useState("");
  const [commercialDate, setCommercialDate] = useState("");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VisitAppointment | null>(null);
  const [payload, setPayload] = useState<VisitAppointmentPayload>(initialPayload);
  const [reminderExplicit, setReminderExplicit] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const actionOpenerRef = useRef<HTMLElement | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmationRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const [visits, customerData, responsibleData] = await Promise.all([
        getVisitAppointments(undefined, signal),
        getCustomers(undefined, signal),
        getVisitResponsibles(signal),
      ]);
      setAppointments(visits);
      setCustomers(customerData.filter((customer) => customer.is_active && !customer.is_deleted));
      setResponsibles(responsibleData);
      setLoadState("loaded");
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(requestError(error));
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (formOpen) firstFieldRef.current?.focus();
  }, [formOpen]);

  useEffect(() => {
    if (pendingAction) confirmationRef.current?.focus();
  }, [pendingAction]);

  const visibleCustomers = useMemo(() => {
    const query = commercialSearch.trim().toLocaleLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return customers.filter((customer) => {
      const matchesQuery = !query || [customer.display_name, customer.email, customer.phone]
        .some((value) => value.toLocaleLowerCase().includes(query));
      if (!matchesQuery) return false;
      if (!sameLocalDate(customer.last_activity_at ?? "", commercialDate)) return false;
      if (commercialFilter === "clients") return customer.lifecycle_status === "client";
      if (commercialFilter === "prospects") return customer.lifecycle_status === "prospect";
      if (commercialFilter === "providers") return false;
      if (commercialFilter === "today") return sameLocalDate(customer.last_activity_at ?? "", today);
      return true;
    });
  }, [commercialDate, commercialFilter, commercialSearch, customers]);

  const visibleAppointments = useMemo(() => {
    const query = appointmentSearch.trim().toLocaleLowerCase();
    return appointments.filter((appointment) => !query || [
      appointment.customer_display_name,
      appointment.location,
      appointment.responsible_username,
    ].some((value) => value.toLocaleLowerCase().includes(query)));
  }, [appointmentSearch, appointments]);

  const openCreate = (event: React.MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    setEditing(null);
    setPayload(initialPayload());
    setReminderExplicit(false);
    setFormErrors({});
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEdit = (appointment: VisitAppointment, event: React.MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    setEditing(appointment);
    setPayload({
      customer_id: appointment.customer_id,
      reason: appointment.reason,
      scheduled_at: localDateTime(appointment.scheduled_at),
      responsible_id: appointment.responsible_id,
      location: appointment.location,
      notes: appointment.notes,
    });
    setReminderExplicit(false);
    setFormErrors({});
    setSubmitError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  };

  const validate = (): FormErrors => {
    const errors: FormErrors = {};
    if (!payload.customer_id) errors.customer_id = "Sélectionnez le client ou prospect.";
    if (!payload.responsible_id) errors.responsible_id = "Sélectionnez le responsable.";
    if (!payload.scheduled_at) errors.scheduled_at = "Indiquez la date et l'heure.";
    if (!payload.location?.trim()) errors.location = "Indiquez le lieu de la visite.";
    return errors;
  };

  const updatePayload = <Key extends keyof VisitAppointmentPayload>(key: Key, value: VisitAppointmentPayload[Key]) => {
    setPayload((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeForm();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeConfirmation = () => {
    actionOpenerRef.current?.focus();
    setPendingAction(null);
  };

  const handleConfirmationKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirmation();
      return;
    }
    if (event.key !== "Tab" || !confirmationRef.current) return;
    const focusable = [...confirmationRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href]',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (document.activeElement === confirmationRef.current) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const { reminder_at: reminderAt, ...basePayload } = payload;
    const requestPayload: Partial<VisitAppointmentPayload> = {
      ...basePayload,
      scheduled_at: new Date(payload.scheduled_at).toISOString(),
    };
    if (reminderExplicit) {
      requestPayload.reminder_at = reminderAt ? new Date(reminderAt).toISOString() : null;
    }
    try {
      const saved = editing
        ? await updateVisitAppointment(editing.id, requestPayload)
        : await createVisitAppointment(requestPayload as VisitAppointmentPayload);
      setAppointments((current) => editing
        ? current.map((appointment) => appointment.id === saved.id ? saved : appointment)
        : [...current, saved].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
      closeForm();
      setPayload(initialPayload());
    } catch (error) {
      if (error instanceof ApiError) {
        setFormErrors((current) => ({ ...current, ...Object.fromEntries(Object.entries(error.errors).map(([key, values]) => [key, values.join(" ")])) }));
      }
      setSubmitError(requestError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmTransition = async () => {
    if (!pendingAction) return;
    const { appointment, kind } = pendingAction;
    setActionId(appointment.id);
    try {
      const updated = kind === "complete"
        ? await completeVisitAppointment(appointment.id)
        : await cancelVisitAppointment(appointment.id);
      setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item));
      closeConfirmation();
    } catch (error) {
      setLoadError(requestError(error));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="page active space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Agenda Visiteurs</h2>
          <p className="text-sm text-slate-500">Registre des visites, réunions commerciales et prestataires.</p>
        </div>
        <button type="button" onClick={openCreate} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
          <i className="fas fa-plus mr-2" aria-hidden="true" />Planifier une visite
        </button>
      </div>

      {loadState === "loading" && <div className="rounded-2xl border border-slate-200 bg-white p-12"><LoadingSpinner size="md" message="Chargement des visiteurs et visites…" /></div>}
      {loadState === "error" && <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center" role="alert"><p className="font-medium text-rose-700">{loadError}</p><button type="button" onClick={() => void load()} className="mt-4 min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Réessayer</button></div>}

      {loadState === "loaded" && <>
        <section aria-labelledby="visitor-register-title" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h3 id="visitor-register-title" className="mb-4 text-lg font-bold text-slate-800">Registre commercial</h3>
          <div className="mb-5 flex flex-wrap gap-2" aria-label="Filtres du registre">
            {(["all", "clients", "prospects", "providers", "today"] as CommercialFilter[]).map((filter) => {
              const labels: Record<CommercialFilter, string> = { all: "Tous", clients: "Clients", prospects: "Prospects", providers: "Prestataires", today: "Aujourd'hui" };
              return <button key={filter} type="button" onClick={() => setCommercialFilter(filter)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${commercialFilter === filter ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{labels[filter]}</button>;
            })}
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label><span className="sr-only">Rechercher un visiteur</span><input value={commercialSearch} onChange={(event) => setCommercialSearch(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Rechercher un visiteur…" /></label>
            <label className="text-sm font-medium text-slate-700">Date d'activité<input type="date" value={commercialDate} onChange={(event) => setCommercialDate(event.target.value)} className="ml-2 min-h-11 rounded-lg border border-slate-200 px-3 text-sm" /></label>
          </div>
          {commercialFilter === "providers" && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Le registre conserve ce filtre validé, mais aucune API ne distingue actuellement les prestataires : aucune donnée n'est affichée ni inventée.</p>}
          {visibleCustomers.length === 0 ? <EmptyState title="Aucun visiteur" message="Aucun client ou prospect réel ne correspond aux filtres." icon="fa-calendar-times" /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Visiteur</th><th className="p-3">Contact</th><th className="p-3">Type</th><th className="p-3">Statut</th><th className="p-3">Dernière activité</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{visibleCustomers.map((customer) => <tr key={customer.id} className="border-b border-slate-100"><td className="p-3 font-semibold text-slate-800">{customer.display_name}</td><td className="p-3"><div>{customer.email || "—"}</div><div className="text-xs text-slate-500">{customer.phone || "—"}</div></td><td className="p-3">{customer.party_type === "company" ? "Entreprise" : "Particulier"}</td><td className="p-3">{customer.lifecycle_status === "prospect" ? "Prospect" : "Client"}</td><td className="p-3 text-slate-600">{displayActivity(customer.last_activity_at)}</td><td className="p-3 text-right"><button type="button" onClick={() => onNavigate("customer", customer.id)} className="min-h-11 px-2 text-indigo-700 hover:underline">Voir</button></td></tr>)}</tbody></table></div>}
          <div className="mt-5 grid grid-cols-3 gap-3"><div className="rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-bold text-indigo-600">{visibleCustomers.length}</div><div className="text-xs text-slate-500">Visiteurs affichés</div></div><div className="rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-bold text-emerald-600">{visibleCustomers.filter((customer) => customer.lifecycle_status === "client").length}</div><div className="text-xs text-slate-500">Clients</div></div><div className="rounded-xl border border-slate-200 p-3 text-center"><div className="text-xl font-bold text-amber-600">{visibleCustomers.filter((customer) => customer.lifecycle_status === "prospect").length}</div><div className="text-xs text-slate-500">Prospects</div></div></div>
        </section>

        <section aria-labelledby="appointments-title" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h3 id="appointments-title" className="text-lg font-bold text-slate-800">Rendez-vous planifiés</h3><label><span className="sr-only">Rechercher une visite</span><input value={appointmentSearch} onChange={(event) => setAppointmentSearch(event.target.value)} className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Client, responsable ou lieu…" /></label></div>
          {visibleAppointments.length === 0 ? <EmptyState title="Aucune visite" message="Planifiez une visite pour l'afficher dans l'agenda et le planning." icon="fa-calendar-days" /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Date et heure</th><th className="p-3">Client / prospect</th><th className="p-3">Motif</th><th className="p-3">Responsable</th><th className="p-3">Lieu</th><th className="p-3">Rappel</th><th className="p-3">Statut</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{visibleAppointments.map((appointment) => <tr key={appointment.id} className="border-b border-slate-100"><td className="p-3 whitespace-nowrap">{new Date(appointment.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</td><td className="p-3"><button type="button" onClick={() => onNavigate("customer", appointment.customer_id)} className="font-semibold text-slate-800 hover:text-indigo-700 hover:underline">{appointment.customer_display_name}</button></td><td className="p-3">{formatReason(appointment.reason)}</td><td className="p-3">{appointment.responsible_username}</td><td className="p-3">{appointment.location}</td><td className="p-3 text-xs">{appointment.reminder_at ? new Date(appointment.reminder_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Selon calendrier ouvré"}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(appointment.status)}`}>{formatStatus(appointment.status)}</span></td><td className="p-3 text-right whitespace-nowrap">{appointment.status === "scheduled" && <><button type="button" onClick={(event) => openEdit(appointment, event)} className="min-h-11 px-2 text-indigo-700 hover:underline">Modifier</button><button type="button" disabled={actionId === appointment.id} onClick={(event) => { actionOpenerRef.current = event.currentTarget; setPendingAction({ appointment, kind: "complete" }); }} className="min-h-11 px-2 text-emerald-700 hover:underline">Terminer</button><button type="button" disabled={actionId === appointment.id} onClick={(event) => { actionOpenerRef.current = event.currentTarget; setPendingAction({ appointment, kind: "cancel" }); }} className="min-h-11 px-2 text-rose-700 hover:underline">Annuler</button></>}</td></tr>)}</tbody></table></div>}
        </section>
        {loadError && <p className="text-sm text-rose-700" role="alert" aria-live="polite">{loadError}</p>}
      </>}

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="visit-form-title" ref={dialogRef} onKeyDown={handleDialogKeyDown}><div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h3 id="visit-form-title" className="text-xl font-bold text-slate-800">{editing ? "Modifier la visite" : "Planifier une visite"}</h3><p className="text-sm text-slate-500">Le rappel par défaut est calculé selon les heures ouvrées. Vous pouvez définir un rappel personnalisé.</p></div><button type="button" onClick={closeForm} className="min-h-11 px-3 text-slate-600" aria-label="Fermer le formulaire">×</button></div><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Client ou prospect *<select ref={firstFieldRef} value={payload.customer_id} onChange={(event) => updatePayload("customer_id", event.target.value)} aria-describedby={formErrors.customer_id ? "visit-customer-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3"><option value="">Sélectionner…</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select>{formErrors.customer_id && <span id="visit-customer-error" className="mt-1 block text-xs text-rose-700">{formErrors.customer_id}</span>}</label><label className="text-sm font-medium text-slate-700">Motif *<select value={payload.reason} onChange={(event) => updatePayload("reason", event.target.value as VisitReason)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3">{REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Date et heure *<input type="datetime-local" value={payload.scheduled_at} onChange={(event) => updatePayload("scheduled_at", event.target.value)} aria-describedby={formErrors.scheduled_at ? "visit-scheduled-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3" />{formErrors.scheduled_at && <span id="visit-scheduled-error" className="mt-1 block text-xs text-rose-700">{formErrors.scheduled_at}</span>}</label><label className="text-sm font-medium text-slate-700">Responsable *<select value={payload.responsible_id} onChange={(event) => updatePayload("responsible_id", event.target.value)} aria-describedby={formErrors.responsible_id ? "visit-responsible-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3"><option value="">Sélectionner…</option>{responsibles.map((responsible) => <option key={responsible.id} value={responsible.id}>{responsible.display_name}</option>)}</select>{formErrors.responsible_id && <span id="visit-responsible-error" className="mt-1 block text-xs text-rose-700">{formErrors.responsible_id}</span>}</label><label className="text-sm font-medium text-slate-700">Lieu *<input value={payload.location ?? ""} onChange={(event) => updatePayload("location", event.target.value)} aria-describedby={formErrors.location ? "visit-location-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3" />{formErrors.location && <span id="visit-location-error" className="mt-1 block text-xs text-rose-700">{formErrors.location}</span>}</label><label className="text-sm font-medium text-slate-700">Rappel personnalisé (facultatif)<input type="datetime-local" value={payload.reminder_at ? localDateTime(payload.reminder_at) : ""} onChange={(event) => { setReminderExplicit(true); updatePayload("reminder_at", event.target.value || null); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3" /></label></div><label className="block text-sm font-medium text-slate-700">Notes<textarea value={payload.notes ?? ""} onChange={(event) => updatePayload("notes", event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>{submitError && <p role="alert" aria-live="assertive" className="text-sm text-rose-700">{submitError}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={closeForm} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">Annuler</button><button disabled={isSubmitting} className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-60">{isSubmitting ? "Enregistrement…" : "Enregistrer"}</button></div></form></div></div>}

      {pendingAction && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="transition-title" ref={confirmationRef} tabIndex={-1} onKeyDown={handleConfirmationKeyDown}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h3 id="transition-title" className="text-lg font-bold text-slate-800">{pendingAction.kind === "complete" ? "Confirmer la finalisation" : "Confirmer l'annulation"}</h3><p className="mt-2 text-sm text-slate-600">{pendingAction.kind === "complete" ? "Cette visite sera marquée terminée." : "Cette annulation est irréversible dans le cycle de vie de la visite."}</p><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={closeConfirmation} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">Retour</button><button type="button" onClick={() => void confirmTransition()} className={`min-h-11 rounded-lg px-4 text-sm font-bold text-white ${pendingAction.kind === "cancel" ? "bg-rose-600" : "bg-emerald-600"}`}>Confirmer</button></div></div></div>}
    </div>
  );
}
