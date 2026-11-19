import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, beforeEach, afterEach, it, expect, vi } from "vitest";
import AdminPage from "./AdminPage";
import type { User, ApplicationRole } from "../types";

const mockUsers: User[] = [
  {
    id: "user-tech-admin",
    username: "sysadmin",
    first_name: "Tech",
    last_name: "Admin",
    display_name: "Tech Admin",
    email: "sysadmin@example.com",
    role_names: ["ADMINISTRATEUR_TECHNIQUE"],
    role_slugs: ["identity_admin"],
    is_active: true,
    is_staff: true,
    last_login: "2026-06-01T10:00:00Z",
    date_joined: "2026-01-01T00:00:00Z",
  },
  {
    id: "user-gerant",
    username: "gerant",
    first_name: "Marc",
    last_name: "Gerant",
    display_name: "Marc Gérant",
    email: "gerant@example.com",
    role_names: ["GÉRANT_MÉTIER"],
    role_slugs: ["owner_manager"],
    is_active: true,
    is_staff: false,
    last_login: "2026-06-02T10:00:00Z",
    date_joined: "2026-01-01T00:00:00Z",
  },
  {
    id: "user-commercial",
    username: "commercial",
    first_name: "Sophie",
    last_name: "Vente",
    display_name: "Sophie Vente",
    email: "commercial@example.com",
    role_names: ["COMMERCIAL"],
    role_slugs: ["commercial"],
    is_active: true,
    is_staff: false,
    last_login: "2026-06-03T10:00:00Z",
    date_joined: "2026-01-01T00:00:00Z",
  },
  {
    id: "user-inactive",
    username: "ancien",
    first_name: "Ancien",
    last_name: "Employe",
    display_name: "Ancien Employé",
    email: "ancien@example.com",
    role_names: ["COMMERCIAL"],
    role_slugs: ["commercial"],
    is_active: false,
    is_staff: false,
    last_login: null,
    date_joined: "2025-01-01T00:00:00Z",
  },
];

const mockRoles: ApplicationRole[] = [
  {
    id: "role-tech",
    name: "ADMINISTRATEUR_TECHNIQUE",
    slug: "identity_admin",
    description: "Administration des comptes et sécurité",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    capabilities: {
      canManageIdentity: true,
      canSensitiveWrite: false,
      canManageFinance: false,
    },
  },
  {
    id: "role-gerant",
    name: "GÉRANT_MÉTIER",
    slug: "owner_manager",
    description: "Direction générale et arbitrage opérationnel",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    capabilities: {
      canSensitiveWrite: true,
      canManageFinance: true,
      canOperateCashbox: true,
      canSuperviseCashbox: true,
      canManageInventory: true,
      canOperateLogistics: true,
      canOverrideLogistics: true,
    },
  },
  {
    id: "role-compta",
    name: "COMPTABLE",
    slug: "accountant",
    description: "Comptabilité et gestion financière",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    capabilities: {
      canManageFinance: true,
      canSensitiveWrite: false,
      canOperateCashbox: false,
    },
  },
  {
    id: "role-commercial",
    name: "COMMERCIAL",
    slug: "commercial",
    description: "Devis et suivi client",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    capabilities: {
      canSensitiveWrite: true,
      canManageFinance: false,
    },
  },
];

const mockGetUsers = vi.fn();
const mockCreateUser = vi.fn();
const mockUpdateUser = vi.fn();
const mockResetUserPassword = vi.fn();
const mockGetRoles = vi.fn();
const mockCreateApplicationRole = vi.fn();
const mockGetNumberingSequences = vi.fn();
const mockConfigureNumberingSequence = vi.fn();
const mockGetIdentitySessions = vi.fn();
const mockRevokeDeviceSession = vi.fn();

vi.mock("../api", () => ({
  getUsers: (...args: any[]) => mockGetUsers(...args),
  createUser: (...args: any[]) => mockCreateUser(...args),
  updateUser: (...args: any[]) => mockUpdateUser(...args),
  resetUserPassword: (...args: any[]) => mockResetUserPassword(...args),
  getApplicationRoles: (...args: any[]) => mockGetRoles(...args),
  createApplicationRole: (...args: any[]) => mockCreateApplicationRole(...args),
  getNumberingSequences: (...args: any[]) => mockGetNumberingSequences(...args),
  configureNumberingSequence: (...args: any[]) => mockConfigureNumberingSequence(...args),
  getIdentitySessions: (...args: any[]) => mockGetIdentitySessions(...args),
  revokeDeviceSession: (...args: any[]) => mockRevokeDeviceSession(...args),
}));

describe("AdminPage - Lot B3 (Droits en clair, cumuls, distinction Gérant vs Admin technique, pas de réaffectation auto)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue(mockUsers);
    mockGetRoles.mockResolvedValue(mockRoles);
    mockGetNumberingSequences.mockResolvedValue([]);
    mockGetIdentitySessions.mockResolvedValue({
      total_active_sessions: 0,
      users_with_concurrent_sessions: [],
      results: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche un badge Admin Technique distinct pour les utilisateurs is_staff dans la table", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Tech Admin");

    // Tech Admin has is_staff = true -> must show "Admin Technique" badge
    const techRow = screen.getByText("Tech Admin").closest("tr");
    expect(techRow).not.toBeNull();
    expect(within(techRow!).getByText("Admin Technique")).toBeInTheDocument();

    // Marc Gérant has is_staff = false -> must NOT have "Admin Technique" badge
    const gerantRow = screen.getByText("Marc Gérant").closest("tr");
    expect(gerantRow).not.toBeNull();
    expect(within(gerantRow!).queryByText("Admin Technique")).toBeNull();
  });

  it("présente les droits effectifs en français simple et explique la règle de cumul des profils", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Tech Admin");

    const newBtn = screen.getByRole("button", { name: /Nouveau Collaborateur/i });
    fireEvent.click(newBtn);

    const dialog = screen.getByRole("dialog");
    const summary = within(dialog).getByLabelText("Résumé des droits");

    // Check plain French title and cumulative rules explanation
    expect(summary).toHaveTextContent("Droits d'accès effectifs (Français simple)");
    expect(summary).toHaveTextContent("Origine des droits & Règle de cumul :");
    expect(summary).toHaveTextContent("Dossiers partagés de l'entreprise :");
    expect(summary).toHaveTextContent("Aucune réaffectation automatique :");

    // Check by default with no roles selected
    expect(summary).toHaveTextContent("Sans profil métier attribué, le compte ne dispose d'aucune habilitation opérationnelle spécifique");

    // Check selecting Commercial role
    const commercialCheckbox = within(dialog).getByRole("checkbox", { name: /Commercial/i });
    fireEvent.click(commercialCheckbox);

    expect(summary).toHaveTextContent("Les droits de ce collaborateur proviennent du cumul de ses profils actifs : COMMERCIAL");
    expect(summary).toHaveTextContent("Autorisé : Confirmer les réservations et enregistrer les paiements");
    expect(summary).toHaveTextContent("Non autorisé : Gérer les achats et les dépenses");

    // Cumul: Now also select Accountant role
    const comptaCheckbox = within(dialog).getByRole("checkbox", { name: /Comptable/i });
    fireEvent.click(comptaCheckbox);

    expect(summary).toHaveTextContent("COMMERCIAL, COMPTABLE");
    expect(summary).toHaveTextContent("Autorisé : Confirmer les réservations et enregistrer les paiements");
    expect(summary).toHaveTextContent("Autorisé : Gérer les achats et les dépenses");
  });

  it("distingue clairement Gérant Métier (direction opérationnelle) et Administration Technique (sécurité)", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Tech Admin");

    const newBtn = screen.getByRole("button", { name: /Nouveau Collaborateur/i });
    fireEvent.click(newBtn);

    const dialog = screen.getByRole("dialog");
    const summary = within(dialog).getByLabelText("Résumé des droits");

    // Initially neither is active
    expect(within(summary).getByText("Gérant Métier (owner_manager)")).toBeInTheDocument();
    expect(within(summary).getByText("Administration Technique (is_staff)")).toBeInTheDocument();

    // Select Gérant Métier
    const gerantCheckbox = within(dialog).getByRole("checkbox", { name: /Gérant/i });
    fireEvent.click(gerantCheckbox);

    // Gérant Métier card should show active badge and operational scope
    expect(summary).toHaveTextContent("Rôle opérationnel & direction générale : arbitrage commercial, validation des devis");

    // Select Tech Admin role
    const techCheckbox = within(dialog).getByRole("checkbox", { name: /Accès & Sécurité/i });
    fireEvent.click(techCheckbox);

    // Admin technique should show security scope and no commercial confirmation restriction
    expect(summary).toHaveTextContent("Administration des accès & sécurité : gestion des comptes et attribution des rôles. Sans pouvoir d'engagement ou de confirmation commerciale sans habilitation dédiée.");
  });

  it("n'effectue aucune réaffectation automatique lors de la modification d'un collaborateur", async () => {
    mockUpdateUser.mockResolvedValue({
      ...mockUsers[2],
      first_name: "Sophie-Claire",
    });

    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Sophie Vente");

    // Click "Profil & droits" for Sophie Vente
    const commercialRow = screen.getByText("Sophie Vente").closest("tr");
    const editBtn = within(commercialRow!).getByRole("button", { name: /Profil & droits/i });
    fireEvent.click(editBtn);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Modifier le profil et les droits/i)).toBeInTheDocument();

    // Change first name
    const firstNameInput = within(dialog).getByLabelText(/Prénom/i);
    fireEvent.change(firstNameInput, { target: { value: "Sophie-Claire" } });

    // Save
    const saveBtn = within(dialog).getByRole("button", { name: /Enregistrer les modifications/i });
    fireEvent.click(saveBtn);

    // Verify updateUser was called strictly with Sophie's ID
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith("user-commercial", expect.objectContaining({
      first_name: "Sophie-Claire",
    }));

    // Other users are not touched or reallocated
    expect(mockUpdateUser).not.toHaveBeenCalledWith("user-tech-admin", expect.anything());
    expect(mockUpdateUser).not.toHaveBeenCalledWith("user-gerant", expect.anything());
  });

  it("affiche un avertissement explicite pour les comptes suspendus sans autoriser d'accès", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Ancien Employé");

    const inactiveRow = screen.getByText("Ancien Employé").closest("tr");
    const editBtn = within(inactiveRow!).getByRole("button", { name: /Profil & droits/i });
    fireEvent.click(editBtn);

    const dialog = screen.getByRole("dialog");
    const summary = within(dialog).getByLabelText("Résumé des droits");

    expect(summary).toHaveTextContent("Compte suspendu : aucun accès autorisé");
    expect(summary).toHaveTextContent("Les profils affichés sont conservés. Réactivez le compte pour consulter ses droits effectifs et lui restituer ses accès.");
  });
});
