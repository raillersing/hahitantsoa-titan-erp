import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservationsPage from './ReservationsPage';
import type { ReservationDraft } from '../types';

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

vi.mock('../api', () => ({
  getReservationDrafts: vi.fn(),
}));

import { getReservationDrafts } from '../api';
const mockGetReservationDrafts = vi.mocked(getReservationDrafts);

describe('ReservationsPage', () => {
  beforeEach(() => {
    mockGetReservationDrafts.mockResolvedValue(mockDrafts);
  });

  it('affiche toutes les réservations après chargement', async () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    });
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0088')).toBeInTheDocument();
  });

  it('filtre par Confirmée', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Confirmée/i }));
    expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0089')).not.toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0088')).not.toBeInTheDocument();
  });

  it('filtre par Brouillon', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Brouillon/i }));
    expect(screen.queryByText('RES-2026-0142')).not.toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0088')).not.toBeInTheDocument();
  });

  it('filtre par Annulée', async () => {
    const user = userEvent.setup();
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('LOC-2026-0088')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Annulée/i }));
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

  it('clic référence ouvre le bon détail', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    render(<ReservationsPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /LOC-2026-0089/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'd2');
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

  it('affiche erreur en cas d\'échec API', async () => {
    mockGetReservationDrafts.mockRejectedValue(new Error('Network error'));
    render(<ReservationsPage onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
