import type { LifecycleSummary } from "../types";

const nextActionLabels: Record<string, string> = {
  sign_contract: "Faire signer le contrat",
  record_deposit: "Enregistrer l’acompte",
  confirm_reservation: "Confirmer la réservation",
  confirm_event: "Confirmer l’événement",
  complete_operations: "Finaliser les opérations en attente",
  close_dossier: "Clôturer le dossier",
  closed: "Aucune action requise : dossier clôturé",
  cancelled: "Aucune action requise : dossier annulé",
};

const blockerLabels: Record<string, string> = {
  contract_signature_required: "Signature du contrat requise",
  deposit_required: "Acompte requis",
  confirmation_required: "Confirmation requise",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function LifecycleTimeline({ summary }: { summary: LifecycleSummary }) {
  const isClosed = summary.next_action === "closed" || summary.next_action === "cancelled";

  return (
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5" aria-labelledby="lifecycle-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="lifecycle-heading" className="font-bold text-slate-800">Parcours opérationnel</h2>
          <p className="mt-1 text-sm text-slate-600">
            Prochaine action : <strong className="text-slate-800">{nextActionLabels[summary.next_action] || summary.next_action}</strong>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isClosed ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
          {isClosed ? "Terminé" : "En cours"}
        </span>
      </div>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.steps.map((step, index) => {
          const done = step.status === "done";
          const occurredAt = formatDate(step.occurred_at);
          return (
            <li key={step.key} className={`rounded-xl border p-3 ${done ? "border-emerald-200 bg-white" : "border-slate-200 bg-white/70"}`}>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {done ? "✓" : index + 1}
                </span>
                <span className="text-sm font-semibold text-slate-800">{step.label}</span>
              </div>
              <p className={`mt-2 text-xs ${done ? "text-emerald-700" : "text-slate-500"}`}>{done ? (occurredAt ? `Réalisé le ${occurredAt}` : "Réalisé") : "En attente"}</p>
            </li>
          );
        })}
      </ol>

      {summary.blockers.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          <span className="font-semibold">À résoudre : </span>
          {summary.blockers.map((blocker) => blockerLabels[blocker] || blocker).join(" · ")}
        </div>
      )}
    </section>
  );
}
