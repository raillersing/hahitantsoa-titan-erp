import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HahitantsoaEventDraftsPanel } from "./HahitantsoaEventDraftsPanel";
import type {
  InventoryItem,
  Customer,
  HahitantsoaEventDraft,
  HahitantsoaEventDraftAvailabilityPreview,
} from "./types";

const CUSTOMERS: Customer[] = [
  {
    id: "customer-1",
    display_name: "Customer One",
    email: "customer1@example.com",
    phone: "123",
    address: "Add 1",
    notes: "",
    is_active: true,
  },
];

const INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: "item-1",
    name: "Material One",
    kind: "material",
    description: "Item desc",
  },
];

const DRAFTS: HahitantsoaEventDraft[] = [
  {
    id: "draft-1",
    public_reference: "HED-DEMO-001",
    status: "draft",
    customer_id: CUSTOMERS[0].id,
    customer_display_name: CUSTOMERS[0].display_name,
    event_name: "Test Event",
    venue_name: "Venue 1",
    location_details: "Loc 1",
    service_notes: "Service Notes 1",
    start_at: "2026-06-06T10:00:00Z",
    end_at: "2026-06-06T12:00:00Z",
    notes: "Notes 1",
    lines: [
      {
        id: "line-1",
        inventory_item_id: INVENTORY_ITEMS[0].id,
        inventory_item_name: INVENTORY_ITEMS[0].name,
        inventory_item_kind: INVENTORY_ITEMS[0].kind,
        quantity: 5,
        notes: "Line note",
      },
    ],
    created_at: "2026-06-06T09:00:00Z",
    updated_at: "2026-06-06T09:00:00Z",
  },
];

const AVAILABILITY_PREVIEW: HahitantsoaEventDraftAvailabilityPreview = {
  event_draft_id: DRAFTS[0].id,
  public_reference: DRAFTS[0].public_reference,
  start_at: DRAFTS[0].start_at,
  end_at: DRAFTS[0].end_at,
  line_count: 1,
  available_line_count: 1,
  unavailable_line_count: 0,
  lines: [
    {
      event_draft_line_id: "line-1",
      quantity: 5,
      inventory_item_id: INVENTORY_ITEMS[0].id,
      inventory_item_name: INVENTORY_ITEMS[0].name,
      inventory_item_kind: INVENTORY_ITEMS[0].kind,
      status: "available",
      conflict_count: 0,
    },
  ],
};

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockHahitantsoaFetch(options: {
  failList?: boolean;
  failDetail?: boolean;
  failCreate?: boolean;
  failDelete?: boolean;
  failPreview?: boolean;
  failPreflight?: boolean;
  failConfirm?: boolean;
  preflightCanConfirm?: boolean;
  preflightBlockers?: string[];
} = {}) {
  const canConfirm = options.preflightCanConfirm ?? true;
  const blockers = options.preflightBlockers ?? [];
  const preflightPayload = {
    event_draft_id: DRAFTS[0].id,
    public_reference: DRAFTS[0].public_reference,
    status: DRAFTS[0].status,
    can_confirm: canConfirm,
    blockers: blockers,
    active_line_count: 1,
    unavailable_line_count: canConfirm ? 0 : 1,
  };

  return vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = String(input);

    if (url === "/api/v1/customers/") {
      return Promise.resolve(jsonResponse(CUSTOMERS));
    }

    if (url === "/api/v1/hahitantsoa/event-drafts/") {
      if (init?.method === "POST") {
        return Promise.resolve(
          options.failCreate ? jsonResponse({}, 400) : jsonResponse(DRAFTS[0])
        );
      }
      return Promise.resolve(
        options.failList ? jsonResponse({}, 500) : jsonResponse(DRAFTS)
      );
    }

    if (url.includes("/api/v1/hahitantsoa/event-drafts/")) {
      const draftId = url.split("/").filter(Boolean).pop();
      if (url.endsWith("/availability-preview/")) {
        return Promise.resolve(
          options.failPreview ? jsonResponse({}, 500) : jsonResponse(AVAILABILITY_PREVIEW)
        );
      }
      if (url.endsWith("/confirmation-preflight/")) {
        return Promise.resolve(
          options.failPreflight ? jsonResponse({}, 500) : jsonResponse(preflightPayload)
        );
      }
      if (url.endsWith("/confirm/")) {
        return Promise.resolve(
          options.failConfirm
            ? jsonResponse({ detail: "Confirmation failed due to business conflicts." }, 400)
            : jsonResponse({
                status: "confirmed",
                public_reference: DRAFTS[0].public_reference,
                blocked_item_count: 0,
                event_draft: DRAFTS[0],
              })
        );
      }
      if (init?.method === "DELETE") {
        return Promise.resolve(
          options.failDelete ? jsonResponse({}, 400) : new Response(null, { status: 204 })
        );
      }
      if (init?.method === "PATCH") {
        return Promise.resolve(jsonResponse(DRAFTS[0]));
      }
      return Promise.resolve(
        options.failDetail ? jsonResponse({}, 404) : jsonResponse(DRAFTS[0])
      );
    }

    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });
}

describe("HahitantsoaEventDraftsPanel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("lists existing event drafts successfully", async () => {
    mockHahitantsoaFetch();
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
      expect(screen.getByText(/Test Event/)).toBeInTheDocument();
    });
  });

  it("creates a new draft successfully", async () => {
    mockHahitantsoaFetch();
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    const eventNameInput = screen.getByLabelText("Event Name");
    fireEvent.change(eventNameInput, { target: { value: "New Party" } });

    // Add a line
    fireEvent.click(screen.getByText("Add Line"));

    // Submit form
    fireEvent.click(screen.getByRole("button", { name: "Create Draft" }));

    await waitFor(() => {
      expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
    });
  });

  it("views draft details and checks cascading availability", async () => {
    mockHahitantsoaFetch();
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Cascading Availability"));

    await waitFor(() => {
      expect(screen.getByText("Cascading Availability Report")).toBeInTheDocument();
      expect(screen.getByText(/1 \/ 1 lines available/i)).toBeInTheDocument();
    });
  });

  it("deletes a draft", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockHahitantsoaFetch();
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Delete Draft"));

    await waitFor(() => {
      expect(screen.getByText(/draft deleted/i)).toBeInTheDocument();
    });
  });

  it("disables inputs and buttons during processing state", async () => {
    let resolvePromise!: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }
      if (url === "/api/v1/hahitantsoa/event-drafts/") {
        if (init?.method === "POST") {
          return pendingPromise.then(() => jsonResponse(DRAFTS[0]));
        }
        return Promise.resolve(jsonResponse(DRAFTS));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    // Populate name
    const eventNameInput = screen.getByLabelText("Event Name");
    fireEvent.change(eventNameInput, { target: { value: "New Party" } });

    // Add a line item so local validation passes
    fireEvent.click(screen.getByRole("button", { name: "Add Line" }));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Create Draft" }));

    // Now in loading state, inputs and buttons should be disabled
    await waitFor(() => {
      expect(screen.getByLabelText("Event Name")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();
    });

    resolvePromise(null);
  });

  it("renders a successful confirmation preflight report", async () => {
    mockHahitantsoaFetch({ preflightCanConfirm: true });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Confirmation Preflight"));

    await waitFor(() => {
      expect(screen.getByText("Confirmation Preflight Report")).toBeInTheDocument();
      expect(screen.getByText("Yes (Ready)")).toBeInTheDocument();
    });
  });

  it("renders a blocked preflight report with blockers", async () => {
    mockHahitantsoaFetch({
      preflightCanConfirm: false,
      preflightBlockers: ["Conflict item-1 on 2026-06-06"],
    });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Confirmation Preflight"));

    await waitFor(() => {
      expect(screen.getByText("Confirmation Preflight Report")).toBeInTheDocument();
      expect(screen.getByText("No (Blocked)")).toBeInTheDocument();
      expect(screen.getByText("Conflict item-1 on 2026-06-06")).toBeInTheDocument();
    });
  });

  it("disables preflight actions and form when preflight is in flight", async () => {
    let resolvePromise!: (val: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }
      if (url === "/api/v1/hahitantsoa/event-drafts/") {
        return Promise.resolve(jsonResponse(DRAFTS));
      }
      if (url.includes("/api/v1/hahitantsoa/event-drafts/")) {
        if (url.endsWith("/confirmation-preflight/")) {
          return pendingPromise.then(() =>
            jsonResponse({
              event_draft_id: DRAFTS[0].id,
              public_reference: DRAFTS[0].public_reference,
              status: DRAFTS[0].status,
              can_confirm: true,
              blockers: [],
              active_line_count: 1,
              unavailable_line_count: 0,
            })
          );
        }
        return Promise.resolve(jsonResponse(DRAFTS[0]));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    // Run Preflight Check
    fireEvent.click(screen.getByText("Check Confirmation Preflight"));

    // Check loading indicator and disabled state
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Running Preflight Check..." })
      ).toBeDisabled();
      screen.getAllByLabelText("Event Name").forEach(input => {
        expect(input).toBeDisabled();
      });
    });

    resolvePromise(null);
  });

  it("displays an error state when preflight fetch fails", async () => {
    mockHahitantsoaFetch({ failPreflight: true });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Confirmation Preflight"));

    await waitFor(() => {
      expect(screen.getByText("The requested data could not be loaded.")).toBeInTheDocument();
    });
  });

  it("handles confirm draft success", async () => {
    mockHahitantsoaFetch({ preflightCanConfirm: true });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    // Run Preflight Check
    fireEvent.click(screen.getByText("Check Confirmation Preflight"));

    // Preflight loaded, confirm button should show
    const confirmButton = await screen.findByRole("button", { name: "Confirm Event Draft" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/confirmed successfully!/i)).toBeInTheDocument();
    });
  });

  it("handles confirm draft failure", async () => {
    mockHahitantsoaFetch({ preflightCanConfirm: true, failConfirm: true });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    // Run Preflight Check
    fireEvent.click(screen.getByText("Check Confirmation Preflight"));

    // Preflight loaded, confirm button should show
    const confirmButton = await screen.findByRole("button", { name: "Confirm Event Draft" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      const alertNode = screen.getByRole("alert");
      expect(alertNode).toHaveClass("notice", "error-notice");
      expect(alertNode).toHaveTextContent("Confirmation failed due to business conflicts.");
    });
  });
});


