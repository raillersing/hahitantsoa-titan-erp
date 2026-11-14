import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ReservationsPage from "./ReservationsPage";
import TitanPage from "./TitanPage";
import HahitantsoaPage from "./HahitantsoaPage";
import * as api from "../api";
import type { HahitantsoaEventDraft, ReservationDraft } from "../types";

const mockTitanDrafts: ReservationDraft[] = [
  {
    id: "d-titan-1",
    public_reference: "TITAN-2026-0042",
    status: "draft",
    customer_id: "CUST-001",
    customer_display_name: "Société Malgache d'Événements",
    start_at: "2026-11-20T08:00:00Z",
    end_at: "2026-11-22T18:00:00Z",
    notes: "",
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    lines: [
      {
        id: "l1",
        inventory_item_id: "MAT-01",
        inventory_item_name: "Chaise Napoléon",
        inventory_item_kind: "article",
        quantity: 150,
        notes: "",
      },
    ],
    created_at: "2026-11-13T14:30:00Z",
    updated_at: "2026-11-13T14:30:00Z",
    created_by_id: "user-uuid-1",
    created_by_username: "ando.commercial",
    created_by_display_name: "Ando Rabeharimanana",
  },
  {
    id: "d-titan-legacy",
    public_reference: "TITAN-LEGACY-01",
    status: "draft",
    customer_id: "CUST-002",
    customer_display_name: "Client Ancien",
    start_at: "2026-11-25T08:00:00Z",
    end_at: "2026-11-26T18:00:00Z",
    notes: "",
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    lines: [],
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    // No created_by (legacy record)
  },
];

const mockHahitantsoaDrafts: HahitantsoaEventDraft[] = [
  {
    id: "d-hahi-1",
    public_reference: "H-2026-0077",
    event_name: "Gala d'Entreprise Orange",
    event_type: "corporate",
    rental_type: "logistics",
    status: "draft",
    customer_id: "CUST-003",
    customer_display_name: "Orange Madagascar",
    start_at: "2026-12-05T18:00:00Z",
    end_at: "2026-12-06T02:00:00Z",
    venue_name: "Salle Principale Hahitantsoa",
    location_details: "",
    service_notes: "",
    notes: "",
    lines: [],
    created_at: "2026-11-14T01:15:00Z",
    updated_at: "2026-11-14T01:15:00Z",
    created_by_id: "user-uuid-2",
    created_by_username: "tantely.admin",
    created_by_display_name: "Tantely Rasolofo",
  },
];

describe("Affichage Auteur et Date de Création des Réservations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue(mockTitanDrafts);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue(mockHahitantsoaDrafts);
    vi.spyOn(api, "getHahitantsoaDiscoveryItems").mockResolvedValue({ items: [] } as any);
  });

  describe("ReservationsPage (Index consolidé)", () => {
    it("affiche la date de création et l'auteur pour les dossiers Titan et Hahitantsoa", async () => {
      render(<ReservationsPage onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("TITAN-2026-0042")).toBeInTheDocument();
        expect(screen.getByText("H-2026-0077")).toBeInTheDocument();
      });

      // Auteurs affichés
      expect(screen.getByText("Ando Rabeharimanana")).toBeInTheDocument();
      expect(screen.getByText("Tantely Rasolofo")).toBeInTheDocument();

      // Mentions "Créé le ... par ..." présentes
      const authorLabels = screen.getAllByText(/Créé le .* par/i);
      expect(authorLabels.length).toBeGreaterThanOrEqual(2);
    });

    it("affiche correctement un dossier sans auteur sans planter (fallback)", async () => {
      render(<ReservationsPage onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("TITAN-LEGACY-01")).toBeInTheDocument();
      });

      expect(screen.getByText(/Créé le 1 oct/i)).toBeInTheDocument();
    });
  });

  describe("TitanPage (Volet Titan Matériel)", () => {
    it("affiche l'auteur et la date de création sous la référence du dossier", async () => {
      render(<TitanPage onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("TITAN-2026-0042")).toBeInTheDocument();
      });

      expect(screen.getByText("Ando Rabeharimanana")).toBeInTheDocument();
      expect(screen.getByText(/Créé le .* par/i)).toBeInTheDocument();
    });
  });

  describe("HahitantsoaPage (Volet Hahitantsoa Événements)", () => {
    it("affiche l'auteur et la date de création sous la référence du dossier", async () => {
      render(<HahitantsoaPage onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("H-2026-0077")).toBeInTheDocument();
      });

      expect(screen.getByText("Tantely Rasolofo")).toBeInTheDocument();
      expect(screen.getByText(/Créé le .* par/i)).toBeInTheDocument();
    });
  });
});
