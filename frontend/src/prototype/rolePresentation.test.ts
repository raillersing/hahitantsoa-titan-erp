import { describe, expect, it } from "vitest";
import { getRolePresentation, ROLE_PRESENTATION_CATALOG } from "./rolePresentation";
import type { ApplicationRole, User } from "../types";

describe("rolePresentation", () => {
  const mockUsers: User[] = [
    {
      id: "u1",
      username: "ranto",
      email: "ranto@example.com",
      first_name: "Ranto",
      last_name: "Rakoto",
      display_name: "Ranto Rakoto",
      is_staff: false,
      is_active: true,
      last_login: null,
      date_joined: "2026-01-01T00:00:00Z",
      role_names: ["reservation_sensitive_operator"],
    },
    {
      id: "u2",
      username: "admin",
      email: "admin@example.com",
      first_name: "Admin",
      last_name: "Boss",
      display_name: "Admin User",
      is_staff: true,
      is_active: true,
      last_login: null,
      date_joined: "2026-01-01T00:00:00Z",
      role_names: ["identity_admin"],
    },
  ];

  it("retourne une présentation enrichie pour un rôle système comme reservation_sensitive_operator", () => {
    const role: ApplicationRole = {
      id: "r1",
      name: "reservation_sensitive_operator",
      slug: "reservation_sensitive_operator",
      description: "System-managed role",
      is_system_managed: true,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const pres = getRolePresentation(role, mockUsers);
    expect(pres.title).toBe("Chargé d'Affaires & Confirmation Commerciale");
    expect(pres.category).toBe("commercial");
    expect(pres.categoryLabel).toBe("Commerce & Vente");
    expect(pres.keyRights.length).toBeGreaterThanOrEqual(3);
    expect(pres.matrix.length).toBe(6);
    expect(pres.memberCount).toBe(1);
    expect(pres.memberNames).toEqual(["Ranto Rakoto"]);

    const confirmationDomain = pres.matrix.find((m) => m.domain === "Confirmation & Contrats");
    expect(confirmationDomain?.allowed).toBe(true);
  });

  it("retourne une présentation enrichie pour le rôle caissier cashbox_operator", () => {
    const role: ApplicationRole = {
      id: "r2",
      name: "cashbox_operator",
      slug: "cashbox_operator",
      description: "System-managed role for cashbox",
      is_system_managed: true,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const pres = getRolePresentation(role, mockUsers);
    expect(pres.title).toBe("Caissier & Opérateur d'Encaissement");
    expect(pres.category).toBe("caisse");
    expect(pres.iconClass).toContain("fa-cash-register");

    const caisseDomain = pres.matrix.find((m) => m.domain === "Caisse & Règlements");
    expect(caisseDomain?.allowed).toBe(true);
  });

  it("gère gracieusement un rôle personnalisé non répertorié dans le catalogue", () => {
    const customRole: ApplicationRole = {
      id: "custom-1",
      name: "Coordinateur Mariages",
      slug: "coordinateur-mariages",
      description: "Supervise spécifiquement les cérémonies et mariages",
      is_system_managed: false,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const pres = getRolePresentation(customRole, []);
    expect(pres.title).toBe("Coordinateur Mariages");
    expect(pres.category).toBe("personnalise");
    expect(pres.summary).toBe("Supervise spécifiquement les cérémonies et mariages");
    expect(pres.memberCount).toBe(0);
    expect(pres.memberNames).toEqual([]);
    expect(pres.matrix.length).toBe(6);
  });

  it("catalogue contient tous les rôles d'entreprise et rôles système indispensables", () => {
    expect(ROLE_PRESENTATION_CATALOG).toHaveProperty("identity_admin");
    expect(ROLE_PRESENTATION_CATALOG).toHaveProperty("reservation_sensitive_operator");
    expect(ROLE_PRESENTATION_CATALOG).toHaveProperty("cashbox_operator");
    expect(ROLE_PRESENTATION_CATALOG).toHaveProperty("cashbox_supervisor");
    expect(ROLE_PRESENTATION_CATALOG).toHaveProperty("logistics_manager");
    expect(ROLE_PRESENTATION_CATALOG).toHaveProperty("accountant");
    expect(ROLE_PRESENTATION_CATALOG).toHaveProperty("owner_manager");
  });
});
