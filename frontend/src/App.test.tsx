import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  });

  it("protects a deep link with the real login panel when anonymous", () => {
    authMock.value.state = { status: "unauthenticated", error: null };
    window.history.replaceState(null, "", "/#documents");
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(screen.getByRole("heading", { name: "Connexion opérateur" })).toBeInTheDocument();
    expect(screen.queryByText("Documents & Modèles")).not.toBeInTheDocument();
  });

  it("shows the read-only backend profile", () => {
    window.history.replaceState(null, "", "/#profile");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Profil utilisateur", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Ada Operator")).toHaveLength(2);
    expect(screen.getByText("commercial")).toBeInTheDocument();
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
