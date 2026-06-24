import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import StockMovementLedgerPanel from './StockMovementLedgerPanel';
import type { InventoryStockMovement } from './types';

const MOCK_MOVEMENT: InventoryStockMovement = {
  id: 'mov-1',
  inventory_item: 'item-1',
  reservation_draft: null,
  movement_type: 'outbound_delivery',
  direction: 'outbound',
  quantity: 5,
  source_label: 'DR-2026-001',
  notes: '',
  effective_at: '2026-06-10T08:00:00Z',
  validated_at: '2026-06-10T09:00:00Z',
  validated_by: 'agent-1',
  created_at: '2026-06-10T08:00:00Z',
  updated_at: '2026-06-10T08:00:00Z',
};

describe('StockMovementLedgerPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(api, 'checkEndpointPermission').mockResolvedValue(false);
  });

  it('shows loading state initially', () => {
    vi.spyOn(api, 'getStockMovements').mockReturnValue(new Promise(() => {}));
    render(<StockMovementLedgerPanel />);
    expect(screen.getByText('Loading stock movements...')).toBeInTheDocument();
  });

  it('shows error state when API call fails', async () => {
    vi.spyOn(api, 'getStockMovements').mockRejectedValue(new Error('Service unavailable'));
    render(<StockMovementLedgerPanel />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Service unavailable');
  });

  it('shows empty state when no movements exist', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    render(<StockMovementLedgerPanel />);
    const empty = await screen.findByText('No stock movements recorded yet.');
    expect(empty).toBeInTheDocument();
  });

  it('renders stock movements in a list', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([MOCK_MOVEMENT]);
    render(<StockMovementLedgerPanel />);
    await screen.findByTestId('stock-movement-row-mov-1');
    expect(screen.getByText('Outbound Delivery')).toBeInTheDocument();
    expect(screen.getByText('Outbound')).toBeInTheDocument();
    expect(screen.getByText('DR-2026-001')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Stock movements list' });
    expect(list).toBeInTheDocument();
  });

  it('renders the panel with heading', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    render(<StockMovementLedgerPanel />);
    expect(screen.getByTestId('stock-movement-ledger-panel')).toBeInTheDocument();
    expect(screen.getByText('Movement Ledger')).toBeInTheDocument();
  });

  it('shows retry button on error and recovers on retry', async () => {
    const spy = vi.spyOn(api, 'getStockMovements');
    spy.mockRejectedValue(new Error('Network error'));
    render(<StockMovementLedgerPanel />);

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Network error');

    const retryBtn = screen.getByRole('button', { name: 'Retry loading stock movements' });
    expect(retryBtn).toBeInTheDocument();

    spy.mockResolvedValue([MOCK_MOVEMENT]);
    fireEvent.click(retryBtn);

    await screen.findByText('Outbound Delivery');
  });

  it('shows read-only badge when user lacks write permission', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    render(<StockMovementLedgerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('stock-write-denied')).toBeInTheDocument();
    });
  });

  it('shows write access badge when user has write permission', async () => {
    vi.spyOn(api, 'checkEndpointPermission').mockResolvedValue(true);
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    render(<StockMovementLedgerPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('stock-write-ok')).toBeInTheDocument();
    });
  });
});
