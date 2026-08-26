import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import HahitantsoaCommercialTermsPage from "./prototype/HahitantsoaCommercialTermsPage";
import * as api from "./api";
import type { HahitantsoaCommercialTerms } from "./types";

const mockTerms: HahitantsoaCommercialTerms = {
  base_space_rental_amount: "6500000.00",
  included_guest_count: 250,
  excess_guest_amount: "5000.00",
  bare_deposit_amount: "1000000.00",
  logistics_deposit_amount: "1500000.00",
  night_option_1_amount: "300000.00",
  night_option_2_amount: "500000.00",
  night_security_amount: "120000.00",
  caution_amount: "500000.00",
  updated_at: "2026-08-27T00:00:00Z",
};

describe("HahitantsoaCommercialTermsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getHahitantsoaCommercialTerms").mockResolvedValue(mockTerms);
  });

  it("renders all sections including 2026 night options and caution", async () => {
    render(<HahitantsoaCommercialTermsPage canEdit={true} />);

    expect(screen.getByText("Chargement des paramètres…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Paramétrage des Tarifs & Modalités Officielles")).toBeInTheDocument();
    });

    // Check Section 1
    expect(screen.getByText("1. Espace Chapiteau & Capacité")).toBeInTheDocument();
    expect(screen.getByLabelText("Tarif de base du chapiteau")).toHaveValue(6500000);
    expect(screen.getByLabelText("Nombre de convives inclus")).toHaveValue(250);

    // Check Section 2: Night options
    expect(screen.getByText("2. Prolongations Nocturnes & Sécurité")).toBeInTheDocument();
    expect(screen.getByLabelText("Option Nuit 1 (Fin 21h00 / Sortie 22h30)")).toHaveValue(300000);
    expect(screen.getByLabelText("Option Nuit 2 (Fin 00h00 / Sortie 03h30)")).toHaveValue(500000);
    expect(screen.getByLabelText("Sécurité nocturne obligatoire")).toHaveValue(120000);

    // Check Section 3: Caution
    expect(screen.getByText("3. Acomptes & Caution de Garantie")).toBeInTheDocument();
    expect(screen.getByLabelText("Caution de garantie forfaitaire")).toHaveValue(500000);

    // Check Hub Navigation
    expect(screen.getByText("Catalogue Visuel des Prestations & Scénographies")).toBeInTheDocument();
  });
});
