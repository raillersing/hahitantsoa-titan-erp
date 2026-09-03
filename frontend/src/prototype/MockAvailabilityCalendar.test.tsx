import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MockAvailabilityCalendar } from "./MockAvailabilityCalendar";

function jsonResponse(payload: object): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
  });
}

describe("MockAvailabilityCalendar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a requested date selectable while it loads real availability", async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const selectedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const nextDay = new Date(Date.UTC(year, month, day + 1)).toISOString().slice(0, 10);
    const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(today);
    const onDateSelect = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("availability-summary")) {
        return Promise.resolve(jsonResponse({
          start_at: "2026-07-23T00:00:00.000Z",
          end_at: `${nextDay}T00:00:00.000Z`,
          available_item_count: 1,
          available_preview_count: 1,
          available_item_kinds: ["material"],
        }));
      }
      return Promise.resolve(jsonResponse([{
        inventory_item_id: "item-1",
        inventory_item_name: "Projecteur",
        inventory_item_kind: "material",
        start_at: `${selectedDate}T00:00:00.000Z`,
        end_at: `${nextDay}T00:00:00.000Z`,
        status: "available",
      }]));
    });

    const { rerender } = render(
      <MockAvailabilityCalendar onDateSelect={onDateSelect} showAvailabilityPreview />,
    );

    fireEvent.click(screen.getByRole("button", { name: `${day} ${monthName} ${year}` }));
    expect(onDateSelect).toHaveBeenCalledWith(selectedDate);

    rerender(
      <MockAvailabilityCalendar
        onDateSelect={onDateSelect}
        selectedDate={selectedDate}
        showAvailabilityPreview
      />,
    );

    expect(screen.getByText("Vérification de la disponibilité réelle…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1 ressource\(s\) Titan disponible/)).toBeInTheDocument());
    expect(screen.getByText("Projecteur")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`start_at=${encodeURIComponent(`${selectedDate}T00:00:00.000Z`)}`);
    expect(screen.getByText(/ne bloque pas la date souhaitée/)).toBeInTheDocument();
  });

  it("shows an explicit error without falling back to a simulated status", async () => {
    const today = new Date();
    const selectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ detail: "Indisponible" }), { status: 500 }));

    render(
      <MockAvailabilityCalendar selectedDate={selectedDate} showAvailabilityPreview />,
    );

    await waitFor(() => expect(screen.getByText(/Disponibilité non vérifiée/)).toBeInTheDocument());
    expect(screen.queryByText(/ressource\(s\) Titan disponible/)).not.toBeInTheDocument();
  });

  it("retries the same selected day after an availability failure", async () => {
    const today = new Date();
    const selectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const nextDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1)).toISOString().slice(0, 10);
    let requestCount = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      requestCount += 1;
      if (requestCount <= 2) {
        return Promise.resolve(new Response(JSON.stringify({ detail: "Indisponible" }), { status: 500 }));
      }
      if (String(input).includes("available-item-previews")) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({
        start_at: `${selectedDate}T00:00:00.000Z`,
        end_at: `${nextDay}T00:00:00.000Z`,
        available_item_count: 0,
        available_preview_count: 0,
        available_item_kinds: [],
      }));
    });

    render(<MockAvailabilityCalendar selectedDate={selectedDate} showAvailabilityPreview />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    await waitFor(() => expect(screen.getByText("Aucune ressource Titan disponible sur cette journée.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[2][0])).toContain(encodeURIComponent(`${selectedDate}T00:00:00.000Z`));
  });

  it("marks a confirmed Hahitantsoa venue reservation as unavailable", async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const selectedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const nextDay = new Date(Date.UTC(year, month, day + 1)).toISOString().slice(0, 10);
    const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(today);
    const onDateSelect = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [{
        public_reference: "H-001/2026",
        venue_name: "Salle des fêtes + jardin",
        start_at: `${selectedDate}T00:00:00.000Z`,
        end_at: `${nextDay}T00:00:00.000Z`,
        occupancy_status: "reserved",
      }],
      count: 1,
    }));

    render(
      <MockAvailabilityCalendar
        onDateSelect={onDateSelect}
        showHahitantsoaVenueOccupancy
        venueName="Salle des fêtes + jardin"
      />,
    );

    const reservedDate = await screen.findByRole("button", {
      name: `${day} ${monthName} ${year}, réservée pour cette salle`,
    });
    expect(reservedDate).toBeDisabled();
    fireEvent.click(reservedDate);
    expect(onDateSelect).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/hahitantsoa/venue-occupancy/?"),
      expect.objectContaining({ credentials: "include" }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain("venue_name=Salle+des+f%C3%AAtes+%2B+jardin");
    expect(screen.getByText(/Les dates réservées sont indisponibles/)).toBeInTheDocument();
  });

  it("keeps the venue calendar explicit and retryable when occupancy cannot be loaded", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Indisponible" }), { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ items: [], count: 0 }));

    render(
      <MockAvailabilityCalendar
        showHahitantsoaVenueOccupancy
        venueName="Salle des fêtes + jardin"
      />,
    );

    await waitFor(() => expect(screen.getByText(/Occupation de la salle non vérifiée/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(screen.getByText("Aucune réservation enregistrée pour cette salle ce mois-ci.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a Hahitantsoa option visible but selectable", async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const optionDay = Math.min(today.getDate() + 1, new Date(year, month + 1, 0).getDate());
    const optionDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(optionDay).padStart(2, "0")}`;
    const optionEndDate = new Date(Date.UTC(year, month, optionDay + 1)).toISOString().slice(0, 10);
    const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(today);
    const onDateSelect = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [{
        public_reference: "H-002/2026",
        venue_name: "Salle des fêtes + jardin",
        start_at: `${optionDate}T00:00:00.000Z`,
        end_at: `${optionEndDate}T00:00:00.000Z`,
        occupancy_status: "option",
      }],
      count: 1,
    }));

    render(
      <MockAvailabilityCalendar
        onDateSelect={onDateSelect}
        showHahitantsoaVenueOccupancy
        venueName="Salle des fêtes + jardin"
      />,
    );

    const optionDateButton = await screen.findByRole("button", {
      name: `${optionDay} ${monthName} ${year}, option en cours pour cette salle`,
    });
    expect(optionDateButton).toBeEnabled();
    fireEvent.click(optionDateButton);
    expect(onDateSelect).toHaveBeenCalledWith(optionDate);
  });
});
