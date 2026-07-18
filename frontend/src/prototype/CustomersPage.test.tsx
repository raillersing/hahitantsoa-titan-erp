import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustomersPage from './CustomersPage';
import * as api from '../api';
import type { Customer } from '../types';

const API_CUSTOMERS: Customer[] = [
  { id: 'CUST-001', display_name: 'Ando Rakoto', lifecycle_status: 'client', party_type: 'individual', email: 'ando.rakoto@email.mg', phone: '+261 34 12 345 67', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null },
  { id: 'CUST-002', display_name: 'Rasoa Nomena', lifecycle_status: 'client', party_type: 'company', email: 'rasoa.nomena@entreprise.mg', phone: '+261 32 98 765 43', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null },
  { id: 'PROS-001', display_name: 'Jean Dupont', lifecycle_status: 'prospect', party_type: 'individual', email: 'jean.dupont@test.com', phone: '+261 34 00 111 22', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null },
];

beforeEach(() => {
  vi.spyOn(api, 'getCustomers').mockResolvedValue(API_CUSTOMERS);
});

describe('CustomersPage', () => {
  it('1. Affiche la liste des clients et prospects par défaut', async () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);
    expect(await screen.findByText('Ando Rakoto')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Rasoa Nomena')).toBeInTheDocument();
  });

  it('2. Recherche par nom', async () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Rechercher nom/i);
    fireEvent.change(searchInput, { target: { value: 'Dupont' } });
    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.queryByText('Ando Rakoto')).not.toBeInTheDocument();
  });

  it('3. Recherche par téléphone', async () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/Rechercher nom/i);
    fireEvent.change(searchInput, { target: { value: '345 67' } }); // Ando's phone
    expect(await screen.findByText('Ando Rakoto')).toBeInTheDocument();
    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument();
  });

  it('4. Filtres prospects et entreprises', async () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    await screen.findByText('Ando Rakoto');
    fireEvent.click(screen.getByText('Prospects'));
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.queryByText('Ando Rakoto')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Entreprises'));
    expect(screen.getByText('Rasoa Nomena')).toBeInTheDocument();
    expect(screen.queryByText('Jean Dupont')).not.toBeInTheDocument();
  });

  it('5. Clic sur le nom ouvre la fiche', async () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);
    
    // Click on name to navigate
    fireEvent.click(await screen.findByText('Ando Rakoto'));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });
  
  it('6. indique explicitement que les écritures sont différées', async () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    expect(await screen.findByText('Ando Rakoto')).toBeInTheDocument();
    expect(screen.getByText('Lecture seule')).toBeInTheDocument();
    expect(screen.queryByText('Nouveau client')).not.toBeInTheDocument();
  });

  it('7. expose le statut prospect issu du backend', async () => {
    render(<CustomersPage onNavigate={vi.fn()} />);
    expect(await screen.findByText('Jean Dupont')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Prospects'));
    expect(screen.getByText('Prospect')).toBeInTheDocument();
  });
});
