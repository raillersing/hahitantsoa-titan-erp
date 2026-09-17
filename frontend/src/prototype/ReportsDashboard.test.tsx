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

  it("renders the tabular accounting & operational exports section", () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(screen.getByText("Exports Comptables & Fiscaux (Tabulaires)")).toBeInTheDocument();
    expect(screen.getByText("Facturier des Ventes")).toBeInTheDocument();
    expect(screen.getByText("Journal des Règlements")).toBeInTheDocument();
    expect(screen.getByText("Balance des Cautions")).toBeInTheDocument();
    expect(screen.getByText("Registre de la Casse")).toBeInTheDocument();
  });

  it("calls downloadTabularExport with selected filters when clicking export buttons", async () => {
    const downloadSpy = vi.spyOn(api, "downloadTabularExport").mockResolvedValue(undefined);
    render(<ReportsDashboard onNavigate={() => {}} />);

    // Configure filters
    const scopeSelect = screen.getByLabelText(/Volet d'activité/i);
    fireEvent.change(scopeSelect, { target: { value: "titan" } });

    const startDateInput = screen.getByLabelText(/Date de début/i);
    fireEvent.change(startDateInput, { target: { value: "2026-01-01" } });

    const endDateInput = screen.getByLabelText(/Date de fin/i);
    fireEvent.change(endDateInput, { target: { value: "2026-01-31" } });

    // Click on Exporter Facturier
    const exportSalesBtn = screen.getByRole("button", { name: /Exporter Facturier/i });
    fireEvent.click(exportSalesBtn);

    expect(downloadSpy).toHaveBeenCalledWith("sales", {
      scope: "titan",
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      method: undefined,
    });
    expect(await screen.findByText("Export téléchargé avec succès.")).toBeInTheDocument();
  });

  it("displays an error message when downloadTabularExport fails", async () => {
    vi.spyOn(api, "downloadTabularExport").mockRejectedValue(
      new Error("Vous n'avez pas l'autorisation d'exporter ce document."),
    );
    render(<ReportsDashboard onNavigate={() => {}} />);

    const exportCautionsBtn = screen.getByRole("button", { name: /Exporter Cautions/i });
    fireEvent.click(exportCautionsBtn);

    expect(
      await screen.findByText("Vous n'avez pas l'autorisation d'exporter ce document."),
    ).toBeInTheDocument();
  });
});
