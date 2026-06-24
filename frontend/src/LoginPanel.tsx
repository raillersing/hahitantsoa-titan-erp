import { type FormEvent, useState } from "react";

import { useAuth } from "./AuthContext";
import { useTheme } from "./ThemeContext";

function LoginPanel() {
  const { state, login } = useAuth();
  const { themeMode, cycleThemeMode } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
    } catch {
      // Error is stored in AuthContext state
    }
  };

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-panel__header">
          <div className="brand-card" aria-label="Ergon corporate identity">
            <div aria-hidden="true" className="brand-mark brand-mark--ergon">E</div>
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
            aria-label={`Theme mode: ${themeMode}`}
            className="theme-toggle"
            type="button"
            onClick={cycleThemeMode}
          >
            Theme: {themeMode}
          </button>
        </div>

        <div className="login-identity-strip" aria-label="Operational brand contexts">
          <div className="login-identity-chip">
            <span aria-hidden="true" className="brand-mark brand-mark--hah">H</span>
            <span>Evenement / full-service</span>
          </div>
          <div className="login-identity-chip">
            <span aria-hidden="true" className="brand-mark brand-mark--titan">T</span>
            <span>Location materiel</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form" aria-label="Sign in">
          {state.status === "unauthenticated" && state.error ? (
            <div className="notice" role="alert">
              <p>{state.error}</p>
            </div>
          ) : null}

          {state.status === "unauthenticated" && !state.error ? (
            <div className="notice">
              <p>
                Your session is not authenticated. Enter your Django account
                credentials below.
              </p>
            </div>
          ) : null}

          <label>
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={state.status === "loading"}
              autoComplete="username"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={state.status === "loading"}
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={state.status === "loading"}>
            {state.status === "loading" ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPanel;
