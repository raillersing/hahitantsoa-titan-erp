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
});
