import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import PlanningPanel from './PlanningPanel';
import type { HahitantsoaEventDraft, ReservationDraft } from './types';

const MOCK_RESERVATIONS: ReservationDraft[] = [
  {
    id: 'rd-1',
    public_reference: 'TR-1001',
    status: 'draft',
    customer_id: 'cust-1',
    customer_display_name: 'Alice',
    start_at: '2026-06-22T08:00:00Z',
    end_at: '2026-06-22T12:00:00Z',
    notes: '',
    lines: [{ id: 'line-1', inventory_item_id: 'item-1', inventory_item_name: 'Folding Chair', inventory_item_kind: 'article', quantity: 10, notes: '' }],
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    created_at: '2026-06-22T08:00:00Z',
    updated_at: '2026-06-22T08:00:00Z',
  },
  {
    id: 'rd-2',
    public_reference: 'TR-1002',
    status: 'draft',
    customer_id: 'cust-2',
    customer_display_name: 'Bob',
    start_at: '2026-06-22T14:00:00Z',
    end_at: '2026-06-22T16:00:00Z',
    notes: '',
    lines: [{ id: 'line-2', inventory_item_id: 'item-2', inventory_item_name: 'Round Table', inventory_item_kind: 'article', quantity: 5, notes: '' }],
    contract_signed_at: '2026-06-22T10:00:00Z',
    contract_signed_by_id: 'user-1',
    required_deposit_received_at: '2026-06-22T11:00:00Z',
    required_deposit_received_by_id: 'user-1',
    confirmed_at: '2026-06-23T10:00:00Z',
    confirmed_by_id: 'user-1',
    cancelled_at: null,
    cancelled_by_id: null,
    created_at: '2026-06-22T08:00:00Z',
    updated_at: '2026-06-22T08:00:00Z',
  },
];

const MOCK_EVENT_DRAFTS: HahitantsoaEventDraft[] = [
  {
    id: 'ed-1',
    public_reference: 'HD-001',
    status: 'draft',
    customer_id: 'cust-3',
    customer_display_name: 'Charlie',
    event_name: 'Wedding',
    venue_name: 'Hall A',
    location_details: 'City Center',
    service_notes: '',
    start_at: '2026-06-23T10:00:00Z',
    end_at: '2026-06-23T18:00:00Z',
    notes: '',
    lines: [
      { id: 'el-1', inventory_item_id: 'item-3', inventory_item_name: 'Table', inventory_item_kind: 'article', quantity: 20, notes: '' },
      { id: 'el-2', inventory_item_id: 'item-4', inventory_item_name: 'Chair', inventory_item_kind: 'article', quantity: 15, notes: '' },
    ],
    created_at: '2026-06-22T08:00:00Z',
    updated_at: '2026-06-22T08:00:00Z',
  },
  {
    id: 'ed-2',
    public_reference: 'HD-002',
    status: 'confirmed',
    customer_id: 'cust-4',
    customer_display_name: 'Diana',
    event_name: 'Conference',
    venue_name: 'Room B',
    location_details: 'Business Park',
    service_notes: 'Coffee included',
    start_at: '2026-06-24T09:00:00Z',
    end_at: '2026-06-24T17:00:00Z',
    notes: '',
    lines: [{ id: 'el-3', inventory_item_id: 'item-5', inventory_item_name: 'Tent', inventory_item_kind: 'material', quantity: 30, notes: '' }],
    created_at: '2026-06-22T08:00:00Z',
    updated_at: '2026-06-22T08:00:00Z',
  },
];

describe('PlanningPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    vi.spyOn(api, 'getReservationDrafts').mockReturnValue(new Promise(() => {}));
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockReturnValue(new Promise(() => {}));
    render(<PlanningPanel />);
    expect(screen.getByText('Chargement du planning...')).toBeInTheDocument();
  });

  it('renders heading and week navigation', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue([]);
    render(<PlanningPanel />);
    expect(await screen.findByRole('heading', { name: 'Planning hebdomadaire' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semaine précédente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semaine courante' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeInTheDocument();
  });

  it('shows empty state when no events are present', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue([]);
    render(<PlanningPanel />);
    expect(await screen.findByText('Aucun événement planifié pour cette semaine.')).toBeInTheDocument();
  });

  it('displays Titan and Hahitantsoa events with new columns', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue(MOCK_RESERVATIONS);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue(MOCK_EVENT_DRAFTS);
    render(<PlanningPanel />);

    await waitFor(() => {
      expect(screen.getByText('TR-1001')).toBeInTheDocument();
    });

    expect(screen.getByText('Wedding')).toBeInTheDocument();
    expect(screen.getByText('Conference')).toBeInTheDocument();

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();

    const scopeTags = screen.getAllByText(/^Hah$/);
    expect(scopeTags.length).toBe(2);

    expect(screen.getAllByText('1').length).toBe(3);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows correct status badges', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue(MOCK_RESERVATIONS);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue(MOCK_EVENT_DRAFTS);
    render(<PlanningPanel />);

    await waitFor(() => {
      expect(screen.getAllByText('Brouillon').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText('Confirmé').length).toBeGreaterThanOrEqual(1);
  });

  it('filters events by Titan scope', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue(MOCK_RESERVATIONS);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue(MOCK_EVENT_DRAFTS);
    render(<PlanningPanel />);

    await waitFor(() => {
      expect(screen.getByText('TR-1001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Titan' }));

    expect(screen.getByText('TR-1001')).toBeInTheDocument();
    expect(screen.getByText('TR-1002')).toBeInTheDocument();
    expect(screen.queryByText('Wedding')).not.toBeInTheDocument();
    expect(screen.queryByText('Conference')).not.toBeInTheDocument();
  });

  it('filters events by Hahitantsoa scope', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue(MOCK_RESERVATIONS);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue(MOCK_EVENT_DRAFTS);
    render(<PlanningPanel />);

    await waitFor(() => {
      expect(screen.getByText('Wedding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Hahitantsoa' }));

    expect(screen.queryByText('TR-1001')).not.toBeInTheDocument();
    expect(screen.queryByText('TR-1002')).not.toBeInTheDocument();
    expect(screen.getByText('Wedding')).toBeInTheDocument();
    expect(screen.getByText('Conference')).toBeInTheDocument();
  });

  it('shows error state and retry button', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockRejectedValue(new Error('Network error'));
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue([]);
    render(<PlanningPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  it('navigates weeks', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue(MOCK_EVENT_DRAFTS);
    render(<PlanningPanel />);

    await waitFor(() => {
      expect(screen.getByText('Wedding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));

    await waitFor(() => {
      expect(screen.getByText('Aucun événement planifié pour cette semaine.')).toBeInTheDocument();
    });
  });
});
