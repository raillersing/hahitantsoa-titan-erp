import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TutorialProvider } from "./TutorialProvider";
import { TutorialCenter } from "./TutorialCenter";
import type { SessionUser } from "../api";
import { TUTORIAL_CATALOG } from "./catalog";

afterEach(cleanup);

describe("TutorialLotB4 - Alignement des tutoriels sur les capacités et absence de matrice parallèle", () => {
  const baseUser: SessionUser = {
    id: "user-base",
    username: "collab",
    display_name: "Collaborateur",
    is_staff: false,
    roles: [],
    capabilities: {},
  };

  it("masque tous les tutoriels privilégiés pour un utilisateur sans capacités serveur", () => {
    render(
      <TutorialProvider user={baseUser} activeScope="help">
        <TutorialCenter />
      </TutorialProvider>
    );

    // Privileged modules must NOT be visible
    expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    expect(screen.queryByText("Paramètres généraux, banques et conditions")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion de la caisse quotidienne")).not.toBeInTheDocument();
    expect(screen.queryByText("Paiements, encaissements et règlements")).not.toBeInTheDocument();
    expect(screen.queryByText("Préparation logistique et bons de prélèvement")).not.toBeInTheDocument();
    expect(screen.queryByText("Rapports d'activité et indicateurs de performance")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion des collaborateurs et variables de paie")).not.toBeInTheDocument();

    // Standard shared discovery guides MUST be visible
    expect(screen.getByText("Bienvenue dans votre ERP")).toBeInTheDocument();
    expect(screen.getByText("Droits, Profil et Dossiers Partagés")).toBeInTheDocument();
    expect(screen.getByText("Aide, Support et Notifications")).toBeInTheDocument();
    expect(screen.getByText("Du Proforma à la Confirmation")).toBeInTheDocument();
    expect(screen.getByText("Génération et cycle de vie des documents")).toBeInTheDocument();
  });

  it("ouvre les tutoriels financiers et les rapports au comptable selon ses capacités réelles", () => {
    const accountantUser: SessionUser = {
      ...baseUser,
      username: "compta",
      display_name: "Comptable",
      capabilities: {
        canManageFinance: true,
      },
    };

    render(
      <TutorialProvider user={accountantUser} activeScope="help">
        <TutorialCenter />
      </TutorialProvider>
    );

    // Financial modules and reports are accessible
    expect(screen.getByText("Paiements, encaissements et règlements")).toBeInTheDocument();
    expect(screen.getByText("Rapports d'activité et indicateurs de performance")).toBeInTheDocument();
    expect(screen.getByText("Achats, approvisionnements et réassort")).toBeInTheDocument();

    // Sensitive write / operations remain hidden
    expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion de la caisse quotidienne")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion des collaborateurs et variables de paie")).not.toBeInTheDocument();
  });

  it("ouvre le tutoriel rapports aux utilisateurs disposant uniquement de reportCategories", () => {
    const reportUser: SessionUser = {
      ...baseUser,
      username: "viewer",
      display_name: "Consultant Rapports",
      reportCategories: ["inventory", "sales_billing"],
    };

    render(
      <TutorialProvider user={reportUser} activeScope="help">
        <TutorialCenter />
      </TutorialProvider>
    );

    // Report tutorial is visible because user has reportCategories
    expect(screen.getByText("Rapports d'activité et indicateurs de performance")).toBeInTheDocument();
    // But other privileged modules remain hidden
    expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    expect(screen.queryByText("Paiements, encaissements et règlements")).not.toBeInTheDocument();
  });

  it("ouvre les modules logistiques au magasinier selon ses capacités", () => {
    const logisticsUser: SessionUser = {
      ...baseUser,
      username: "magasinier",
      display_name: "Magasinier",
      capabilities: {
        canOperateLogistics: true,
      },
    };

    render(
      <TutorialProvider user={logisticsUser} activeScope="help">
        <TutorialCenter />
      </TutorialProvider>
    );

    // Logistics modules are visible
    expect(screen.getByText("Préparation logistique et bons de prélèvement")).toBeInTheDocument();
    expect(screen.getByText("Bons de livraison, sorties et passations")).toBeInTheDocument();
    expect(screen.getByText("Réception des retours et réintégration en stock")).toBeInTheDocument();

    // Financial and admin modules remain hidden
    expect(screen.queryByText("Paiements, encaissements et règlements")).not.toBeInTheDocument();
    expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
  });

  it("ouvre les modules de caisse à l'opérateur de caisse", () => {
    const cashUser: SessionUser = {
      ...baseUser,
      username: "caissier",
      display_name: "Caissier",
      capabilities: {
        canOperateCashbox: true,
      },
    };

    render(
      <TutorialProvider user={cashUser} activeScope="help">
        <TutorialCenter />
      </TutorialProvider>
    );

    expect(screen.getByText("Gestion de la caisse quotidienne")).toBeInTheDocument();
    expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
  });

  it("ouvre le module d'administration technique à l'administrateur is_staff", () => {
    const staffUser: SessionUser = {
      ...baseUser,
      username: "admin_tech",
      display_name: "Admin Tech",
      is_staff: true,
    };

    render(
      <TutorialProvider user={staffUser} activeScope="help">
        <TutorialCenter />
      </TutorialProvider>
    );

    expect(screen.getByText("Administration, habilitations et sécurité")).toBeInTheDocument();
    expect(screen.getByText("Paramètres généraux, banques et conditions")).toBeInTheDocument();
    expect(screen.getByText("Rapports d'activité et indicateurs de performance")).toBeInTheDocument();
  });

  it("ne déduit aucun droit à partir de chaînes de rôles arbitraires (pas de matrice parallèle)", () => {
    // User having a role name string "ADMINISTRATEUR" or "GERANT" but empty capabilities and is_staff: false
    const decoyUser: SessionUser = {
      ...baseUser,
      username: "decoy",
      display_name: "Decoy",
      roles: ["ADMINISTRATEUR", "DIRECTEUR_GENERAL", "GERANT_METIER"],
      capabilities: {},
      is_staff: false,
    };

    render(
      <TutorialProvider user={decoyUser} activeScope="help">
        <TutorialCenter />
      </TutorialProvider>
    );

    // Must strictly fail closed on all privileged modules because server capabilities are empty
    expect(screen.queryByText("Administration, habilitations et sécurité")).not.toBeInTheDocument();
    expect(screen.queryByText("Paramètres généraux, banques et conditions")).not.toBeInTheDocument();
    expect(screen.queryByText("Gestion des caisses physiques et clôtures")).not.toBeInTheDocument();
    expect(screen.queryByText("Paiements, encaissements et règlements")).not.toBeInTheDocument();
  });

  it("garantit que l'intégralité du catalogue des tutoriels est déclarée en mode live-readonly", () => {
    // Check all modules in catalog
    for (const tut of TUTORIAL_CATALOG) {
      expect(["live-readonly", "exercise"]).toContain(tut.mode);
    }
  });
});
