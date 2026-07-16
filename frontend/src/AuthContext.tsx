import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import {
  checkAuth,
  login as apiLogin,
  logout as apiLogout,
  SESSION_REVALIDATION_EVENT,
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
  isOnline: boolean;
  refreshSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_REVALIDATION_TIMEOUT_MS = 10_000;

function stateFromSession(session: SessionStateResponse): AuthState {
  return session.authenticated
    ? { status: "authenticated", user: session.user, error: null }
    : { status: "unauthenticated", error: null };
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") {
    return "La vérification de la session a expiré. Vérifiez votre connexion puis réessayez.";
  }
  return error instanceof Error ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const stateRef = useRef(state);
  const revalidationRef = useRef<Promise<void> | null>(null);

  const commitState = useCallback((nextState: AuthState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const revalidateSession = useCallback((sessionExpiredMessage = false) => {
    if (revalidationRef.current) return revalidationRef.current;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SESSION_REVALIDATION_TIMEOUT_MS);
    const request = checkAuth(controller.signal)
      .then((session) => {
        commitState(
          session.authenticated
            ? stateFromSession(session)
            : {
                status: "unauthenticated",
                error: sessionExpiredMessage
                  ? "Votre session a expiré. Reconnectez-vous pour continuer."
                  : null,
              },
        );
      })
      .catch((error) => {
        const currentState = stateRef.current;
        const message = errorMessage(error, "La session n'a pas pu être vérifiée.");
        commitState(
          currentState.status === "authenticated"
            ? { ...currentState, error: message }
            : { status: "error", error: message },
        );
        throw error;
      })
      .finally(() => {
        window.clearTimeout(timeout);
        revalidationRef.current = null;
      });

    revalidationRef.current = request;
    return request;
  }, [commitState]);

  const refreshSession = useCallback(async () => {
    commitState({ status: "loading" });
    try {
      await revalidateSession();
    } catch (error) {
      commitState({
        status: "error",
        error: errorMessage(error, "La session n'a pas pu être vérifiée."),
      });
      throw error;
    }
  }, [commitState, revalidateSession]);

  useEffect(() => {
    void revalidateSession().catch(() => undefined);
  }, [revalidateSession]);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      const currentState = stateRef.current;
      const message = "Vous êtes hors ligne. La session sera vérifiée au retour du réseau.";
      commitState(
        currentState.status === "authenticated"
          ? { ...currentState, error: message }
          : { status: "error", error: message },
      );
    };
    const handleOnline = () => {
      setIsOnline(true);
      void revalidateSession().catch(() => undefined);
    };
    const handleFocus = () => {
      if (navigator.onLine) void revalidateSession().catch(() => undefined);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleFocus();
    };
    const handleSessionRevalidation = () => {
      if (stateRef.current.status === "authenticated") {
        void revalidateSession(true).catch(() => undefined);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);
    window.addEventListener(SESSION_REVALIDATION_EVENT, handleSessionRevalidation);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(SESSION_REVALIDATION_EVENT, handleSessionRevalidation);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [commitState, revalidateSession]);

  const login = useCallback(async (username: string, password: string) => {
    setIsSubmitting(true);
    try {
      const session = await apiLogin(username, password);
      if (!session.authenticated) {
        throw new Error("Le serveur n'a pas ouvert de session authentifiée.");
      }
      commitState(stateFromSession(session));
    } catch (error) {
      commitState({
        status: "unauthenticated",
        error: errorMessage(error, "La connexion a échoué."),
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [commitState]);

  const logout = useCallback(async () => {
    if (state.status !== "authenticated") return;

    const currentUser = state.user;
    setIsSubmitting(true);
    commitState({ status: "authenticated", user: currentUser, error: null });
    try {
      await apiLogout();
      commitState({ status: "unauthenticated", error: null });
    } catch (error) {
      try {
        const session = await checkAuth();
        commitState(
          session.authenticated
            ? {
                status: "authenticated",
                user: session.user,
                error: errorMessage(error, "La déconnexion n'a pas pu être confirmée."),
              }
            : stateFromSession(session),
        );
      } catch {
        commitState({
          status: "authenticated",
          user: currentUser,
          error: errorMessage(error, "La déconnexion n'a pas pu être confirmée."),
        });
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [commitState, state]);

  return (
    <AuthContext.Provider value={{ state, isSubmitting, isOnline, refreshSession, login, logout }}>
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
