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

  it('8. crée un client via l’API et ouvre sa fiche', async () => {
    const mockNavigate = vi.fn();
    const created = { ...API_CUSTOMERS[0], id: 'CUST-099', display_name: 'Client Persisté' };
    vi.spyOn(api, 'createCustomer').mockResolvedValue(created);
    render(<CustomersPage onNavigate={mockNavigate} canSensitiveWrite />);
    await screen.findByText('Ando Rakoto');
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau client' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Rakoto Jean'), { target: { value: 'Client Persisté' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.queryByPlaceholderText('NIF')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('STAT')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('RCS')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer le client' }));
    expect(await screen.findByText('Ando Rakoto')).toBeInTheDocument();
    expect(api.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      display_name: 'Client Persisté',
      party_type: 'individual',
      nif: '',
      stat: '',
      rcs: '',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-099');
  });

  it('9. affiche les champs et boutons légaux uniquement pour une entreprise', async () => {
    render(<CustomersPage onNavigate={vi.fn()} canSensitiveWrite />);
    await screen.findByText('Ando Rakoto');
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau client' }));
    fireEvent.click(screen.getByText('Entreprise'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByPlaceholderText("Nom de l'entreprise"), { target: { value: 'Entreprise Test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByPlaceholderText('NIF')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('STAT')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('RCS')).toBeInTheDocument();
    expect(screen.getByLabelText('Ajouter une pièce jointe pour NIF')).toBeInTheDocument();
    expect(screen.getByLabelText('Ajouter une pièce jointe pour STAT')).toBeInTheDocument();
    expect(screen.getByLabelText('Ajouter une pièce jointe pour RCS')).toBeInTheDocument();
    const nifFile = new File(['nif'], 'nif.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Ajouter une pièce jointe pour NIF'), { target: { files: [nifFile] } });
    expect(screen.getByAltText('Aperçu NIF')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    const categories = Array.from((screen.getByPlaceholderText('Intitulé de la pièce').parentElement?.querySelector('select') as HTMLSelectElement).options).map(option => option.value);
    expect(categories).not.toContain('CIN');
    expect(categories).not.toContain('Passeport');
    expect(categories).not.toContain('NIF');
    expect(categories).not.toContain('STAT');
    expect(categories).not.toContain('RCS');
  });

  it('10. persiste tous les contacts fournis avec un principal par type', async () => {
    const created = { ...API_CUSTOMERS[0], id: 'CUST-100', display_name: 'Contacts multiples' };
    vi.spyOn(api, 'createCustomer').mockResolvedValue(created);
    render(<CustomersPage onNavigate={vi.fn()} canSensitiveWrite />);
    await screen.findByText('Ando Rakoto');
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau client' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Rakoto Jean'), { target: { value: 'Contacts multiples' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 034 00 000 00'), { target: { value: '0340000000' } });
    fireEvent.change(screen.getByPlaceholderText('contact@email.com'), { target: { value: 'principal@exemple.mg' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Téléphone' }));
    fireEvent.click(screen.getByRole('button', { name: '+ E-mail' }));
    fireEvent.change(screen.getByLabelText('Téléphone supplémentaire'), { target: { value: '0320000000' } });
    fireEvent.change(screen.getByLabelText('E-mail supplémentaire'), { target: { value: 'logistique@exemple.mg' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Principal' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer le client' }));

    await screen.findByText('Ando Rakoto');
    expect(api.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      contact_points: expect.arrayContaining([
        expect.objectContaining({ kind: 'phone', value: '0340000000', is_primary: true }),
        expect.objectContaining({ kind: 'phone', value: '0320000000' }),
        expect.objectContaining({ kind: 'email', value: 'principal@exemple.mg', is_primary: false }),
        expect.objectContaining({ kind: 'email', value: 'logistique@exemple.mg', is_primary: true }),
      ]),
    }));
  });
});
