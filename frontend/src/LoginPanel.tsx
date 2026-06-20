import { type FormEvent, useState } from "react";

import { useAuth } from "./AuthContext";

function LoginPanel() {
  const { state, login } = useAuth();
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
    <main className="app-shell">
      <header className="app-header">
        <div className="app-intro">
          <p className="eyebrow">Hahitantsoa / Titan ERP</p>
          <h1>Sign in</h1>
          <p className="shell-summary">
            Authenticate with your Django session credentials to access the ERP
            frontend.
          </p>
        </div>
      </header>

      <div className="shell-layout">
        <form
          onSubmit={handleSubmit}
          className="login-form"
          aria-label="Sign in"
        >
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
      </div>
    </main>
  );
}

export default LoginPanel;
