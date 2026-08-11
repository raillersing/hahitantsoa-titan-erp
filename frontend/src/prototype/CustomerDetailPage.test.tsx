import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CustomerDetailPage from './CustomerDetailPage';
import * as api from '../api';

const customer = (id: string, display_name: string, party_type: 'individual' | 'company', lifecycle_status: 'client' | 'prospect' = 'client') => ({
  id, public_reference: `CLI-${id}`, display_name, party_type, lifecycle_status, email: `${id.toLowerCase()}@example.test`, phone: '', address: '', notes: '',
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
  vi.spyOn(api, 'getCustomerAttachments').mockResolvedValue([]);
  vi.spyOn(api, 'getCustomerTimeline').mockResolvedValue([]);
  vi.spyOn(api, 'uploadAttachment').mockResolvedValue({
    id: 'ATT-001', customer_id: 'CUST-001', customer_reference: 'CLI-CUST-001', reservation_draft_id: null,
    hahitantsoa_event_draft_id: null, category: 'CIN', original_name: 'cin.pdf',
    content_type: 'application/pdf', size_bytes: 24, sha256: 'hash', created_at: '',
  });
  vi.spyOn(api, 'downloadAttachment').mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
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
    expect(screen.getAllByText(/^NIF$/i).length).toBeGreaterThan(0);
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
    expect(api.updateCustomer).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      display_name: 'Ando Modifié',
      id_issue_date: null,
      birth_date: null,
    }));
  });

  it('5. Persiste les champs d’identité et permet d’ajouter une pièce jointe', async () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} canSensitiveWrite />);

    expect(await screen.findByText('Fiche client — Ando Rakoto')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Modifier'));
    fireEvent.change(screen.getByPlaceholderText('Numéro'), { target: { value: '101010101010' } });
    fireEvent.click(screen.getByText('Enregistrer'));
    await waitFor(() => expect(api.updateCustomer).toHaveBeenCalledWith(
      'CUST-001',
      expect.objectContaining({ id_number: '101010101010' }),
    ));

    const file = new File(['%PDF-1.7'], 'cin.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Sélectionner une pièce jointe'), { target: { files: [file] } });
    expect(await screen.findByText(/1 pièce\(s\) sélectionnée/)).toBeInTheDocument();
    expect(api.uploadAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Enregistrer les pièces jointes'));
    await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalledWith(
      file,
      'CIN',
      { customerId: 'CUST-001' },
    ));
    expect(await screen.findByText('cin.pdf')).toBeInTheDocument();
  });

  it('6. Ouvre l’aperçu PDF d’une pièce jointe au clic et le ferme au clavier', async () => {
    const mockNavigate = vi.fn();
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURL = vi.fn().mockReturnValue('blob:attachment-preview');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    try {
      vi.spyOn(api, 'getCustomerAttachments').mockResolvedValue([{
        id: 'ATT-001', customer_id: 'CUST-001', customer_reference: 'CLI-CUST-001', reservation_draft_id: null,
        hahitantsoa_event_draft_id: null, category: 'CIN', original_name: 'cin.pdf',
        content_type: 'application/pdf', size_bytes: 24, sha256: 'hash', created_at: '',
      }]);
      render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} canSensitiveWrite />);

      const previewButton = await screen.findByRole('button', { name: 'Afficher un aperçu de cin.pdf' });
      fireEvent.click(previewButton);

      expect(await screen.findByTitle('Aperçu de cin.pdf')).toBeInTheDocument();
      expect(api.downloadAttachment).toHaveBeenCalledWith('ATT-001', expect.any(AbortSignal));
      expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:attachment-preview');
    } finally {
      vi.restoreAllMocks();
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL });
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    }
  });

  it('7. Clic sur retour et nouvelle réservation', async () => {
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

  it('8. Affiche la synthèse des ressources commerciales depuis la chronologie', async () => {
    vi.mocked(api.getCustomerTimeline).mockResolvedValue([
      {
        date: '2026-08-01T10:00:00Z',
        type: 'reservation',
        title: 'Réservation RES-001',
        description: 'Réservation Titan',
        metadata: {
          reservation_draft_id: 'RES-001',
          public_reference: 'RES-001',
          start_at: '2026-08-20T08:00:00Z',
          status: 'draft',
        },
      },
      {
        date: '2026-08-02T10:00:00Z',
        type: 'proforma',
        title: 'Proforma Titan',
        description: 'Statut : generated',
        metadata: {},
      },
      {
        date: '2026-08-03T10:00:00Z',
        type: 'invoice',
        title: 'Facture INV-001',
        description: 'Montant : 100000',
        metadata: { amount: '100000', status: 'open' },
      },
      {
        date: '2026-08-04T10:00:00Z',
        type: 'payment',
        title: 'Paiement deposit',
        description: '40000 via bank',
        metadata: { amount: '40000', status: 'confirmed' },
      },
      {
        date: '2026-08-05T10:00:00Z',
        type: 'logistics',
        title: 'Logistique : Livraison',
        description: 'Statut : planned',
        metadata: {},
      },
      {
        date: '2026-08-06T10:00:00Z',
        type: 'follow_up',
        title: 'Relance commerciale',
        description: 'Raison : confirmer le besoin',
        metadata: {},
      },
    ]);

    render(<CustomerDetailPage param="CUST-001" onNavigate={vi.fn()} />);

    expect(await screen.findByText('Fiche client — Ando Rakoto')).toBeInTheDocument();
    expect(screen.getByText('Activité commerciale liée')).toBeInTheDocument();
    expect(screen.getByText('Ouvrir Commercial Ops')).toBeInTheDocument();
    expect(screen.getAllByText(/40.*000/)[0]).toBeInTheDocument();
    expect(screen.getByText(/60.*000/)).toBeInTheDocument();
    expect(screen.getByText('RES-001')).toBeInTheDocument();
    expect(screen.getAllByText('Relance commerciale')).toHaveLength(2);
  });
});
