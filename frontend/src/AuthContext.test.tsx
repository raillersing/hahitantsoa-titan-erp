import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import { SESSION_REVALIDATION_EVENT } from "./api";
import { AuthProvider, useAuth } from "./AuthContext";

const user = {
  id: "user-1",
  username: "ada",
  display_name: "Ada Operator",
  is_staff: false,
  roles: ["commercial"],
};

let context: ReturnType<typeof useAuth>;

function Probe() {
  context = useAuth();
  return <p>{context.state.status}</p>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("restores an authenticated session with its backend identity", async () => {
    vi.spyOn(api, "checkAuth").mockResolvedValue({ authenticated: true, user });
    render(<AuthProvider><Probe /></AuthProvider>);

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(context.state).toEqual({ status: "authenticated", user, error: null });
  });

  it("exposes a recoverable error instead of pretending the user is anonymous", async () => {
    const checkSpy = vi.spyOn(api, "checkAuth")
      .mockRejectedValueOnce(new Error("Réseau indisponible"))
      .mockResolvedValueOnce({ authenticated: false, user: null });
    render(<AuthProvider><Probe /></AuthProvider>);

    expect(await screen.findByText("error")).toBeInTheDocument();
    await act(async () => { await context.refreshSession(); });
    expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
    expect(checkSpy).toHaveBeenCalledTimes(2);
  });

  it("keeps the authenticated identity and exposes the error when logout is rejected", async () => {
    vi.spyOn(api, "checkAuth").mockResolvedValue({ authenticated: true, user });
    vi.spyOn(api, "logout").mockRejectedValue(new Error("Déconnexion refusée"));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("authenticated");

    await act(async () => { await expect(context.logout()).rejects.toThrow("Déconnexion refusée"); });
    await waitFor(() => expect(context.state).toEqual({
      status: "authenticated",
      user,
      error: "Déconnexion refusée",
    }));
  });

  it("moves to login with an explicit message when the active session expires", async () => {
    const checkSpy = vi.spyOn(api, "checkAuth")
      .mockResolvedValueOnce({ authenticated: true, user })
      .mockResolvedValueOnce({ authenticated: false, user: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("authenticated");

    act(() => window.dispatchEvent(new CustomEvent(SESSION_REVALIDATION_EVENT, { detail: { status: 401 } })));

    await waitFor(() => expect(checkSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("unauthenticated")).toBeInTheDocument();
    expect(context.state).toEqual({
      status: "unauthenticated",
      error: "Votre session a expiré. Reconnectez-vous pour continuer.",
    });
  });

  it("keeps an authenticated user after a permission denial revalidation", async () => {
    const refreshedUser = { ...user, roles: ["commercial", "direction"] };
    const checkSpy = vi.spyOn(api, "checkAuth")
      .mockResolvedValueOnce({ authenticated: true, user })
      .mockResolvedValueOnce({ authenticated: true, user: refreshedUser });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("authenticated");

    act(() => window.dispatchEvent(new CustomEvent(SESSION_REVALIDATION_EVENT, { detail: { status: 403 } })));

    await waitFor(() => expect(checkSpy).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(context.state).toEqual({
      status: "authenticated",
      user: refreshedUser,
      error: null,
    }));
  });

  it("reports offline state and recovers automatically when the network returns", async () => {
    const checkSpy = vi.spyOn(api, "checkAuth")
      .mockResolvedValueOnce({ authenticated: true, user })
      .mockResolvedValueOnce({ authenticated: true, user });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("authenticated");

    act(() => window.dispatchEvent(new Event("offline")));
    await waitFor(() => expect(context.isOnline).toBe(false));
    await waitFor(() => expect(context.state).toEqual(expect.objectContaining({
      status: "authenticated",
      error: expect.stringMatching(/hors ligne/i),
    })));

    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(context.isOnline).toBe(true));
    await waitFor(() => expect(context.state).toEqual({ status: "authenticated", user, error: null }));
    expect(checkSpy).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent session revalidation events", async () => {
    let resolveRevalidation!: (value: api.SessionStateResponse) => void;
    const checkSpy = vi.spyOn(api, "checkAuth")
      .mockResolvedValueOnce({ authenticated: true, user })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRevalidation = resolve; }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("authenticated");

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_REVALIDATION_EVENT));
      window.dispatchEvent(new CustomEvent(SESSION_REVALIDATION_EVENT));
    });
    await waitFor(() => expect(checkSpy).toHaveBeenCalledTimes(2));
    act(() => resolveRevalidation({ authenticated: true, user }));
    await waitFor(() => expect(context.state.status).toBe("authenticated"));
  });

  it("coalesces focus revalidation with the initial session bootstrap", async () => {
    let resolveBootstrap!: (value: api.SessionStateResponse) => void;
    const checkSpy = vi.spyOn(api, "checkAuth")
      .mockImplementationOnce(() => new Promise((resolve) => { resolveBootstrap = resolve; }));

    render(<AuthProvider><Probe /></AuthProvider>);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(checkSpy).toHaveBeenCalledTimes(1);

    act(() => resolveBootstrap({ authenticated: true, user }));
    expect(await screen.findByText("authenticated")).toBeInTheDocument();
  });

  it("releases a timed-out revalidation so a later focus can recover", async () => {
    const checkSpy = vi.spyOn(api, "checkAuth")
      .mockResolvedValueOnce({ authenticated: true, user })
      .mockImplementationOnce((signal) => new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }))
      .mockResolvedValueOnce({ authenticated: true, user });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText("authenticated");

    vi.useFakeTimers();
    act(() => window.dispatchEvent(new CustomEvent(SESSION_REVALIDATION_EVENT)));
    expect(checkSpy).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(context.state).toEqual({
      status: "authenticated",
      user,
      error: "La vérification de la session a expiré. Vérifiez votre connexion puis réessayez.",
    });

    act(() => window.dispatchEvent(new Event("focus")));
    await act(async () => { await Promise.resolve(); });
    expect(checkSpy).toHaveBeenCalledTimes(3);
    expect(context.state).toEqual({ status: "authenticated", user, error: null });
  });
});
