import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservationsPage from './ReservationsPage';
import type { HahitantsoaEventDraft, ReservationDraft } from '../types';

const mockDrafts: ReservationDraft[] = [
  {
    id: 'd1',
    public_reference: 'RES-2026-0142',
    status: 'confirmed',
    customer_id: 'CUST-001',
    customer_display_name: 'Ando Rakoto',
    start_at: '2026-06-15T09:00:00Z',
    end_at: '2026-06-15T21:00:00Z',
    notes: '',
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    lines: [
      { id: 'l1', inventory_item_id: 'MAT-01', inventory_item_name: 'Chaise', inventory_item_kind: 'article', quantity: 200, notes: '' },
    ],
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'd2',
    public_reference: 'LOC-2026-0089',
    status: 'draft',
    customer_id: 'CUST-001',
    customer_display_name: 'Ando Rakoto',
    start_at: '2026-06-14T08:00:00Z',
    end_at: '2026-06-16T18:00:00Z',
    notes: '',
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    lines: [],
    created_at: '2026-06-02T10:00:00Z',
    updated_at: '2026-06-02T10:00:00Z',
  },
  {
    id: 'd3',
    public_reference: 'LOC-2026-0088',
    status: 'cancelled',
    customer_id: 'CUST-003',
    customer_display_name: 'Traiteur Royal',
    start_at: '2026-06-18T09:00:00Z',
    end_at: '2026-06-19T18:00:00Z',
    notes: '',
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: '2026-06-10T10:00:00Z',
    cancelled_by_id: null,
    lines: [],
    created_at: '2026-06-03T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
  },
];

const mockHahitantsoaDrafts: HahitantsoaEventDraft[] = [
  {
    id: 'hd1',
    public_reference: 'H-2026-0001',
    event_name: 'Mariage Rasoa & Rakoto',
    event_type: 'wedding',
    rental_type: 'bare',
    status: 'confirmed',
    customer_id: 'CUST-002',
    customer_display_name: 'Bodo Rasoa',
    start_at: '2026-07-10T10:00:00Z',
    end_at: '2026-07-10T22:00:00Z',
    venue_name: 'Salle des Fêtes Hahitantsoa',
    location_details: '',
    service_notes: '',
    notes: '',
    lines: [
      { id: 'hl1', inventory_item_id: 'MAT-02', inventory_item_name: 'Table ronde', inventory_item_kind: 'material', quantity: 20, notes: '' },
    ],
    created_at: '2026-06-05T10:00:00Z',
    updated_at: '2026-06-05T10:00:00Z',
  },
];

vi.mock('../api', () => ({
  getReservationDrafts: vi.fn(),
  getHahitantsoaEventDrafts: vi.fn(),
  deleteReservationDraft: vi.fn(),
  deleteHahitantsoaEventDraft: vi.fn(),
}));

import {
  deleteHahitantsoaEventDraft,
  deleteReservationDraft,
  getHahitantsoaEventDrafts,
  getReservationDrafts,
} from '../api';
const mockGetReservationDrafts = vi.mocked(getReservationDrafts);
const mockGetHahitantsoaEventDrafts = vi.mocked(getHahitantsoaEventDrafts);
const mockDeleteReservationDraft = vi.mocked(deleteReservationDraft);
const mockDeleteHahitantsoaEventDraft = vi.mocked(deleteHahitantsoaEventDraft);

describe('ReservationsPage', () => {
  beforeEach(() => {
    mockGetReservationDrafts.mockResolvedValue(mockDrafts);
    mockGetHahitantsoaEventDrafts.mockResolvedValue(mockHahitantsoaDrafts);
    mockDeleteReservationDraft.mockResolvedValue(undefined);
    mockDeleteHahitantsoaEventDraft.mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('supprime uniquement un brouillon pour un utilisateur autorisé', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} canSensitiveWrite canSuperAdminDelete />);
    await waitFor(() => expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' });
    await user.click(deleteButtons[0]);

    expect(mockDeleteReservationDraft).toHaveBeenCalledWith('d2');
    expect(screen.queryByText('LOC-2026-0089')).not.toBeInTheDocument();
    expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
  });

  it('affiche toutes les réservations consolidées après chargement (Titan + Hahitantsoa)', async () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    });
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0088')).toBeInTheDocument();
    expect(screen.getByText('H-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Mariage Rasoa & Rakoto')).toBeInTheDocument();
  });

  it('filtre par volet Titan et Hahitantsoa', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('H-2026-0001')).toBeInTheDocument();
    });

    // Filter Titan
    await user.click(screen.getByRole('button', { name: /Titan \(3\)/i }));
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    expect(screen.queryByText('H-2026-0001')).not.toBeInTheDocument();

    // Filter Hahitantsoa
    await user.click(screen.getByRole('button', { name: /Hahitantsoa \(1\)/i }));
    expect(screen.getByText('H-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0089')).not.toBeInTheDocument();
  });

  it('filtre par statut Confirmée', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^Confirmée$/i }));
    expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    expect(screen.getByText('H-2026-0001')).toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0089')).not.toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0088')).not.toBeInTheDocument();
  });

  it('filtre par statut Brouillon', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^Brouillon$/i }));
    expect(screen.queryByText('RES-2026-0142')).not.toBeInTheDocument();
    expect(screen.queryByText('H-2026-0001')).not.toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0088')).not.toBeInTheDocument();
  });

  it('filtre par statut Annulée', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('LOC-2026-0088')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /^Annulée$/i }));
    expect(screen.queryByText('RES-2026-0142')).not.toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0089')).not.toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0088')).toBeInTheDocument();
  });

  it('recherche par référence LOC-2026-0089', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Rechercher/i), 'LOC-2026-0089');
    expect(screen.queryByText('RES-2026-0142')).not.toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
  });

  it('clic référence Titan ouvre reservation-detail avec titan:id', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    render(<ReservationsPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /LOC-2026-0089/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'titan:d2');
  });

  it('clic référence Hahitantsoa ouvre reservation-detail avec hahitantsoa:id', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    render(<ReservationsPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('H-2026-0001')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /H-2026-0001/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'hahitantsoa:hd1');
  });

  it('clic client ouvre la fiche client', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    render(<ReservationsPage onNavigate={mockNavigate} />);
    await waitFor(() => expect(screen.getAllByText('Ando Rakoto').length).toBeGreaterThanOrEqual(1));
    await user.click(screen.getAllByRole('button', { name: /^Ando Rakoto$/i })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });

  it('affiche message quand aucun résultat', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Rechercher/i), 'INEXISTANT');
    expect(screen.getByText(/Aucune réservation ne correspond/i)).toBeInTheDocument();
  });

  it('affiche état de chargement puis données', async () => {
    mockGetReservationDrafts.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ReservationsPage onNavigate={vi.fn()} />);
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });
});
