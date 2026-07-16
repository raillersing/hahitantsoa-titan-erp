import type { SessionUser } from "../api";

export default function ProfilePage({ user }: { user: SessionUser }) {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6" aria-labelledby="profile-heading">
      <header className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-800 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-600">Compte connecté</p>
        <h1 id="profile-heading" className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
          Profil utilisateur
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Ces informations proviennent de votre session sécurisée. Elles ne sont pas stockées dans ce navigateur.
        </p>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-800">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nom affiché</dt>
          <dd className="mt-2 break-words font-semibold text-slate-900 dark:text-white">{user.display_name}</dd>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-800">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nom d’utilisateur</dt>
          <dd className="mt-2 break-all font-semibold text-slate-900 dark:text-white">{user.username}</dd>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm dark:bg-slate-800 sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rôles actifs</dt>
          <dd className="mt-3 flex flex-wrap gap-2">
            {user.roles.length ? user.roles.map((role) => (
              <span key={role} className="rounded-full bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-200">
                {role}
              </span>
            )) : <span className="text-sm text-slate-600 dark:text-slate-300">Aucun rôle applicatif actif</span>}
          </dd>
        </div>
        {user.is_staff ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 sm:col-span-2 dark:border-amber-900 dark:bg-amber-950/40">
            <dt className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Compte Django</dt>
            <dd className="mt-2 text-sm font-semibold text-amber-900 dark:text-amber-100">Accès staff activé</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
