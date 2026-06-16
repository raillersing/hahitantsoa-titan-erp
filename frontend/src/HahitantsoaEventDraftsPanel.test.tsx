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
  preflightCanAmend?: boolean;
  preflightBlockers?: string[];
} = {}) {
  const canConfirm = options.preflightCanConfirm ?? true;
  const canAmend = options.preflightCanAmend ?? true;
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

  const amendmentRequests = [
    {
      id: "request-1",
      event_draft_id: DRAFTS[0].id,
      status: "draft" as const,
      reason: "Initial reason",
      notes: "Initial notes",
      lines: [
        {
          id: "amendment-line-1",
          inventory_item_id: INVENTORY_ITEMS[0].id,
          inventory_item_name: INVENTORY_ITEMS[0].name,
          inventory_item_kind: INVENTORY_ITEMS[0].kind,
          quantity: 2,
          notes: "Initial amendment line notes",
        }
      ],
      created_at: "2026-06-16T10:00:00Z",
      updated_at: "2026-06-16T10:00:00Z",
    }
  ];

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
      const parts = url.split("/").filter(Boolean);
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
      if (url.endsWith("/amendment-preflight/")) {
        const amendmentPreflightPayload = {
          event_draft_id: DRAFTS[0].id,
          public_reference: DRAFTS[0].public_reference,
          status: DRAFTS[0].status,
          can_amend: canAmend,
          blockers: blockers,
          active_line_count: 1,
        };
        return Promise.resolve(
          options.failPreflight ? jsonResponse({}, 500) : jsonResponse(amendmentPreflightPayload)
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
      if (url.includes("/amendment-requests/")) {
        // Path matches: .../amendment-requests/<req_id>/availability-preflight/
        if (url.endsWith("/availability-preflight/")) {
          const reqId = parts[parts.length - 2];
          return Promise.resolve(jsonResponse({
            amendment_request_id: reqId,
            event_draft_id: DRAFTS[0].id,
            public_reference: DRAFTS[0].public_reference,
            status: "draft",
            start_at: DRAFTS[0].start_at,
            end_at: DRAFTS[0].end_at,
            line_count: 1,
            available_line_count: 1,
            unavailable_line_count: 0,
            lines: [
              {
                amendment_request_line_id: "amendment-line-1",
                quantity: 2,
                inventory_item_id: INVENTORY_ITEMS[0].id,
                inventory_item_name: INVENTORY_ITEMS[0].name,
                inventory_item_kind: INVENTORY_ITEMS[0].kind,
                status: "available",
                conflict_count: 0,
              }
            ]
          }));
        }
        // Path matches: .../amendment-requests/<req_id>/lines/
        if (url.endsWith("/lines/")) {
          const reqId = parts[parts.length - 2];
          const req = amendmentRequests.find(r => r.id === reqId) || amendmentRequests[0];
          if (init?.method === "POST") {
            const body = JSON.parse(init.body as string);
            const item = INVENTORY_ITEMS.find(i => i.id === body.inventory_item_id) || INVENTORY_ITEMS[0];
            const newLine = {
              id: `amendment-line-${(req.lines?.length || 0) + 1}`,
              inventory_item_id: item.id,
              inventory_item_name: item.name,
              inventory_item_kind: item.kind,
              quantity: body.quantity,
              notes: body.notes || "",
            };
            if (!req.lines) req.lines = [];
            req.lines.push(newLine);
            return Promise.resolve(jsonResponse(newLine, 201));
          }
          return Promise.resolve(jsonResponse(req.lines || []));
        }
        // Path matches: .../amendment-requests/<req_id>/lines/<line_id>/
        if (url.includes("/lines/")) {
          const lineId = parts[parts.length - 1];
          const reqId = parts[parts.length - 3];
          const req = amendmentRequests.find(r => r.id === reqId) || amendmentRequests[0];
          if (init?.method === "PATCH") {
            const body = JSON.parse(init.body as string);
            const line = (req.lines || []).find(l => l.id === lineId);
            if (line) {
              if (body.quantity !== undefined) line.quantity = body.quantity;
              if (body.notes !== undefined) line.notes = body.notes;
              if (body.inventory_item_id !== undefined) {
                const item = INVENTORY_ITEMS.find(i => i.id === body.inventory_item_id) || INVENTORY_ITEMS[0];
                line.inventory_item_id = item.id;
                line.inventory_item_name = item.name;
                line.inventory_item_kind = item.kind;
              }
              return Promise.resolve(jsonResponse(line));
            }
          }
          if (init?.method === "DELETE") {
            if (req.lines) {
              req.lines = req.lines.filter(l => l.id !== lineId);
            }
            return Promise.resolve(new Response(null, { status: 204 }));
          }
        }
        // Path matches: .../amendment-requests/<req_id>/
        if (init?.method === "PATCH") {
          const body = JSON.parse(init.body as string);
          const reqId = url.split("/").filter(Boolean).pop();
          const req = amendmentRequests.find(r => r.id === reqId) || amendmentRequests[0];
          req.reason = body.reason !== undefined ? body.reason : req.reason;
          req.notes = body.notes !== undefined ? body.notes : req.notes;
          return Promise.resolve(jsonResponse(req));
        }
        if (init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          const newReq = {
            id: `request-${amendmentRequests.length + 1}`,
            event_draft_id: DRAFTS[0].id,
            status: "draft" as const,
            reason: body.reason || "",
            notes: body.notes || "",
            lines: [],
            created_at: "2026-06-16T10:00:00Z",
            updated_at: "2026-06-16T10:00:00Z",
          };
          amendmentRequests.push(newReq);
          return Promise.resolve(jsonResponse({ amendment_request: newReq }, 201));
        }
        return Promise.resolve(jsonResponse(amendmentRequests));
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

  it("shows amendment preflight error state with retry button", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }
      if (url === "/api/v1/hahitantsoa/event-drafts/") {
        if (!init?.method || init.method === "GET") {
          return Promise.resolve(jsonResponse(DRAFTS));
        }
      }
      if (url.includes("/api/v1/hahitantsoa/event-drafts/")) {
        if (url.endsWith("/amendment-preflight/")) {
          return Promise.resolve(jsonResponse({ detail: "Server error during preflight." }, 500));
        }
        if (url.includes("/amendment-requests/")) {
          return Promise.resolve(jsonResponse([]));
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

    fireEvent.click(screen.getByText("Check Amendment Preflight"));

    await waitFor(() => {
      expect(screen.getByText("Amendment Preflight Failed")).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: "Retry Preflight Check" });
      expect(retryBtn).toBeInTheDocument();
    });

    fetchSpy.mockRestore();
  });

  it("shows contextual hint when amendment preflight is idle", async () => {
    mockHahitantsoaFetch();
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Run the amendment preflight check above to verify this draft is eligible/i)
    ).toBeInTheDocument();
  });

  it("shows blocked notice when amendment preflight blocks the request", async () => {
    mockHahitantsoaFetch({ preflightCanAmend: false, preflightBlockers: ["draft_not_confirmed_for_amendment"] });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Amendment Preflight"));

    await waitFor(() => {
      expect(
        screen.getByText(/Amendment is currently blocked/i)
      ).toBeInTheDocument();
    });
  });

  it("shows ready notice when amendment preflight allows the request", async () => {
    mockHahitantsoaFetch({ preflightCanAmend: true });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Amendment Preflight"));

    await waitFor(() => {
      expect(
        screen.getByText(/This draft is eligible for amendment/i)
      ).toBeInTheDocument();
    });
  });

  it("shows human-readable blocker labels in amendment preflight report", async () => {
    mockHahitantsoaFetch({ preflightCanAmend: false, preflightBlockers: ["draft_not_confirmed_for_amendment"] });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Amendment Preflight"));

    await waitFor(() => {
      expect(
        screen.getByText(/This draft has not been confirmed yet/i)
      ).toBeInTheDocument();
    });
  });

  it("shows amendment requests error state with retry button", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }
      if (url === "/api/v1/hahitantsoa/event-drafts/") {
        return Promise.resolve(jsonResponse(DRAFTS));
      }
      if (url.includes("/api/v1/hahitantsoa/event-drafts/")) {
        if (url.includes("/amendment-requests/")) {
          return Promise.resolve(jsonResponse({ detail: "Service unavailable." }, 503));
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
      const retryBtn = screen.getByRole("button", { name: "Retry Loading Requests" });
      expect(retryBtn).toBeInTheDocument();
    });
  });

  it("handles amendment preflight check successfully", async () => {
    mockHahitantsoaFetch({ preflightCanAmend: true });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Amendment Preflight"));

    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: "Amendment Preflight Report" });
      const container = heading.closest(".notice");
      expect(container).toBeInTheDocument();
      expect(container).toHaveTextContent(/Can Amend:\s*Yes \(Ready\)/i);
    });
  });

  it("renders blockers during amendment preflight when blocked", async () => {
    mockHahitantsoaFetch({ preflightCanAmend: false, preflightBlockers: ["draft_not_confirmed_for_amendment"] });
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    await waitFor(() => {
      expect(screen.getByText("Manage Draft: HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Check Amendment Preflight"));

    await waitFor(() => {
      const heading = screen.getByRole("heading", { name: "Amendment Preflight Report" });
      const container = heading.closest(".notice");
      expect(container).toBeInTheDocument();
      expect(container).toHaveTextContent(/Can Amend:\s*No \(Blocked\)/i);
      expect(container).toHaveTextContent("This draft has not been confirmed yet. Amendment is only available on confirmed drafts.");
    });
  });

  it("renders a confirmed event draft as read-only with disabled inputs and buttons", async () => {
    const confirmedDraft: HahitantsoaEventDraft = {
      ...DRAFTS[0],
      status: "confirmed",
    };
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }
      if (url === "/api/v1/hahitantsoa/event-drafts/") {
        return Promise.resolve(jsonResponse([confirmedDraft]));
      }
      if (url.includes(`/api/v1/hahitantsoa/event-drafts/${confirmedDraft.id}/`)) {
        return Promise.resolve(jsonResponse(confirmedDraft));
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

    // Check readonly alert is displayed
    expect(screen.getByText("Confirmed & Immutable Event Draft")).toBeInTheDocument();

    // Verify fields and buttons are disabled
    const eventNameInputs = screen.getAllByLabelText("Event Name");
    expect(eventNameInputs[0]).toBeDisabled(); // The edit input should be disabled
    
    // Save Changes button is a submit button in the edit form
    const forms = document.querySelectorAll("form.availability-form");
    const editForm = forms[0];
    const saveButton = editForm.querySelector("button[type='submit']");
    expect(saveButton).toBeDisabled();

    expect(screen.getByRole("button", { name: "Check Cascading Availability" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Check Confirmation Preflight" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Draft" })).toBeDisabled();

    // Verify Check Amendment Preflight remains enabled
    expect(screen.getByRole("button", { name: "Check Amendment Preflight" })).not.toBeDisabled();
  });

  it("populates default values when prefill props are provided", async () => {
    mockHahitantsoaFetch();
    render(
      <HahitantsoaEventDraftsPanel
        inventoryItems={INVENTORY_ITEMS}
        prefillEventName="Custom Festival"
        prefillVenueName="Grand Arena"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    // Verify draft creation inputs
    const inputs = screen.getAllByLabelText("Event Name");
    // Find the input which has the prefill value
    const prefilledInput = inputs.find((inp) => (inp as HTMLInputElement).value === "Custom Festival");
    expect(prefilledInput).toBeInTheDocument();

    const venueInput = screen.getByLabelText("Venue Name");
    expect(venueInput).toHaveValue("Grand Arena");
  });

  it("handles field-level validation errors from API with input highlights", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/v1/customers/") {
        return Promise.resolve(jsonResponse(CUSTOMERS));
      }
      if (url === "/api/v1/hahitantsoa/event-drafts/") {
        if (init?.method === "POST") {
          return Promise.resolve(
            jsonResponse({
              event_name: ["The event name is too long."],
              venue_name: ["The venue is already fully booked for this date."]
            }, 400)
          );
        }
        return Promise.resolve(jsonResponse(DRAFTS));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    // Fill details
    const inputs = screen.getAllByLabelText("Event Name");
    const createInput = inputs.find(inp => !(inp as HTMLInputElement).disabled) as HTMLInputElement;
    fireEvent.change(createInput, { target: { value: "A very long event name..." } });

    // Add a line to satisfy local validation
    fireEvent.click(screen.getByText("Add Line"));

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Create Draft" }));

    // Verify errors render under fields
    await waitFor(() => {
      expect(screen.getByText("The event name is too long.")).toBeInTheDocument();
      expect(screen.getByText("The venue is already fully booked for this date.")).toBeInTheDocument();
      expect(createInput).toHaveClass("invalid-input-highlight");
    });
  });

  it("manages amendment requests successfully (list, create, edit)", async () => {
    mockHahitantsoaFetch();
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    // Verify existing amendment request lists correctly
    await waitFor(() => {
      expect(screen.getByText("Initial reason")).toBeInTheDocument();
      expect(screen.getByText("Initial notes")).toBeInTheDocument();
    });

    const section = screen.getByText("Amendment Requests").closest(".amendment-requests-section")!;

    // Create a new amendment request
    const createSection = section.querySelector(".create-amendment-section")!;
    const reasonInput = createSection.querySelector("input[type='text']") as HTMLInputElement;
    const notesInput = createSection.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(reasonInput, { target: { value: "Reason text" } });
    fireEvent.change(notesInput, { target: { value: "Notes text" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit Amendment Request" }));

    await waitFor(() => {
      expect(screen.getByText("Reason text")).toBeInTheDocument();
      expect(screen.getByText("Notes text")).toBeInTheDocument();
    });

    // Edit the request
    fireEvent.click(screen.getAllByRole("button", { name: "Edit Request Details" })[0]);

    const editForm = section.querySelector(".edit-amendment-form")!;
    const editReasonInput = editForm.querySelector("input[type='text']") as HTMLInputElement;
    const editNotesInput = editForm.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(editReasonInput, { target: { value: "Updated reason" } });
    fireEvent.change(editNotesInput, { target: { value: "Updated notes" } });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Updated reason")).toBeInTheDocument();
      expect(screen.getByText("Updated notes")).toBeInTheDocument();
    });
  });

  it("renders amendment request lines, allows inline CRUD, and checks availability preflight", async () => {
    mockHahitantsoaFetch();
    render(<HahitantsoaEventDraftsPanel inventoryItems={INVENTORY_ITEMS} />);

    await waitFor(() => {
      expect(screen.getByText("HED-DEMO-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("View & Manage"));

    // Verify existing amendment request lines rendering
    await waitFor(() => {
      expect(screen.getByText("Initial reason")).toBeInTheDocument();
      expect(screen.getByText("Material One")).toBeInTheDocument();
      expect(screen.getByText(/Initial amendment line notes/i)).toBeInTheDocument();
    });

    // Add proposed line change
    const addLineForm = screen.getByText("Add Proposed Line Change").closest("form")!;
    const itemSelect = addLineForm.querySelector("select") as HTMLSelectElement;
    const qtyInput = addLineForm.querySelector("input[placeholder='Qty']") as HTMLInputElement;
    const notesInput = addLineForm.querySelector("input[placeholder='Line Notes']") as HTMLInputElement;

    fireEvent.change(itemSelect, { target: { value: "item-1" } });
    fireEvent.change(qtyInput, { target: { value: "3" } });
    fireEvent.change(notesInput, { target: { value: "New line notes" } });

    fireEvent.click(screen.getByRole("button", { name: "Add Line" }));

    await waitFor(() => {
      expect(screen.getByText(/New line notes/i)).toBeInTheDocument();
    });

    // Check Availability Preflight
    fireEvent.click(screen.getByRole("button", { name: "Check Amendment Availability Preflight" }));

    await waitFor(() => {
      expect(screen.getByText("Availability Preflight Report")).toBeInTheDocument();
      expect(screen.getByText("Lines Checked:")).toBeInTheDocument();
      expect(screen.getByText("Available Lines:")).toBeInTheDocument();
      expect(screen.getByText("Unavailable Lines:")).toBeInTheDocument();
    });
  });
});


