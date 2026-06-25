import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
const UPDATED_START_AT_LOCAL = "2026-06-06T13:00";
const UPDATED_END_AT_LOCAL = "2026-06-06T15:00";
const UPDATED_START_AT_ISO = new Date(UPDATED_START_AT_LOCAL).toISOString();
const UPDATED_END_AT_ISO = new Date(UPDATED_END_AT_LOCAL).toISOString();

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
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    display_name: "Client Updated",
    email: "updated@example.test",
    phone: "+261 34 11 111 11",
    address: "Antananarivo",
    notes: "Updated customer",
    is_active: true,
  },
];

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

const EMPTY_SUMMARY: ReservationAvailabilitySummary = {
  ...SUMMARY,
  available_item_count: 0,
  available_preview_count: 0,
  available_item_kinds: [],
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

const DRAFT_RESPONSE = {
  id: "draft-1",
  public_reference: "RD-DEMO-001",
  status: "draft",
  customer_id: CUSTOMERS[0].id,
  customer_display_name: CUSTOMERS[0].display_name,
  start_at: START_AT_ISO,
  end_at: END_AT_ISO,
  notes: "Created from the frontend MVP draft flow.",
  contract_signed_at: null,
  contract_signed_by_id: null,
  required_deposit_received_at: null,
  required_deposit_received_by_id: null,
  confirmed_at: null,
  confirmed_by_id: null,
  cancelled_at: null,
  cancelled_by_id: null,
  lines: [
    {
      id: "line-1",
      inventory_item_id: INVENTORY_ITEMS[0].id,
      inventory_item_name: INVENTORY_ITEMS[0].name,
      inventory_item_kind: INVENTORY_ITEMS[0].kind,
      quantity: 1,
      notes: "",
    },
    {
      id: "line-2",
      inventory_item_id: INVENTORY_ITEMS[1].id,
      inventory_item_name: INVENTORY_ITEMS[1].name,
      inventory_item_kind: INVENTORY_ITEMS[1].kind,
      quantity: 1,
      notes: "",
    },
  ],
  created_at: START_AT_ISO,
  updated_at: START_AT_ISO,
};

type MockOptions = {
  summary?: object;
  previews?: object;
  itemPreviews?: Record<string, object>;
  draft?: object;
  updatedDraft?: object;
  fail?:
    | "customers"
    | "summary"
    | "previews"
    | "itemPreview"
    | "draft"
    | "update";
  pendingAvailability?: boolean;
};

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockAvailabilityFetch(options: MockOptions = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = String(input);

    if (url === "/api/v1/customers/") {
      return Promise.resolve(
        options.fail === "customers"
          ? jsonResponse({}, 500)
          : jsonResponse(CUSTOMERS),
      );
    }

    if (url.includes("/api/v1/reservations/availability-summary/")) {
      if (options.pendingAvailability) {
        return new Promise(() => undefined);
      }

      return Promise.resolve(
        options.fail === "summary"
          ? jsonResponse({}, 500)
          : jsonResponse(options.summary ?? SUMMARY),
      );
    }

    if (url.includes("/api/v1/reservations/available-item-previews/")) {
      return Promise.resolve(
        options.fail === "previews"
          ? jsonResponse({}, 500)
          : jsonResponse(options.previews ?? PREVIEWS),
      );
    }

    if (url.includes("/api/v1/reservations/items/")) {
      if (options.fail === "itemPreview") {
        return Promise.resolve(jsonResponse({}, 500));
      }

      const itemPreview = url.includes(INVENTORY_ITEMS[0].id)
        ? (options.itemPreviews?.[INVENTORY_ITEMS[0].id] ?? ITEM_PREVIEWS[0])
        : (options.itemPreviews?.[INVENTORY_ITEMS[1].id] ?? ITEM_PREVIEWS[1]);

      return Promise.resolve(jsonResponse(itemPreview));
    }

    if (url === "/api/v1/reservations/drafts/") {
      if (init?.method === "OPTIONS") {
        return Promise.resolve(jsonResponse({}, 200));
      }

      if (init?.method === "POST") {
        return Promise.resolve(
          options.fail === "draft"
            ? jsonResponse({}, 500)
            : jsonResponse(options.draft ?? DRAFT_RESPONSE),
        );
      }

      return Promise.resolve(jsonResponse([options.draft ?? DRAFT_RESPONSE]));
    }

    if (url === `/api/v1/reservations/drafts/${DRAFT_RESPONSE.id}/`) {
      if (init?.method === "PATCH") {
        const updatePayload = JSON.parse(String(init.body ?? "{}")) as {
          customer_id?: string;
          start_at?: string;
          end_at?: string;
          notes?: string;
          lines?: Array<{
            inventory_item_id: string;
            quantity: number;
            notes?: string;
          }>;
        };
        const updatedCustomer = CUSTOMERS.find(
          (customer) => customer.id === updatePayload.customer_id,
        );
        const updatedLines = updatePayload.lines?.map((line, index) => {
          const inventoryItem = INVENTORY_ITEMS.find(
            (item) => item.id === line.inventory_item_id,
          );

          return {
            id: `updated-line-${index + 1}`,
            inventory_item_id: line.inventory_item_id,
            inventory_item_name: inventoryItem?.name ?? "Unknown item",
            inventory_item_kind: inventoryItem?.kind ?? "article",
            quantity: line.quantity,
            notes: line.notes ?? "",
          };
        });

        return Promise.resolve(
          options.fail === "update"
            ? jsonResponse({}, 500)
            : jsonResponse(
                options.updatedDraft ?? {
                  ...DRAFT_RESPONSE,
                  customer_id:
                    updatePayload.customer_id ?? DRAFT_RESPONSE.customer_id,
                  customer_display_name:
                    updatedCustomer?.display_name ??
                    DRAFT_RESPONSE.customer_display_name,
                  start_at: updatePayload.start_at ?? DRAFT_RESPONSE.start_at,
                  end_at: updatePayload.end_at ?? DRAFT_RESPONSE.end_at,
                  notes: updatePayload.notes ?? DRAFT_RESPONSE.notes,
                  lines: updatedLines ?? DRAFT_RESPONSE.lines,
                  updated_at: END_AT_ISO,
                },
              ),
        );
      }

      return Promise.resolve(jsonResponse(options.draft ?? DRAFT_RESPONSE));
    }

    if (url === `/api/v1/reservations/drafts/${DRAFT_RESPONSE.id}/contract-signed/`) {
      return Promise.resolve(
        jsonResponse({
          status: "draft",
          public_reference: DRAFT_RESPONSE.public_reference,
          reservation_draft: {
            ...(options.updatedDraft ?? DRAFT_RESPONSE),
            contract_signed_at: START_AT_ISO,
            contract_signed_by_id: "actor-1",
          },
        }),
      );
    }

    if (url === `/api/v1/reservations/drafts/${DRAFT_RESPONSE.id}/required-deposit-received/`) {
      return Promise.resolve(
        jsonResponse({
          status: "draft",
          public_reference: DRAFT_RESPONSE.public_reference,
          reservation_draft: {
            ...(options.updatedDraft ?? DRAFT_RESPONSE),
            contract_signed_at: START_AT_ISO,
            contract_signed_by_id: "actor-1",
            required_deposit_received_at: END_AT_ISO,
            required_deposit_received_by_id: "actor-1",
          },
        }),
      );
    }

    if (url === `/api/v1/reservations/drafts/${DRAFT_RESPONSE.id}/confirm/`) {
      return Promise.resolve(
        jsonResponse({
          status: "confirmed",
          public_reference: DRAFT_RESPONSE.public_reference,
          blocked_item_count: 2,
          reservation_draft: {
            ...(options.updatedDraft ?? DRAFT_RESPONSE),
            status: "confirmed",
            contract_signed_at: START_AT_ISO,
            contract_signed_by_id: "actor-1",
            required_deposit_received_at: END_AT_ISO,
            required_deposit_received_by_id: "actor-1",
            confirmed_at: END_AT_ISO,
            confirmed_by_id: "actor-1",
          },
        }),
      );
    }

    return Promise.resolve(jsonResponse({}, 404));
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

async function loadAvailability(inventoryItems = INVENTORY_ITEMS) {
  render(<AvailabilityPanel inventoryItems={inventoryItems} />);
  fillValidPeriod();
  submitAvailability();
  await screen.findByText("Item-specific availability previews");
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AvailabilityPanel", () => {
  it("renders the period form without login or forbidden commercial controls", () => {
    mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    expect(screen.getByLabelText("Start")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(screen.getByLabelText("End")).toHaveAttribute(
      "type",
      "datetime-local",
    );
    expect(
      screen.getByRole("button", { name: "Check availability" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/username|password/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /confirm|pay|invoice|contract|pdf/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("loads customers with session credentials before draft creation UI is shown", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/customers/", {
        credentials: "include",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("calls availability endpoints with session credentials and aware datetimes", async () => {
    const fetchMock = mockAvailabilityFetch();

    await loadAvailability();

    const availabilityCalls = fetchMock.mock.calls.filter(
      ([url]) =>
        String(url).includes("/api/v1/reservations/") &&
        !String(url).includes("/api/v1/reservations/drafts/"),
    );

    expect(availabilityCalls).toHaveLength(4);

    for (const [url, options] of availabilityCalls.slice(0, 3)) {
      expect(options).toEqual({ credentials: "include", signal: undefined });
      const requestUrl = new URL(String(url), "http://localhost");
      expect(requestUrl.searchParams.get("start_at")).toBe(START_AT_ISO);
      expect(requestUrl.searchParams.get("end_at")).toBe(END_AT_ISO);
    }

    expect(String(availabilityCalls[0][0])).toContain(
      "/api/v1/reservations/availability-summary/",
    );
    expect(String(availabilityCalls[1][0])).toContain(
      "/api/v1/reservations/available-item-previews/",
    );
    expect(String(availabilityCalls[2][0])).toContain(
      `/api/v1/reservations/items/${INVENTORY_ITEMS[0].id}/availability-preview/`,
    );
    expect(String(availabilityCalls[3][0])).toContain(
      `/api/v1/reservations/items/${INVENTORY_ITEMS[1].id}/availability-preview/`,
    );
  });

  it("shows loading while availability requests are pending", async () => {
    mockAvailabilityFetch({ pendingAvailability: true });

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);
    fillValidPeriod();
    submitAvailability();

    expect(screen.getByText("Checking availability...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check availability" }),
    ).toBeDisabled();
  });

  it("renders summary, available previews and item-specific conflict counts", async () => {
    mockAvailabilityFetch();

    await loadAvailability();

    expect(screen.getAllByText("Projector")).toHaveLength(2);
    expect(screen.getAllByText("Lighting pack")).toHaveLength(2);
    expect(screen.getByText("material, material_pack")).toBeInTheDocument();
    expect(screen.getAllByText("available")).toHaveLength(3);
    expect(screen.getByText("unavailable")).toBeInTheDocument();
    expect(screen.getByText("0 conflicts")).toBeInTheDocument();
    expect(screen.getByText("1 conflicts")).toBeInTheDocument();
  });

  it("renders empty preview states", async () => {
    mockAvailabilityFetch({
      summary: EMPTY_SUMMARY,
      previews: [],
    });

    await loadAvailability([]);

    expect(
      screen.getByText("No items are available for this period."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No inventory items are loaded for item-specific preview.",
      ),
    ).toBeInTheDocument();
  });

  it.each(["summary", "previews", "itemPreview"] as const)(
    "renders an error when the %s request fails",
    async (failedRequest) => {
      mockAvailabilityFetch({ fail: failedRequest });

      render(<AvailabilityPanel inventoryItems={[INVENTORY_ITEMS[0]]} />);
      fillValidPeriod();
      submitAvailability();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The requested data could not be loaded.",
      );
    },
  );

  it("rejects an invalid or reversed local period without availability API requests", async () => {
    const fetchMock = mockAvailabilityFetch();

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

    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/v1/reservations/availability-summary/"),
      ),
    ).toBe(false);
  });

  it("loads existing reservation drafts with session credentials", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    expect(await screen.findByText("RD-DEMO-001")).toBeInTheDocument();
    expect(screen.getByText("Client Demo")).toBeInTheDocument();
    expect(screen.getByText("2 lines")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/reservations/drafts/", {
      credentials: "include",
      signal: expect.any(AbortSignal),
    });
  });

  it("opens an existing reservation draft detail with Titan workflow actions", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    expect(
      await screen.findByText("Draft detail RD-DEMO-001"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Client Demo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("draft").length).toBeGreaterThan(0);
    expect(screen.getByText("Pending prerequisites")).toBeInTheDocument();
    expect(screen.getAllByText("Quantity: 1")).toHaveLength(2);
    expect(
      screen.getByText(
        /Confirmation still depends on existing backend truth/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark contract signed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark deposit received" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm Titan reservation" }),
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/reservations/drafts/draft-1/",
      {
        credentials: "include",
        signal: undefined,
      },
    );
  });

  it("updates an existing reservation draft lines only without commercial controls", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    fireEvent.change(await screen.findByLabelText("Draft line 1 quantity"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Draft line 1 notes"), {
      target: { value: "Frontend replacement line." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft lines" }));

    expect(await screen.findByText("Draft changes saved.")).toBeInTheDocument();
    expect(screen.getByText("Quantity: 3")).toBeInTheDocument();
    expect(screen.getAllByText("Frontend replacement line.")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/reservations/drafts/draft-1/",
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lines: [
            {
              inventory_item_id: INVENTORY_ITEMS[0].id,
              quantity: 3,
              notes: "Frontend replacement line.",
            },
            {
              inventory_item_id: INVENTORY_ITEMS[1].id,
              quantity: 1,
              notes: "",
            },
          ],
        }),
        signal: undefined,
      },
    );
  });

  it("updates an existing reservation draft customer only without commercial controls", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    fireEvent.change(await screen.findByLabelText("Draft customer"), {
      target: { value: CUSTOMERS[1].id },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save draft customer" }),
    );

    expect(await screen.findByText("Draft changes saved.")).toBeInTheDocument();
    const detailHeading = screen.getByText("Draft detail RD-DEMO-001");
    const detailCard = detailHeading.closest("article");
    expect(detailCard).not.toBeNull();
    expect(
      within(detailCard as HTMLElement).getAllByText("Client Updated").length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Draft customer")).toHaveValue(
      CUSTOMERS[1].id,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/reservations/drafts/draft-1/",
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: CUSTOMERS[1].id,
        }),
        signal: undefined,
      },
    );
  });

  it("updates an existing reservation draft period only without commercial controls", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    fireEvent.change(await screen.findByLabelText("Draft start"), {
      target: { value: UPDATED_START_AT_LOCAL },
    });
    fireEvent.change(screen.getByLabelText("Draft end"), {
      target: { value: UPDATED_END_AT_LOCAL },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft period" }));

    expect(await screen.findByText("Draft changes saved.")).toBeInTheDocument();
    expect(screen.getByLabelText("Draft start")).toHaveValue(
      UPDATED_START_AT_LOCAL,
    );
    expect(screen.getByLabelText("Draft end")).toHaveValue(
      UPDATED_END_AT_LOCAL,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/reservations/drafts/draft-1/",
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          start_at: UPDATED_START_AT_ISO,
          end_at: UPDATED_END_AT_ISO,
        }),
        signal: undefined,
      },
    );
  });

  it("rejects an invalid draft period without calling the update API", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    fireEvent.change(await screen.findByLabelText("Draft start"), {
      target: { value: UPDATED_END_AT_LOCAL },
    });
    fireEvent.change(screen.getByLabelText("Draft end"), {
      target: { value: UPDATED_START_AT_LOCAL },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft period" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a valid draft period with an end after the start.",
    );

    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/v1/reservations/drafts/draft-1/" &&
          init?.method === "PATCH",
      ),
    ).toBe(false);
  });

  it("updates an existing reservation draft notes only without commercial controls", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    const notesField = await screen.findByLabelText("Draft notes");
    fireEvent.change(notesField, {
      target: { value: "Updated from frontend notes edit." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft notes" }));

    expect(await screen.findByText("Draft changes saved.")).toBeInTheDocument();
    expect(screen.getByLabelText("Draft notes")).toHaveValue(
      "Updated from frontend notes edit.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/reservations/drafts/draft-1/",
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: "Updated from frontend notes edit.",
        }),
        signal: undefined,
      },
    );
  });

  it("shows a draft notes update error without commercial controls", async () => {
    mockAvailabilityFetch({ fail: "update" });

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    const notesField = await screen.findByLabelText("Draft notes");
    fireEvent.change(notesField, {
      target: { value: "This save will fail." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft notes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The requested data could not be loaded.",
    );
  });

  it("creates a reservation draft for the selected customer and available items", async () => {
    const fetchMock = mockAvailabilityFetch();

    await loadAvailability();

    expect(screen.getByText("New reservation wizard")).toBeInTheDocument();
    expect(await screen.findByLabelText("Customer")).toBeInTheDocument();
    expect(screen.getAllByText("Client Demo").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Create Titan draft" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create Titan draft" }));

    expect(
      await screen.findByText("Reference: RD-DEMO-001"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("draft").length).toBeGreaterThan(0);

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/reservations/drafts/", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: CUSTOMERS[0].id,
        start_at: START_AT_ISO,
        end_at: END_AT_ISO,
        notes: "Created from the frontend MVP draft flow.",
        lines: [
          {
            inventory_item_id: INVENTORY_ITEMS[0].id,
            quantity: 1,
            notes: "",
          },
          {
            inventory_item_id: INVENTORY_ITEMS[1].id,
            quantity: 1,
            notes: "",
          },
        ],
      }),
      signal: undefined,
    });
  });

  it("marks Titan prerequisites and confirms the reservation from the detail panel", async () => {
    const fetchMock = mockAvailabilityFetch();

    render(<AvailabilityPanel inventoryItems={INVENTORY_ITEMS} />);

    await screen.findByText("RD-DEMO-001");
    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    fireEvent.click(await screen.findByRole("button", { name: "Mark contract signed" }));
    expect(
      await screen.findByText("Contract marker recorded for this Titan reservation."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark deposit received" }));
    expect(
      await screen.findByText("Deposit marker recorded for this Titan reservation."),
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Titan reservation",
    });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    expect(
      await screen.findByText("Titan reservation confirmed. 2 inventory blocks were created."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/reservations/drafts/draft-1/confirm/",
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        signal: undefined,
      },
    );
  });

  it("shows a draft creation error", async () => {
    mockAvailabilityFetch({ fail: "draft" });

    await loadAvailability();

    fireEvent.click(screen.getByRole("button", { name: "Create Titan draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The requested data could not be loaded.",
    );
  });
});
