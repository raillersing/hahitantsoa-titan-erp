import React, { useCallback, useEffect, useMemo, useState } from "react";

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
type FormErrors = Partial<Record<keyof VisitAppointmentPayload, string>>;

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

export default function AgendaVisitorsPage({ onNavigate }: AgendaVisitorsPageProps) {
  const [appointments, setAppointments] = useState<VisitAppointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [responsibles, setResponsibles] = useState<VisitResponsible[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VisitAppointment | null>(null);
  const [payload, setPayload] = useState<VisitAppointmentPayload>(initialPayload);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | VisitAppointment["status"]>("all");

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

  const filteredAppointments = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return appointments.filter((appointment) => {
      if (statusFilter !== "all" && appointment.status !== statusFilter) return false;
      return !normalized || [appointment.customer_display_name, appointment.location, appointment.responsible_username]
        .some((value) => value.toLocaleLowerCase().includes(normalized));
    });
  }, [appointments, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setPayload(initialPayload());
    setFormErrors({});
    setSubmitError(null);
    setFormOpen(true);
  };

  const openEdit = (appointment: VisitAppointment) => {
    setEditing(appointment);
    setPayload({
      customer_id: appointment.customer_id,
      reason: appointment.reason,
      scheduled_at: localDateTime(appointment.scheduled_at),
      responsible_id: appointment.responsible_id,
      location: appointment.location,
      notes: appointment.notes,
      reminder_at: appointment.reminder_at,
    });
    setFormErrors({});
    setSubmitError(null);
    setFormOpen(true);
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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    const requestPayload = {
      ...payload,
      scheduled_at: new Date(payload.scheduled_at).toISOString(),
      reminder_at: payload.reminder_at ? new Date(payload.reminder_at).toISOString() : null,
    };
    try {
      const saved = editing
        ? await updateVisitAppointment(editing.id, requestPayload)
        : await createVisitAppointment(requestPayload);
      setAppointments((current) => editing
        ? current.map((appointment) => appointment.id === saved.id ? saved : appointment)
        : [...current, saved].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)));
      setFormOpen(false);
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

  const transition = async (appointment: VisitAppointment, kind: "complete" | "cancel") => {
    setActionId(appointment.id);
    try {
      const updated = kind === "complete"
        ? await completeVisitAppointment(appointment.id)
        : await cancelVisitAppointment(appointment.id);
      setAppointments((current) => current.map((item) => item.id === updated.id ? updated : item));
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
          <h2 className="text-2xl font-bold text-slate-800">Agenda visiteurs</h2>
          <p className="text-sm text-slate-500">Planifiez les visites sans bloquer les ressources ou les disponibilités.</p>
        </div>
        <button type="button" onClick={openCreate} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">
          <i className="fas fa-plus mr-2" aria-hidden="true" />Planifier une visite
        </button>
      </div>

      {loadState === "loading" && <div className="rounded-2xl border border-slate-200 bg-white p-12"><LoadingSpinner size="md" message="Chargement des visites…" /></div>}
      {loadState === "error" && <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center" role="alert"><p className="font-medium text-rose-700">{loadError}</p><button type="button" onClick={() => void load()} className="mt-4 min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Réessayer</button></div>}

      {loadState === "loaded" && <>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex-1"><span className="sr-only">Rechercher une visite</span><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm" placeholder="Rechercher client, responsable ou lieu…" /></label>
            <label className="text-sm font-medium text-slate-700">Statut<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="ml-2 min-h-11 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">Tous</option><option value="scheduled">Planifiées</option><option value="completed">Terminées</option><option value="cancelled">Annulées</option></select></label>
          </div>
          {filteredAppointments.length === 0 ? <EmptyState title="Aucune visite" message="Planifiez une visite pour l'afficher dans l'agenda et le planning." icon="fa-calendar-days" /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Date et heure</th><th className="p-3">Client / prospect</th><th className="p-3">Motif</th><th className="p-3">Responsable</th><th className="p-3">Lieu</th><th className="p-3">Statut</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{filteredAppointments.map((appointment) => <tr key={appointment.id} className="border-b border-slate-100"><td className="p-3 whitespace-nowrap">{new Date(appointment.scheduled_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</td><td className="p-3"><button type="button" onClick={() => onNavigate("customer", appointment.customer_id)} className="font-semibold text-slate-800 hover:text-indigo-700 hover:underline">{appointment.customer_display_name}</button></td><td className="p-3">{formatReason(appointment.reason)}</td><td className="p-3">{appointment.responsible_username}</td><td className="p-3">{appointment.location}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(appointment.status)}`}>{formatStatus(appointment.status)}</span></td><td className="p-3 text-right whitespace-nowrap">{appointment.status === "scheduled" && <><button type="button" onClick={() => openEdit(appointment)} className="min-h-11 px-2 text-indigo-700 hover:underline">Modifier</button><button type="button" disabled={actionId === appointment.id} onClick={() => void transition(appointment, "complete")} className="min-h-11 px-2 text-emerald-700 hover:underline">Terminer</button><button type="button" disabled={actionId === appointment.id} onClick={() => void transition(appointment, "cancel")} className="min-h-11 px-2 text-rose-700 hover:underline">Annuler</button></>}</td></tr>)}</tbody></table></div>}
        </div>
        {loadError && <p className="text-sm text-rose-700" role="alert">{loadError}</p>}
      </>}

      {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="visit-form-title"><div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><h3 id="visit-form-title" className="text-xl font-bold text-slate-800">{editing ? "Modifier la visite" : "Planifier une visite"}</h3><p className="text-sm text-slate-500">Un rappel est enregistré 24 h avant par défaut.</p></div><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 px-3 text-slate-600" aria-label="Fermer le formulaire">×</button></div><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Client ou prospect *<select value={payload.customer_id} onChange={(event) => updatePayload("customer_id", event.target.value)} onBlur={() => setFormErrors(validate())} aria-describedby={formErrors.customer_id ? "visit-customer-error" : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3"><option value="">Sélectionner…</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name}</option>)}</select>{formErrors.customer_id && <span id="visit-customer-error" className="mt-1 block text-xs text-rose-700">{formErrors.customer_id}</span>}</label><label className="text-sm font-medium text-slate-700">Motif *<select value={payload.reason} onChange={(event) => updatePayload("reason", event.target.value as VisitReason)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3">{REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Date et heure *<input type="datetime-local" value={payload.scheduled_at} onChange={(event) => updatePayload("scheduled_at", event.target.value)} onBlur={() => setFormErrors(validate())} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3" />{formErrors.scheduled_at && <span className="mt-1 block text-xs text-rose-700">{formErrors.scheduled_at}</span>}</label><label className="text-sm font-medium text-slate-700">Responsable *<select value={payload.responsible_id} onChange={(event) => updatePayload("responsible_id", event.target.value)} onBlur={() => setFormErrors(validate())} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3"><option value="">Sélectionner…</option>{responsibles.map((responsible) => <option key={responsible.id} value={responsible.id}>{responsible.display_name}</option>)}</select>{formErrors.responsible_id && <span className="mt-1 block text-xs text-rose-700">{formErrors.responsible_id}</span>}</label></div><label className="block text-sm font-medium text-slate-700">Lieu *<input value={payload.location ?? ""} onChange={(event) => updatePayload("location", event.target.value)} onBlur={() => setFormErrors(validate())} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3" />{formErrors.location && <span className="mt-1 block text-xs text-rose-700">{formErrors.location}</span>}</label><label className="block text-sm font-medium text-slate-700">Notes<textarea value={payload.notes ?? ""} onChange={(event) => updatePayload("notes", event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>{submitError && <p className="text-sm text-rose-700" role="alert">{submitError}</p>}<div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-700">Annuler</button><button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-60">{isSubmitting ? "Enregistrement…" : "Enregistrer la visite"}</button></div></form></div></div>}
    </div>
  );
}
