import { type FormEvent, useCallback, useEffect, useState } from "react";
import { createBankProfile, getBankProfiles, updateBankProfile } from "../api";
import type { BankProfile, BankProfileCreatePayload } from "../types";

const blankForm: BankProfileCreatePayload = {
  account: "",
  business_scope: "titan",
  account_code: "",
  account_label: "",
  bank_name: "",
  account_holder: "",
  branch: "",
  account_number: "",
  rib: "",
  iban: "",
  swift_bic: "",
  is_default_for_documents: false,
};

const fields = [
  ["bank_name", "Nom de la banque"], ["account_holder", "Titulaire"],
  ["account_code", "Code compte"], ["account_label", "Libellé compte"],
  ["branch", "Agence"], ["account_number", "Numéro de compte"],
  ["rib", "RIB"], ["iban", "IBAN"], ["swift_bic", "SWIFT / BIC"],
] as const;

export default function BankSettingsPage() {
  const [scope, setScope] = useState<"titan" | "hahitantsoa">("titan");
  const [profiles, setProfiles] = useState<BankProfile[]>([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setProfiles(await getBankProfiles(scope)); }
    catch (err) { setError(err instanceof Error ? err.message : "Impossible de charger les banques."); }
    finally { setLoading(false); }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      const { account: _account, ...newBank } = form;
      await createBankProfile({ ...newBank, business_scope: scope });
      setForm({ ...blankForm, business_scope: scope });
      setNotice("Coordonnées bancaires enregistrées."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Impossible d'enregistrer la banque."); }
    finally { setSaving(false); }
  };

  const setDefault = async (profile: BankProfile) => {
    setError(null);
    try { await updateBankProfile(profile.id, { is_default_for_documents: true }); setNotice(`${profile.bank_name} est maintenant la banque par défaut.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Impossible de sélectionner la banque."); }
  };

  return <main className="mx-auto max-w-6xl space-y-6 p-6">
    <header><p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Finance</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Coordonnées bancaires</h1><p className="mt-2 text-slate-600">Gérez les banques utilisées dans les documents de chaque volet.</p></header>
    <div className="flex gap-2" role="tablist" aria-label="Volet bancaire">{(["titan", "hahitantsoa"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={scope === value} onClick={() => { setScope(value); setForm({ ...blankForm, business_scope: value }); }} className={`rounded-lg px-4 py-2 font-semibold ${scope === value ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{value === "titan" ? "Titan" : "Hahitantsoa"}</button>)}</div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Banques configurées</h2>{loading ? <p className="mt-4 text-slate-500" role="status">Chargement…</p> : profiles.length === 0 ? <p className="mt-4 text-slate-500">Aucune banque configurée pour ce volet.</p> : <ul className="mt-4 space-y-3">{profiles.map((profile) => <li key={profile.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{profile.bank_name}</p><p className="text-sm text-slate-600">{profile.account_holder} · {profile.account_code}</p><p className="mt-1 text-xs text-slate-500">RIB : {profile.rib || "—"}</p></div>{profile.is_default_for_documents ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Par défaut</span> : <button type="button" onClick={() => void setDefault(profile)} className="text-sm font-semibold text-indigo-700 hover:underline">Utiliser par défaut</button>}</div></li>)}</ul>}</div>
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Ajouter une banque</h2><div className="mt-4 grid gap-3">{fields.map(([field, label]) => <label key={field} className="text-sm font-semibold text-slate-700">{label}<input value={String(form[field] ?? "")} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} required={["bank_name", "account_holder", "account_code", "account_label"].includes(field)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 font-normal" /></label>)}<label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={Boolean(form.is_default_for_documents)} onChange={(event) => setForm((current) => ({ ...current, is_default_for_documents: event.target.checked }))} /> Utiliser pour les nouveaux documents</label><button type="submit" disabled={saving} className="mt-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? "Enregistrement…" : "Ajouter la banque"}</button></div></form>
    </section>
  </main>;
}
