import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReportsDashboard from "./ReportsDashboard";

describe("ReportsDashboard", () => {
  it("renders the dashboard heading and period selector", () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(screen.getByRole("heading", { name: /Rapports & BI/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mois" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semaine" })).toBeInTheDocument();
  });

  it("renders KPI cards with mock data for the default category", async () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    // Wait for mock data to render (useEffect runs immediately)
    expect(await screen.findByText("Total réservations")).toBeInTheDocument();
    expect(await screen.findByText("124")).toBeInTheDocument();
    expect(await screen.findByText(/CA Réservations/i)).toBeInTheDocument();
    expect(await screen.findByText(/24\.5M Ar/)).toBeInTheDocument();
  });

  it("switches category tabs and renders different KPIs", async () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    const paymentsTab = screen.getByRole("button", { name: /Paiements/i });
    fireEvent.click(paymentsTab);
    expect(await screen.findByText("Paiements reçus")).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(await screen.findByText("Montant total")).toBeInTheDocument();
    expect(await screen.findByText(/18\.3M Ar/)).toBeInTheDocument();
  });

  it("shows trend badges with correct colors", async () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(await screen.findByText("+5.2%")).toBeInTheDocument();
    expect(await screen.findByText("+8.1%")).toBeInTheDocument();
    expect(await screen.findByText("-3.4%")).toBeInTheDocument();
  });
});
