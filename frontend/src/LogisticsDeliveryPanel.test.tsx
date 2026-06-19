import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import LogisticsDeliveryPanel from './LogisticsDeliveryPanel';
import type { LogisticsEvent } from './types';

const MOCK_DELIVERY_EVENTS: LogisticsEvent[] = [
  {
    id: 'del-1',
    reservation_draft: 'rd-1111',
    event_type: 'delivery',
    status: 'planned',
    scheduled_at: '2026-06-15T08:00:00Z',
    executed_at: null,
    address: '123 Main St',
    contact_name: 'John',
    contact_phone: '+261',
    notes: '',
    created_at: '2026-06-10T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    created_by: null,
    updated_by: null,
  },
];

const MOCK_PICKUP_EVENTS: LogisticsEvent[] = [
  {
    id: 'pick-1',
    reservation_draft: 'rd-2222',
    event_type: 'pickup',
    status: 'completed',
    scheduled_at: '2026-06-14T16:00:00Z',
    executed_at: '2026-06-14T16:30:00Z',
    address: '456 Oak Ave',
    contact_name: 'Jane',
    contact_phone: '+262',
    notes: '',
    created_at: '2026-06-10T10:00:00Z',
    updated_at: '2026-06-14T16:30:00Z',
    created_by: null,
    updated_by: null,
  },
];

describe('LogisticsDeliveryPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue([]);
    render(<LogisticsDeliveryPanel />);
    expect(screen.getByText('Loading delivery events...')).toBeInTheDocument();
  });

  it('renders the panel with heading', async () => {
    vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue([]);
    render(<LogisticsDeliveryPanel />);
    await waitFor(() => {
      expect(screen.getByText('Delivery Events')).toBeInTheDocument();
    });
  });

  it('shows empty state when no events exist', async () => {
    vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue([]);
    render(<LogisticsDeliveryPanel />);
    await waitFor(() => {
      expect(screen.getByText('No delivery events found.')).toBeInTheDocument();
    });
  });

  it('shows only delivery events (filters out pickup)', async () => {
    vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue([
      ...MOCK_DELIVERY_EVENTS,
      ...MOCK_PICKUP_EVENTS,
    ]);
    render(<LogisticsDeliveryPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('delivery-row-del-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('delivery-row-pick-1')).not.toBeInTheDocument();
  });

  it('shows error state when API call fails', async () => {
    vi.spyOn(api, 'getLogisticsEvents').mockRejectedValue(
      new Error('Network error'),
    );
    render(<LogisticsDeliveryPanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('renders delivery event details correctly', async () => {
    vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue(MOCK_DELIVERY_EVENTS);
    render(<LogisticsDeliveryPanel />);
    await waitFor(() => {
      expect(screen.getByText('Planned')).toBeInTheDocument();
    });
    expect(screen.getByText('John')).toBeInTheDocument();
  });
});
