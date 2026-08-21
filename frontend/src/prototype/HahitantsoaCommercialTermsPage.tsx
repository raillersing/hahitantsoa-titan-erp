import { type FormEvent, useEffect, useState } from "react";
import { getHahitantsoaCommercialTerms, updateHahitantsoaCommercialTerms } from "../api";
import type { HahitantsoaCommercialTerms, HahitantsoaCommercialTermsUpdatePayload } from "../types";

type FormState = {
  base_space_rental_amount: string;
  included_guest_count: string;
  excess_guest_amount: string;
  bare_deposit_amount: string;
  logistics_deposit_amount: string;
};

const emptyForm: FormState = {
  base_space_rental_amount: "",
  included_guest_count: "",
  excess_guest_amount: "",
  bare_deposit_amount: "",
  logistics_deposit_amount: "",
};

function toForm(terms: HahitantsoaCommercialTerms): FormState {
  return {
    base_space_rental_amount: terms.base_space_rental_amount,
    included_guest_count: String(terms.included_guest_count),
    excess_guest_amount: terms.excess_guest_amount,
    bare_deposit_amount: terms.bare_deposit_amount,
    logistics_deposit_amount: terms.logistics_deposit_amount,
  };
}

function formatAmount(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("fr-FR")} Ar` : "—";
}

export default function HahitantsoaCommercialTermsPage({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void getHahitantsoaCommercialTerms(controller.signal)
      .then((terms) => setForm(toForm(terms)))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Impossible de charger les modalités.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
    setNotice(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const numericFields = [
      ["base_space_rental_amount", "Tarif de base"],
      ["included_guest_count", "Nombre de pax inclus"],
      ["excess_guest_amount", "Tarif par pax excédentaire"],
      ["bare_deposit_amount", "Acompte location nue"],
      ["logistics_deposit_amount", "Acompte location + logistique"],
    ] as const;
    const invalid = numericFields.find(([field]) => !Number.isFinite(Number(form[field])) || Number(form[field]) < 0);
    if (invalid) {
      setError(`${invalid[1]} doit être un nombre positif ou nul.`);
      return;
    }
    setSaving(true); setError(null); setNotice(null);
    const payload: HahitantsoaCommercialTermsUpdatePayload = {
      base_space_rental_amount: form.base_space_rental_amount,
      included_guest_count: Number(form.included_guest_count),
      excess_guest_amount: form.excess_guest_amount,
      bare_deposit_amount: form.bare_deposit_amount,
      logistics_deposit_amount: form.logistics_deposit_amount,
    };
    try {
      const terms = await updateHahitantsoaCommercialTerms(payload);
      setForm(toForm(terms));
      setNotice("Les tarifs et acomptes par défaut ont été enregistrés.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer les modalités.");
    } finally { setSaving(false); }
  };

  const fields: Array<[keyof FormState, string, string]> = [
    ["base_space_rental_amount", "Tarif de base de l’espace", "Ar — hors articles de location"],
    ["included_guest_count", "Nombre de pax inclus", "pax"],
    ["excess_guest_amount", "Supplément par pax excédentaire", "Ar / pax"],
    ["bare_deposit_amount", "Acompte — location nue", "Ar"],
    ["logistics_deposit_amount", "Acompte — location + logistique", "Ar"],
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-hah-700">Hahitantsoa</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Tarifs & modalités commerciales</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Ces valeurs alimentent automatiquement les nouveaux assistants de réservation. Les articles, packs et options logistiques restent calculés séparément.</p>
      </header>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-lg font-bold text-slate-900">Valeurs par défaut</h2><p className="mt-1 text-sm text-slate-500">Modifiables avant une nouvelle réservation.</p></div>
            {!canEdit && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Lecture seule</span>}
          </div>
          {loading ? <p role="status" className="mt-6 text-slate-500">Chargement…</p> : <div className="mt-6 space-y-4">
            {fields.map(([field, label, suffix]) => <label key={field} className="block text-sm font-semibold text-slate-700">{label}<div className="mt-1 flex items-center gap-2"><input aria-label={label} type="number" min="0" step={field === "included_guest_count" ? "1" : "0.01"} value={form[field]} onChange={(event) => setField(field, event.target.value)} disabled={!canEdit || saving} required className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal disabled:bg-slate-100" /><span className="w-32 text-xs font-normal text-slate-500">{suffix}</span></div></label>)}
            {canEdit && <button type="submit" disabled={saving} className="w-full rounded-lg bg-hah-700 px-4 py-3 font-semibold text-white hover:bg-hah-800 disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer les valeurs par défaut"}</button>}
          </div>}
        </form>
        <aside className="rounded-2xl border border-hah-100 bg-hah-50 p-6 shadow-sm"><h2 className="text-lg font-bold text-hah-950">Règle appliquée</h2><p className="mt-3 text-sm leading-6 text-hah-900">Jusqu’au nombre de pax inclus, le tarif de base couvre uniquement l’espace. Au-delà, le supplément par pax excédentaire est ajouté. Les articles et packs ne sont jamais inclus dans ce tarif.</p>{!loading && <dl className="mt-5 space-y-3 border-t border-hah-200 pt-5 text-sm"><div className="flex justify-between gap-4"><dt className="text-hah-800">Base</dt><dd className="font-bold text-hah-950">{formatAmount(form.base_space_rental_amount)}</dd></div><div className="flex justify-between gap-4"><dt className="text-hah-800">Seuil</dt><dd className="font-bold text-hah-950">{form.included_guest_count} pax</dd></div><div className="flex justify-between gap-4"><dt className="text-hah-800">Excédent</dt><dd className="font-bold text-hah-950">{formatAmount(form.excess_guest_amount)} / pax</dd></div></dl>}</aside>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Échéancier appliqué aux réservations</h2><p className="mt-2 text-sm leading-6 text-slate-600">L’acompte est demandé à la signature. Le solde restant est divisé en deux tranches égales, exigibles au plus tard à J-30 et J-10. Les paiements partiels restent possibles à tout moment avant ces échéances.</p></section>
    </main>
  );
}
