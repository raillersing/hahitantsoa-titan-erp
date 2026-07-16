import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
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
});
