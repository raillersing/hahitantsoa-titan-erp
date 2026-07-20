import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import ReservationNewPage from './prototype/ReservationNewPage';
import {
  getCustomers,
  getHahitantsoaVenues,
  getHahitantsoaServices,
  getReservationAvailableItemPreviews,
  createReservationDraft,
  createCustomer,
} from './api';

// ---- Shared mock data ----
const mockCustomersData = [
  {
    id: 'CUST-001',
    display_name: 'Ando Rakoto',
    party_type: 'individual',
    lifecycle_status: 'client',
    phone: '+261 34 00 000 01',
    email: 'ando@example.com',
    address: 'Lot 123 Ankorondrano',
    notes: '',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_deleted: false,
    deleted_at: null,
    created_by: null,
    updated_by: null,
  },
  {
    id: 'CUST-002',
    display_name: 'Rija Andria',
    party_type: 'individual',
    lifecycle_status: 'client',
    phone: '+261 34 00 000 02',
    email: 'rija@example.com',
    address: 'Lot 456 Analakely',
    notes: '',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_deleted: false,
    deleted_at: null,
    created_by: null,
    updated_by: null,
  },
];

const mockVenuesData = [
  {
    id: 'VEN-001',
    name: 'Salle des fêtes + jardin',
    type: 'location_event',
    capacity: 200,
    active: true,
    price: 1500000,
  },
];

const mockServicesData = [
  {
    id: 'SRV-001',
    name: 'Traiteur',
    desc: 'Service de restauration pour vos événements',
    price: 500000,
    active: true,
  },
  {
    id: 'SRV-002',
    name: 'Décoration',
    desc: 'Service de décoration événementielle',
    price: 300000,
    active: true,
  },
];

const mockCatalogData = [
  {
    inventory_item_id: 'MAT-01',
    inventory_item_name: 'Chaise Napoléon transparente',
    inventory_item_kind: 'material',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-02',
    inventory_item_name: 'Table rectangulaire',
    inventory_item_kind: 'material',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-04',
    inventory_item_name: 'Sonorisation',
    inventory_item_kind: 'article',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-05',
    inventory_item_name: 'Chaise Chiavari',
    inventory_item_kind: 'material',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-06',
    inventory_item_name: 'Éclairage LED',
    inventory_item_kind: 'article',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
];

// ---- Mock API ----
vi.mock('./api', () => ({
  getCustomers: vi.fn(),
  getHahitantsoaVenues: vi.fn(),
  getHahitantsoaServices: vi.fn(),
  getReservationAvailableItemPreviews: vi.fn(),
  createReservationDraft: vi.fn(),
  createCustomer: vi.fn(),
}));

describe('ReservationNewPage', () => {
  let mockNavigate: any;

  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    localStorage.clear();

    // Apply mock implementations before each test
    vi.mocked(getCustomers).mockResolvedValue(mockCustomersData as any);
    vi.mocked(getHahitantsoaVenues).mockResolvedValue(mockVenuesData as any);
    vi.mocked(getHahitantsoaServices).mockResolvedValue(mockServicesData as any);
    vi.mocked(getReservationAvailableItemPreviews).mockResolvedValue(mockCatalogData as any);
    vi.mocked(createReservationDraft).mockResolvedValue({ id: 'DRAFT-001', status: 'draft' } as any);
    vi.mocked(createCustomer).mockResolvedValue({ id: 'CUST-NEW', display_name: 'New Client' } as any);
  });

  afterEach(() => {
    expect(window.alert).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('1. la première étape affiche les deux chemins si pas de param', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Comment voulez-vous commencer ?')).toBeInTheDocument();
    });
    expect(screen.getByText('Commencer par le client')).toBeInTheDocument();
    expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
  });

  it('2. parcours "client d\'abord" fonctionne jusqu\'au résumé', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Comment voulez-vous commencer ?')).toBeInTheDocument();
    });

    // Step 0
    fireEvent.click(screen.getByText('Commencer par le client'));

    // Step 1: Client
    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Step 2: Domain
    await waitFor(() => {
      expect(screen.getByText('Hahitantsoa')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    // Step 3: Details
    await waitFor(() => {
      expect(screen.getByText('Suivant (Services)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Suivant (Services)'));

    // Step 5: Services (Hahitantsoa) (skipped catalogue)
    await waitFor(() => {
      expect(screen.getByText('Services Hahitantsoa')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // Step 6: Summary
    await waitFor(() => {
      expect(screen.getByText('Résumé modifiable', { exact: false })).toBeInTheDocument();
    });
    expect(screen.getByText('Ando Rakoto')).toBeInTheDocument();
  });

  it('3. Titan n\'affiche pas de champs événementiels mais propose la livraison', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Details Titan
    await waitFor(() => {
      expect(screen.getByText('Détails Location (Titan)')).toBeInTheDocument();
    });
    expect(screen.queryByText("Type d'événement")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Aller au catalogue'));

    // Catalogue
    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    // Livraison Titan
    await waitFor(() => {
      expect(screen.getByText('Option Livraison (Titan)')).toBeInTheDocument();
    });
    const deliveryInput = screen.getByPlaceholderText('Ex: 50000');
    fireEvent.change(deliveryInput, { target: { value: '100000' } });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // Summary Titan
    await waitFor(() => {
      expect(screen.getAllByText(/100\s*000\s*Ar/)[0]).toBeInTheDocument();
    });
  });

  it('4. Hahitantsoa propose les services', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Suivant (Services)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Suivant (Services)'));

    expect(screen.getByText('Services Hahitantsoa')).toBeInTheDocument();
  });

  it('5. La finalisation montre le proforma puis le paiement puis le contrat', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    // Fast path to Proforma
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Aller au catalogue')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller au catalogue'));

    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // In summary
    await waitFor(() => {
      expect(screen.getByText('Générer Devis/Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Générer Devis/Proforma'));

    // Proforma preview
    await waitFor(() => {
      expect(screen.getByText('Aperçu Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Passer au paiement'));

    // Payment step
    await waitFor(() => {
      expect(screen.getByText('Acompte / Paiement')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Valider paiement et Aperçu Contrat'));

    // Contract preview
    await waitFor(() => {
      expect(screen.getByText('Aperçu Contrat')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Valider et Clôturer le Dossier'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('dashboard');
    });
  });

  it('6. la catégorie Photo a été retirée', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Comment voulez-vous commencer ?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le client'));

    // Check attachment UI
    await waitFor(() => {
      expect(screen.getByText('Pièces jointes client')).toBeInTheDocument();
    });
    expect(screen.getByRole('option', { name: 'CIN' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Photo' })).not.toBeInTheDocument();
  });

  it('7. Le catalogue permet d\'ajouter un matériel au tableau', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Aller au catalogue')).toBeInTheDocument();
    });
    // Set dates so the catalog availability API is triggered
    const dateInputs7 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'date');
    const timeInputs7 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'time');
    if (dateInputs7.length >= 2) {
      fireEvent.change(dateInputs7[0], { target: { value: '2026-08-01' } });
      fireEvent.change(dateInputs7[1], { target: { value: '2026-08-02' } });
    }
    if (timeInputs7.length >= 2) {
      fireEvent.change(timeInputs7[0], { target: { value: '08:00' } });
      fireEvent.change(timeInputs7[1], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByText('Aller au catalogue'));

    // Enter quantity in catalogue
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText('0');
      expect(inputs.length).toBeGreaterThan(0);
    });
    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(inputs[0], { target: { value: '5' } }); // Chaise

    fireEvent.click(screen.getByText('Aller à la Livraison')); // to livraison
    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé')); // to summary

    // Check table in summary
    await waitFor(() => {
      expect(screen.getByText('Matériels sélectionnés')).toBeInTheDocument();
    });
    expect(screen.getByText('Chaise Napoléon transparente')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Qté
  });

  it('8. Le stepper permet de naviguer entre les étapes', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Commencer par le client')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le client'));

    // Verify step 1 shows client selection
    await waitFor(() => {
      expect(screen.getByText('Sélection ou création du client')).toBeInTheDocument();
    });
  });

  it('9. Le wizard et résumé Titan affichent les bons champs géographiques', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Check wizard labels
    await waitFor(() => {
      expect(screen.getByText("Type d'usage")).toBeInTheDocument();
    });
    expect(screen.getByText('Nom du lieu')).toBeInTheDocument();
    expect(screen.getByText('Adresse complète')).toBeInTheDocument();
    expect(screen.getByText('Commune / Ville')).toBeInTheDocument();
    expect(screen.getByText('Contact sur place')).toBeInTheDocument();
    expect(screen.getByText('Téléphone contact')).toBeInTheDocument();
    expect(screen.getByText('Latitude')).toBeInTheDocument();
    expect(screen.getByText('Longitude')).toBeInTheDocument();

    // Fill the fields
    const venueNameInput = screen.getByPlaceholderText('Ex: Espace Fitiavana, Villa privée, Salle communale, Domicile client');
    fireEvent.change(venueNameInput, { target: { value: 'Villa Privée' } });

    fireEvent.change(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao'), { target: { value: 'Lot 123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Antananarivo'), { target: { value: 'Tana' } });

    // GPS
    fireEvent.change(screen.getByPlaceholderText('Ex: -18.8792'), { target: { value: '-18.0' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 47.5079'), { target: { value: '47.0' } });

    fireEvent.click(screen.getByText('Aller au catalogue'));

    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // In summary
    await waitFor(() => {
      expect(screen.getByText('Résumé modifiable')).toBeInTheDocument();
    });
    expect(screen.getByText('Mariage')).toBeInTheDocument(); // default usage type
    expect(screen.getByText(/Villa Privée/)).toBeInTheDocument();
    expect(screen.getByText('Lot 123 - Tana')).toBeInTheDocument();

    const gpsLink = screen.getByText('Ouvrir dans Google Maps (GPS)');
    expect(gpsLink).toBeInTheDocument();
    expect(gpsLink.closest('a')).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=-18.0,47.0');
  });

  it('10. Le résumé Titan utilise l\'adresse si pas de GPS', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-002')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-002'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao'), { target: { value: 'Lot 123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Antananarivo'), { target: { value: 'Tana' } });

    fireEvent.click(screen.getByText('Aller au catalogue'));

    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    await waitFor(() => {
      expect(screen.getByText('Ouvrir dans Google Maps (Adresse)')).toBeInTheDocument();
    });
    const addressLink = screen.getByText('Ouvrir dans Google Maps (Adresse)');
    expect(addressLink.closest('a')).toHaveAttribute('href', expect.stringContaining('Lot%20123%2C%20Tana'));
  });

  it('11. Clamp quantite: catalogue depassement est ramene au max et les inputs ont min max step', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /Aller au catalogue/i})).toBeInTheDocument();
    });
    // Set dates so the catalog availability API is triggered
    const dateInputs11 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'date');
    const timeInputs11 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'time');
    if (dateInputs11.length >= 2) {
      fireEvent.change(dateInputs11[0], { target: { value: '2026-08-01' } });
      fireEvent.change(dateInputs11[1], { target: { value: '2026-08-02' } });
    }
    if (timeInputs11.length >= 2) {
      fireEvent.change(timeInputs11[0], { target: { value: '08:00' } });
      fireEvent.change(timeInputs11[1], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByRole('button', {name: /Aller au catalogue/i}));

    const inputs = await screen.findAllByPlaceholderText('0');
    expect(inputs[0]).toHaveAttribute('type', 'number');
    expect(inputs[0]).toHaveAttribute('min', '0');
    // mapPreviewToCatalogItem hardcodes available: 999
    expect(inputs[0]).toHaveAttribute('max', '999');

    // Type > max (mapPreviewToCatalogItem hardcodes available: 999)
    fireEvent.change(inputs[0], { target: { value: '1500' } });
    expect(inputs[0]).toHaveValue(999);
    expect(screen.getByText('Maximum disponible : 999')).toBeInTheDocument();

    // Type < 0
    fireEvent.change(inputs[0], { target: { value: '-10' } });
    expect(inputs[0]).toHaveValue(0);
  });

  it('12. Package Hahitantsoa quantite ne depasse pas le disponible', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    // We are on details step. Click Location avec package
    await waitFor(() => {
      expect(screen.getByText('Location avec package')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Location avec package'));

    // Now the next button says "Aller au catalogue / package"
    // Set dates so the catalog availability API is triggered
    const dateInputs12 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'date');
    const timeInputs12 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'time');
    if (dateInputs12.length >= 2) {
      fireEvent.change(dateInputs12[0], { target: { value: '2026-08-01' } });
      fireEvent.change(dateInputs12[1], { target: { value: '2026-08-02' } });
    }
    if (timeInputs12.length >= 2) {
      fireEvent.change(timeInputs12[0], { target: { value: '08:00' } });
      fireEvent.change(timeInputs12[1], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByText(/Aller au catalogue/i));

    // Choose package 1
    await waitFor(() => {
      expect(screen.getByText(/Package Standard 100 pax/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Package Standard 100 pax/i));

    // Adjust package
    fireEvent.click(screen.getByText('Ajuster package'));

    const inputs = screen.getAllByPlaceholderText('0'); // articles inside package
    // mapPreviewToCatalogItem hardcodes available: 999
    fireEvent.change(inputs[0], { target: { value: '1500' } });
    expect(inputs[0]).toHaveValue(999);
    expect(screen.getByText('Maximum disponible : 999')).toBeInTheDocument();
  });

  it('13. Affiche l\'écran de neutralisation pour quote/CUST-001', async () => {
    vi.useFakeTimers();
    render(<ReservationNewPage onNavigate={mockNavigate} param="quote/CUST-001" />);
    // The component uses setTimeout(() => onNavigate('customer', clientId), 0)
    // With fake timers, we need to advance timers for the setTimeout to fire
    await vi.advanceTimersByTimeAsync(0);
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
    vi.useRealTimers();
  });

  it('14. Affiche le breadcrumb contextuel et évite l\'écran initial pour CUST-001', async () => {
    localStorage.clear();
    render(<ReservationNewPage onNavigate={mockNavigate} param="CUST-001" />);

    await waitFor(() => {
      expect(screen.getByText(/Clients & Prospects/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Choix du volet métier/)).toBeInTheDocument();
    expect(screen.queryByText(/Comment voulez-vous commencer \?/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Retour à la fiche Ando Rakoto/).length).toBeGreaterThan(0);
    });
    const btnRetour = screen.getAllByText(/Retour à la fiche Ando Rakoto/)[0];
    fireEvent.click(btnRetour);
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });
});
