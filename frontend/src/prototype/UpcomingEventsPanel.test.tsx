import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import UpcomingEventsPanel from "./UpcomingEventsPanel";
import type { HahitantsoaEventDraft, ReservationDraft } from "../types";

function isoAt(offsetDays: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function makeReservationDraft(overrides: Partial<ReservationDraft>): ReservationDraft {
  return {
    id: "rd-1",
    public_reference: "TR-1001",
    status: "draft",
    customer_id: "cust-1",
    customer_display_name: "Alice",
    start_at: isoAt(1, 8),
    end_at: isoAt(1, 12),
    notes: "",
    lines: [],
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    created_at: isoAt(-1, 8),
    updated_at: isoAt(-1, 8),
    ...overrides,
  };
}

function makeEventDraft(overrides: Partial<HahitantsoaEventDraft>): HahitantsoaEventDraft {
  return {
    id: "ed-1",
    public_reference: "HD-001",
    status: "draft",
    customer_id: "cust-3",
    customer_display_name: "Charlie",
    event_name: "Mariage Randria",
    venue_name: "Salle A",
    location_details: "",
    service_notes: "",
    start_at: isoAt(3, 10),
    end_at: isoAt(3, 18),
    notes: "",
    lines: [],
    created_at: isoAt(-2, 8),
    updated_at: isoAt(-2, 8),
    ...overrides,
  };
}

describe("UpcomingEventsPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders upcoming Titan and Hahitantsoa items grouped by day", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([
      makeReservationDraft({ id: "rd-1", start_at: isoAt(1, 8), end_at: isoAt(1, 12) }),
    ]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([
      makeEventDraft({ id: "ed-1", start_at: isoAt(3, 10), end_at: isoAt(3, 18) }),
    ]);

    render(<UpcomingEventsPanel onNavigate={() => {}} />);

    expect(await screen.findByText("TR-1001")).toBeInTheDocument();
    expect(screen.getByText("Mariage Randria")).toBeInTheDocument();
    expect(screen.queryByText("Aujourd'hui")).not.toBeInTheDocument();
  });

  it("excludes cancelled reservations and events outside the 7-day window", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([
      makeReservationDraft({
        id: "rd-cancelled",
        status: "cancelled",
        start_at: isoAt(1, 8),
        end_at: isoAt(1, 12),
      }),
      makeReservationDraft({
        id: "rd-far",
        start_at: isoAt(10, 8),
        end_at: isoAt(10, 12),
      }),
    ]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([
      makeEventDraft({ id: "ed-far", start_at: isoAt(15, 10), end_at: isoAt(15, 18) }),
    ]);

    render(<UpcomingEventsPanel onNavigate={() => {}} />);

    await waitFor(() =>
      expect(screen.getByText(/Aucun événement dans les 7 prochains jours/i)).toBeInTheDocument(),
    );
  });

  it("navigates to the scoped reservation detail on row click", async () => {
    const onNavigate = vi.fn();
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([
      makeReservationDraft({ id: "rd-1", start_at: isoAt(1, 8), end_at: isoAt(1, 12) }),
    ]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([
      makeEventDraft({ id: "ed-1", start_at: isoAt(3, 10), end_at: isoAt(3, 18) }),
    ]);

    render(<UpcomingEventsPanel onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByText("TR-1001"));
    expect(onNavigate).toHaveBeenCalledWith("reservation-detail", "titan:rd-1");

    fireEvent.click(screen.getByText("Mariage Randria"));
    expect(onNavigate).toHaveBeenCalledWith("reservation-detail", "hahitantsoa:ed-1");
  });

  it("shows an API error with a retry action", async () => {
    vi.spyOn(api, "getReservationDrafts").mockRejectedValue(new Error("API indisponible"));
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);

    render(<UpcomingEventsPanel onNavigate={() => {}} />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("API indisponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réessayer/i })).toBeInTheDocument();
  });
});