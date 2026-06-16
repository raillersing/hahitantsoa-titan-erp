import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

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

    return Promise.resolve(jsonResponse({}, 404));
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("defaults to the Dashboard module shell when the URL hash is missing", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Frontend module shell" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "ERP Overview" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("navigates to Titan scope from the Dashboard quick-nav action button", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    render(<App />);

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

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Hahitantsoa discovery" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("venue")).toHaveLength(2);
  });

  it("shows the loading state while inventory is pending", async () => {
    window.history.replaceState(null, "", "/#titan");
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => undefined),
    );

    render(<App />);

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

    render(<App />);

    expect(await screen.findByText("Projector")).toBeInTheDocument();
    expect(screen.getByText("Lighting pack")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("material")).toBeInTheDocument();
    expect(screen.getByText("material pack")).toBeInTheDocument();
  });

  it("requests the authenticated inventory endpoint", async () => {
    window.history.replaceState(null, "", "/#titan");
    const fetchMock = mockAppFetch({ inventoryItems: [] });

    render(<App />);

    await screen.findByText("No inventory items are currently visible.");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/inventory/items/", {
      credentials: "include",
      signal: expect.any(AbortSignal),
    });
  });

  it("renders the empty inventory state", async () => {
    window.history.replaceState(null, "", "/#titan");
    mockAppFetch({ inventoryItems: [] });

    render(<App />);

    expect(
      await screen.findByText("No inventory items are currently visible."),
    ).toBeInTheDocument();
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

      return Promise.resolve(jsonResponse({}, 404));
    });

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Inventory unavailable",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The requested data could not be loaded.",
    );
  });

  it("renders an error state when the request rejects", async () => {
    window.history.replaceState(null, "", "/#titan");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);

      if (url === "/api/v1/inventory/items/") {
        return Promise.reject(new Error("Network unavailable"));
      }

      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }

      if (url === "/api/v1/reservations/drafts/") {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(jsonResponse({}, 404));
    });

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable",
    );
  });

  it("renders availability without login or forbidden reservation controls", async () => {
    window.history.replaceState(null, "", "/#titan");
    mockAppFetch({ inventoryItems: [] });

    render(<App />);

    await screen.findByText("No inventory items are currently visible.");
    expect(
      screen.getByRole("heading", { name: "Availability" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check availability" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /log in|sign in/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /confirm|pay|invoice|contract|pdf/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps Hahitantsoa discovery separate from the Titan surface", async () => {
    window.history.replaceState(null, "", "/#titan");
    const fetchMock = mockAppFetch({
      inventoryItems: [],
      discoveryResponse: {
        items: [{ concept: "venue", label: "venue" }],
        count: 1,
      },
    });

    render(<App />);

    await screen.findByText("No inventory items are currently visible.");
    expect(screen.queryByText("venue")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hahitantsoa" }));

    expect(await screen.findAllByText("venue")).toHaveLength(2);
    expect(
      screen.queryByRole("heading", { name: "Availability" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/hahitantsoa/discovery-items/",
      {
        credentials: "include",
        signal: expect.any(AbortSignal),
      },
    );
    expect(window.location.hash).toBe("#hahitantsoa");
  });

  it("navigates to Commercial Ops scope from nav button and dashboard quick action", async () => {
    window.history.replaceState(null, "", "/");
    mockAppFetch({ inventoryItems: [] });

    render(<App />);

    // Click quick nav action in Dashboard panel
    const commOpsQuickBtn = await screen.findByRole("button", { name: /View Operations/i });
    fireEvent.click(commOpsQuickBtn);

    expect(
      await screen.findByRole("heading", { name: "Commercial Operations", level: 2 }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#commercial-ops");

    // Switch back to Dashboard via tab and verify
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(window.location.hash).toBe("#dashboard");

    // Switch to Commercial Ops via navigation button
    fireEvent.click(screen.getByRole("button", { name: "Commercial Ops" }));
    expect(window.location.hash).toBe("#commercial-ops");
  });
});
