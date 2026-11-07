import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import { AuthProvider } from "./AuthContext";
import LoginPanel from "./LoginPanel";
import { ThemeProvider } from "./ThemeContext";

const anonymousSession = { authenticated: false as const, user: null };
const authenticatedSession = {
  authenticated: true as const,
  user: {
    id: "user-1",
    username: "admin",
    display_name: "Admin ERP",
    is_staff: true,
    roles: ["direction"],
  },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(api, "checkAuth").mockResolvedValue(anonymousSession);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

function renderLoginPanel() {
  render(
    <ThemeProvider>
      <AuthProvider>
        <LoginPanel />
      </AuthProvider>
    </ThemeProvider>,
  );
}

async function fillAndSubmit() {
  fireEvent.change(await screen.findByRole("textbox", { name: "Nom d’utilisateur" }), {
    target: { value: "admin" },
  });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("LoginPanel", () => {
  it("renders the accessible branded sign-in form", async () => {
    renderLoginPanel();

    expect(await screen.findByRole("heading", { name: "Connexion opérateur" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nom d’utilisateur" })).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hahitantsoa" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Titan Rental" })).toBeInTheDocument();
  });

  it("submits once and disables the form while login is pending", async () => {
    let resolveLogin!: (value: typeof authenticatedSession) => void;
    const loginSpy = vi.spyOn(api, "login").mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; }),
    );
    renderLoginPanel();

    await fillAndSubmit();
    expect(await screen.findByRole("button", { name: "Connexion en cours…" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Nom d’utilisateur" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toBeDisabled();
    expect(loginSpy).toHaveBeenCalledTimes(1);
    resolveLogin(authenticatedSession);
  });

  it("announces and focuses a backend login error", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("Identifiants invalides."));
    renderLoginPanel();

    await fillAndSubmit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Identifiants invalides.");
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it("cycles the theme from the login screen", async () => {
    renderLoginPanel();
    const button = await screen.findByRole("button", { name: "Mode de thème : system" });
    fireEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggles password visibility between masked and plain text", async () => {
    renderLoginPanel();
    const passwordInput = await screen.findByLabelText("Mot de passe");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", { name: "Afficher le mot de passe" });
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Masquer le mot de passe" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Masquer le mot de passe" }));
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Afficher le mot de passe" })).toBeInTheDocument();
  });
});
