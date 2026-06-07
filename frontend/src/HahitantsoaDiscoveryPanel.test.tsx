import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HahitantsoaDiscoveryPanel from "./HahitantsoaDiscoveryPanel";

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HahitantsoaDiscoveryPanel", () => {
  it("shows the loading state while discovery is pending", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => undefined));

    render(<HahitantsoaDiscoveryPanel />);

    expect(screen.getByText("Loading Hahitantsoa discovery...")).toBeInTheDocument();
  });

  it("loads and renders only read-only Hahitantsoa discovery fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        items: [
          { concept: "event", label: "event" },
          { concept: "venue", label: "venue" },
          { concept: "material", label: "material" },
        ],
        count: 3,
      }),
    );

    render(<HahitantsoaDiscoveryPanel />);

    expect(await screen.findAllByText("venue")).toHaveLength(2);
    expect(screen.getAllByText("event")).toHaveLength(2);
    expect(screen.getAllByText("material")).toHaveLength(2);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/hahitantsoa/discovery-items/", {
      credentials: "include",
      signal: expect.any(AbortSignal),
    });
  });

  it("renders an error state when discovery cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 403 }));

    render(<HahitantsoaDiscoveryPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hahitantsoa discovery unavailable",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The requested data could not be loaded.",
    );
  });

  it("does not expose Hahitantsoa write or commercial controls", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ items: [{ concept: "room", label: "room" }], count: 1 }),
    );

    render(<HahitantsoaDiscoveryPanel />);

    await screen.findByText("Complete-event concepts");
    expect(
      screen.queryByRole("button", { name: /reserve|book|pay|contract/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/price|quantity|stock|invoice|customer/i),
    ).not.toBeInTheDocument();
  });
});
