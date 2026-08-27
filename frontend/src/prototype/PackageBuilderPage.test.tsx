import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PackageBuilderPage from './PackageBuilderPage';
import type { MaterialPackage, InventoryItem } from '../types';

// Mock data
const mockPackages: MaterialPackage[] = [
  {
    id: '1',
    name: 'Package Standard 100 pax',
    description: 'Pack complet pour 100 personnes',
    price: 500000,
    image_url: '',
    is_active: true,
    lines: [
      {
        id: 'line-1',
        inventory_item: 'inv-1',
        inventory_item_name: 'Chaises pliantes',
        quantity: 100,
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Package VIP',
    description: 'Pack premium pour événements',
    price: 1000000,
    image_url: 'https://images.unsplash.com/photo-vip',
    is_active: false,
    lines: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockCatalog: InventoryItem[] = [
  { id: 'inv-1', name: 'Chaises pliantes', kind: 'material', description: 'Chaises', rental_price: '6000.00' },
  { id: 'inv-2', name: 'Tables rondes', kind: 'material', description: 'Tables', rental_price: '25000.00' },
  { id: 'inv-3', name: 'Nappes blanches', kind: 'article', description: 'Nappes', rental_price: '10000.00' },
];

// Mock API functions
const mockGetMaterialPackages = vi.fn().mockResolvedValue(mockPackages);
const mockGetInventoryItems = vi.fn().mockResolvedValue(mockCatalog);
const mockCreateMaterialPackage = vi.fn().mockImplementation((payload: any) => {
  return Promise.resolve({
    id: 'new-id',
    ...payload,
    lines: payload.lines || [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  });
});
const mockUpdateMaterialPackage = vi.fn().mockImplementation((id: string, payload: any) => {
  const existing = mockPackages.find((p) => p.id === id) || mockPackages[0];
  return Promise.resolve({ ...existing, ...payload });
});
const mockDeleteMaterialPackage = vi.fn().mockResolvedValue(undefined);

vi.mock('../api', () => ({
  getMaterialPackages: (...args: any[]) => mockGetMaterialPackages(...args),
  createMaterialPackage: (...args: any[]) => mockCreateMaterialPackage(...args),
  updateMaterialPackage: (...args: any[]) => mockUpdateMaterialPackage(...args),
  deleteMaterialPackage: (...args: any[]) => mockDeleteMaterialPackage(...args),
  getInventoryItems: (...args: any[]) => mockGetInventoryItems(...args),
}));

describe('PackageBuilderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMaterialPackages.mockResolvedValue(mockPackages);
    mockGetInventoryItems.mockResolvedValue(mockCatalog);
    window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
  });

  it('1. Affiche le nom du pack complet en vue Grille et Détails', async () => {
    render(<PackageBuilderPage />);

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Chargement des packages…')).not.toBeInTheDocument();
    });

    // Switch to grid view
    const grilleBtn = screen.getByRole('button', { name: /Grille/i });
    fireEvent.click(grilleBtn);
    expect(screen.getByText('Package Standard 100 pax')).toBeInTheDocument();

    // Switch to details
    const detailsBtn = screen.getByRole('button', { name: /Détails/i });
    fireEvent.click(detailsBtn);

    // Click on the package in the list to select it
    const packInList = screen.getAllByText('Package Standard 100 pax')[0];
    fireEvent.click(packInList);

    // Détails: should show the full name in the list item
    const listItems = screen.getAllByText('Package Standard 100 pax');
    expect(listItems.length).toBeGreaterThan(0);

    const titleElement = listItems[0];
    expect(titleElement.className).not.toContain('line-clamp-2');
    expect(titleElement.className).toContain('whitespace-normal');
  });

  it("2. Le formulaire contient un champ de fichier local pour l'image", async () => {
    render(<PackageBuilderPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement des packages…')).not.toBeInTheDocument();
    });

    // Open creation modal
    fireEvent.click(screen.getByRole('button', { name: /Nouveau Pack/i }));
    expect(screen.getByText('Créer un nouveau Pack Commercial')).toBeInTheDocument();

    // Verify local file dropzone and file input exist
    expect(screen.getByText(/Cliquez ou glissez une photo du pack ici/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Sélectionner une photo locale dans la modale')).toBeInTheDocument();
  });

  it("3. La sélection d'un fichier local met à jour l'image du pack avec prévisualisation et badge", async () => {
    render(<PackageBuilderPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement des packages…')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Nouveau Pack/i }));

    // Mock FileReader
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: 'data:image/png;base64,mockPackImageData', configurable: true });
      this.onload?.({} as ProgressEvent<FileReader>);
    });

    const file = new File(['mock content'], 'pack_photo.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Sélectionner une photo locale dans la modale');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('📁 Fichier local')).toBeInTheDocument();
      expect(screen.getByText('pack_photo.png')).toBeInTheDocument();
    });
  });

  it("4. Retirer l'image fonctionne", async () => {
    render(<PackageBuilderPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement des packages…')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Nouveau Pack/i }));

    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      Object.defineProperty(this, 'result', { value: 'data:image/png;base64,mockPackImageData', configurable: true });
      this.onload?.({} as ProgressEvent<FileReader>);
    });

    const file = new File(['mock content'], 'pack_photo.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Sélectionner une photo locale dans la modale');
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('pack_photo.png')).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole('button', { name: /^Retirer$/i });
    fireEvent.click(removeBtn);
    expect(screen.queryByText('pack_photo.png')).not.toBeInTheDocument();
  });

  it('5. Ajouter du matériel ouvre la modale', async () => {
    render(<PackageBuilderPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement des packages…')).not.toBeInTheDocument();
    });

    // Select a pack in list
    fireEvent.click(screen.getAllByText('Package Standard 100 pax')[0]);

    const addMatBtn = screen.getAllByText(/Ajouter du matériel/i)[0];
    fireEvent.click(addMatBtn);

    expect(screen.getByText('Ajouter du matériel au pack')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Rechercher par nom d'article/i)).toBeInTheDocument();
  });

  it("6. Calcule et affiche la valeur commerciale au détail et l'avantage client", async () => {
    render(<PackageBuilderPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement des packages…')).not.toBeInTheDocument();
    });

    // Package Standard 100 pax has 100 chaises @ 6 000 Ar = 600 000 Ar retail, price = 500 000 Ar -> savings = 100 000 Ar (17%)
    expect(screen.getByText('Analyse de la Valeur Commerciale')).toBeInTheDocument();
    expect(screen.getAllByText(/600\s?000\s?Ar/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/-100\s?000\s?Ar/i)).toBeInTheDocument();
  });

  it('7. Dupliquer un pack appelle createMaterialPackage avec mention (Copie)', async () => {
    render(<PackageBuilderPage />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement des packages…')).not.toBeInTheDocument();
    });

    const duplicateButtons = screen.getAllByRole('button', { name: /Dupliquer/i });
    fireEvent.click(duplicateButtons[0]);

    await waitFor(() => {
      expect(mockCreateMaterialPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Package Standard 100 pax (Copie)',
        }),
      );
    });
  });
});
