import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { ThemeProvider } from "./ThemeContext";
import { useAuth } from "./AuthContext";

vi.mock("./AuthContext", () => ({
  useAuth: vi.fn(() => ({
    state: { status: "authenticated" },
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

type InventoryItem = {
  id: string;
  name: string;
  kind: "material" | "article" | "material_pack";
  description: string;
};

const CUSTOMERS = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    display_name: "Client Demo",
    email: "client@example.test",
    phone: "+261 34 00 000 00",
    address: "Antananarivo",
    notes: "Demo customer",
    is_active: true,
  },
];

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

function mockAppFetch(options: {
  inventoryItems?: InventoryItem[];
  discoveryResponse?: object;
}) {
  const inventoryItems = options.inventoryItems ?? [];
  const discoveryResponse = options.discoveryResponse ?? {
    items: [{ concept: "venue", label: "venue" }],
    count: 1,
  };

  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);

    if (url === "/api/v1/inventory/items/") {
      return Promise.resolve(jsonResponse(inventoryItems));
    }

    if (url === "/api/v1/customers/") {
      return Promise.resolve(jsonResponse(CUSTOMERS));
    }

    if (url === "/api/v1/reservations/drafts/") {
      return Promise.resolve(jsonResponse([]));
    }

    if (url === "/api/v1/hahitantsoa/discovery-items/") {
      return Promise.resolve(jsonResponse(discoveryResponse));
    }

    if (url === "/api/v1/inventory/stock-movements/") {
      return Promise.resolve(jsonResponse([]));
    }

    if (url === "/api/v1/payments/") {
      return Promise.resolve(jsonResponse([]));
    }

    if (url === "/api/v1/hahitantsoa/event-drafts/") {
      return Promise.resolve(jsonResponse([]));
    }

    return Promise.resolve(jsonResponse({}, 404));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  installMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("defaults to the Dashboard module shell when the URL hash is missing", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    expect(
      screen.getByRole("heading", { name: "Frontend module shell" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "ERP command center" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("navigates to Titan scope from the Dashboard quick-nav action button", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    const titanNavBtn = await screen.findByRole("button", { name: /Manage Inventory/i });
    fireEvent.click(titanNavBtn);

    expect(
      await screen.findByRole("heading", { name: "Titan inventory" }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#titan");
  });

  it("opens the Hahitantsoa module from the URL hash", async () => {
    window.history.replaceState(null, "", "/#hahitantsoa");

    mockAppFetch({
      inventoryItems: [],
      discoveryResponse: {
        items: [{ concept: "venue", label: "venue" }],
        count: 1,
      },
    });

    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Hahitantsoa discovery" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("venue")).toHaveLength(2);
  });

  it("opens the planning placeholder from the topbar shortcut", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Open planning" }));

    expect(
      await screen.findByRole("heading", { name: "Planning and calendar workspace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Frontend placeholder only")).toBeInTheDocument();
    expect(window.location.hash).toBe("#planning");
  });

  it("opens the reports placeholder from the URL hash", async () => {
    window.history.replaceState(null, "", "/#reports");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    expect(await screen.findByText("Frontend placeholder only")).toBeInTheDocument();
    expect(screen.getByText("Decision required")).toBeInTheDocument();
  });

  it("opens the help placeholder from the URL hash", async () => {
    window.history.replaceState(null, "", "/#help");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    expect(await screen.findByText("Frontend placeholder only")).toBeInTheDocument();
    expect(screen.getByText("Future content")).toBeInTheDocument();
  });

  it("shows the loading state while inventory is pending", async () => {
    window.history.replaceState(null, "", "/#titan");
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => undefined),
    );

    renderApp();

    expect(screen.getByText("Loading inventory...")).toBeInTheDocument();
  });

  it("renders inventory items, count and kind labels", async () => {
    window.history.replaceState(null, "", "/#titan");
    mockAppFetch({
      inventoryItems: [
        {
          id: "item-1",
          name: "Projector",
          kind: "material",
          description: "Portable projector",
        },
        {
          id: "item-2",
          name: "Lighting pack",
          kind: "material_pack",
          description: "",
        },
      ],
    });

    renderApp();

    expect(await screen.findByText("Projector")).toBeInTheDocument();
    expect(screen.getByText("Lighting pack")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("material")).toBeInTheDocument();
    expect(screen.getByText("material pack")).toBeInTheDocument();
  });

  it("requests the authenticated inventory endpoint", async () => {
    window.history.replaceState(null, "", "/#titan");
    const fetchMock = mockAppFetch({ inventoryItems: [] });

    renderApp();

    await screen.findByText("No inventory items are currently visible.");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/inventory/items/", {
      credentials: "include",
      signal: expect.any(AbortSignal),
    });
  });

  it("renders the empty inventory state", async () => {
    window.history.replaceState(null, "", "/#titan");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    expect(
      await screen.findByText("No inventory items are currently visible."),
    ).toBeInTheDocument();
  });

  it("renders the dashboard quick actions and brand context cards", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    expect(
      await screen.findByRole("heading", { name: "ERP command center" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Titan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Hahitantsoa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open operations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operational context" })).toBeInTheDocument();
  });

  it("renders an error state for a failed HTTP response", async () => {
    window.history.replaceState(null, "", "/#titan");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);

      if (url === "/api/v1/inventory/items/") {
        return Promise.resolve(new Response(null, { status: 403 }));
      }

      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }

      if (url === "/api/v1/reservations/drafts/") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/v1/hahitantsoa/discovery-items/") {
        return Promise.resolve(jsonResponse({ items: [], count: 0 }));
      }

      if (url === "/api/v1/inventory/stock-movements/") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/v1/payments/") {
        return Promise.resolve(jsonResponse([]));
      }

      if (url === "/api/v1/hahitantsoa/event-drafts/") {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(jsonResponse({}, 404));
    });

    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Inventory unavailable" }),
    ).toBeInTheDocument();
  });

  it("cycles theme mode and persists the selection", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    renderApp();

    const themeButton = await screen.findByRole("button", { name: "Theme mode: system" });
    fireEvent.click(themeButton);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("erp-theme-mode")).toBe("light");
    expect(
      screen.getByRole("button", { name: "Theme mode: light" }),
    ).toHaveTextContent("Theme: Light");
  });

  it("keeps the login shell when the session is unauthenticated", async () => {
    vi.mocked(useAuth).mockReturnValue({
      state: { status: "unauthenticated", error: null },
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Connexion opérateur" }),
    ).toBeInTheDocument();
  });
});
