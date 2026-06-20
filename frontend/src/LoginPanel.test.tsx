import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./AuthContext";
import LoginPanel from "./LoginPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    <AuthProvider>
      <LoginPanel />
    </AuthProvider>,
  );
}

describe("LoginPanel", () => {
  it("renders the sign-in form with username and password fields", async () => {
    renderLoginPanel();

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
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
      <AuthProvider>
        <LoginPanel />
      </AuthProvider>,
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
});
