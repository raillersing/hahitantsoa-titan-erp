import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

import { checkAuth, login as apiLogin, logout as apiLogout } from "./api";

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated" }
  | { status: "unauthenticated"; error: string | null };

export type AuthContextValue = {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    checkAuth(controller.signal)
      .then((authenticated) => {
        setState(
          authenticated
            ? { status: "authenticated" }
            : { status: "unauthenticated", error: null },
        );
      })
      .catch(() => {
        setState({ status: "unauthenticated", error: null });
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setState({ status: "loading" });
    try {
      await apiLogin(username, password);
      setState({ status: "authenticated" });
    } catch (err) {
      setState({
        status: "unauthenticated",
        error: err instanceof Error ? err.message : "Login failed.",
      });
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setState({ status: "unauthenticated", error: null });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
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
