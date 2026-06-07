import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

type InventoryItem = {
  id: string;
  name: string;
  kind: "material" | "article" | "material_pack";
  description: string;
};

function mockInventoryResponse(items: InventoryItem[]) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(items), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("shows the loading state while inventory is pending", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => undefined));

    render(<App />);

    expect(screen.getByText("Loading inventory...")).toBeInTheDocument();
  });

  it("renders inventory items, count and kind labels", async () => {
    mockInventoryResponse([
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
    ]);

    render(<App />);

    expect(await screen.findByText("Projector")).toBeInTheDocument();
    expect(screen.getByText("Lighting pack")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("material")).toBeInTheDocument();
    expect(screen.getByText("material pack")).toBeInTheDocument();
  });

  it("requests the authenticated inventory endpoint", async () => {
    const fetchMock = mockInventoryResponse([]);

    render(<App />);

    await screen.findByText("No inventory items are currently visible.");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/inventory/items/", {
      credentials: "include",
      signal: expect.any(AbortSignal),
    });
  });

  it("renders the empty inventory state", async () => {
    mockInventoryResponse([]);

    render(<App />);

    expect(
      await screen.findByText("No inventory items are currently visible."),
    ).toBeInTheDocument();
  });

  it("renders an error state for a failed HTTP response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Inventory unavailable");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The requested data could not be loaded.",
    );
  });

  it("renders an error state when the request rejects", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network unavailable"));

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
  });

  it("renders availability without login or reservation creation controls", async () => {
    mockInventoryResponse([]);

    render(<App />);

    await screen.findByText("No inventory items are currently visible.");
    expect(screen.getByRole("heading", { name: "Availability" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check availability" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in|sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reserve|book/i })).not.toBeInTheDocument();
  });

  it("keeps Hahitantsoa discovery separate from the Titan surface", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ concept: "venue", label: "venue" }],
            count: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<App />);

    await screen.findByText("No inventory items are currently visible.");
    expect(screen.queryByText("venue")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hahitantsoa" }));

    expect(await screen.findAllByText("venue")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Availability" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/hahitantsoa/discovery-items/", {
      credentials: "include",
      signal: expect.any(AbortSignal),
    });
  });
});
