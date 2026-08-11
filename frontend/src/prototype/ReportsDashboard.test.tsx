import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReportsDashboard from "./ReportsDashboard";
import * as api from "../api";
import type { ReportCategory } from "../types";

const reportResponse = (category: ReportCategory, label: string, value: number) => ({
  category,
  period: "month",
  kpis: [{ key: "total", label, value, format: "number" as const }],
});

describe("ReportsDashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getReportCategory").mockImplementation(async (category) => {
      if (category === "payments") return reportResponse(category, "Paiements reçus", 42);
      return reportResponse(category, "Total réservations", 124);
    });
  });

  it("renders the dashboard heading and period selector", () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(screen.getByRole("heading", { name: /Rapports & BI/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mois" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semaine" })).toBeInTheDocument();
  });

  it("renders KPI cards returned by the reporting API", async () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(await screen.findByText("Total réservations")).toBeInTheDocument();
    expect(await screen.findByText("124")).toBeInTheDocument();
  });

  it("switches category tabs and renders different KPIs", async () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    const paymentsTab = screen.getByRole("button", { name: /Paiements/i });
    fireEvent.click(paymentsTab);
    expect(await screen.findByText("Paiements reçus")).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
  });

  it("shows an API error instead of fabricated report data", async () => {
    vi.mocked(api.getReportCategory).mockRejectedValueOnce(new Error("Rapports indisponibles"));
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(await screen.findByText("Rapports indisponibles")).toBeInTheDocument();
    expect(screen.queryByText("Total réservations")).not.toBeInTheDocument();
  });

  it("exports the API-backed report as CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ReportsDashboard onNavigate={() => {}} />);
    await screen.findByText("Total réservations");
    fireEvent.click(screen.getByRole("button", { name: /Exporter CSV/i }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
