import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  createDesiredDateWaitlistEntry,
  getCustomers,
  getDesiredDateWaitlistEntries,
  transitionDesiredDateWaitlistEntry,
} from "../api";
import { EmptyState, LoadingSpinner } from "../components";
import type {
  Customer,
  DesiredDateBusinessScope,
  DesiredDateInterestKind,
  DesiredDateWaitlistCreatePayload,
  DesiredDateWaitlistEntry,
  DesiredDateWaitlistStatus,
  DesiredDateWaitlistTransition,
} from "../types";

type DesiredDatesPageProps = {
  canSensitiveWrite: boolean;
  currentUserId: string;
  onNavigate: (scope: "customer", param?: string) => void;
};

type DateMode = "preferred" | "flexible";
type PendingTransition = { entry: DesiredDateWaitlistEntry; transition: DesiredDateWaitlistTransition } | null;
type FormErrors = Partial<Record<keyof DesiredDateWaitlistCreatePayload, string>>;

const STATUS_LABELS: Record<DesiredDateWaitlistStatus, string> = {
  new: "Nouvelle",
  contacted: "Contactée",
  converted: "Convertie",
  lost: "Perdue",
  cancelled: "Annulée",
};

const STATUS_CLASSES: Record<DesiredDateWaitlistStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-amber-100 text-amber-800",
  converted: "bg-emerald-100 text-emerald-800",
  lost: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-200 text-slate-800",
};

const INTEREST_OPTIONS: Record<DesiredDateBusinessScope, Array<{ value: DesiredDateInterestKind; label: string }>> = {
  titan: [
    { value: "material", label: "Matériel" },
    { value: "material_pack", label: "Pack matériel" },
  ],
  hahitantsoa: [
    { value: "local", label: "Local" },
    { value: "material", label: "Matériel" },
    { value: "service", label: "Service" },
  ],
};

function initialPayload(currentUserId: string): DesiredDateWaitlistCreatePayload {
  return {
    business_scope: "titan",
    preferred_dates: [],
    interest_kind: "material",
    quantity: 1,
    responsible_id: currentUserId,
  };
}

function requestError(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue. Réessayez.";
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR", { dateStyle: "long" });
}

function formatDateSelection(entry: DesiredDateWaitlistEntry): string {
  if (entry.preferred_dates.length > 0) return entry.preferred_dates.map(formatDate).join(", ");
  if (entry.flexible_start && entry.flexible_end) return `Du ${formatDate(entry.flexible_start)} au ${formatDate(entry.flexible_end)}`;
  return "Période non renseignée";
}

function transitionLabel(transition: DesiredDateWaitlistTransition): string {
  return ({ contact: "Marquer comme contactée", convert: "Convertir", lose: "Marquer comme perdue", cancel: "Annuler" })[transition];
}

function availableTransitions(status: DesiredDateWaitlistStatus): DesiredDateWaitlistTransition[] {
  if (status === "new") return ["contact"];
  if (status === "contacted") return ["convert", "lose", "cancel"];
  return [];
}

export default function DesiredDatesPage({ canSensitiveWrite, currentUserId, onNavigate }: DesiredDatesPageProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [entries, setEntries] = useState<DesiredDateWaitlistEntry[]>([]);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | DesiredDateWaitlistStatus>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | DesiredDateBusinessScope>("all");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>("preferred");
  const [payload, setPayload] = useState<DesiredDateWaitlistCreatePayload>(() => initialPayload(currentUserId));
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition>(null);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const actionOpenerRef = useRef<HTMLElement | null>(null);
  const formDialogRef = useRef<HTMLDivElement | null>(null);
  const confirmationRef = useRef<HTMLDivElement | null>(null);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;

  const loadCustomers = useCallback(async (signal?: AbortSignal) => {
    setCustomerLoading(true);
    setLoadError(null);
    try {
      const data = await getCustomers(undefined, signal);
      if (signal?.aborted) return;
      setCustomers(data.filter((customer) => customer.is_active && !customer.is_deleted));
    } catch (error) {
      if (!signal?.aborted) setLoadError(requestError(error));
    } finally {
      if (!signal?.aborted) setCustomerLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async (customerId: string, signal?: AbortSignal) => {
    if (!customerId) {
      setEntries([]);
      setSelectedEntryId(null);
      return;
    }
    setEntriesLoading(true);
    setLoadError(null);
    try {
      const data = await getDesiredDateWaitlistEntries(customerId, signal);
      if (signal?.aborted) return;
      setEntries(data);
      setSelectedEntryId(null);
    } catch (error) {
      if (!signal?.aborted) setLoadError(requestError(error));
    } finally {
      if (!signal?.aborted) setEntriesLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCustomers(controller.signal);
    return () => controller.abort();
  }, [loadCustomers]);

  useEffect(() => {
    const controller = new AbortController();
    void loadEntries(selectedCustomerId, controller.signal);
    return () => controller.abort();
  }, [loadEntries, selectedCustomerId]);

  useEffect(() => {
    if (formOpen) formDialogRef.current?.focus();
  }, [formOpen]);

  useEffect(() => {
    if (pendingTransition) confirmationRef.current?.focus();
  }, [pendingTransition]);

  const visibleEntries = useMemo(() => entries.filter((entry) => (
    (statusFilter === "all" || entry.status === statusFilter)
    && (scopeFilter === "all" || entry.business_scope === scopeFilter)
    && (!responsibleFilter.trim() || entry.responsible_id.toLocaleLowerCase().includes(responsibleFilter.trim().toLocaleLowerCase()))
  )), [entries, responsibleFilter, scopeFilter, statusFilter]);

  const updatePayload = <Key extends keyof DesiredDateWaitlistCreatePayload>(key: Key, value: DesiredDateWaitlistCreatePayload[Key]) => {
    setPayload((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
  };

  const openForm = (event: React.MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    setPayload(initialPayload(currentUserId));
    setDateMode("preferred");
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
    if (!selectedCustomerId) errors.business_scope = "Sélectionnez d'abord un client ou prospect.";
    if (!payload.responsible_id.trim()) errors.responsible_id = "Indiquez l'identifiant du responsable autorisé.";
    if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) errors.quantity = "La quantité doit être un entier positif.";
    if (dateMode === "preferred" && !(payload.preferred_dates?.filter(Boolean).length)) {
      errors.preferred_dates = "Indiquez au moins une date souhaitée.";
    }
    if (dateMode === "flexible" && (!payload.flexible_start || !payload.flexible_end)) {
      errors.flexible_start = "Indiquez les deux bornes de la période flexible.";
    }
    if (payload.flexible_start && payload.flexible_end && payload.flexible_start > payload.flexible_end) {
      errors.flexible_end = "La fin doit être postérieure ou égale au début.";
    }
    return errors;
  };

  const handleScopeChange = (scope: DesiredDateBusinessScope) => {
    updatePayload("business_scope", scope);
    const nextInterest = INTEREST_OPTIONS[scope][0].value;
    updatePayload("interest_kind", nextInterest);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !selectedCustomerId) return;

    const preferredDates = (payload.preferred_dates ?? []).filter(Boolean);
    const requestPayload: DesiredDateWaitlistCreatePayload = dateMode === "preferred"
      ? { ...payload, preferred_dates: preferredDates, flexible_start: undefined, flexible_end: undefined }
      : { ...payload, preferred_dates: undefined };
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const saved = await createDesiredDateWaitlistEntry(selectedCustomerId, requestPayload);
      setEntries((current) => [...current, saved]);
      setSelectedEntryId(saved.id);
      closeForm();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormErrors((current) => ({
          ...current,
          ...Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key, messages.join(" ")])),
        }));
      }
      setSubmitError(requestError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeConfirmation = () => {
    setPendingTransition(null);
    window.setTimeout(() => actionOpenerRef.current?.focus(), 0);
  };

  const performTransition = async (entry: DesiredDateWaitlistEntry, transition: DesiredDateWaitlistTransition) => {
    if (!selectedCustomerId) return;
    setTransitioningId(entry.id);
    setTransitionError(null);
    try {
      const saved = await transitionDesiredDateWaitlistEntry(selectedCustomerId, entry.id, transition);
      setEntries((current) => current.map((item) => item.id === saved.id ? saved : item));
      setSelectedEntryId(saved.id);
      closeConfirmation();
    } catch (error) {
      setTransitionError(requestError(error));
    } finally {
      setTransitioningId(null);
    }
  };

  const requestTransition = (entry: DesiredDateWaitlistEntry, transition: DesiredDateWaitlistTransition, event: React.MouseEvent<HTMLButtonElement>) => {
    actionOpenerRef.current = event.currentTarget;
    if (transition === "contact") {
      void performTransition(entry, transition);
      return;
    }
    setPendingTransition({ entry, transition });
  };

  const trapDialogFocus = (event: React.KeyboardEvent<HTMLDivElement>, close: () => void, root: React.RefObject<HTMLDivElement | null>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !root.current) return;
    const focusable = [...root.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]")];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (document.activeElement === root.current) {
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

  return (
    <div className="page active space-y-6 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dates souhaitées</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Suivi commercial non bloquant, rattaché à un client ou prospect.</p>
        </div>
        {canSensitiveWrite ? (
          <button type="button" onClick={openForm} disabled={!selectedCustomerId} className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            Nouvelle demande
          </button>
        ) : <span className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Lecture seule</span>}
      </header>

      {customerLoading ? <section className="rounded-2xl border border-slate-200 bg-white p-10 dark:border-slate-700 dark:bg-slate-800"><LoadingSpinner message="Chargement des clients et prospects…" /></section> : null}
      {loadError ? <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800"><p>{loadError}</p><button type="button" onClick={() => { void loadCustomers(); void loadEntries(selectedCustomerId); }} className="mt-3 min-h-11 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Réessayer</button></section> : null}

      {!customerLoading && !loadError ? <>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-800">
          <label className="block max-w-xl text-sm font-semibold text-slate-700 dark:text-slate-200">Client ou prospect
            <select aria-label="Client ou prospect" value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              <option value="">Sélectionner un client ou prospect…</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.display_name} — {customer.lifecycle_status === "prospect" ? "Prospect" : "Client"}</option>)}
            </select>
          </label>
          {!selectedCustomerId ? <p role="status" className="mt-3 text-sm text-slate-500">Sélectionnez un client ou prospect pour consulter ses dates souhaitées réelles.</p> : null}
          {canSensitiveWrite && !selectedCustomerId ? <p className="mt-2 text-xs text-slate-500">La création est disponible après sélection du client ou prospect concerné.</p> : null}
        </section>

        {selectedCustomerId ? <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div><h2 className="text-lg font-bold text-slate-800 dark:text-white">Demandes de {selectedCustomer?.display_name}</h2><p className="text-sm text-slate-500">Les filtres s'appliquent à la liste chargée pour ce client uniquement.</p></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Statut<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | DesiredDateWaitlistStatus)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"><option value="all">Tous</option>{Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Scope<select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as "all" | DesiredDateBusinessScope)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"><option value="all">Tous</option><option value="hahitantsoa">Hahitantsoa</option><option value="titan">Titan</option></select></label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Responsable<input value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900" placeholder="Identifiant" /></label>
            </div>
          </div>

          {entriesLoading ? <LoadingSpinner message="Chargement des dates souhaitées…" /> : null}
          {!entriesLoading && visibleEntries.length === 0 ? <EmptyState title="Aucune date souhaitée" message={entries.length === 0 ? "Aucune demande n'est enregistrée pour ce client ou prospect." : "Aucune demande ne correspond aux filtres actifs."} icon="fa-calendar-xmark" /> : null}
          {!entriesLoading && visibleEntries.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-3">Dates / période</th><th className="p-3">Scope</th><th className="p-3">Intérêt</th><th className="p-3">Quantité</th><th className="p-3">Responsable</th><th className="p-3">Statut</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{visibleEntries.map((entry) => <tr key={entry.id} className="border-b border-slate-100 dark:border-slate-700"><td className="p-3 font-medium text-slate-800 dark:text-white">{formatDateSelection(entry)}</td><td className="p-3">{entry.business_scope === "titan" ? "Titan" : "Hahitantsoa"}</td><td className="p-3">{INTEREST_OPTIONS[entry.business_scope].find((option) => option.value === entry.interest_kind)?.label ?? entry.interest_kind}</td><td className="p-3">{entry.quantity}</td><td className="p-3 font-mono text-xs">{entry.responsible_id}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASSES[entry.status]}`}>{STATUS_LABELS[entry.status]}</span></td><td className="p-3 text-right whitespace-nowrap"><button type="button" onClick={() => setSelectedEntryId(entry.id)} className="min-h-10 px-2 text-indigo-700 hover:underline dark:text-indigo-300">Voir le détail</button>{canSensitiveWrite ? availableTransitions(entry.status).map((transition) => <button key={transition} type="button" disabled={transitioningId === entry.id} onClick={(event) => requestTransition(entry, transition, event)} className={`min-h-10 px-2 hover:underline disabled:cursor-wait ${transition === "cancel" || transition === "lose" ? "text-rose-700 dark:text-rose-300" : "text-indigo-700 dark:text-indigo-300"}`}>{transitionLabel(transition)}</button>) : null}</td></tr>)}</tbody></table></div> : null}
          {transitionError ? <p role="alert" className="mt-3 text-sm text-rose-700">{transitionError}</p> : null}
        </section> : null}

        {selectedEntry && selectedCustomer ? <aside aria-labelledby="desired-date-detail-title" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-slate-800"><div className="flex items-start justify-between gap-4"><div><h2 id="desired-date-detail-title" className="text-lg font-bold text-slate-900 dark:text-white">Détail de la demande</h2><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatDateSelection(selectedEntry)} · {STATUS_LABELS[selectedEntry.status]}</p></div><button type="button" onClick={() => setSelectedEntryId(null)} className="min-h-10 px-2 text-sm text-slate-700 hover:underline dark:text-slate-300">Fermer</button></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold text-slate-600 dark:text-slate-300">Client ou prospect</dt><dd><button type="button" onClick={() => onNavigate("customer", selectedCustomer.id)} className="text-indigo-700 hover:underline dark:text-indigo-300">{selectedCustomer.display_name}</button></dd></div><div><dt className="font-semibold text-slate-600 dark:text-slate-300">Responsable</dt><dd className="font-mono text-xs">{selectedEntry.responsible_id}</dd></div><div><dt className="font-semibold text-slate-600 dark:text-slate-300">Scope</dt><dd>{selectedEntry.business_scope === "titan" ? "Titan" : "Hahitantsoa"}</dd></div><div><dt className="font-semibold text-slate-600 dark:text-slate-300">Dernière mise à jour</dt><dd>{new Date(selectedEntry.updated_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</dd></div></dl><p className="mt-4 rounded-lg bg-white/80 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">La conversion ici est uniquement une transition de statut. Elle ne crée pas de réservation, de proforma, de contrat ni de paiement : la préparation d'un brouillon de réservation reste une action humaine future.</p></aside> : null}
      </> : null}

      {formOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="desired-date-form-title" ref={formDialogRef} tabIndex={-1} onKeyDown={(event) => trapDialogFocus(event, closeForm, formDialogRef)}><div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="desired-date-form-title" className="text-xl font-bold text-slate-900 dark:text-white">Nouvelle date souhaitée</h2><p className="text-sm text-slate-500">Pour {selectedCustomer?.display_name}. Les champs correspondent au contrat backend publié.</p></div><button type="button" onClick={closeForm} className="min-h-10 px-2 text-slate-700 dark:text-slate-300" aria-label="Fermer le formulaire">×</button></div><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Scope<select value={payload.business_scope} onChange={(event) => handleScopeChange(event.target.value as DesiredDateBusinessScope)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900"><option value="titan">Titan</option><option value="hahitantsoa">Hahitantsoa</option></select></label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Intérêt<select value={payload.interest_kind} onChange={(event) => updatePayload("interest_kind", event.target.value as DesiredDateInterestKind)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900">{INTEREST_OPTIONS[payload.business_scope].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Quantité<input aria-label="Quantité" type="number" min="1" step="1" value={payload.quantity} onChange={(event) => updatePayload("quantity", Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" />{formErrors.quantity ? <span className="text-xs text-rose-700">{formErrors.quantity}</span> : null}</label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Identifiant du responsable<input aria-label="Identifiant du responsable" value={payload.responsible_id} onChange={(event) => updatePayload("responsible_id", event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" />{formErrors.responsible_id ? <span className="text-xs text-rose-700">{formErrors.responsible_id}</span> : null}</label></div><fieldset><legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Type de dates</legend><div className="mt-2 flex gap-4"><label><input type="radio" checked={dateMode === "preferred"} onChange={() => setDateMode("preferred")} /> Dates précises</label><label><input type="radio" checked={dateMode === "flexible"} onChange={() => setDateMode("flexible")} /> Période flexible</label></div></fieldset>{dateMode === "preferred" ? <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((index) => <label key={index} className="text-sm font-semibold text-slate-700 dark:text-slate-200">Date souhaitée {index + 1}<input aria-label={`Date souhaitée ${index + 1}`} type="date" value={payload.preferred_dates?.[index] ?? ""} onChange={(event) => { const dates = [...(payload.preferred_dates ?? [])]; dates[index] = event.target.value; updatePayload("preferred_dates", dates); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" /></label>)}</div> : <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Début flexible<input type="date" value={payload.flexible_start ?? ""} onChange={(event) => updatePayload("flexible_start", event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" /></label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fin flexible<input type="date" value={payload.flexible_end ?? ""} onChange={(event) => updatePayload("flexible_end", event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900" /></label></div>}{formErrors.preferred_dates || formErrors.flexible_start || formErrors.flexible_end ? <p role="alert" className="text-sm text-rose-700">{formErrors.preferred_dates ?? formErrors.flexible_start ?? formErrors.flexible_end}</p> : null}{submitError ? <p role="alert" className="text-sm text-rose-700">{submitError}</p> : null}<div className="flex flex-wrap justify-end gap-3"><button type="button" onClick={closeForm} disabled={isSubmitting} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200">Annuler</button><button type="submit" disabled={isSubmitting} className="min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-wait">{isSubmitting ? "Enregistrement…" : "Enregistrer la demande"}</button></div></form></div></div> : null}

      {pendingTransition ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="desired-date-transition-title" ref={confirmationRef} tabIndex={-1} onKeyDown={(event) => trapDialogFocus(event, closeConfirmation, confirmationRef)}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"><h2 id="desired-date-transition-title" className="text-lg font-bold text-slate-900 dark:text-white">{pendingTransition.transition === "convert" ? "Confirmer la conversion" : `Confirmer : ${transitionLabel(pendingTransition.transition)}`}</h2><p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{pendingTransition.transition === "convert" ? "Cette demande sera marquée convertie. Aucun brouillon de réservation, proforma, contrat ou paiement ne sera créé automatiquement." : "Cette transition est terminale et ne pourra pas être annulée depuis cette interface."}</p><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={closeConfirmation} disabled={transitioningId === pendingTransition.entry.id} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200">Retour</button><button type="button" onClick={() => void performTransition(pendingTransition.entry, pendingTransition.transition)} disabled={transitioningId === pendingTransition.entry.id} className="min-h-11 rounded-lg bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:cursor-wait">{pendingTransition.transition === "convert" ? "Confirmer la conversion" : "Confirmer"}</button></div></div></div> : null}
    </div>
  );
}
