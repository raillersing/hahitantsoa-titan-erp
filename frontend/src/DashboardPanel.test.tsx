import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import DashboardPanel from './DashboardPanel';
import type { HahitantsoaEventDraft, InventoryItem, ReservationDraft, Payment } from './types';

const MOCK_ITEMS: InventoryItem[] = [
  { id: 'item-1', name: 'Folding Chair', kind: 'article', description: 'Chair' },
  { id: 'item-2', name: 'Round Table', kind: 'article', description: 'Table' },
];

const MOCK_EVENT_DRAFTS: HahitantsoaEventDraft[] = [
  {
    id: 'ed-1',
    public_reference: 'HD-001',
    status: 'draft',
    customer_id: 'cust-1',
    customer_display_name: 'Client',
    event_name: 'Wedding',
    venue_name: 'Hall A',
    location_details: 'City Center',
    service_notes: '',
    start_at: '2026-06-01T10:00:00Z',
    end_at: '2026-06-01T12:00:00Z',
    notes: '',
    lines: [],
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
];

const MOCK_RESERVATION_DRAFTS: ReservationDraft[] = [
  {
    id: 'rd-1',
    public_reference: 'TR-1001',
    status: 'draft',
    customer_id: 'cust-1',
    customer_display_name: 'Client',
    start_at: '2026-06-01T10:00:00Z',
    end_at: '2026-06-01T12:00:00Z',
    notes: '',
    lines: [],
    contract_signed_at: null,
    contract_signed_by_id: null,
    required_deposit_received_at: null,
    required_deposit_received_by_id: null,
    confirmed_at: null,
    confirmed_by_id: null,
    cancelled_at: null,
    cancelled_by_id: null,
    created_at: '2026-06-01T10:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
];

const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    reservation_draft: null,
    receipt_document: null,
    payment_kind: 'deposit',
    payment_method: 'cash',
    payment_status: 'confirmed',
    amount: '50000.00',
    paid_at: '2026-06-01T12:00:00Z',
    external_reference: '',
    source_label: '',
    notes: '',
    confirmed_at: null,
    confirmed_by: null,
    created_at: '2026-06-01T12:00:00Z',
    updated_at: '2026-06-01T12:00:00Z',
  },
];

function mockAllApis(data: {
  items?: InventoryItem[];
  eventDrafts?: HahitantsoaEventDraft[];
  reservationDrafts?: ReservationDraft[];
  payments?: Payment[];
}) {
  vi.spyOn(api, 'getInventoryItems').mockResolvedValue(data.items ?? []);
  vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue(data.eventDrafts ?? []);
  vi.spyOn(api, 'getReservationDrafts').mockResolvedValue(data.reservationDrafts ?? []);
  vi.spyOn(api, 'getPayments').mockResolvedValue(data.payments ?? []);
}

describe('DashboardPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    expect(screen.getByText('Pilotage opérationnel')).toBeInTheDocument();
  });

  it('renders action buttons and KPI section after loading', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Ouvrir le planning')).toBeInTheDocument();
    });
    expect(screen.getByText('Voir les rapports')).toBeInTheDocument();
  });

  it('displays all four Prototype 4 KPI cards', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Événements Hahitantsoa ce mois')).toBeInTheDocument();
    });
    expect(screen.getByText('Locations Titan ce mois')).toBeInTheDocument();
    expect(screen.getByText("Retours à contrôler aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText('Reste à payer (échéances)')).toBeInTheDocument();
  });

  it('shows correct metric counts when data is loaded', async () => {
    mockAllApis({
      items: MOCK_ITEMS,
      eventDrafts: MOCK_EVENT_DRAFTS,
      reservationDrafts: MOCK_RESERVATION_DRAFTS,
      payments: MOCK_PAYMENTS,
    });
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      const twos = screen.getAllByText('2');
      expect(twos.length).toBeGreaterThanOrEqual(1);
    });
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThanOrEqual(2);
  });

  it('shows zero counts when all API responses are empty', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      const zeroes = screen.getAllByText('0');
      expect(zeroes.length).toBe(3);
    });
  });

  it('shows error state when an API call fails', async () => {
    vi.spyOn(api, 'getInventoryItems').mockRejectedValue(new Error('Connection refused'));
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getPayments').mockResolvedValue([]);
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Connection refused');
    });
  });

  it('handles payment API failure gracefully', async () => {
    vi.spyOn(api, 'getInventoryItems').mockResolvedValue(MOCK_ITEMS);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getPayments').mockRejectedValue(new Error('Payment service down'));
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Événements Hahitantsoa ce mois')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onNavigate with planning scope when Ouvrir le planning is clicked', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Ouvrir le planning')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Ouvrir le planning'));
    expect(onNavigate).toHaveBeenCalledWith('planning');
  });

  it('calls onNavigate with commercial-ops when Voir les rapports is clicked', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Voir les rapports')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Voir les rapports'));
    expect(onNavigate).toHaveBeenCalledWith('commercial-ops');
  });

  it('calls onNavigate with hahitantsoa scope from KPI card action', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText(/Voir les réservations/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Voir les réservations/));
    expect(onNavigate).toHaveBeenCalledWith('hahitantsoa');
  });

  it('calls onNavigate with titan scope from KPI card action', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText(/Voir les locations/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Voir les locations/));
    expect(onNavigate).toHaveBeenCalledWith('titan');
  });

  it('calls onNavigate with commercial-ops scope from KPI billing action', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText(/Voir la facturation/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Voir la facturation/));
    expect(onNavigate).toHaveBeenCalledWith('commercial-ops');
  });

  it('renders the reservation choice zone', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Nouvelle réservation — Choisissez le domaine')).toBeInTheDocument();
    });
    const hahElements = screen.getAllByText('Hahitantsoa');
    expect(hahElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Titan Rental')).toBeInTheDocument();
  });

  it('renders the activity and alerts sections', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Activité des 7 derniers jours')).toBeInTheDocument();
    });
    expect(screen.getByText('Alertes & Notifications')).toBeInTheDocument();
    expect(screen.getByText('Dossiers en cours')).toBeInTheDocument();
  });
});
