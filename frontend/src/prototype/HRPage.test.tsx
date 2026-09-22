import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HRPage from "./HRPage";
import * as api from "../api";
import type { SessionUser } from "../api";

const accountantUser: SessionUser = {
  id: "user-acc",
  username: "comptable_1",
  display_name: "Comptable",
  is_staff: false,
  roles: ["accountant"],
};

const hrManagerUser: SessionUser = {
  id: "user-hr",
  username: "rh_1",
  display_name: "DRH",
  is_staff: false,
  roles: ["hr_manager"],
};

const staffUser: SessionUser = {
  id: "user-admin",
  username: "admin_1",
  display_name: "Admin Staff",
  is_staff: true,
  roles: [],
};

const mockEmployees = [
  {
    id: "emp-1",
    first_name: "Jean",
    last_name: "Rakoto",
    full_name: "Jean Rakoto",
    role: "Technicien Son",
    status: "active" as const,
    assignment: "Dépôt Titan",
    salary: 1200000,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "emp-2",
    first_name: "Soa",
    last_name: "Rasoa",
    full_name: "Soa Rasoa",
    role: "Responsable Logistique",
    status: "active" as const,
    assignment: "Antananarivo",
    salary: "1800000.00" as any, // DRF decimal string test
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

describe("HRPage (F31 & F16)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getEmployees").mockResolvedValue(mockEmployees);
  });

  it("hides 'Nouvel employé' button and delete actions for read-only accountant user (F31)", async () => {
    render(<HRPage onNavigate={vi.fn()} user={accountantUser} />);

    await waitFor(() => {
      expect(screen.getByText("Liste des employés (2)")).toBeInTheDocument();
    });

    // Verify employee rows are rendered
    expect(screen.getByText("Jean Rakoto")).toBeInTheDocument();
    expect(screen.getByText("Soa Rasoa")).toBeInTheDocument();

    // Verify write actions are NOT rendered for accountant
    expect(screen.queryByRole("button", { name: /Nouvel employé/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Supprimer/i)).not.toBeInTheDocument();
  });

  it("shows 'Nouvel employé' button and delete actions for hr_manager user (F31)", async () => {
    render(<HRPage onNavigate={vi.fn()} user={hrManagerUser} />);

    await waitFor(() => {
      expect(screen.getByText("Liste des employés (2)")).toBeInTheDocument();
    });

    // Write button and Actions column must be present
    expect(screen.getByRole("button", { name: /Nouvel employé/i })).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();

    // Delete buttons must be present
    const deleteButtons = screen.getAllByLabelText(/Supprimer/i);
    expect(deleteButtons).toHaveLength(2);
  });

  it("allows staff user to create a new employee", async () => {
    const createSpy = vi.spyOn(api, "createEmployee").mockResolvedValue({
      id: "emp-3",
      first_name: "Paul",
      last_name: "Rabe",
      full_name: "Paul Rabe",
      role: "Chauffeur",
      status: "active",
      assignment: "Livraison",
      salary: 900000,
      created_at: "2026-09-22T00:00:00Z",
      updated_at: "2026-09-22T00:00:00Z",
    });

    render(<HRPage onNavigate={vi.fn()} user={staffUser} />);

    await waitFor(() => {
      expect(screen.getByText("Liste des employés (2)")).toBeInTheDocument();
    });

    const newBtn = screen.getByRole("button", { name: /Nouvel employé/i });
    fireEvent.click(newBtn);

    expect(screen.getByText("Ajouter un employé")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Prénom *"), { target: { value: "Paul" } });
    fireEvent.change(screen.getByLabelText("Nom *"), { target: { value: "Rabe" } });
    fireEvent.change(screen.getByLabelText("Fonction *"), { target: { value: "Chauffeur" } });
    fireEvent.change(screen.getByLabelText("Salaire (Ar)"), { target: { value: "900000" } });

    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: "Paul",
          last_name: "Rabe",
          role: "Chauffeur",
          salary: 900000,
        })
      );
    });
  });

  it("calls deleteEmployee when confirming deletion as hr_manager", async () => {
    const deleteSpy = vi.spyOn(api, "deleteEmployee").mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<HRPage onNavigate={vi.fn()} user={hrManagerUser} />);

    await waitFor(() => {
      expect(screen.getByText("Liste des employés (2)")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText("Supprimer Jean Rakoto");
    fireEvent.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith("Supprimer cet employé ?");
    expect(deleteSpy).toHaveBeenCalledWith("emp-1");
  });

  it("correctly formats salary amounts even when returned as DRF decimal string", async () => {
    render(<HRPage onNavigate={vi.fn()} user={accountantUser} />);

    await waitFor(() => {
      expect(screen.getByText("Liste des employés (2)")).toBeInTheDocument();
    });

    // emp-1: 1200000
    expect(screen.getByText(/1\s*200\s*000\s*Ar/)).toBeInTheDocument();
    // emp-2: "1800000.00"
    expect(screen.getByText(/1\s*800\s*000\s*Ar/)).toBeInTheDocument();
  });
});
