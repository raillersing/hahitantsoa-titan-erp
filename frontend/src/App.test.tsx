import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { ThemeProvider } from "./ThemeContext";

const authMock = vi.hoisted(() => ({
  value: {
    state: {
      status: "authenticated" as const,
      user: { id: "1", username: "ada", display_name: "Ada Operator", is_staff: false, roles: ["commercial"] },
      error: null,
    } as any,
    isSubmitting: false,
    isOnline: true,
    refreshSession: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock("./AuthContext", () => ({ useAuth: () => authMock.value }));

beforeEach(() => {
  window.localStorage.clear();
  authMock.value.state = {
    status: "authenticated",
    user: { id: "1", username: "ada", display_name: "Ada Operator", is_staff: false, roles: ["commercial"] },
    error: null,
  };
});

afterEach(() => {
  cleanup();
});

describe("App Prototype", () => {
  it("defaults to the Dashboard when the URL hash is missing", () => {
    window.history.replaceState(null, "", "/");
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(screen.getByRole("heading", { name: "Tableau de bord" })).toBeInTheDocument();
  });

  it("navigates to Titan scope from the sidebar", () => {
    window.history.replaceState(null, "", "/");
    render(<App />);
    const titanBtn = screen.getByRole("link", { name: /Titan/i });
    fireEvent.click(titanBtn);
    expect(screen.getByRole("heading", { name: "Titan" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#titan");
    expect(screen.getByTestId("route-content")).toHaveFocus();
  });

  it("opens the Hahitantsoa module from the URL hash", () => {
    window.history.replaceState(null, "", "/#hahitantsoa");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Hahitantsoa" })).toBeInTheDocument();
  });

  it("opens the planning view from the topbar shortcut", () => {
    window.history.replaceState(null, "", "/");
    render(<App />);
    const planningButtons = screen.getAllByRole("button", { name: /Planning/i });
    fireEvent.click(planningButtons[0]);
    expect(screen.getByRole("heading", { name: "Planning" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#planning");
  });

  it("shows the reports page from the URL hash", () => {
    window.history.replaceState(null, "", "/#reports");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Rapports & BI" })).toBeInTheDocument();
  });

  it("redirects an authenticated login hash to the dashboard", async () => {
    window.history.replaceState(null, "", "/#login");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Tableau de bord" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#dashboard");
    expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
  });

  it("shows an explicit recovery page for an unknown hash", () => {
    window.history.replaceState(null, "", "/#unknown/route");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Page introuvable" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#unknown/route");
    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Tableau de bord" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nouvelle réservation" })).not.toBeInTheDocument();
  });

  it("uses browser history for user navigation", async () => {
    window.history.replaceState(null, "", "/#dashboard");
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: /Titan/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Planning/i })[0]);
    expect(window.location.hash).toBe("#planning");

    act(() => window.history.back());
    await waitFor(() => expect(window.location.hash).toBe("#titan"));
    expect(screen.getByRole("heading", { name: "Titan" })).toBeInTheDocument();

    act(() => window.history.forward());
    await waitFor(() => expect(window.location.hash).toBe("#planning"));
    expect(screen.getByRole("heading", { name: "Planning" })).toBeInTheDocument();
  });

  it("protects a deep link with the real login panel when anonymous", () => {
    authMock.value.state = { status: "unauthenticated", error: null };
    window.history.replaceState(null, "", "/#documents");
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(screen.getByRole("heading", { name: "Connexion opérateur" })).toBeInTheDocument();
    expect(screen.queryByText("Documents & Modèles")).not.toBeInTheDocument();
  });

  it("preserves an encoded deep-link parameter while anonymous", () => {
    authMock.value.state = { status: "unauthenticated", error: null };
    window.history.replaceState(null, "", "/#customer/client%20%C3%A9t%C3%A9%2F001");
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(screen.getByRole("heading", { name: "Connexion opérateur" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#customer/client%20%C3%A9t%C3%A9%2F001");
  });

  it("shows the read-only backend profile", () => {
    window.history.replaceState(null, "", "/#profile");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Profil utilisateur", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Ada Operator")).toHaveLength(2);
    expect(screen.getByText("commercial")).toBeInTheDocument();
  });

  it("hides restricted navigation and denies restricted deep links for a regular session", () => {
    window.history.replaceState(null, "", "/#admin");
    render(<App />);

    expect(screen.getByRole("alert")).toHaveTextContent("Accès non autorisé");
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit & Sécurité" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nouvelle réservation" })).not.toBeInTheDocument();
  });

  it("keeps reservation creation available for the backend sensitive role", () => {
    authMock.value.state.user = {
      ...authMock.value.state.user,
      roles: ["reservation_sensitive_operator"],
    };
    window.history.replaceState(null, "", "/#dashboard");
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Nouvelle réservation" })[0]);
    expect(window.location.hash).toBe("#reservation-new");
  });

  it("does not call /api/v1/inventory/items on dashboard", () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    window.history.replaceState(null, "", "/#dashboard");
    render(<App />);
    
    // Check that there is no fetch call containing the inventory API path
    const inventoryCalls = fetchSpy.mock.calls.filter((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes("/api/v1/inventory/items")
    );
    expect(inventoryCalls.length).toBe(0);
    fetchSpy.mockRestore();
  });

  it("does not call /api/v1/inventory/items on inventory-item", () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    window.history.replaceState(null, "", "/#inventory-item/ITEM-001");
    render(<App />);
    
    // Provide a mocked router to set the hash to inventory-item
    const inventoryCalls = fetchSpy.mock.calls.filter((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes("/api/v1/inventory/items")
    );
    expect(inventoryCalls.length).toBe(0);
    fetchSpy.mockRestore();
  });
  it("shows all logistics routes in the sidebar", () => {
    window.history.replaceState(null, "", "/");
    render(<App />);
    expect(screen.getByRole("link", { name: /Catalogue/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mouvements/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Préparation/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sortie \/ Livraison/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Retour \/ Restitution/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Casse & Perte/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Packs/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Services/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Liste noire/i })).toBeInTheDocument();
  });

  it("navigates to packages and shows correct breadcrumbs and titles", () => {
    window.history.replaceState(null, "", "/#packages");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Gestion des Packs" })).toBeInTheDocument();
    expect(screen.getAllByText("Offres").length).toBeGreaterThan(0);
  });

  it("navigates correctly from sidebar clicks for logistics routes", () => {
    window.history.replaceState(null, "", "/");
    render(<App />);
    
    fireEvent.click(screen.getByRole("link", { name: /Catalogue/i }));
    expect(window.location.hash).toBe("#inventory");
    
    fireEvent.click(screen.getByRole("link", { name: /Mouvements/i }));
    expect(window.location.hash).toBe("#stock-movements");
    
    fireEvent.click(screen.getByRole("link", { name: /Préparation/i }));
    expect(window.location.hash).toBe("#stock-preparation");
    
    fireEvent.click(screen.getByRole("link", { name: /Sortie \/ Livraison/i }));
    expect(window.location.hash).toBe("#logistics-dispatch");
    
    fireEvent.click(screen.getByRole("link", { name: /Retour \/ Restitution/i }));
    expect(window.location.hash).toBe("#logistics-returns");
    
    fireEvent.click(screen.getByRole("link", { name: /Casse & Perte/i }));
    expect(window.location.hash).toBe("#breakage-loss");
  });

  it("does not call /api/v1/inventory/items on logistics routes", () => {
    const fetchSpy = vi.spyOn(window, "fetch");
    window.history.replaceState(null, "", "/#inventory");
    const { unmount } = render(<App />);
    unmount();
    window.history.replaceState(null, "", "/#stock-movements");
    render(<App />);
    
    const inventoryCalls = fetchSpy.mock.calls.filter((call: any[]) =>
      typeof call[0] === 'string' && call[0].includes("/api/v1/inventory/items")
    );
    expect(inventoryCalls.length).toBe(0);
    fetchSpy.mockRestore();
  });

  it("preserves dark/light mode toggle", () => {
    window.history.replaceState(null, "", "/");
    render(<App />);
    expect(screen.getByTitle("Changer le thème")).toBeInTheDocument();
  });
});
