import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ServicesPage from "./prototype/ServicesPage";
import * as api from "./api";
import type { HahitantsoaService } from "./types";

const mockServices: HahitantsoaService[] = [
  {
    id: "srv-1",
    name: "Voilage centré",
    category: "drapery",
    category_display: "Draperie & Voilage",
    pricing_type: "flat_fee",
    price: 1250000,
    desc: "Draperie de plafond avec voilage centré blanc.",
    features: ["Disponible en blanc", "Installation exclusive"],
    active: true,
  },
  {
    id: "srv-2",
    name: "Guinguette linéaire",
    category: "starry_sky",
    category_display: "Ciel étoilé",
    pricing_type: "per_line",
    unit_label: "ligne",
    price: 100000,
    desc: "Ligne de guirlande guinguette.",
    features: ["Blanc chaud"],
    active: true,
  },
  {
    id: "srv-3",
    name: "Piste lumineuse LED",
    category: "scenography",
    category_display: "Piste LED & Scéno",
    pricing_type: "flat_fee",
    price: 1500000,
    desc: "Dalles LED interactives multicolores.",
    features: ["Multicolore"],
    active: true,
  },
];

describe("ServicesPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getHahitantsoaServices").mockResolvedValue(mockServices);
  });

  it("renders catalog title, categories and services in cards view", async () => {
    render(<ServicesPage />);

    expect(screen.getByText("Chargement du catalogue des offres...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Catalogue des Prestations & Scénographies")).toBeInTheDocument();
    });

    // Check services rendered
    expect(screen.getByText("Voilage centré")).toBeInTheDocument();
    expect(screen.getByText("Guinguette linéaire")).toBeInTheDocument();
    expect(screen.getByText("Piste lumineuse LED")).toBeInTheDocument();

    // Check pricing formatting
    expect(screen.getByText("1 250 000 Ar")).toBeInTheDocument();
    expect(screen.getByText("100 000 Ar / ligne")).toBeInTheDocument();
    expect(screen.getByText("1 500 000 Ar")).toBeInTheDocument();
  });

  it("filters services by category when clicking category tab", async () => {
    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText("Voilage centré")).toBeInTheDocument();
    });

    // Click on Drapery filter
    const draperyTab = screen.getByRole("button", { name: /Draperie & Voilage/i });
    fireEvent.click(draperyTab);

    // Only drapery service should be visible
    expect(screen.getByText("Voilage centré")).toBeInTheDocument();
    expect(screen.queryByText("Guinguette linéaire")).not.toBeInTheDocument();
    expect(screen.queryByText("Piste lumineuse LED")).not.toBeInTheDocument();
  });

  it("switches to table view correctly", async () => {
    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText("Voilage centré")).toBeInTheDocument();
    });

    const tableButton = screen.getByRole("button", { name: /Tableau/i });
    fireEvent.click(tableButton);

    // Should have table headers
    expect(screen.getByText("Prestation")).toBeInTheDocument();
    expect(screen.getByText("Catégorie")).toBeInTheDocument();
    expect(screen.getByText("Tarif Officiel")).toBeInTheDocument();
  });

  it("supports selecting an image via local file with preview and removal", async () => {
    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText("Voilage centré")).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle Prestation/i }));
    expect(screen.getByText("Ajouter une prestation au catalogue")).toBeInTheDocument();

    // Verify Local File mode is active by default
    expect(screen.getByText(/Glissez-déposez une photo ici/i)).toBeInTheDocument();

    // Mock FileReader in jsdom
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: 'data:image/png;base64,dGVzdA==', configurable: true });
      this.onload?.({} as ProgressEvent<FileReader>);
    });

    // Select a mock file
    const file = new File(["dummy image content"], "photo_test.png", { type: "image/png" });
    const fileInput = screen.getByLabelText("Sélectionner une photo locale");

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Verify preview and local file badge appear
    await waitFor(() => {
      expect(screen.getByText("📁 Fichier local")).toBeInTheDocument();
      expect(screen.getByText("photo_test.png")).toBeInTheDocument();
    });

    // Remove photo
    const removeBtn = screen.getByRole("button", { name: /Retirer/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText("photo_test.png")).not.toBeInTheDocument();
  });

  it("supports entering an external image URL with preview", async () => {
    render(<ServicesPage />);

    await waitFor(() => {
      expect(screen.getByText("Voilage centré")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Nouvelle Prestation/i }));

    // Switch to URL mode
    const urlTab = screen.getByRole("button", { name: /Lien URL/i });
    fireEvent.click(urlTab);

    // Enter URL
    const urlInput = screen.getByPlaceholderText(/https:\/\/... ou \/brand\/services\/voilage.jpg/i);
    fireEvent.change(urlInput, { target: { value: "https://example.com/sceno.jpg" } });

    // Verify URL badge and preview
    await waitFor(() => {
      expect(screen.getByText("🌐 URL web")).toBeInTheDocument();
    });
  });
});
