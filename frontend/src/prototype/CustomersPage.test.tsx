import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomersPage from './CustomersPage';

describe('CustomersPage', () => {
  it('1. Affiche la liste des clients et prospects par défaut', () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);
    expect(screen.getByText('Ando Rakoto')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument(); // Prospect
    expect(screen.getByText('Rasoa Nomena')).toBeInTheDocument(); // Entreprise
  });

  it('2. Recherche par nom', () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Rechercher nom/i);
    fireEvent.change(searchInput, { target: { value: 'Dupont' } });
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.queryByText('Ando Rakoto')).not.toBeInTheDocument();
  });

  it('3. Recherche par téléphone', () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Rechercher nom/i);
    fireEvent.change(searchInput, { target: { value: '345 67' } }); // Ando's phone
    expect(screen.getByText('Ando Rakoto')).toBeInTheDocument();
    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument();
  });

  it('4. Filtres prospects et entreprises', () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByText('Prospects'));
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.queryByText('Ando Rakoto')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Entreprises'));
    expect(screen.getByText('Rasoa Nomena')).toBeInTheDocument();
    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument();
  });

  it('5. Clic sur le nom ouvre la fiche', () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);
    
    // Click on name to navigate
    fireEvent.click(screen.getByText('Ando Rakoto'));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });
  
  it('6. Modal de création fonctionne pour client entreprise', () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Nouveau client'));
    
    expect(screen.getByText('Création Client')).toBeInTheDocument();
    
    // Choose entreprise
    const typeEntreprise = screen.getByText('Société, association, avec NIF/STAT.');
    fireEvent.click(typeEntreprise);
    fireEvent.click(screen.getByText('Continuer'));
    
    // Fill form (Step 2)
    fireEvent.change(screen.getByPlaceholderText("Nom de l'entreprise"), { target: { value: 'Nouvelle Entreprise SA' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 034 00 000 00'), { target: { value: '+261 34 00 000 00' } });
    fireEvent.click(screen.getByText('Continuer'));

    // Step 3
    fireEvent.click(screen.getByText('Continuer'));

    // Step 4
    fireEvent.click(screen.getByText('Continuer'));
    
    // Submit (Step 5)
    fireEvent.click(screen.getByText('Créer le client'));
    
    // Form should close and new element should appear in list
    expect(screen.queryByText('Création Client')).not.toBeInTheDocument();
    expect(screen.getByText('Nouvelle Entreprise SA')).toBeInTheDocument();
  });

  it('7. Demande commerciale prospect : pas de date/budget, gestion Indécis', () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByText('Nouveau prospect'));
    
    expect(screen.getByText('Création Prospect')).toBeInTheDocument();
    
    // Choose particulier
    fireEvent.click(screen.getByText('Particulier'));
    fireEvent.click(screen.getByText('Continuer'));
    
    // Fill form (Step 2)
    fireEvent.change(screen.getByPlaceholderText('Ex: Rakoto Jean'), { target: { value: 'Nouveau Prospect' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 034 00 000 00'), { target: { value: '+261 34 12 345 67' } });
    fireEvent.click(screen.getByText('Continuer'));

    // Step 3 - Demande commerciale
    expect(screen.getAllByText('Demande commerciale').length).toBeGreaterThan(0);
    
    // Check missing fields
    expect(screen.queryByText('Date souhaitée')).not.toBeInTheDocument();
    expect(screen.queryByText('Budget estimatif')).not.toBeInTheDocument();
    
    // Check choices
    expect(screen.getByDisplayValue('Proforma demandée')).toBeInTheDocument();
    expect(screen.getByText('Disponibilité demandée')).toBeInTheDocument();
    expect(screen.getByText('Visite demandée')).toBeInTheDocument();
    
    // Select Proforma demandée
    const typeSelect = screen.getByDisplayValue('Proforma demandée');
    fireEvent.change(typeSelect, { target: { value: 'Proforma demandée' } });
    
    // Indécis should not be present
    const domainSelect = screen.getByDisplayValue('Hahitantsoa');
    expect(screen.queryByText('Indécis')).not.toBeInTheDocument();
    
    // Change to Disponibilité demandée
    fireEvent.change(typeSelect, { target: { value: 'Disponibilité demandée' } });
    expect(screen.getByText('Indécis')).toBeInTheDocument();
  });
});
