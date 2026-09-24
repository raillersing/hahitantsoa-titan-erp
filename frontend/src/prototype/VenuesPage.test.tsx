import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VenuesPage from "./VenuesPage";
import { getHahitantsoaVenues, ApiError } from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    getHahitantsoaVenues: vi.fn(),
    createHahitantsoaVenue: vi.fn(),
    updateHahitantsoaVenue: vi.fn(),
  };
});

describe("VenuesPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockVenues = [
    {
      id: "ven-1",
      name: "Salle des fêtes + jardin",
      type: "location_event",
      capacity: 350,
      active: true,
      is_default: true,
      note: "Espace principal",
    },
    {
      id: "ven-2",
      name: "Dépôt Matériel Central",
      type: "depot_stock",
      capacity: 0,
      active: true,
      is_default: false,
      note: "Stock",
    },
  ];

  it("renders venues list and indicates default venue", async () => {
    vi.mocked(getHahitantsoaVenues).mockResolvedValue(mockVenues as any);

    render(<VenuesPage />);

    expect(screen.getByText("Chargement des locaux...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Salle des fêtes + jardin")).toBeInTheDocument();
      expect(screen.getByText("Dépôt Matériel Central")).toBeInTheDocument();
    });

    expect(screen.getByTitle("Local par défaut")).toBeInTheDocument();
  });

  it("displays an explicit error row and retry button on fetch failure, and retries successfully", async () => {
    vi.mocked(getHahitantsoaVenues).mockRejectedValueOnce(new ApiError("Erreur serveur", 500));

    render(<VenuesPage />);

    await waitFor(() => {
      expect(screen.getByText("Erreur serveur")).toBeInTheDocument();
      expect(screen.getByText(/Échec du chargement des locaux/)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Réessayer" });
    expect(retryBtn).toBeInTheDocument();

    // Now mock success for retry
    vi.mocked(getHahitantsoaVenues).mockResolvedValueOnce(mockVenues as any);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Salle des fêtes + jardin")).toBeInTheDocument();
    });
  });

  it("displays empty state rows when no venues exist", async () => {
    vi.mocked(getHahitantsoaVenues).mockResolvedValue([]);

    render(<VenuesPage />);

    await waitFor(() => {
      expect(screen.getByText("Aucun local événementiel configuré.")).toBeInTheDocument();
      expect(screen.getByText("Aucun dépôt interne configuré.")).toBeInTheDocument();
    });
  });
});
