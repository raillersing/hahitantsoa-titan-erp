import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AvailabilityPanel from "./AvailabilityPanel";
import type {
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
} from "./types";

const START_AT_LOCAL = "2026-06-06T10:00";
const END_AT_LOCAL = "2026-06-06T12:00";
const START_AT_ISO = new Date(START_AT_LOCAL).toISOString();
const END_AT_ISO = new Date(END_AT_LOCAL).toISOString();

const SUMMARY: ReservationAvailabilitySummary = {
  start_at: START_AT_ISO,
  end_at: END_AT_ISO,
  available_item_count: 2,
  available_preview_count: 2,
  available_item_kinds: ["material", "material_pack"],
};

const PREVIEWS: ReservationAvailableItemPreview[] = [
  {
    inventory_item_id: "item-1",
    inventory_item_name: "Projector",
    inventory_item_kind: "material",
    start_at: START_AT_ISO,
    end_at: END_AT_ISO,
    status: "available",
  },
  {
    inventory_item_id: "item-2",
    inventory_item_name: "Lighting pack",
    inventory_item_kind: "material_pack",
    start_at: START_AT_ISO,
    end_at: END_AT_ISO,
    status: "available",
  },
];

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fillValidPeriod() {
  fireEvent.change(screen.getByLabelText("Start"), {
    target: { value: START_AT_LOCAL },
  });
  fireEvent.change(screen.getByLabelText("End"), {
    target: { value: END_AT_LOCAL },
  });
}

function submitAvailability() {
  fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AvailabilityPanel", () => {
  it("renders the period form without login or reservation creation controls", () => {
    render(<AvailabilityPanel />);

    expect(screen.getByLabelText("Start")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByLabelText("End")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByRole("button", { name: "Check availability" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in|sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reserve|book/i })).not.toBeInTheDocument();
  });

  it("calls both read-only endpoints with session credentials and aware datetimes", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(SUMMARY))
      .mockResolvedValueOnce(jsonResponse(PREVIEWS));
    render(<AvailabilityPanel />);
    fillValidPeriod();

    submitAvailability();

    await screen.findByText("Projector");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    for (const [url, options] of fetchMock.mock.calls) {
      expect(options).toEqual({ credentials: "include", signal: undefined });
      const requestUrl = new URL(String(url), "http://localhost");
      expect(requestUrl.searchParams.get("start_at")).toBe(START_AT_ISO);
      expect(requestUrl.searchParams.get("end_at")).toBe(END_AT_ISO);
    }

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/reservations/availability-summary/",
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "/api/v1/reservations/available-item-previews/",
    );
  });

  it("shows loading while both requests are pending", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => undefined));
    render(<AvailabilityPanel />);
    fillValidPeriod();

    submitAvailability();

    expect(screen.getByText("Checking availability...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check availability" })).toBeDisabled();
  });

  it("renders summary and available item previews", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(SUMMARY))
      .mockResolvedValueOnce(jsonResponse(PREVIEWS));
    render(<AvailabilityPanel />);
    fillValidPeriod();

    submitAvailability();

    expect(await screen.findByText("Projector")).toBeInTheDocument();
    expect(screen.getByText("Lighting pack")).toBeInTheDocument();
    expect(screen.getByText("material, material_pack")).toBeInTheDocument();
    expect(screen.getAllByText("2")).toHaveLength(2);
    expect(screen.getAllByText("available")).toHaveLength(2);
  });

  it("renders an empty previews state", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          ...SUMMARY,
          available_item_count: 0,
          available_preview_count: 0,
          available_item_kinds: [],
        }),
      )
      .mockResolvedValueOnce(jsonResponse([]));
    render(<AvailabilityPanel />);
    fillValidPeriod();

    submitAvailability();

    expect(
      await screen.findByText("No items are available for this period."),
    ).toBeInTheDocument();
  });

  it.each(["summary", "previews"])(
    "renders an error when the %s request fails",
    async (failedRequest) => {
      const fetchMock = vi.spyOn(globalThis, "fetch");
      if (failedRequest === "summary") {
        fetchMock
          .mockResolvedValueOnce(jsonResponse({}, 500))
          .mockResolvedValueOnce(jsonResponse(PREVIEWS));
      } else {
        fetchMock
          .mockResolvedValueOnce(jsonResponse(SUMMARY))
          .mockResolvedValueOnce(jsonResponse({}, 500));
      }
      render(<AvailabilityPanel />);
      fillValidPeriod();

      submitAvailability();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The requested data could not be loaded.",
      );
    },
  );

  it("rejects an invalid or reversed local period without API requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<AvailabilityPanel />);
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: END_AT_LOCAL },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: START_AT_LOCAL },
    });

    submitAvailability();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a valid period with an end after the start.",
    );
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
