import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustomerDetailPage from './CustomerDetailPage';
import * as api from '../api';

const customer = (id: string, display_name: string, party_type: 'individual' | 'company', lifecycle_status: 'client' | 'prospect' = 'client') => ({
  id, display_name, party_type, lifecycle_status, email: `${id.toLowerCase()}@example.test`, phone: '', address: '', notes: '',
  is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null,
});

beforeEach(() => {
  vi.spyOn(api, 'getCustomer').mockImplementation(async (id: string) => {
    if (id === 'CUST-002') return customer(id, 'Rasoa Nomena', 'company');
    if (id === 'PROS-001') return customer(id, 'Jean Dupont', 'individual', 'prospect');
    return { ...customer('CUST-001', 'Ando Rakoto', 'individual'), email: 'ando.rakoto@email.mg' };
  });
  vi.spyOn(api, 'updateCustomer').mockImplementation(async (id, payload) => ({
    ...customer(id, payload.display_name ?? 'Ando Rakoto', 'individual'),
    email: payload.email ?? 'ando.rakoto@email.mg',
    phone: payload.phone ?? '', address: payload.address ?? '', notes: payload.notes ?? '',
  }));
});

describe('CustomerDetailPage', () => {
  it('1. Affiche un particulier (CUST-001) avec ses sections', async () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} canSensitiveWrite />);
    
    expect(await screen.findByText('Fiche client — Ando Rakoto')).toBeInTheDocument();
    expect(screen.getByText('Particulier')).toBeInTheDocument();
    
    // Check buttons
    expect(screen.getByText('Nouvelle réservation')).toBeInTheDocument();
    
    // Check fields
    expect(screen.getAllByText(/CIN \/ Passeport/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Raison sociale/i)).not.toBeInTheDocument();
  });

  it('2. Affiche une entreprise (CUST-002)', async () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="CUST-002" onNavigate={mockNavigate} />);
    
    expect(await screen.findByText('Entreprise')).toBeInTheDocument();
    
    // Check fields
    expect(screen.getAllByText(/Raison sociale/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NIF \/ STAT/i).length).toBeGreaterThan(0);
  });

  it('3. Affiche un prospect sans simuler une conversion persistée (PROS-001)', async () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="PROS-001" onNavigate={mockNavigate} />);
    
    expect(await screen.findByText('Fiche prospect — Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Prospect')).toBeInTheDocument();
    
    expect(screen.queryByText('Conversion en client')).not.toBeInTheDocument();
  });

  it('4. Modification du nom est persistée via l’API', async () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} canSensitiveWrite />);
    
    expect(await screen.findByText('Fiche client — Ando Rakoto')).toBeInTheDocument();
    const modifierBtns = screen.getAllByText('Modifier');
    fireEvent.click(modifierBtns[0]); // first section
    
    const inputs = screen.getAllByDisplayValue('Ando Rakoto');
    fireEvent.change(inputs[0], { target: { value: 'Ando Modifié' } });
    
    fireEvent.click(screen.getByText('Enregistrer'));
    
    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument();
  });

  it('5. Clic sur retour et nouvelle réservation', async () => {
    const mockNavigate = vi.fn();
    const mockBack = vi.fn();
    render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} onBack={mockBack} canSensitiveWrite />);
    
    expect(await screen.findByText('Fiche client — Ando Rakoto')).toBeInTheDocument();
    const retourBtn = screen.getByLabelText('Retour');
    fireEvent.click(retourBtn);
    expect(mockBack).toHaveBeenCalled();
    
    const resBtn = screen.getByText('Nouvelle réservation');
    fireEvent.click(resBtn);
    expect(mockNavigate).toHaveBeenCalledWith('reservation-new', 'CUST-001');
  });
});
