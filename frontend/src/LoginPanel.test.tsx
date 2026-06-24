import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./AuthContext";
import LoginPanel from "./LoginPanel";
import { ThemeProvider } from "./ThemeContext";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderLoginPanel() {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);

    if (url === "/api/v1/inventory/items/") {
      return Promise.resolve(jsonResponse([], 403));
    }

    return Promise.resolve(jsonResponse({}, 404));
  });

  render(
    <ThemeProvider>
      <AuthProvider>
        <LoginPanel />
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe("LoginPanel", () => {
  it("renders the sign-in form with username and password fields", async () => {
    renderLoginPanel();

    expect(
      await screen.findByRole("heading", { name: "Connexion opérateur" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Username" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Password"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
  });

  it("shows the unauthenticated notice by default", async () => {
    renderLoginPanel();

    expect(
      await screen.findByText(/session is not authenticated/i),
    ).toBeInTheDocument();
  });

  it("calls the login API on form submission", async () => {
    renderLoginPanel();

    const usernameInput = await screen.findByRole("textbox", {
      name: "Username",
    });
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(usernameInput, { target: { value: "admin" } });
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(submitButton);

    expect(
      await screen.findByRole("button", { name: "Signing in..." }),
    ).toBeInTheDocument();
  });

  it("displays an error message when login fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);

      if (url === "/api/v1/inventory/items/") {
        return Promise.resolve(jsonResponse([], 403));
      }

      if (url === "/api-auth/login/") {
        return Promise.resolve(jsonResponse({ detail: "Invalid credentials" }, 401));
      }

      return Promise.resolve(jsonResponse({}, 404));
    });

    render(
      <ThemeProvider>
        <AuthProvider>
          <LoginPanel />
        </AuthProvider>
      </ThemeProvider>,
    );

    const usernameInput = await screen.findByRole("textbox", {
      name: "Username",
    });
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(usernameInput, { target: { value: "admin" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText("Login failed. Please check your credentials."),
    ).toBeInTheDocument();
  });

  it("cycles theme mode from the login shell", async () => {
    renderLoginPanel();

    const themeButton = await screen.findByRole("button", { name: "Theme mode: system" });
    fireEvent.click(themeButton);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("erp-theme-mode")).toBe("light");
    expect(
      screen.getByRole("button", { name: "Theme mode: light" }),
    ).toHaveTextContent("Theme: light");
  });

  it("disables the form during loading", async () => {
    renderLoginPanel();

    const usernameInput = await screen.findByRole("textbox", {
      name: "Username",
    });
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    expect(usernameInput).not.toBeDisabled();
    expect(passwordInput).not.toBeDisabled();
    expect(submitButton).not.toBeDisabled();
  });

  it("disables inputs and button while submitting", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/v1/inventory/items/") {
        return Promise.resolve(jsonResponse([], 403));
      }
      return new Promise(() => undefined);
    });

    render(
      <ThemeProvider>
        <AuthProvider>
          <LoginPanel />
        </AuthProvider>
      </ThemeProvider>,
    );

    const usernameInput = await screen.findByRole("textbox", {
      name: "Username",
    });
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    fireEvent.change(usernameInput, { target: { value: "admin" } });
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(submitButton);

    expect(usernameInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent("Signing in...");
  });
});
