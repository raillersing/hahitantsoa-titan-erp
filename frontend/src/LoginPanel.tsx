import { type FormEvent, useEffect, useRef, useState } from "react";

import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";
import BrandIdentity from "./prototype/BrandIdentity";

function LoginPanel() {
  const { state, isSubmitting, login } = useAuth();
  const { themeMode, cycleThemeMode } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "unauthenticated" && state.error) {
      errorRef.current?.focus();
    }
  }, [state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
    } catch {
      // Error is stored in AuthContext state
    }
  };

  return (
    <main className="login-shell min-h-screen bg-slate-100 px-4 py-8 sm:px-6 flex items-center justify-center">
      <section className="login-panel w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl sm:p-8">
        <div className="login-panel__header">
          <div className="brand-card" aria-label="Ergon corporate identity">
            <img
              alt="Ergon"
              className="brand-logo brand-logo--ergon"
              src="/assets/ergon-logo.png"
            />
            <div className="brand-card__copy">
              <p className="eyebrow">Ergon ERP</p>
              <h1>Connexion opérateur</h1>
              <p className="shell-summary">
                Connectez-vous à la plateforme Ergon pour accéder aux workflows
                Hahitantsoa et Titan selon vos permissions backend.
              </p>
            </div>
          </div>
          <button
            aria-label={`Mode de thème : ${themeMode}`}
            className="theme-toggle"
            type="button"
            onClick={cycleThemeMode}
          >
            Thème : {themeMode}
          </button>
        </div>

        <div className="login-identity-strip" aria-label="Operational brand contexts">
          <div className="login-identity-chip">
            <BrandIdentity brand="hahitantsoa" compact />
            <span>Événement / full-service</span>
          </div>
          <div className="login-identity-chip">
            <BrandIdentity brand="titan" compact />
            <span>Location matériel</span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="login-form grid gap-4"
          aria-label="Connexion"
          aria-busy={isSubmitting}
        >
          {state.status === "unauthenticated" && state.error ? (
            <div
              className="notice"
              id="login-error"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              <p>{state.error}</p>
            </div>
          ) : null}

          {state.status === "unauthenticated" && !state.error ? (
            <div className="notice">
              <p>
                Votre session n’est pas authentifiée. Saisissez les identifiants
                de votre compte pour continuer.
              </p>
            </div>
          ) : null}

          <label>
            <span>Nom d’utilisateur</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="username"
              aria-describedby={state.status === "unauthenticated" && state.error ? "login-error" : undefined}
            />
          </label>

          <label>
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="current-password"
              aria-describedby={state.status === "unauthenticated" && state.error ? "login-error" : undefined}
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPanel;
