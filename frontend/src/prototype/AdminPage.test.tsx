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
    sequence_type: "proforma",
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
    id: "seq-1-inv",
    brand: "titan",
    sequence_type: "invoice",
    year: 2026,
    prefix: "",
    next_number: 10,
    padding: 3,
    suffix_template: "/{year}-FA",
    preview_next: "010/2026-FA",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "seq-1-bl",
    brand: "titan",
    sequence_type: "delivery_note",
    year: 2026,
    prefix: "",
    next_number: 5,
    padding: 3,
    suffix_template: "/{year}-BL",
    preview_next: "005/2026-BL",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "seq-2",
    brand: "hahitantsoa",
    sequence_type: "proforma",
    year: 2026,
    prefix: "H-",
    next_number: 50,
    padding: 3,
    suffix_template: "/{year}",
    preview_next: "H-050/2026",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "seq-2-inv",
    brand: "hahitantsoa",
    sequence_type: "invoice",
    year: 2026,
    prefix: "H-",
    next_number: 15,
    padding: 3,
    suffix_template: "/{year}-FA",
    preview_next: "H-015/2026-FA",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "seq-2-bl",
    brand: "hahitantsoa",
    sequence_type: "delivery_note",
    year: 2026,
    prefix: "H-",
    next_number: 8,
    padding: 3,
    suffix_template: "/{year}-BL",
    preview_next: "H-008/2026-BL",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
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

vi.mock("../api", () => ({
  getUsers: (...args: any[]) => mockGetUsers(...args),
  createUser: (...args: any[]) => mockCreateUser(...args),
  updateUser: (...args: any[]) => mockUpdateUser(...args),
  resetUserPassword: (...args: any[]) => mockResetUserPassword(...args),
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
    mockCreateUser.mockResolvedValue({
      id: "user-2",
      username: "jean.dupont",
      first_name: "Jean",
      last_name: "Dupont",
      display_name: "Jean Dupont",
      email: "jean.dupont@example.com",
      role_names: ["ADMINISTRATEUR_METIER"],
      role_slugs: ["administrateur-metier"],
      is_active: true,
      is_staff: false,
      last_login: null,
      date_joined: "2026-06-01T10:00:00Z",
    });
    mockUpdateUser.mockResolvedValue({
      ...mockUsers[0],
      email: "updated@example.com",
    });
    mockResetUserPassword.mockResolvedValue({
      detail: "Mot de passe réinitialisé avec succès.",
    });
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

  it("affiche les collaborateurs avec rôles et aucun lien vers Django admin", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    expect(await screen.findByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("@admin")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();

    // Vérifier l'absence totale de redirection vers /admin/
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();

    // Vérifier la présence du bouton de création in-app
    const newCollaboratorBtn = screen.getByRole("button", { name: /Nouveau Collaborateur/i });
    expect(newCollaboratorBtn).toBeInTheDocument();
  });

  it("permet d'ouvrir le modal et de créer un collaborateur in-app", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const newBtn = screen.getByRole("button", { name: /Nouveau Collaborateur/i });
    fireEvent.click(newBtn);

    // Vérifier l'ouverture du modal
    expect(screen.getByRole("heading", { name: /Nouveau Collaborateur/i })).toBeInTheDocument();

    // Remplir le formulaire
    const firstNameInput = screen.getByPlaceholderText("Ex: Jean");
    const lastNameInput = screen.getByPlaceholderText("Ex: Dupont");
    const emailInput = screen.getByPlaceholderText("jean.dupont@entreprise.com");

    fireEvent.change(firstNameInput, { target: { value: "Jean" } });
    fireEvent.change(lastNameInput, { target: { value: "Dupont" } });
    fireEvent.change(emailInput, { target: { value: "jean.dupont@example.com" } });

    // L'identifiant est suggéré automatiquement
    const usernameInput = screen.getByPlaceholderText("ex: jean.dupont") as HTMLInputElement;
    expect(usernameInput.value).toBe("jean.dupont");

    // Soumettre le formulaire
    const submitBtn = screen.getByRole("button", { name: /Créer le collaborateur/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "jean.dupont",
          first_name: "Jean",
          last_name: "Dupont",
          email: "jean.dupont@example.com",
        })
      );
    });
  });

  it("permet de modifier un profil collaborateur", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const editBtn = screen.getByRole("button", { name: /Modifier/i });
    fireEvent.click(editBtn);

    expect(screen.getByRole("heading", { name: /Modifier le profil collaborateur/i })).toBeInTheDocument();

    const emailInput = screen.getByDisplayValue("admin@example.com");
    fireEvent.change(emailInput, { target: { value: "nouveau.mail@example.com" } });

    const saveBtn = screen.getByRole("button", { name: /Enregistrer les modifications/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({
          email: "nouveau.mail@example.com",
        })
      );
    });
  });

  it("permet de réinitialiser le mot de passe d'un collaborateur", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const accessBtn = screen.getByRole("button", { name: /Accès/i });
    fireEvent.click(accessBtn);

    expect(screen.getByRole("heading", { name: /Réinitialiser le mot de passe/i })).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Mettre à jour le mot de passe/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockResetUserPassword).toHaveBeenCalledWith("user-1", expect.any(String));
    });
  });

  it("permet de suspendre le compte d'un collaborateur", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const suspendBtn = screen.getByRole("button", { name: /Suspendre/i });
    fireEvent.click(suspendBtn);

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith("user-1", { is_active: false });
    });
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
          sequence_type: "proforma",
          year: 2026,
          next_number: 200,
        })
      );
    });
  });

  it("permet de basculer sur les séquences de Factures Définitives et de Bons de Livraison et de les configurer", async () => {
    render(<AdminPage onNavigate={vi.fn()} />);
    await screen.findByText("Admin User");

    const numberingTab = screen.getByRole("button", { name: /Numérotation & Séquences/i });
    fireEvent.click(numberingTab);

    expect(await screen.findByText("Configuration des Séquences Annuelles")).toBeInTheDocument();

    // Switch to Factures Définitives
    const invoiceTypeBtn = screen.getByRole("button", { name: /Factures Définitives/i });
    fireEvent.click(invoiceTypeBtn);

    expect(screen.getByText("010/2026-FA")).toBeInTheDocument();
    expect(screen.getByText("H-015/2026-FA")).toBeInTheDocument();

    const configButtons = screen.getAllByRole("button", { name: /Configurer la séquence/i });
    // Click config for Titan Invoice
    fireEvent.click(configButtons[0]);

    // Update next_number and prefix
    const inputNumber = screen.getByDisplayValue("10");
    fireEvent.change(inputNumber, { target: { value: "25" } });
    const inputPrefix = screen.getByPlaceholderText("Ex: PRO-");
    fireEvent.change(inputPrefix, { target: { value: "FAC-" } });

    // Save
    const saveBtn = screen.getByRole("button", { name: /^Enregistrer$/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockConfigureNumberingSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: "titan",
          sequence_type: "invoice",
          year: 2026,
          next_number: 25,
          prefix: "FAC-",
        })
      );
    });

    // Switch to Bons de Livraison
    const blTypeBtn = screen.getByRole("button", { name: /Bons de Livraison/i });
    fireEvent.click(blTypeBtn);

    expect(screen.getByText("005/2026-BL")).toBeInTheDocument();
    expect(screen.getByText("H-008/2026-BL")).toBeInTheDocument();
  });
});
