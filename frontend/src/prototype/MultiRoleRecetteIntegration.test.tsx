import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { capabilitiesForUser, type FrontendCapabilities } from "../capabilities";
import type { SessionUser } from "../api";
import { TutorialProvider } from "../tutorial/TutorialProvider";
import { TutorialCenter } from "../tutorial/TutorialCenter";

afterEach(cleanup);

describe("Multi-Role Recette Intégration - Validation des 5 personas (A0-B4)", () => {
  // 1. Persona COMPTABLE (Accountant)
  const accountantUser: SessionUser = {
    id: "user-compta",
    username: "comptable_1",
    display_name: "Comptable Agence",
    is_staff: false,
    roles: ["COMPTABLE"],
    capabilities: {
      canManageFinance: true,
      canSensitiveWrite: false,
      canOperateCashbox: false,
      canOperateLogistics: false,
      canManageIdentity: false,
    },
    reportCategories: ["sales_billing", "payments"],
  };

  // 2. Persona COMMERCIAL (Sales / Account Manager)
  const commercialUser: SessionUser = {
    id: "user-commercial",
    username: "commercial_1",
    display_name: "Commercial Agence",
    is_staff: false,
    roles: ["COMMERCIAL"],
    capabilities: {
      canSensitiveWrite: true,
      canManageFinance: false,
      canOperateCashbox: false,
      canOperateLogistics: false,
      canManageIdentity: false,
    },
    reportCategories: ["reservations", "prospects", "documents"],
  };

  // 3. Persona GÉRANT MÉTIER (Owner Manager)
  const ownerManagerUser: SessionUser = {
    id: "user-gerant",
    username: "gerant_metier",
    display_name: "Direction Générale",
    is_staff: false,
    roles: ["GÉRANT_MÉTIER"],
    capabilities: {
      canSensitiveWrite: true,
      canManageFinance: true,
      canOperateCashbox: true,
      canSuperviseCashbox: true,
      canManageInventory: true,
      canOperateLogistics: true,
      canOverrideLogistics: true,
      canManageIdentity: false,
    },
    reportCategories: ["reservations", "sales_billing", "payments", "prospects", "logistics", "inventory", "documents"],
  };

  // 4. Persona MAGASINIER (Storekeeper)
  const storekeeperUser: SessionUser = {
    id: "user-magasinier",
    username: "magasinier_1",
    display_name: "Magasinier Dépôt",
    is_staff: false,
    roles: ["MAGASINIER"],
    capabilities: {
      canOperateLogistics: true,
      canManageInventory: true,
      canSensitiveWrite: false,
      canManageFinance: false,
    },
    reportCategories: ["inventory", "logistics"],
  };

  // 5. Persona LIVREUR / AGENT OPÉRATIONNEL (Driver / Operational Agent)
  const driverUser: SessionUser = {
    id: "user-livreur",
    username: "livreur_1",
    display_name: "Livreur / Chauffeur",
    is_staff: false,
    roles: ["LIVREUR"],
    capabilities: {
      canOperateLogistics: true,
      canManageInventory: false,
      canSensitiveWrite: false,
      canManageFinance: false,
    },
    reportCategories: [],
  };

  describe("1. Profil Comptable (Accountant)", () => {
    const caps = capabilitiesForUser(accountantUser);

    it("accorde les droits financiers mais verrouille strictement les écritures sensibles et signatures", () => {
      expect(caps.canManageFinance).toBe(true);
      expect(caps.canSensitiveWrite).toBe(false);
      expect(caps.canManageIdentity).toBe(false);
      expect(accountantUser.is_staff).toBe(false);
    });

    it("restreint les tutoriels visibles aux opérations financières et rapports", () => {
      render(
        <TutorialProvider user={accountantUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Paiements, encaissements et règlements")).toBeInTheDocument();
      expect(screen.getByText("Rapports d'activité et indicateurs de performance")).toBeInTheDocument();
      expect(screen.getByText("Achats, approvisionnements et réassort")).toBeInTheDocument();

      expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
      expect(screen.queryByText("Préparation logistique et bons de prélèvement")).not.toBeInTheDocument();
      expect(screen.queryByText("Gestion des caisses physiques et clôtures")).not.toBeInTheDocument();
    });
  });

  describe("2. Profil Commercial (Commercial)", () => {
    const caps = capabilitiesForUser(commercialUser);

    it("accorde les droits d'engagement de devis mais refuse les dépenses et l'administration", () => {
      expect(caps.canSensitiveWrite).toBe(true);
      expect(caps.canManageFinance).toBe(false);
      expect(caps.canManageIdentity).toBe(false);
      expect(commercialUser.is_staff).toBe(false);
    });

    it("accorde les tutoriels de découverte contractuelle et de reprise de brouillon", () => {
      render(
        <TutorialProvider user={commercialUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Du Proforma à la Confirmation")).toBeInTheDocument();
      expect(screen.getByText("Reprise de Brouillon et Synchronisation")).toBeInTheDocument();
      expect(screen.getByText("Génération et cycle de vie des documents")).toBeInTheDocument();

      expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
      expect(screen.queryByText("Préparation logistique et bons de prélèvement")).not.toBeInTheDocument();
    });
  });

  describe("3. Profil Gérant Métier (Owner Manager)", () => {
    const caps = capabilitiesForUser(ownerManagerUser);

    it("accorde l'autorité opérationnelle transversale mais distingue l'administration technique système", () => {
      expect(caps.canSensitiveWrite).toBe(true);
      expect(caps.canManageFinance).toBe(true);
      expect(caps.canOperateCashbox).toBe(true);
      expect(caps.canSuperviseCashbox).toBe(true);
      expect(caps.canManageInventory).toBe(true);
      expect(caps.canOperateLogistics).toBe(true);
      expect(caps.canOverrideLogistics).toBe(true);
      // N'est pas un administrateur système is_staff par défaut
      expect(ownerManagerUser.is_staff).toBe(false);
    });

    it("accorde l'accès aux guides opérationnels et de supervision", () => {
      render(
        <TutorialProvider user={ownerManagerUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Paramètres généraux, banques et conditions")).toBeInTheDocument();
      expect(screen.getByText("Paiements, encaissements et règlements")).toBeInTheDocument();
      expect(screen.getByText("Gestion de la caisse quotidienne")).toBeInTheDocument();
      expect(screen.getByText("Rapports d'activité et indicateurs de performance")).toBeInTheDocument();
      expect(screen.getByText("Préparation logistique et bons de prélèvement")).toBeInTheDocument();
      expect(screen.getByText("Gestion des packs et lots de matériel")).toBeInTheDocument();

      // Administration technique réservée à is_staff / canManageIdentity
      expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    });
  });

  describe("4. Profil Magasinier (Storekeeper)", () => {
    const caps = capabilitiesForUser(storekeeperUser);

    it("accorde les capacités logistiques et de stock mais refuse les finances et écritures sensibles", () => {
      expect(caps.canOperateLogistics).toBe(true);
      expect(caps.canManageInventory).toBe(true);
      expect(caps.canManageFinance).toBe(false);
      expect(caps.canSensitiveWrite).toBe(false);
    });

    it("accorde l'accès aux guides logistiques et de préparation", () => {
      render(
        <TutorialProvider user={storekeeperUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Préparation logistique et bons de prélèvement")).toBeInTheDocument();
      expect(screen.getByText("Bons de livraison, sorties et passations")).toBeInTheDocument();
      expect(screen.getByText("Réception des retours et réintégration en stock")).toBeInTheDocument();
      expect(screen.getByText("Gestion des packs et lots de matériel")).toBeInTheDocument();

      expect(screen.queryByText("Paiements, encaissements et règlements")).not.toBeInTheDocument();
      expect(screen.queryByText("Gestion de la caisse quotidienne")).not.toBeInTheDocument();
      expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    });
  });

  describe("5. Profil Livreur / Agent Opérationnel (Driver / Operational Agent)", () => {
    const caps = capabilitiesForUser(driverUser);

    it("accorde les capacités logistiques d'expédition sans gestion d'inventaire ni finance", () => {
      expect(caps.canOperateLogistics).toBe(true);
      expect(caps.canManageInventory).toBe(false);
      expect(caps.canManageFinance).toBe(false);
      expect(caps.canSensitiveWrite).toBe(false);
      expect(driverUser.reportCategories).toHaveLength(0);
    });

    it("accorde l'accès aux guides de livraison et retours opérationnels", () => {
      render(
        <TutorialProvider user={driverUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Bons de livraison, sorties et passations")).toBeInTheDocument();
      expect(screen.getByText("Réception des retours et réintégration en stock")).toBeInTheDocument();

      // Ni packs, ni caisses, ni finance, ni rapports
      expect(screen.queryByText("Gestion des packs et lots de matériel")).not.toBeInTheDocument();
      expect(screen.queryByText("Rapports d'activité et indicateurs de performance")).not.toBeInTheDocument();
      expect(screen.queryByText("Paiements, encaissements et règlements")).not.toBeInTheDocument();
    });
  });
});
