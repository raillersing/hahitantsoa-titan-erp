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
    expect(screen.getByText('Loading ERP dashboard summary...')).toBeInTheDocument();
  });

  it('renders heading and section elements after loading', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('ERP command center')).toBeInTheDocument();
    });
    expect(screen.getByText('Prototype-aligned overview')).toBeInTheDocument();
    expect(screen.getByText('System authenticated session active')).toBeInTheDocument();
  });

  it('displays all four metric cards', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Titan inventory')).toBeInTheDocument();
    });
    expect(screen.getByText('Hahitantsoa drafts')).toBeInTheDocument();
    expect(screen.getByText('Reservation drafts')).toBeInTheDocument();
    expect(screen.getByText('Operational payments')).toBeInTheDocument();
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
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    const ones = screen.getAllByText('1');
    expect(ones).toHaveLength(3);
  });

  it('shows zero counts when all API responses are empty', async () => {
    mockAllApis({});
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      const zeroes = screen.getAllByText('0');
      expect(zeroes.length).toBe(4);
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

  it('handles payment API failure gracefully without showing error', async () => {
    vi.spyOn(api, 'getInventoryItems').mockResolvedValue(MOCK_ITEMS);
    vi.spyOn(api, 'getHahitantsoaEventDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue([]);
    vi.spyOn(api, 'getPayments').mockRejectedValue(new Error('Payment service down'));
    render(<DashboardPanel onNavigate={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onNavigate with titan scope when Open Titan is clicked', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Titan inventory')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open Titan' }));
    expect(onNavigate).toHaveBeenCalledWith('titan');
  });

  it('calls onNavigate with hahitantsoa scope when Open Hahitantsoa is clicked', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Hahitantsoa drafts')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open Hahitantsoa' }));
    expect(onNavigate).toHaveBeenCalledWith('hahitantsoa');
  });

  it('calls onNavigate with titan scope when Review reservations is clicked', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Reservation drafts')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review reservations' }));
    expect(onNavigate).toHaveBeenCalledWith('titan');
  });

  it('calls onNavigate with commercial-ops scope when Open operations is clicked', async () => {
    const onNavigate = vi.fn();
    mockAllApis({});
    render(<DashboardPanel onNavigate={onNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Operational payments')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open operations' }));
    expect(onNavigate).toHaveBeenCalledWith('commercial-ops');
  });
});
