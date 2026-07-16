import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import {
  checkAuth,
  login as apiLogin,
  logout as apiLogout,
  type SessionStateResponse,
  type SessionUser,
} from "./api";

export type AuthState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "authenticated"; user: SessionUser; error: string | null }
  | { status: "unauthenticated"; error: string | null };

export type AuthContextValue = {
  state: AuthState;
  isSubmitting: boolean;
  refreshSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function stateFromSession(session: SessionStateResponse): AuthState {
  return session.authenticated
    ? { status: "authenticated", user: session.user, error: null }
    : { status: "unauthenticated", error: null };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshSession = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState(stateFromSession(await checkAuth()));
    } catch (error) {
      setState({
        status: "error",
        error: errorMessage(error, "La session n'a pas pu être vérifiée."),
      });
      throw error;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    checkAuth(controller.signal)
      .then((session) => setState(stateFromSession(session)))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          error: errorMessage(error, "La session n'a pas pu être vérifiée."),
        });
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsSubmitting(true);
    try {
      const session = await apiLogin(username, password);
      if (!session.authenticated) {
        throw new Error("Le serveur n'a pas ouvert de session authentifiée.");
      }
      setState(stateFromSession(session));
    } catch (error) {
      setState({
        status: "unauthenticated",
        error: errorMessage(error, "La connexion a échoué."),
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (state.status !== "authenticated") return;

    const currentUser = state.user;
    setIsSubmitting(true);
    setState({ status: "authenticated", user: currentUser, error: null });
    try {
      await apiLogout();
      setState({ status: "unauthenticated", error: null });
    } catch (error) {
      try {
        const session = await checkAuth();
        setState(
          session.authenticated
            ? {
                status: "authenticated",
                user: session.user,
                error: errorMessage(error, "La déconnexion n'a pas pu être confirmée."),
              }
            : stateFromSession(session),
        );
      } catch {
        setState({
          status: "authenticated",
          user: currentUser,
          error: errorMessage(error, "La déconnexion n'a pas pu être confirmée."),
        });
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [state]);

  return (
    <AuthContext.Provider value={{ state, isSubmitting, refreshSession, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
