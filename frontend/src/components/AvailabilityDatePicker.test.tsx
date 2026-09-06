import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AvailabilityDatePicker, parseAndNormalizeDate } from "./AvailabilityDatePicker";

function jsonResponse(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parseAndNormalizeDate", () => {
  it("normalizes ISO YYYY-MM-DD format correctly", () => {
    expect(parseAndNormalizeDate("2026-09-15")).toBe("2026-09-15");
    expect(parseAndNormalizeDate("2026-9-5")).toBe("2026-09-05");
  });

  it("normalizes French DD/MM/YYYY and DD-MM-YYYY format correctly", () => {
    expect(parseAndNormalizeDate("15/09/2026")).toBe("2026-09-15");
    expect(parseAndNormalizeDate("05-09-2026")).toBe("2026-09-05");
    expect(parseAndNormalizeDate("5.9.2026")).toBe("2026-09-05");
  });

  it("returns null for invalid strings or out-of-range dates", () => {
    expect(parseAndNormalizeDate("")).toBeNull();
    expect(parseAndNormalizeDate("invalid-date")).toBeNull();
    expect(parseAndNormalizeDate("32/01/2026")).toBeNull();
    expect(parseAndNormalizeDate("2026-02-30")).toBeNull();
  });
});

describe("AvailabilityDatePicker Component", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with manual input and calls onChange when a valid date is typed", async () => {
    const onChange = vi.fn();
    const futureYear = new Date().getFullYear() + 1;
    const testDate = `${futureYear}-11-20`;

    render(
      <AvailabilityDatePicker
        label="Date de début"
        placeholder="AAAA-MM-JJ"
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Date de début" });
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: testDate } });
    expect(onChange).toHaveBeenCalledWith(testDate);
  });

  it("handles French format manual typing and normalizes on change", async () => {
    const onChange = vi.fn();
    const futureYear = new Date().getFullYear() + 1;

    render(
      <AvailabilityDatePicker
        label="Date souhaitée"
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Date souhaitée" });
    fireEvent.change(input, { target: { value: `25/12/${futureYear}` } });

    expect(onChange).toHaveBeenCalledWith(`${futureYear}-12-25`);
  });

  it("opens popover calendar on toggle button click and closes on Escape", async () => {
    render(
      <AvailabilityDatePicker
        label="Date de visite"
        allowPast
      />,
    );

    const toggleButton = screen.getByRole("button", { name: "Ouvrir le calendrier interactif" });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Calendrier de sélection de date" })).toBeInTheDocument();

    // Escape closes popover
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selects a date via calendar grid click in popover mode and closes popover", async () => {
    const onChange = vi.fn();
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const expectedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(today);

    render(
      <AvailabilityDatePicker
        label="Date événement"
        onChange={onChange}
        allowPast
      />,
    );

    const toggleButton = screen.getByRole("button", { name: "Ouvrir le calendrier interactif" });
    fireEvent.click(toggleButton);

    const dayButton = screen.getByRole("button", { name: `${day} ${monthName} ${year}` });
    fireEvent.click(dayButton);

    expect(onChange).toHaveBeenCalledWith(expectedDate);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies shortcut pills like 'Aujourd hui' and 'Demain'", () => {
    const onChange = vi.fn();
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    render(
      <AvailabilityDatePicker
        label="Date"
        onChange={onChange}
        allowPast
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le calendrier interactif" }));
    const todayPill = screen.getByRole("button", { name: "Aujourd'hui" });
    fireEvent.click(todayPill);

    expect(onChange).toHaveBeenCalledWith(todayISO);
  });

  it("renders inline mode directly with availability preview and queries backend", async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const selectedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const nextDay = new Date(Date.UTC(year, month, day + 1)).toISOString().slice(0, 10);

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("availability-summary")) {
        return Promise.resolve(jsonResponse({
          start_at: `${selectedDate}T00:00:00.000Z`,
          end_at: `${nextDay}T00:00:00.000Z`,
          available_item_count: 5,
          available_preview_count: 1,
          available_item_kinds: ["material"],
        }));
      }
      return Promise.resolve(jsonResponse([{
        inventory_item_id: "item-42",
        inventory_item_name: "Chaises Napoléon",
        inventory_item_kind: "material",
        start_at: `${selectedDate}T00:00:00.000Z`,
        end_at: `${nextDay}T00:00:00.000Z`,
        status: "available",
      }]));
    });

    render(
      <AvailabilityDatePicker
        mode="inline"
        selectedDate={selectedDate}
        showAvailabilityPreview
        label="Calendrier Titan"
      />,
    );

    expect(screen.getByText("Calendrier Titan")).toBeInTheDocument();
    expect(screen.getByText(`Sélection: ${selectedDate}`)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/5 ressource\(s\) Titan disponible\(s\)/)).toBeInTheDocument();
    });
    expect(screen.getByText("Chaises Napoléon")).toBeInTheDocument();
  });

  it("displays Hahitantsoa venue occupancy with reserved date disabling", async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const nextDay = new Date(Date.UTC(year, month, day + 1)).toISOString().slice(0, 10);
    const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(today);
    const onChange = vi.fn();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [{
        public_reference: "H-2026-009",
        venue_name: "Grande Salle",
        start_at: `${dateStr}T00:00:00.000Z`,
        end_at: `${nextDay}T00:00:00.000Z`,
        occupancy_status: "reserved",
      }],
      count: 1,
    }));

    render(
      <AvailabilityDatePicker
        mode="inline"
        onChange={onChange}
        showHahitantsoaVenueOccupancy
        venueName="Grande Salle"
      />,
    );

    const reservedBtn = await screen.findByRole("button", {
      name: `${day} ${monthName} ${year}, réservée pour cette salle`,
    });
    expect(reservedBtn).toBeDisabled();
    fireEvent.click(reservedBtn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders in-situ live preview card directly beneath the input in popover mode", async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const selectedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const nextDay = new Date(Date.UTC(year, month, day + 1)).toISOString().slice(0, 10);

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("venue-occupancy")) {
        return Promise.resolve(jsonResponse({
          items: [{
            public_reference: "H-2026-009",
            venue_name: "Grande Salle",
            start_at: `${selectedDate}T00:00:00.000Z`,
            end_at: `${nextDay}T00:00:00.000Z`,
            occupancy_status: "free",
          }],
          count: 1,
        }));
      }
      if (url.includes("availability-summary")) {
        return Promise.resolve(jsonResponse({
          start_at: `${selectedDate}T00:00:00.000Z`,
          end_at: `${nextDay}T00:00:00.000Z`,
          available_item_count: 8,
          available_preview_count: 1,
          available_item_kinds: ["material"],
        }));
      }
      return Promise.resolve(jsonResponse([{
        inventory_item_id: "item-101",
        inventory_item_name: "Tente 50m2",
        inventory_item_kind: "material",
        start_at: `${selectedDate}T00:00:00.000Z`,
        end_at: `${nextDay}T00:00:00.000Z`,
        status: "available",
      }]));
    });

    render(
      <AvailabilityDatePicker
        label="Date souhaitée de l'événement"
        value={selectedDate}
        showAvailabilityPreview
        showHahitantsoaVenueOccupancy
        allowPast
      />,
    );

    // In-situ card should be visible directly below the input
    expect(screen.getByText("Lieu / Salle Hahitantsoa")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/8 ressource\(s\) Titan disponible\(s\)/)).toBeInTheDocument();
    });
    expect(screen.getByText("Tente 50m2")).toBeInTheDocument();
  });
});
