import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";
import { capabilitiesForUser } from "../capabilities";
import type { SessionUser } from "../api";
import { TutorialProvider } from "../tutorial/TutorialProvider";
import { TutorialCenter } from "../tutorial/TutorialCenter";

afterEach(cleanup);

/**
 * Multi-Role Recette - Tests de présentation frontend (Lots A0-B4).
 *
 * NOTE DE CADRAGE :
 * Ces tests frontend valident strictement la présentation visuelle, l'affichage conditionnel
 * et l'orientation dans les tutoriels selon les capacités émises par la session backend.
 *
 * Ils ne constituent PAS une preuve des réponses HTTP réelles (200/403), de la persistance en base
 * ou de l'invariance des données. Cette preuve exhaustive est apportée par la suite d'intégration
 * backend test_multi_role_api_recette.py.
 */
describe("Multi-Role Recette - Tests de présentation frontend (Lots A0-B4)", () => {
  // 1. Persona COMPTABLE (Accountant - rôle catalog: accountant)
  const accountantUser: SessionUser = {
    id: "user-compta",
    username: "comptable_1",
    display_name: "Comptable Agence",
    is_staff: false,
    roles: ["accountant"],
    capabilities: {
      canManageFinance: true,
      canViewPayroll: true,
      canActivatePayroll: true,
      canSensitiveWrite: false,
      canOperateCashbox: false,
      canOperateLogistics: false,
      canManageIdentity: false,
    },
    reportCategories: ["payments", "sales_billing"],
  };

  // 2. Persona COMMERCIAL (Sales / Account Manager - rôle catalog: reservation_sensitive_operator)
  const commercialUser: SessionUser = {
    id: "user-commercial",
    username: "commercial_1",
    display_name: "Commercial Agence",
    is_staff: false,
    roles: ["reservation_sensitive_operator"],
    capabilities: {
      canSensitiveWrite: true,
      canViewAudit: true,
      canOperateCashbox: true,
      canOperateLogistics: true,
      canManageFinance: false,
      canManageIdentity: false,
    },
    reportCategories: [
      "documents",
      "inventory",
      "logistics",
      "payments",
      "prospects",
      "reservations",
      "sales_billing",
    ],
  };

  // 3. Persona GÉRANT MÉTIER (Owner Manager - rôle catalog: owner_manager)
  // Conserve canManageIdentity pour l'administration métier des collaborateurs, sans être staff technique.
  const ownerManagerUser: SessionUser = {
    id: "user-gerant",
    username: "gerant_metier",
    display_name: "Direction Générale",
    is_staff: false,
    roles: ["owner_manager"],
    capabilities: {
      canManageIdentity: true,
      canSensitiveWrite: true,
      canManageFinance: true,
      canOperateCashbox: true,
      canSuperviseCashbox: true,
      canManageInventory: true,
      canOperateLogistics: true,
      canOverrideLogistics: true,
      canViewAudit: true,
      canViewPayroll: true,
      canEditPayroll: true,
      canActivatePayroll: true,
    },
    reportCategories: [
      "documents",
      "inventory",
      "logistics",
      "payments",
      "prospects",
      "reservations",
      "sales_billing",
    ],
  };

  // 4. Persona MAGASINIER (Storekeeper - rôle catalog: storekeeper)
  // Utilise exactement les catégories de rapports autorisées par le sélecteur backend (INVENTORY seul).
  const storekeeperUser: SessionUser = {
    id: "user-magasinier",
    username: "magasinier_1",
    display_name: "Magasinier Dépôt",
    is_staff: false,
    roles: ["storekeeper"],
    capabilities: {
      canManageInventory: true,
      canOperateLogistics: true,
      canSensitiveWrite: false,
      canManageFinance: false,
      canManageIdentity: false,
    },
    reportCategories: ["inventory"],
  };

  // 5. Persona LIVREUR (Driver - rôle catalog existant: delivery_driver)
  // Dans le catalogue de rôles du backend, delivery_driver ne possède aucune capacité attribuée.
  const deliveryDriverUser: SessionUser = {
    id: "user-livreur",
    username: "livreur_1",
    display_name: "Livreur / Chauffeur",
    is_staff: false,
    roles: ["delivery_driver"],
    capabilities: {},
    reportCategories: [],
  };

  // 6. Profil Hypothétique : Agent Opérationnel avec délégation logistique transport
  // Combinaison hypothétique explicite pour tester l'impact de canOperateLogistics sur la livraison.
  const hypotheticalTransportDelegateUser: SessionUser = {
    id: "user-transport-delegate",
    username: "transport_delegue",
    display_name: "Chauffeur Délégué Logistique (Hypothétique)",
    is_staff: false,
    roles: ["transport_delegate_hypothetical"],
    capabilities: {
      canOperateLogistics: true,
    },
    reportCategories: [],
  };

  describe("1. Profil Comptable (accountant)", () => {
    const caps = capabilitiesForUser(accountantUser);

    it("accorde les droits financiers mais verrouille les écritures sensibles et la gestion d'identité", () => {
      expect(caps.canManageFinance).toBe(true);
      expect(caps.canSensitiveWrite).toBe(false);
      expect(caps.canManageIdentity).toBe(false);
      expect(accountantUser.is_staff).toBe(false);
      expect(accountantUser.reportCategories).toEqual(["payments", "sales_billing"]);
    });

    it("restreint les tutoriels visibles aux opérations financières, achats et rapports autorisés", () => {
      render(
        <TutorialProvider user={accountantUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Paiements, encaissements et règlements")).toBeInTheDocument();
      expect(screen.getByText("Rapports d'activité et indicateurs de performance")).toBeInTheDocument();
      expect(screen.getByText("Achats, approvisionnements et réassort")).toBeInTheDocument();

      // Non visibles
      expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
      expect(screen.queryByText("Préparation logistique et bons de prélèvement")).not.toBeInTheDocument();
      expect(screen.queryByText("Gestion de la caisse quotidienne")).not.toBeInTheDocument();
    });
  });

  describe("2. Profil Commercial (reservation_sensitive_operator)", () => {
    const caps = capabilitiesForUser(commercialUser);

    it("accorde l'engagement commercial et préserve l'accès bancaire historique (canSensitiveWrite OU canManageFinance)", () => {
      expect(caps.canSensitiveWrite).toBe(true);
      expect(caps.canManageIdentity).toBe(false);
      expect(commercialUser.is_staff).toBe(false);

      // Règle confirmée : l'accès bancaire /api/v1/finance/banks/ est conditionné par is_financial_operation_actor
      // (canSensitiveWrite OU canManageFinance). Le commercial y a donc accès historiquement.
      const hasBankAccess = Boolean(caps.canSensitiveWrite || caps.canManageFinance);
      expect(hasBankAccess).toBe(true);
    });

    it("accorde les tutoriels de découverte contractuelle, reprise de brouillon et cycle de vie documentaire", () => {
      render(
        <TutorialProvider user={commercialUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Du Proforma à la Confirmation")).toBeInTheDocument();
      expect(screen.getByText("Reprise de Brouillon et Synchronisation")).toBeInTheDocument();
      expect(screen.getByText("Génération et cycle de vie des documents")).toBeInTheDocument();

      // Administration des collaborateurs refusée
      expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    });
  });

  describe("3. Profil Gérant Métier (owner_manager)", () => {
    const caps = capabilitiesForUser(ownerManagerUser);

    it("accorde canManageIdentity pour l'administration métier sans être Django staff/superuser", () => {
      // Gérant métier possède canManageIdentity pour collaborateur & rôles
      expect(caps.canManageIdentity).toBe(true);
      expect(caps.canSensitiveWrite).toBe(true);
      expect(caps.canManageFinance).toBe(true);
      expect(caps.canOperateCashbox).toBe(true);
      expect(caps.canSuperviseCashbox).toBe(true);
      expect(caps.canManageInventory).toBe(true);
      expect(caps.canOperateLogistics).toBe(true);
      expect(caps.canOverrideLogistics).toBe(true);

      // Mais n'est pas un administrateur système Django is_staff
      expect(ownerManagerUser.is_staff).toBe(false);
    });

    it("accorde l'accès aux guides opérationnels, financiers, et d'administration des collaborateurs", () => {
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

      // Administration des collaborateurs autorisée car canManageIdentity est vrai
      expect(screen.getByText("Administration, habilitations et sécurité")).toBeInTheDocument();
    });
  });

  describe("4. Profil Magasinier (storekeeper)", () => {
    const caps = capabilitiesForUser(storekeeperUser);

    it("accorde stock et logistique, refuse finances/sensible, et limite les rapports au strict périmètre INVENTORY", () => {
      expect(caps.canOperateLogistics).toBe(true);
      expect(caps.canManageInventory).toBe(true);
      expect(caps.canManageFinance).toBe(false);
      expect(caps.canSensitiveWrite).toBe(false);
      expect(caps.canManageIdentity).toBe(false);

      // Exactement 'inventory' selon REPORT_ACCESS_MATRIX['storekeeper']
      expect(storekeeperUser.reportCategories).toEqual(["inventory"]);
    });

    it("accorde les guides de préparation et gestion de packs, refuse caisse et administration", () => {
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

  describe("5. Profil Livreur (delivery_driver catalogue existant)", () => {
    const caps = capabilitiesForUser(deliveryDriverUser);

    it("ne possède aucune capacité logistique sans décision explicite dans le catalogue existant", () => {
      // Dans le catalogue backend, delivery_driver ne reçoit aucune capacité par défaut
      expect(caps.canOperateLogistics).toBe(false);
      expect(caps.canManageInventory).toBe(false);
      expect(caps.canManageFinance).toBe(false);
      expect(caps.canSensitiveWrite).toBe(false);
      expect(deliveryDriverUser.reportCategories).toHaveLength(0);
    });

    it("ne peut pas accéder aux tutoriels d'opération logistique sans la capacité canOperateLogistics", () => {
      render(
        <TutorialProvider user={deliveryDriverUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      // Les tutoriels logistiques sont conditionnés par canOperateLogistics
      expect(screen.queryByText("Bons de livraison, sorties et passations")).not.toBeInTheDocument();
      expect(screen.queryByText("Préparation logistique et bons de prélèvement")).not.toBeInTheDocument();
      expect(screen.queryByText("Gestion des packs et lots de matériel")).not.toBeInTheDocument();
    });
  });

  describe("6. Combinaison Hypothétique : Agent Opérationnel avec délégation logistique", () => {
    const caps = capabilitiesForUser(hypotheticalTransportDelegateUser);

    it("rend accessibles les guides de livraison uniquement lorsqu'une capacité logistique explicite est accordée", () => {
      expect(caps.canOperateLogistics).toBe(true);

      render(
        <TutorialProvider user={hypotheticalTransportDelegateUser} activeScope="help">
          <TutorialCenter />
        </TutorialProvider>
      );
      expect(screen.getByText("Bons de livraison, sorties et passations")).toBeInTheDocument();
      expect(screen.getByText("Réception des retours et réintégration en stock")).toBeInTheDocument();

      // Ni finances ni administration
      expect(screen.queryByText("Paiements, encaissements et règlements")).not.toBeInTheDocument();
      expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    });
  });
});
