import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AvailabilityPanel from "./AvailabilityPanel";
import type {
  InventoryItem,
  ReservationAvailabilitySummary,
  ReservationAvailableItemPreview,
  ReservationItemAvailabilityPreview,
} from "./types";

const START_AT_LOCAL = "2026-06-06T10:00";
const END_AT_LOCAL = "2026-06-06T12:00";
const START_AT_ISO = new Date(START_AT_LOCAL).toISOString();
const END_AT_ISO = new Date(END_AT_LOCAL).toISOString();

const INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Projector",
    kind: "material",
    description: "Demo projector",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Lighting pack",
    kind: "material_pack",
    description: "Demo lighting pack",
  },
];

const SUMMARY: ReservationAvailabilitySummary = {
  start_at: START_AT_ISO,
  end_at: END_AT_ISO,
  available_item_count: 2,
  available_preview_count: 2,
  available_item_kinds: ["material", "material_pack"],
};

const PREVIEWS: ReservationAvailableItemPreview[] = [
  {
    inventory_item_id: INVENTORY_ITEMS[0].id,
    inventory_item_name: "Projector",
    inventory_item_kind: "material",
    start_at: START_AT_ISO,
    end_at: END_AT_ISO,
    status: "available",
  },
  {
    inventory_item_id: INVENTORY_ITEMS[1].id,
    inventory_item_name: "Lighting pack",
    inventory_item_kind: "material_pack",
    start_at: START_AT_ISO,
    end_at: END_AT_ISO,
    status: "available",
  },
];

const ITEM_PREVIEWS: ReservationItemAvailabilityPreview[] = [
  {
    inventory_item_id: INVENTORY_ITEMS[0].id,
    inventory_item_name: "Projector",
    inventory_item_kind: "material",
    start_at: START_AT_ISO,
    end_at: END_AT_ISO,
    status: "available",
    conflict_count: 0,
  },
  {
    inventory_item_id: INVENTORY_ITEMS[1].id,
    inventory_item_name: "Lighting pack",
    inventory_item_kind: "material_pack",
    start_at: START_AT_ISO,
    end_at: END_AT_ISO,
    status: "unavailable",
    conflict_count: 1,
  },
];

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockSuccessfulAvailabilityResponses() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(jsonResponse(SUMMARY))
    .mockResolvedValueOnce(jsonResponse(PREVIEWS))
    .mockResolvedValueOnce(jsonResponse(ITEM_PREVIEWS[0]))
    .mockResolvedValueOnce(jsonResponse(ITEM_PREVIEWS[1]));
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
    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    expect(screen.getByLabelText("Start")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByLabelText("End")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByRole("button", { name: "Check availability" })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sign in through the backend \/api-auth\/login\/ first\. For local demo data, run seed_demo_availability and choose a period overlapping its next two-hour window\. Checking availability does not create a reservation\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log in|sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/username|password/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reserve|book|create reservation/i }),
    ).not.toBeInTheDocument();
  });

  it("calls read-only endpoints including item-specific previews with session credentials and aware datetimes", async () => {
    const fetchMock = mockSuccessfulAvailabilityResponses();
    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);
    fillValidPeriod();

    submitAvailability();

    await screen.findByText("Item-specific availability previews");
    expect(fetchMock).toHaveBeenCalledTimes(4);

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
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      `/api/v1/reservations/items/${INVENTORY_ITEMS[0].id}/availability-preview/`,
    );
    expect(String(fetchMock.mock.calls[3][0])).toContain(
      `/api/v1/reservations/items/${INVENTORY_ITEMS[1].id}/availability-preview/`,
    );
  });

  it("shows loading while requests are pending", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => undefined));
    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);
    fillValidPeriod();

    submitAvailability();

    expect(screen.getByText("Checking availability...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check availability" })).toBeDisabled();
  });

  it("renders summary, available item previews and item-specific conflict counts", async () => {
    mockSuccessfulAvailabilityResponses();
    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);
    fillValidPeriod();

    submitAvailability();

    expect(await screen.findByText("Item-specific availability previews")).toBeInTheDocument();
    expect(screen.getAllByText("Projector")).toHaveLength(2);
    expect(screen.getAllByText("Lighting pack")).toHaveLength(2);
    expect(screen.getByText("material, material_pack")).toBeInTheDocument();
    expect(screen.getAllByText("available")).toHaveLength(3);
    expect(screen.getByText("unavailable")).toBeInTheDocument();
    expect(screen.getByText("0 conflicts")).toBeInTheDocument();
    expect(screen.getByText("1 conflicts")).toBeInTheDocument();
  });

  it("renders an empty previews state and an empty item-specific state", async () => {
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
    render(<AvailabilityPanel inventoryItems={[]} />);
    fillValidPeriod();

    submitAvailability();

    expect(
      await screen.findByText("No items are available for this period."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No inventory items are loaded for item-specific preview."),
    ).toBeInTheDocument();
  });

  it.each(["summary", "previews", "item preview"])(
    "renders an error when the %s request fails",
    async (failedRequest) => {
      const fetchMock = vi.spyOn(globalThis, "fetch");
      if (failedRequest === "summary") {
        fetchMock
          .mockResolvedValueOnce(jsonResponse({}, 500))
          .mockResolvedValueOnce(jsonResponse(PREVIEWS))
          .mockResolvedValueOnce(jsonResponse(ITEM_PREVIEWS[0]));
      } else if (failedRequest === "previews") {
        fetchMock
          .mockResolvedValueOnce(jsonResponse(SUMMARY))
          .mockResolvedValueOnce(jsonResponse({}, 500))
          .mockResolvedValueOnce(jsonResponse(ITEM_PREVIEWS[0]));
      } else {
        fetchMock
          .mockResolvedValueOnce(jsonResponse(SUMMARY))
          .mockResolvedValueOnce(jsonResponse(PREVIEWS))
          .mockResolvedValueOnce(jsonResponse({}, 500));
      }
      render(<AvailabilityPanel inventoryItems={[INVENTORY_ITEMS[0]]} />);
      fillValidPeriod();

      submitAvailability();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The requested data could not be loaded.",
      );
    },
  );

  it("rejects an invalid or reversed local period without API requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);
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
