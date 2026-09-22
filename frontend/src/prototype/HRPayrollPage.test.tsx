import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HRPayrollPage from "./HRPayrollPage";
import * as api from "../api";
import type { SessionUser } from "../api";

const mockUser: SessionUser = {
  id: "user-1",
  username: "rh_user",
  display_name: "Responsable RH",
  is_staff: false,
  roles: ["hr_manager"],
};

describe("HRPayrollPage (F16)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getEmployees").mockResolvedValue([
      {
        id: "emp-1",
        first_name: "Jean",
        last_name: "Rakoto",
        full_name: "Jean Rakoto",
        role: "Technicien",
        status: "active",
        assignment: "Dépôt Titan",
        salary: 1500000,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.spyOn(api, "getAdvanceRequests").mockResolvedValue([
      {
        id: "adv-1",
        employee: "emp-1",
        employee_name: "Jean Rakoto",
        amount: 200000,
        reason: "Avance fête",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
      },
    ]);
    vi.spyOn(api, "getLeaveRequests").mockResolvedValue([
      {
        id: "lv-1",
        employee: "emp-1",
        employee_name: "Jean Rakoto",
        start_date: "2026-10-01",
        end_date: "2026-10-05",
        reason: "Repos",
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
      },
    ]);
    vi.spyOn(api, "getCurrentPayrollRuleSet").mockRejectedValue(
      new api.ApiError("Aucune configuration active", 404)
    );
    vi.spyOn(api, "getPayrollRuleSets").mockResolvedValue([]);
  });

  it("safely converts DRF decimal strings into numbers and avoids string concatenation or NaN in totals", async () => {
    // DRF DecimalField returns string values
    vi.spyOn(api, "getPaySlips").mockResolvedValue([
      {
        id: "ps-1",
        employee: "emp-1",
        employee_name: "Jean Rakoto",
        period: "2026-08",
        gross_salary: "1500000.00" as any,
        deductions: "100000.00" as any,
        net_salary: "1400000.00" as any,
        status: "paid",
        created_at: "2026-08-31T00:00:00Z",
      },
      {
        id: "ps-2",
        employee: "emp-1",
        employee_name: "Jean Rakoto",
        period: "2026-07",
        gross_salary: "2000000.00" as any,
        deductions: "200000.00" as any,
        net_salary: "1800000.00" as any,
        status: "paid",
        created_at: "2026-07-31T00:00:00Z",
      },
      {
        id: "ps-3",
        employee: "emp-1",
        employee_name: "Jean Rakoto",
        period: "2026-09",
        gross_salary: "1000000.00" as any,
        deductions: "50000.00" as any,
        net_salary: "950000.00" as any,
        status: "draft",
        created_at: "2026-09-20T00:00:00Z",
      },
    ]);

    render(<HRPayrollPage onNavigate={vi.fn()} user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Paie & Congés")).toBeInTheDocument();
    });

    // Verify Net total payé does NOT say NaN or string concatenation
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/01400000/)).not.toBeInTheDocument();

    // Net total payé must only sum paid payslips (ps-1: 1 400 000 + ps-2: 1 800 000 = 3 200 000 Ar), excluding draft ps-3
    expect(screen.getByText(/3\s*200\s*000\s*Ar/)).toBeInTheDocument();

    // Verify paid count badge displays "2 payés / 3"
    expect(screen.getByText(/2 payés \/ 3/)).toBeInTheDocument();
  });

  it("allows switching to advances and leaves tabs without errors", async () => {
    vi.spyOn(api, "getPaySlips").mockResolvedValue([]);

    render(<HRPayrollPage onNavigate={vi.fn()} user={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText("Bulletins de paie (0)")).toBeInTheDocument();
    });

    // Switch to advances tab
    const advancesTab = screen.getByRole("button", { name: /Avances/i });
    fireEvent.click(advancesTab);

    expect(screen.getByText("Demandes d'avance (1)")).toBeInTheDocument();
    expect(screen.getByText("Avance fête")).toBeInTheDocument();
    expect(screen.getByText(/200\s*000\s*Ar/)).toBeInTheDocument();

    // Switch to leaves tab
    const leavesTab = screen.getByRole("button", { name: /Congés/i });
    fireEvent.click(leavesTab);

    expect(screen.getByText("Demandes de congé (1)")).toBeInTheDocument();
    expect(screen.getByText("Repos")).toBeInTheDocument();
  });
});
