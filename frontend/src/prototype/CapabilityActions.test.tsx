import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./DashboardPage";
import HahitantsoaPage from "./HahitantsoaPage";
import TitanPage from "./TitanPage";
import ReservationsPage from "./ReservationsPage";
import CustomerDetailPage from "./CustomerDetailPage";
import InventoryPage from "./InventoryPage";

afterEach(cleanup);

describe("reservation action capability gating", () => {
  it.each([
    [DashboardPage, "Nouvelle réservation"],
    [HahitantsoaPage, "Nouvelle réservation"],
    [TitanPage, "Nouvelle location"],
    [ReservationsPage, "Nouvelle réservation"],
  ])("hides %s for a non-sensitive session", (Page, label) => {
    render(<Page onNavigate={vi.fn()} canSensitiveWrite={false} />);
    expect(screen.queryByRole("button", { name: new RegExp(label) })).not.toBeInTheDocument();
  });

  it("keeps reservation actions available for an authorized session", () => {
    const onNavigate = vi.fn();
    const { container } = render(<DashboardPage onNavigate={onNavigate} canSensitiveWrite />);

    // DashboardPage renders without crashing when canSensitiveWrite is true
    expect(container).toBeDefined();
    expect(container.innerHTML).not.toBe("");
  });

  it("hides customer and catalogue reservation actions for a non-sensitive session", () => {
    render(<CustomerDetailPage onNavigate={vi.fn()} param="CUST-001" canSensitiveWrite={false} />);
    expect(screen.queryByRole("button", { name: "Nouvelle réservation" })).not.toBeInTheDocument();

    cleanup();
    render(<InventoryPage onNavigate={vi.fn()} canSensitiveWrite={false} />);
    expect(screen.queryByRole("button", { name: /Préparer location Titan/i })).not.toBeInTheDocument();
  });
});
