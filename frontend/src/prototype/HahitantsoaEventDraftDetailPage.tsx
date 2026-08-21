import React, { useCallback, useEffect, useState } from "react";
import {
  confirmHahitantsoaEventDraft,
  confirmPayment,
  createPayment,
  getHahitantsoaEventDraft,
  getHahitantsoaEventDraftConfirmationPreflight,
  getHahitantsoaEventDraftDocumentInstances,
  getHahitantsoaEventDraftPayments,
} from "../api";
import PaymentWhatsAppReminderButton from "../PaymentWhatsAppReminderButton";
import type {
  DocumentInstance,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftConfirmationPreflight,
  Payment,
} from "../types";

type Props = {
  onNavigate: (scope: any, param?: string) => void;
  param?: string;
  onBack?: () => void;
};

function errorMessage(error: any, fallback: string) {
  return error?.message || fallback;
}

export default function HahitantsoaEventDraftDetailPage({ onNavigate, param, onBack }: Props) {
  const [draft, setDraft] = useState<HahitantsoaEventDraft | null>(null);
  const [preflight, setPreflight] = useState<HahitantsoaEventDraftConfirmationPreflight | null>(null);
  const [documents, setDocuments] = useState<DocumentInstance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [depositAmount, setDepositAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!param) {
      setError("Aucun identifiant de dossier Hahitantsoa fourni.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const eventDraft = await getHahitantsoaEventDraft(param);
      const [nextPreflight, nextDocuments, nextPayments] = await Promise.all([
        getHahitantsoaEventDraftConfirmationPreflight(param),
        getHahitantsoaEventDraftDocumentInstances(param),
        getHahitantsoaEventDraftPayments(param),
      ]);
      setDraft(eventDraft);
      setDepositAmount(eventDraft.required_deposit_amount || "");
      setPreflight(nextPreflight);
      setDocuments(nextDocuments);
      setPayments(nextPayments);
    } catch (err) {
      setError(errorMessage(err, "Erreur lors du chargement du dossier Hahitantsoa."));
    } finally {
      setLoading(false);
    }
  }, [param]);

  useEffect(() => {
    void load();
  }, [load]);

  const recordDeposit = async () => {
    if (!param) return;
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Saisissez un montant d'acompte supérieur à zéro.");
      return;
    }
    setBusy("deposit");
    setError(null);
    try {
      const payment = await createPayment({
        hahitantsoa_event_draft: param,
        payment_kind: "deposit",
        payment_method: "cash",
        payment_status: "pending",
        amount: amount.toFixed(2),
        notes: "Acompte enregistré depuis le dossier Hahitantsoa.",
      });
      await confirmPayment(payment.id, {});
      setDepositAmount("");
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible d'enregistrer l'acompte."));
    } finally {
      setBusy(null);
    }
  };

  const confirmDraft = async () => {
    if (!param) return;
    setBusy("confirm");
    setError(null);
    try {
      await confirmHahitantsoaEventDraft(param);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Impossible de confirmer le dossier Hahitantsoa."));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="page active p-8 text-slate-500">Chargement du dossier événement…</div>;
  if (!draft) {
    return (
      <div className="page active mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Dossier introuvable</h1>
          <p className="mt-2 text-rose-600">{error || "Le dossier Hahitantsoa n'est pas accessible."}</p>
          <button className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-white" onClick={() => (onBack ? onBack() : onNavigate("hahitantsoa"))}>Retour</button>
        </div>
      </div>
    );
  }

  const contractExists = documents.some(
    (document) => document.template_key === "hahitantsoa.contract.v1" && (document.status === "generated" || document.status === "issued"),
  );
  const confirmedDeposit = payments.some(
    (payment) => payment.payment_kind === "deposit" && (payment.payment_status === "confirmed" || payment.payment_status === "reconciled"),
  );

  return (
    <div className="page active mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button className="mb-3 text-sm text-slate-500 hover:text-indigo-600" onClick={() => (onBack ? onBack() : onNavigate("hahitantsoa"))}>← Retour</button>
          <h1 className="text-2xl font-bold text-slate-800">{draft.public_reference}</h1>
          <p className="mt-1 text-slate-500">Dossier événement Hahitantsoa · {draft.customer_display_name}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{draft.status === "confirmed" ? "Confirmée" : "En attente"}</span>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="font-bold text-slate-800">Événement</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div><dt className="font-semibold">Nom</dt><dd>{draft.event_name}</dd></div>
            <div><dt className="font-semibold">Lieu</dt><dd>{draft.venue_name || "—"}</dd></div>
            <div><dt className="font-semibold">Période</dt><dd>{new Date(draft.start_at).toLocaleString("fr-FR")} → {new Date(draft.end_at).toLocaleString("fr-FR")}</dd></div>
            <div><dt className="font-semibold">Articles</dt><dd>{draft.lines.length}</dd></div>
          </dl>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="font-bold text-slate-800">Prérequis de confirmation</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li className={contractExists ? "text-emerald-700" : "text-amber-700"}>{contractExists ? "✓ Contrat généré" : "○ Contrat généré requis"}</li>
            <li className={confirmedDeposit ? "text-emerald-700" : "text-amber-700"}>{confirmedDeposit ? "✓ Acompte confirmé" : "○ Acompte confirmé requis"}</li>
            {preflight?.blockers.map((blocker) => <li key={blocker} className="text-rose-700">• {blocker}</li>)}
          </ul>
        </div>
      </section>

      {draft.payment_schedule && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="font-bold text-indigo-950">Échéancier contractuel</h2>
          <p className="mt-1 text-sm text-indigo-800">Les paiements peuvent être enregistrés en plusieurs fois avant chaque échéance.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Acompte à la signature", draft.payment_schedule.deposit_amount, "À la réservation"],
              ["1ère tranche", draft.payment_schedule.first_installment_amount, `Au plus tard le ${new Date(`${draft.payment_schedule.first_installment_due_on}T12:00:00Z`).toLocaleDateString("fr-FR")}`],
              ["2ème tranche", draft.payment_schedule.second_installment_amount, `Au plus tard le ${new Date(`${draft.payment_schedule.second_installment_due_on}T12:00:00Z`).toLocaleDateString("fr-FR")}`],
            ].map(([label, amount, due]) => <div key={label} className="rounded-xl bg-white/80 p-4"><p className="text-xs font-semibold uppercase text-indigo-600">{label}</p><p className="mt-1 text-lg font-bold text-indigo-950">{Number(amount).toLocaleString("fr-FR")} Ar</p><p className="mt-1 text-xs text-indigo-700">{due}</p></div>)}
          </div>
          <p className="mt-4 text-sm font-semibold text-indigo-950">Total du dossier : {Number(draft.payment_schedule.total_amount).toLocaleString("fr-FR")} Ar · Solde après acompte : {Number(draft.payment_schedule.remaining_after_deposit).toLocaleString("fr-FR")} Ar</p>
        </section>
      )}

      <PaymentWhatsAppReminderButton draftId={param || draft.id} businessScope="hahitantsoa" />

      <section className="rounded-2xl border border-slate-100 bg-white p-6">
        <h2 className="font-bold text-slate-800">Actions</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {draft.status === "draft" && !confirmedDeposit && (
            <label className="text-sm text-slate-600">Montant de l'acompte
              <input className="mt-1 block rounded-lg border border-slate-300 px-3 py-2" type="number" min="1" step="0.01" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="Montant" />
            </label>
          )}
          {draft.status === "draft" && !confirmedDeposit && <button className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy !== null} onClick={() => void recordDeposit()}>Enregistrer l'acompte</button>}
          {draft.status === "draft" && preflight?.can_confirm && <button className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy !== null} onClick={() => void confirmDraft()}>Confirmer la réservation</button>}
        </div>
        {!preflight?.can_confirm && draft.status === "draft" && <p className="mt-3 text-sm text-slate-500">La confirmation restera indisponible tant que tous les prérequis ne seront pas satisfaits.</p>}
      </section>
    </div>
  );
}
