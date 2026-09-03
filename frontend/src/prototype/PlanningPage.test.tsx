import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../api";
import PlanningPage from "./PlanningPage";

function currentMonday(): Date {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

describe("PlanningPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows an ongoing Titan reservation during the visible week", async () => {
    const monday = currentMonday();
    const startAt = new Date(monday);
    startAt.setDate(startAt.getDate() - 1);
    const endAt = new Date(monday);
    endAt.setDate(endAt.getDate() + 2);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([{
      id: "titan-ongoing", public_reference: "T-010/2026", status: "confirmed",
      customer_display_name: "Client Titan", start_at: startAt.toISOString(), end_at: endAt.toISOString(), lines: [],
    }] as any);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getVisitAppointments").mockResolvedValue([]);

    render(<PlanningPage />);

    expect(await screen.findByText("T-010/2026")).toBeInTheDocument();
    expect(screen.getByText(/En cours/)).toBeInTheDocument();
  });

  it("opens a Hahitantsoa event through its domain-specific dossier route", async () => {
    const monday = currentMonday();
    const endAt = new Date(monday);
    endAt.setHours(endAt.getHours() + 4);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([{
      id: "hah-event", event_name: "Mariage", venue_name: "Salle des fêtes + jardin",
      customer_display_name: "Client Hahitantsoa", start_at: monday.toISOString(), end_at: endAt.toISOString(),
      status: "confirmed", lines: [],
    }] as any);
    vi.spyOn(api, "getVisitAppointments").mockResolvedValue([]);
    const onNavigate = vi.fn();

    render(<PlanningPage onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByRole("button", { name: /Mariage/i }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("reservation-detail", "hahitantsoa:hah-event"));
  });
});
