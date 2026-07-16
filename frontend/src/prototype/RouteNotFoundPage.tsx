interface RouteNotFoundPageProps {
  requestedHash: string;
  onNavigateHome: () => void;
}

export function RouteNotFoundPage({ requestedHash, onNavigateHome }: RouteNotFoundPageProps) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-10" aria-labelledby="route-not-found-title">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Erreur 404</p>
        <h1 id="route-not-found-title" className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
          Page introuvable
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          L’adresse <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-900">{requestedHash}</code> ne correspond à aucune page de l’application.
        </p>
        <button
          type="button"
          onClick={onNavigateHome}
          className="mt-6 min-h-11 rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 focus-ring"
        >
          Retour au tableau de bord
        </button>
      </div>
    </section>
  );
}
