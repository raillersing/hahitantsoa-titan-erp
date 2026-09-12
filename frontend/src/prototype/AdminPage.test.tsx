import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import AdminPage from "./AdminPage";
import type { User, ApplicationRole, NumberingSequence } from "../types";

const mockUsers: User[] = [
  {
    id: "user-1",
    username: "admin",
    first_name: "Admin",
    last_name: "User",
    display_name: "Admin User",
    email: "admin@example.com",
    role_names: ["ADMINISTRATEUR_METIER"],
    is_active: true,
    is_staff: true,
    last_login: "2026-06-01T10:00:00Z",
    date_joined: "2026-01-01T00:00:00Z",
  },
];

const mockRoles: ApplicationRole[] = [
  {
    id: "role-1",
    name: "ADMINISTRATEUR_METIER",
    slug: "administrateur-metier",
    description: "Administrateur Métier ERP",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockSequences: NumberingSequence[] = [
  {
    id: "seq-1",
    brand: "titan",
    year: 2026,
    prefix: "",
    next_number: 100,
    padding: 3,
    suffix_template: "/{year}",
    preview_next: "100/2026",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "seq-2",
    brand: "hahitantsoa",
    year: 2026,
    prefix: "H-",
    next_number: 50,
    padding: 3,
    suffix_template: "/{year}",
    preview_next: "H-050/2026",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockGetUsers = vi.fn();
const mockGetRoles = vi.fn();
const mockCreateApplicationRole = vi.fn();
const mockGetNumberingSequences = vi.fn();
const mockConfigureNumberingSequence = vi.fn();

vi.mock("../api", () => ({
  getUsers: (...args: any[]) => mockGetUsers(...args),
  getApplicationRoles: (...args: any[]) => mockGetRoles(...args),
  createApplicationRole: (...args: any[]) => mockCreateApplicationRole(...args),
  getNumberingSequences: (...args: any[]) => mockGetNumberingSequences(...args),
  configureNumberingSequence: (...args: any[]) => mockConfigureNumberingSequence(...args),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue(mockUsers);
    mockGetRoles.mockResolvedValue(mockRoles);
    mockGetNumberingSequences.mockResolvedValue(mockSequences);
    mockConfigureNumberingSequence.mockResolvedValue({
      id: "seq-1",
      brand: "titan",
      year: 2026,
      prefix: "",
      next_number: 200,
      padding: 3,
      suffix_template: "/{year}",
      preview_next: "200/2026",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche les utilisateurs par défaut et le lien vers Django admin", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    expect(await screen.findByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();

    const userAddLink = screen.getByRole("link", { name: /Nouvel Utilisateur \(Admin Django\)/i });
    expect(userAddLink).toHaveAttribute("href", "/admin/auth/user/add/");
    expect(userAddLink).toHaveAttribute("target", "_blank");
  });

  it("permet de consulter les détails d'un rôle existant", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const rolesTab = screen.getByRole("button", { name: /Rôles & Permissions/i });
    fireEvent.click(rolesTab);

    const manageBtn = await screen.findByRole("button", { name: /Détails & Permissions/i });
    fireEvent.click(manageBtn);

    expect(await screen.findByText("Identifiant technique")).toBeInTheDocument();
    expect(screen.getByText("administrateur-metier")).toBeInTheDocument();
    expect(screen.getByText("Rôle système managé")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /^Fermer$/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Identifiant technique")).not.toBeInTheDocument();
    });
  });

  it("permet de créer un nouveau rôle applicatif via l'API", async () => {
    mockCreateApplicationRole.mockResolvedValue({
      id: "role-2",
      name: "Responsable Planning",
      slug: "responsable-planning",
      description: "Gestion des plannings",
      is_system_managed: false,
      is_active: true,
    });

    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const rolesTab = screen.getByRole("button", { name: /Rôles & Permissions/i });
    fireEvent.click(rolesTab);

    const newRoleBtn = await screen.findByRole("button", { name: /Nouveau Rôle/i });
    fireEvent.click(newRoleBtn);

    expect(await screen.findByRole("heading", { name: /Nouveau rôle applicatif/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Ex: Responsable Planning/i);
    fireEvent.change(nameInput, { target: { value: "Responsable Planning" } });

    const descInput = screen.getByPlaceholderText(/Rôle et responsabilités métier.../i);
    fireEvent.change(descInput, { target: { value: "Gestion des plannings" } });

    const submitBtn = screen.getByRole("button", { name: /Créer le rôle/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateApplicationRole).toHaveBeenCalledWith({
        name: "Responsable Planning",
        slug: "responsable-planning",
        description: "Gestion des plannings",
      });
    });

    expect(await screen.findByText("Nouveau rôle créé avec succès.")).toBeInTheDocument();
  });

  it("affiche les paramètres système verrouillés sous l'onglet Paramètres globaux", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const settingsTab = screen.getByRole("button", { name: /Paramètres globaux/i });
    fireEvent.click(settingsTab);

    expect(await screen.findByText("Hahitantsoa / Titan ERP")).toBeInTheDocument();
    expect(screen.getByText("Ariary (Ar / MGA)")).toBeInTheDocument();
    expect(screen.getByText("20 %")).toBeInTheDocument();
    expect(screen.getByText(/Paramètres d'exploitation verrouillés/i)).toBeInTheDocument();
  });

  it("bascule sur l'onglet Numérotation & Séquences et configure une séquence de départ", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const numberingTab = screen.getByRole("button", { name: /Numérotation & Séquences/i });
    fireEvent.click(numberingTab);

    expect(await screen.findByText("Configuration des Séquences Annuelles")).toBeInTheDocument();
    expect(screen.getByText("100/2026")).toBeInTheDocument();
    expect(screen.getByText("H-050/2026")).toBeInTheDocument();

    const configButtons = screen.getAllByRole("button", { name: /Configurer la séquence/i });
    expect(configButtons.length).toBe(2);

    // Click config for Titan (first card)
    fireEvent.click(configButtons[0]);

    // Check input next_number appears
    const inputNumber = screen.getByDisplayValue("100");
    fireEvent.change(inputNumber, { target: { value: "200" } });

    // Save
    const saveBtn = screen.getByRole("button", { name: /^Enregistrer$/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockConfigureNumberingSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: "titan",
          year: 2026,
          next_number: 200,
        })
      );
    });
  });
});
