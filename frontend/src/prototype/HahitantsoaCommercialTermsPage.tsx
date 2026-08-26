import { type FormEvent, useEffect, useState } from "react";
import { getHahitantsoaCommercialTerms, updateHahitantsoaCommercialTerms } from "../api";
import type { HahitantsoaCommercialTerms, HahitantsoaCommercialTermsUpdatePayload } from "../types";

type FormState = {
  base_space_rental_amount: string;
  included_guest_count: string;
  excess_guest_amount: string;
  bare_deposit_amount: string;
  logistics_deposit_amount: string;
  night_option_1_amount: string;
  night_option_2_amount: string;
  night_security_amount: string;
  caution_amount: string;
};

const emptyForm: FormState = {
  base_space_rental_amount: "",
  included_guest_count: "",
  excess_guest_amount: "",
  bare_deposit_amount: "",
  logistics_deposit_amount: "",
  night_option_1_amount: "",
  night_option_2_amount: "",
  night_security_amount: "",
  caution_amount: "",
};

function toForm(terms: HahitantsoaCommercialTerms): FormState {
  return {
    base_space_rental_amount: terms.base_space_rental_amount,
    included_guest_count: String(terms.included_guest_count),
    excess_guest_amount: terms.excess_guest_amount,
    bare_deposit_amount: terms.bare_deposit_amount,
    logistics_deposit_amount: terms.logistics_deposit_amount,
    night_option_1_amount: terms.night_option_1_amount || "300000",
    night_option_2_amount: terms.night_option_2_amount || "500000",
    night_security_amount: terms.night_security_amount || "120000",
    caution_amount: terms.caution_amount || "500000",
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
      ["night_option_1_amount", "Tarif option nuit 1"],
      ["night_option_2_amount", "Tarif option nuit 2"],
      ["night_security_amount", "Tarif sécurité nuit"],
      ["caution_amount", "Montant caution de garantie"],
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
      night_option_1_amount: form.night_option_1_amount,
      night_option_2_amount: form.night_option_2_amount,
      night_security_amount: form.night_security_amount,
      caution_amount: form.caution_amount,
    };
    try {
      const terms = await updateHahitantsoaCommercialTerms(payload);
      setForm(toForm(terms));
      setNotice("Les tarifs et modalités officielles ont été enregistrés avec succès.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer les modalités.");
    } finally { setSaving(false); }
  };

  const spaceFields: Array<[keyof FormState, string, string]> = [
    ["base_space_rental_amount", "Tarif de base du chapiteau", "Ar — forfait jour"],
    ["included_guest_count", "Nombre de convives inclus", "pax"],
    ["excess_guest_amount", "Supplément par convive excédentaire", "Ar / pax"],
  ];

  const nightFields: Array<[keyof FormState, string, string]> = [
    ["night_option_1_amount", "Option Nuit 1 (Fin 21h00 / Sortie 22h30)", "Ar"],
    ["night_option_2_amount", "Option Nuit 2 (Fin 00h00 / Sortie 03h30)", "Ar"],
    ["night_security_amount", "Sécurité nocturne obligatoire", "Ar / nuit"],
  ];

  const depositFields: Array<[keyof FormState, string, string]> = [
    ["bare_deposit_amount", "Acompte — location nue", "Ar"],
    ["logistics_deposit_amount", "Acompte — location + logistique", "Ar"],
    ["caution_amount", "Caution de garantie forfaitaire", "Ar"],
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Navigation Hub */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
        <a
          href="#hahitantsoa-settings"
          className="border-b-2 border-indigo-600 px-4 py-3 text-sm font-bold text-indigo-600 flex items-center gap-2"
        >
          <i className="fas fa-sliders"></i>
          <span>Tarifs & Règles de Base Hahitantsoa</span>
        </a>
        <a
          href="#services"
          className="border-b-2 border-transparent px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2"
        >
          <i className="fas fa-magic"></i>
          <span>Catalogue Visuel des Prestations & Scénographies</span>
        </a>
      </div>

      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-hah-700">Domaine Hahitantsoa • Configuration Commerciale</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Paramétrage des Tarifs & Modalités Officielles</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Ces valeurs alimentent par défaut le tunnel de création de devis et réservations. Modifiables à tout moment pour refléter la grille tarifaire en vigueur.</p>
      </header>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Grille Tarifaire Hahitantsoa</h2>
              <p className="mt-1 text-sm text-slate-500">Valeurs par défaut injectées dans chaque nouveau devis.</p>
            </div>
            {!canEdit && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Lecture seule</span>}
          </div>

          {loading ? (
            <p role="status" className="py-6 text-slate-500">Chargement des paramètres…</p>
          ) : (
            <div className="space-y-6">
              {/* Section 1 : Espace et Convives */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <i className="fa-solid fa-building text-indigo-500"></i>
                  <span>1. Espace Chapiteau & Capacité</span>
                </h3>
                <div className="space-y-3">
                  {spaceFields.map(([field, label, suffix]) => (
                    <label key={field} className="block text-sm font-semibold text-slate-700">
                      {label}
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          aria-label={label}
                          type="number"
                          min="0"
                          step={field === "included_guest_count" ? "1" : "0.01"}
                          value={form[field]}
                          onChange={(event) => setField(field, event.target.value)}
                          disabled={!canEdit || saving}
                          required
                          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal disabled:bg-slate-100"
                        />
                        <span className="w-32 text-xs font-normal text-slate-500">{suffix}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 2 : Options de nuit */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <i className="fa-solid fa-moon text-indigo-500"></i>
                  <span>2. Prolongations Nocturnes & Sécurité</span>
                </h3>
                <div className="space-y-3">
                  {nightFields.map(([field, label, suffix]) => (
                    <label key={field} className="block text-sm font-semibold text-slate-700">
                      {label}
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          aria-label={label}
                          type="number"
                          min="0"
                          step="0.01"
                          value={form[field]}
                          onChange={(event) => setField(field, event.target.value)}
                          disabled={!canEdit || saving}
                          required
                          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal disabled:bg-slate-100"
                        />
                        <span className="w-32 text-xs font-normal text-slate-500">{suffix}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 3 : Acomptes et Caution */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-indigo-500"></i>
                  <span>3. Acomptes & Caution de Garantie</span>
                </h3>
                <div className="space-y-3">
                  {depositFields.map(([field, label, suffix]) => (
                    <label key={field} className="block text-sm font-semibold text-slate-700">
                      {label}
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          aria-label={label}
                          type="number"
                          min="0"
                          step="0.01"
                          value={form[field]}
                          onChange={(event) => setField(field, event.target.value)}
                          disabled={!canEdit || saving}
                          required
                          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal disabled:bg-slate-100"
                        />
                        <span className="w-32 text-xs font-normal text-slate-500">{suffix}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {canEdit && (
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? "Enregistrement en cours…" : "Enregistrer la grille tarifaire"}
                </button>
              )}
            </div>
          )}
        </form>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-hah-100 bg-hah-50 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-hah-950">Synthèse des Règles Commerciales</h2>
            <p className="mt-3 text-sm leading-6 text-hah-900">
              Jusqu’à {form.included_guest_count || 250} personnes, le loyer de base couvre l'espace. Au-delà, un supplément automatique s'applique par convive.
            </p>
            {!loading && (
              <dl className="mt-5 space-y-2.5 border-t border-hah-200 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-hah-800">Loyer de base</dt>
                  <dd className="font-bold text-hah-950">{formatAmount(form.base_space_rental_amount)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-hah-800">Capacité incluse</dt>
                  <dd className="font-bold text-hah-950">{form.included_guest_count} pax</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-hah-800">Dépassement pax</dt>
                  <dd className="font-bold text-hah-950">+{formatAmount(form.excess_guest_amount)} / pax</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-hah-200 pt-2">
                  <dt className="text-hah-800">Option Nuit 1 (+22h30)</dt>
                  <dd className="font-bold text-hah-950">+{formatAmount(form.night_option_1_amount)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-hah-800">Option Nuit 2 (+03h30)</dt>
                  <dd className="font-bold text-hah-950">+{formatAmount(form.night_option_2_amount)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-hah-800">Sécurité de nuit (obligatoire)</dt>
                  <dd className="font-bold text-hah-950">+{formatAmount(form.night_security_amount)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-hah-200 pt-2">
                  <dt className="text-hah-800">Caution de garantie</dt>
                  <dd className="font-bold text-hah-950">{formatAmount(form.caution_amount)}</dd>
                </div>
              </dl>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Échéancier de Règlement</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="font-bold text-indigo-600">1. Acompte :</span>
                <span>Exigible à la signature ({formatAmount(form.bare_deposit_amount)} ou {formatAmount(form.logistics_deposit_amount)}).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-indigo-600">2. 1ère tranche :</span>
                <span>50% du solde restant exigible à M-1 (J-30).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-indigo-600">3. Solde final & Caution :</span>
                <span>Solde restant + caution de {formatAmount(form.caution_amount)} exigibles à J-10.</span>
              </li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
