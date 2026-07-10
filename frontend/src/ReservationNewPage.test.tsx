import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import ReservationNewPage from './prototype/ReservationNewPage';

describe('ReservationNewPage', () => {
  let mockNavigate: any;

  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.spyOn(window, 'alert').mockImplementation(() => {}); vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    expect(window.alert).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('1. la première étape affiche les deux chemins si pas de param', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    expect(screen.getByText('Comment voulez-vous commencer ?')).toBeInTheDocument();
    expect(screen.getByText('Commencer par le client')).toBeInTheDocument();
    expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
  });

  it('2. parcours "client d\'abord" fonctionne jusqu\'au résumé', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    
    // Step 0
    fireEvent.click(screen.getByText('Commencer par le client'));
    
    // Step 1: Client
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Step 2: Domain
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    // Step 3: Details
    fireEvent.click(screen.getByText('Suivant (Services)'));

    // Step 5: Services (Hahitantsoa) (skipped catalogue)
    expect(screen.getByText('Services Hahitantsoa')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // Step 6: Summary
    expect(screen.getByText('Résumé modifiable', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Ando Rakoto')).toBeInTheDocument();
  });

  it('3. Titan n\'affiche pas de champs événementiels mais propose la livraison', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Details Titan
    expect(screen.getByText('Détails Location (Titan)')).toBeInTheDocument();
    expect(screen.queryByText("Type d'événement")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Aller au catalogue'));

    // Catalogue
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    // Livraison Titan
    expect(screen.getByText('Option Livraison (Titan)')).toBeInTheDocument();
    const deliveryInput = screen.getByPlaceholderText('Ex: 50000');
    fireEvent.change(deliveryInput, { target: { value: '100000' } });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // Summary Titan
    expect(screen.getAllByText(/100\s*000\s*Ar/)[0]).toBeInTheDocument(); // Delivery fee shown
  });

  it('4. Hahitantsoa propose les services', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    fireEvent.click(screen.getByText('Suivant (Services)'));

    expect(screen.getByText('Services Hahitantsoa')).toBeInTheDocument();
  });

  it('5. La finalisation montre le proforma puis le paiement puis le contrat', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    // Fast path to Proforma
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByText('Aller au catalogue'));
    fireEvent.click(screen.getByText('Aller à la Livraison'));
    fireEvent.click(screen.getByText('Vérifier le résumé'));
    
    // In summary
    fireEvent.click(screen.getByText('Générer Devis/Proforma'));
    
    // Proforma preview
    expect(screen.getByText('Aperçu Proforma')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Passer au paiement'));

    // Payment step
    expect(screen.getByText('Acompte / Paiement (Mock)')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Valider paiement et Aperçu Contrat'));

    // Contract preview
    expect(screen.getByText('Aperçu Contrat')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Valider et Clôturer le Dossier'));

    expect(mockNavigate).toHaveBeenCalledWith('dashboard');
  });

  it('6. la catégorie Photo a été retirée', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le client'));
    
    // Check attachment UI
    expect(screen.getByText('Pièces jointes client')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CIN' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Photo' })).not.toBeInTheDocument();
  });

  it('7. Le catalogue permet d\'ajouter un matériel au tableau', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByText('Aller au catalogue'));

    // Enter quantity in catalogue
    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(inputs[0], { target: { value: '5' } }); // Chaise
    
    fireEvent.click(screen.getByText('Aller à la Livraison')); // to livraison
    fireEvent.click(screen.getByText('Vérifier le résumé')); // to summary

    // Check table in summary
    expect(screen.getByText('Matériels sélectionnés')).toBeInTheDocument();
    expect(screen.getByText('Chaise Napoléon transparente')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Qté
  });

  it('8. Le stepper permet de revenir à une étape atteinte', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le client')); // step 1
    
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer')); // step 2

    // At step 2, click on stepper to go to step 1
    fireEvent.click(screen.getByText('Client'));
    expect(screen.getByText('Sélection ou création du client')).toBeInTheDocument();

    // Now click on stepper to go forward to step 2 since we already reached it
    fireEvent.click(screen.getByText('Volet'));
    expect(screen.getByText('Choix du volet métier')).toBeInTheDocument();
  });

  it('9. Le wizard et résumé Titan affichent les bons champs géographiques', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Check wizard labels
    expect(screen.getByText("Type d'usage")).toBeInTheDocument();
    expect(screen.getByText('Nom du lieu')).toBeInTheDocument();
    expect(screen.getByText('Adresse complète')).toBeInTheDocument();
    expect(screen.getByText('Commune / Ville')).toBeInTheDocument();
    expect(screen.getByText('Contact sur place')).toBeInTheDocument();
    expect(screen.getByText('Téléphone contact')).toBeInTheDocument();
    expect(screen.getByText('Latitude')).toBeInTheDocument();
    expect(screen.getByText('Longitude')).toBeInTheDocument();

    // Fill the fields
    // Default is Mariage, let's change to Anniversaire (Wait, since there's no label htmlFor, select has no explicit text binding but we can query by Display Value or Role if needed. Since we just check it exists, it's fine. We'll change destinationName)
    const venueNameInput = screen.getByPlaceholderText('Ex: Espace Fitiavana, Villa privée, Salle communale, Domicile client');
    fireEvent.change(venueNameInput, { target: { value: 'Villa Privée' } });
    
    fireEvent.change(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao'), { target: { value: 'Lot 123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Antananarivo'), { target: { value: 'Tana' } });
    
    // GPS
    fireEvent.change(screen.getByPlaceholderText('Ex: -18.8792'), { target: { value: '-18.0' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 47.5079'), { target: { value: '47.0' } });

    fireEvent.click(screen.getByText('Aller au catalogue'));
    fireEvent.click(screen.getByText('Aller à la Livraison'));
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // In summary
    expect(screen.getByText('Mariage')).toBeInTheDocument(); // default usage type
    expect(screen.getByText(/Villa Privée/)).toBeInTheDocument();
    expect(screen.getByText('Lot 123 - Tana')).toBeInTheDocument();
    
    const gpsLink = screen.getByText('Ouvrir dans Google Maps (GPS)');
    expect(gpsLink).toBeInTheDocument();
    expect(gpsLink.closest('a')).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=-18.0,47.0');
  });

  it('10. Le résumé Titan utilise l\'adresse si pas de GPS', () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByTestId('client-select-CUST-002')); // Use an existing test client instead of combobox
    fireEvent.click(screen.getByText('Continuer'));

    fireEvent.change(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao'), { target: { value: 'Lot 123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Antananarivo'), { target: { value: 'Tana' } });
    
    fireEvent.click(screen.getByText('Aller au catalogue'));
    fireEvent.click(screen.getByText('Aller à la Livraison'));
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    const addressLink = screen.getByText('Ouvrir dans Google Maps (Adresse)');
    expect(addressLink).toBeInTheDocument();
    expect(addressLink.closest('a')).toHaveAttribute('href', expect.stringContaining('Lot%20123%2C%20Tana'));
  });

  it('11. Clamp quantite: catalogue depassement est ramene au max et les inputs ont min max step', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));
    fireEvent.click(screen.getByRole('button', {name: /Aller au catalogue/i}));

    const inputs = await screen.findAllByPlaceholderText('0');
    expect(inputs[0]).toHaveAttribute('type', 'number');
    expect(inputs[0]).toHaveAttribute('min', '0');
    expect(inputs[0]).toHaveAttribute('max', '150'); // chaise napoleon 150 dispo

    // Type > max
    fireEvent.change(inputs[0], { target: { value: '600' } });
    expect(inputs[0]).toHaveValue(150);
    expect(screen.getByText('Maximum disponible : 150')).toBeInTheDocument();

    // Type < 0
    fireEvent.change(inputs[0], { target: { value: '-10' } });
    expect(inputs[0]).toHaveValue(0);
  });

  it('12. Package Hahitantsoa quantite ne depasse pas le disponible', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));
    
    // We are on details step. Click Location avec package
    fireEvent.click(screen.getByText('Location avec package'));
    
    // Now the next button says "Aller au catalogue / package"
    fireEvent.click(screen.getByRole('button', {name: /Aller au catalogue \/ package/i}));

    // Choose package 1
    fireEvent.click(screen.getByText(/Package Standard 100 pax/i));
    
    // Adjust package
    fireEvent.click(screen.getByText('Ajuster package'));
    
    const inputs = screen.getAllByPlaceholderText('0'); // articles inside package
    // For chaise in Pack Standard, available is 150 (since it uses MAT-01 which has 150)
    // The clamp checks available (150).
    fireEvent.change(inputs[0], { target: { value: '600' } });
    expect(inputs[0]).toHaveValue(150);
    expect(screen.getByText('Maximum disponible : 150')).toBeInTheDocument();
  });

  it('13. Affiche l\'écran de neutralisation pour quote/CUST-001', () => {
    vi.useFakeTimers();
    render(<ReservationNewPage onNavigate={mockNavigate} param="quote/CUST-001" />);
    vi.runAllTimers();
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
    vi.useRealTimers();
  });

  it('14. Affiche le breadcrumb contextuel et évite l\'écran initial pour CUST-001', () => {
    localStorage.clear();
    render(<ReservationNewPage onNavigate={mockNavigate} param="CUST-001" />);
    expect(screen.getByText(/Clients & Prospects/)).toBeInTheDocument();
    expect(screen.getByText(/Choix du volet métier/)).toBeInTheDocument();
    expect(screen.queryByText(/Comment voulez-vous commencer \?/)).not.toBeInTheDocument();

    const btnRetour = screen.getAllByText(/Retour à la fiche Ando Rakoto/)[0];
    fireEvent.click(btnRetour);
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });
});
