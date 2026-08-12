import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  activatePayrollRuleSet,
  archivePayrollRuleSet,
  confirmPayrollRuleSetFields,
  createPayrollRuleSet,
  duplicatePayrollRuleSet,
  getPayrollRuleSets,
  previewPayrollRuleSet,
  submitPayrollRuleSet,
  updatePayrollRuleSet,
} from "../api";
import type { PayrollRuleSet, PayrollRuleSetCreatePayload } from "../types";

type PayrollRulesAccess = {
  canView: boolean;
  canEdit: boolean;
  canActivate: boolean;
};

const emptyForm: PayrollRuleSetCreatePayload = {
  label: "",
  effective_from: "",
  effective_until: null,
  source_reference: "",
  validation_note: "",
  irsa_brackets: [],
  irsa_minimum: null,
  irsa_abatement: null,
  dependent_allowance: null,
  contribution_base_definition: "",
  cnaps_employee_rate: null,
  cnaps_employer_rate: null,
  ostie_employee_rate: null,
  ostie_employer_rate: null,
  fmfp_rate: null,
  contribution_cap: null,
  overtime_rules: {},
  payslip_contexture: {},
  dns_format: {},
  ostie_format: {},
  collective_agreement: {},
};

const statusLabel: Record<string, string> = {
  draft: "Brouillon",
  pending_review: "À valider",
  active: "Actif",
  archived: "Archivé",
};

function jsonText(value: Record<string, unknown> | Array<Record<string, string>>): string {
  return JSON.stringify(value, null, 2);
}

function parseJson(value: string, label: string): Record<string, unknown> | Array<Record<string, string>> {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} doit contenir un JSON valide.`);
  }
}

export default function PayrollRulesPanel({ access }: { access: PayrollRulesAccess }) {
  const [ruleSets, setRuleSets] = useState<PayrollRuleSet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PayrollRuleSetCreatePayload>(emptyForm);
  const [jsonFields, setJsonFields] = useState({
    irsa_brackets: "[]",
    overtime_rules: "{}",
    payslip_contexture: "{}",
    dns_format: "{}",
    ostie_format: "{}",
    collective_agreement: "{}",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationSalary, setSimulationSalary] = useState("1000000");
  const [simulation, setSimulation] = useState<Record<string, string | boolean> | null>(null);

  const selected = useMemo(
    () => ruleSets.find((item) => item.id === selectedId) ?? null,
    [ruleSets, selectedId],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPayrollRuleSets();
      setRuleSets(data);
      if (!selectedId && data[0]) {
        setSelectedId(data[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible de charger les règles de paie.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!access.canView) {
      setLoading(false);
      return;
    }
    void load();
  }, [access.canView, load]);

  useEffect(() => {
    if (!selected) return;
    setForm({
      label: selected.label,
      effective_from: selected.effective_from,
      effective_until: selected.effective_until,
      source_reference: selected.source_reference,
      validation_note: selected.validation_note,
      irsa_brackets: selected.irsa_brackets,
      irsa_minimum: selected.irsa_minimum,
      irsa_abatement: selected.irsa_abatement,
      dependent_allowance: selected.dependent_allowance,
      contribution_base_definition: selected.contribution_base_definition,
      cnaps_employee_rate: selected.cnaps_employee_rate,
      cnaps_employer_rate: selected.cnaps_employer_rate,
      ostie_employee_rate: selected.ostie_employee_rate,
      ostie_employer_rate: selected.ostie_employer_rate,
      fmfp_rate: selected.fmfp_rate,
      contribution_cap: selected.contribution_cap,
      overtime_rules: selected.overtime_rules,
      payslip_contexture: selected.payslip_contexture,
      dns_format: selected.dns_format,
      ostie_format: selected.ostie_format,
      collective_agreement: selected.collective_agreement,
    });
    setJsonFields({
      irsa_brackets: jsonText(selected.irsa_brackets),
      overtime_rules: jsonText(selected.overtime_rules),
      payslip_contexture: jsonText(selected.payslip_contexture),
      dns_format: jsonText(selected.dns_format),
      ostie_format: jsonText(selected.ostie_format),
      collective_agreement: jsonText(selected.collective_agreement),
    });
  }, [selected]);

  const setField = <K extends keyof PayrollRuleSetCreatePayload>(
    key: K,
    value: PayrollRuleSetCreatePayload[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const newDraft = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setJsonFields({ irsa_brackets: "[]", overtime_rules: "{}", payslip_contexture: "{}", dns_format: "{}", ostie_format: "{}", collective_agreement: "{}" });
    setError(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const payload: PayrollRuleSetCreatePayload = {
        ...form,
        irsa_brackets: parseJson(jsonFields.irsa_brackets, "Les tranches IRSA") as Array<Record<string, string>>,
        overtime_rules: parseJson(jsonFields.overtime_rules, "Les règles d'heures supplémentaires") as Record<string, unknown>,
        payslip_contexture: parseJson(jsonFields.payslip_contexture, "La contexture du bulletin") as Record<string, unknown>,
        dns_format: parseJson(jsonFields.dns_format, "Le format DNS") as Record<string, unknown>,
        ostie_format: parseJson(jsonFields.ostie_format, "Le format OSTIE") as Record<string, unknown>,
        collective_agreement: parseJson(jsonFields.collective_agreement, "La convention collective") as Record<string, unknown>,
      };
      const result = selectedId
        ? await updatePayrollRuleSet(selectedId, payload)
        : await createPayrollRuleSet(payload);
      setSelectedId(result.id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la configuration.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: (id: string) => Promise<PayrollRuleSet>) => {
    if (!selectedId) return;
    try {
      setSaving(true);
      setError(null);
      await action(selectedId);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setSaving(false);
    }
  };

  const confirmAllFields = async () => {
    if (!selectedId || !selected) return;
    const fields = Object.keys(selected.completeness_errors).reduce<Record<string, Record<string, string>>>((result, field) => {
      result[field] = { source: "Confirmation DRH dans l’application" };
      return result;
    }, {});
    try {
      setSaving(true);
      setError(null);
      await confirmPayrollRuleSetFields(selectedId, fields);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Confirmation impossible.");
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    if (!selectedId) return;
    try {
      setSaving(true);
      const result = await duplicatePayrollRuleSet(selectedId);
      setSelectedId(result.id);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Duplication impossible.");
    } finally {
      setSaving(false);
    }
  };

  const simulate = async () => {
    if (!selectedId) return;
    try {
      setSaving(true);
      setError(null);
      setSimulation(await previewPayrollRuleSet(selectedId, simulationSalary));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Simulation impossible.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-slate-500">Chargement des paramètres de paie…</div>;

  if (!access.canView) {
    return (
      <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900" role="alert">
        Votre rôle ne permet pas de consulter les paramètres RH et paie.
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" aria-labelledby="payroll-rules-title">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="payroll-rules-title" className="text-lg font-bold text-slate-800">Paramètres RH et paie</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">La DRH peut préparer les valeurs manquantes. Une configuration doit être complète et validée avant d’être utilisée pour une paie définitive.</p>
        </div>
        {access.canEdit && <button type="button" onClick={newDraft} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Nouveau brouillon</button>}
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <div className="space-y-2" aria-label="Versions des règles de paie">
          {ruleSets.length === 0 && <p className="text-sm text-slate-500">Aucune configuration enregistrée.</p>}
          {ruleSets.map((item) => (
            <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${selectedId === item.id ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white"}`}>
              <span className="block font-semibold text-slate-800">{item.label || "Sans intitulé"}</span>
              <span className="mt-1 block text-xs text-slate-500">{statusLabel[item.status]} · {item.effective_from || "Date non définie"}</span>
            </button>
          ))}
        </div>
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Intitulé *<input required value={form.label} onChange={(e) => setField("label", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">Date d’effet *<input required type="date" value={form.effective_from} onChange={(e) => setField("effective_from", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">Référence / source<input value={form.source_reference} onChange={(e) => setField("source_reference", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">Plafond cotisations<input type="number" value={form.contribution_cap ?? ""} onChange={(e) => setField("contribution_cap", e.target.value || null)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {["irsa_minimum", "irsa_abatement", "dependent_allowance", "cnaps_employee_rate", "cnaps_employer_rate", "ostie_employee_rate", "ostie_employer_rate", "fmfp_rate"].map((key) => (
              <label key={key} className="text-sm font-medium text-slate-700">{key.replaceAll("_", " ")}<input type="number" step="0.0001" value={(form[key as keyof PayrollRuleSetCreatePayload] as string | null) ?? ""} onChange={(e) => setField(key as keyof PayrollRuleSetCreatePayload, e.target.value || null as never)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            ))}
          </div>
          <label className="block text-sm font-medium text-slate-700">Base des cotisations<textarea value={form.contribution_base_definition} onChange={(e) => setField("contribution_base_definition", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(jsonFields).map(([key, value]) => (
              <label key={key} className="text-sm font-medium text-slate-700">{key.replaceAll("_", " ")}<textarea value={value} onChange={(e) => setJsonFields((current) => ({ ...current, [key]: e.target.value }))} rows={6} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" aria-label={key} /></label>
            ))}
          </div>
          <label className="block text-sm font-medium text-slate-700">Note de validation<textarea value={form.validation_note} onChange={(e) => setField("validation_note", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          {selected && Object.keys(selected.completeness_errors).length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Champs restant à compléter :</strong><ul className="mt-1 list-disc pl-5">{Object.entries(selected.completeness_errors).map(([key, message]) => <li key={key}>{key} — {message}</li>)}</ul></div>}
          {selected && <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong>Confirmation des champs</strong><p className="mt-1">Chaque valeur doit être confirmée par la DRH avant soumission.</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(selected.field_confirmations ?? {}).map(([key, metadata]) => <span key={key} className={`rounded-full px-2 py-1 text-xs ${metadata.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : metadata.status === "proposed" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{key}: {metadata.status}</span>)}</div>{access.canEdit && selected.status === "draft" && <button type="button" disabled={saving || Object.keys(selected.completeness_errors).length === 0} onClick={() => void confirmAllFields()} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">Confirmer les champs remplis</button>}</div>}
          {selected && <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900"><strong>Simulation indicative</strong><p className="mt-1">Aucun bulletin ni montant comptable n’est créé.</p><div className="mt-2 flex gap-2"><input aria-label="Salaire brut à simuler" type="number" value={simulationSalary} onChange={(e) => setSimulationSalary(e.target.value)} className="w-44 rounded-lg border border-indigo-200 px-3 py-2" /><button type="button" disabled={saving} onClick={() => void simulate()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Simuler</button></div>{simulation && <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2">{Object.entries(simulation).filter(([key]) => key !== "simulation_only").map(([key, value]) => <span key={key}><strong>{key.replaceAll("_", " ")} :</strong> {value}</span>)}</div>}</div>}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {access.canEdit && (!selected || selected.status === "draft") && <button disabled={saving} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer le brouillon"}</button>}
            {access.canEdit && selected?.status === "draft" && <button type="button" disabled={saving} onClick={() => void runAction(submitPayrollRuleSet)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Soumettre à validation</button>}
            {access.canActivate && selected?.status === "pending_review" && <button type="button" disabled={saving} onClick={() => void runAction(activatePayrollRuleSet)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Activer la configuration</button>}
            {access.canEdit && selected && selected.status !== "active" && selected.status !== "archived" && <button type="button" disabled={saving} onClick={() => void runAction(archivePayrollRuleSet)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Archiver</button>}
            {access.canEdit && selected && <button type="button" disabled={saving} onClick={() => void duplicate()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Dupliquer la version</button>}
          </div>
        </form>
      </div>
    </section>
  );
}
