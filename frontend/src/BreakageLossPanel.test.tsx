import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import BreakageLossPanel from './BreakageLossPanel';
import type { InventoryDamageLossSettlement } from './types';

const MOCK_SETTLEMENTS: InventoryDamageLossSettlement[] = [
  {
    id: 'stl-1',
    return_operation: 'ret-1111',
    document_instance: null,
    settlement_status: 'draft',
    damage_loss_total: 150000.00,
    caution_available: 200000.00,
    caution_applied: 150000.00,
    refund_due: 50000.00,
    excess_due: 0,
    notes: '',
    validated_at: null,
    validated_by: null,
    lines: [
      {
        id: 'line-1',
        return_operation_line: 'rline-1',
        manual_label: '',
        settlement_line_kind: 'damage',
        quantity: 2,
        unit_amount: 75000.00,
        amount_source: 'manual',
        total_amount: 150000.00,
        notes: '',
        created_at: '2026-06-10T10:00:00Z',
        updated_at: '2026-06-10T10:00:00Z',
        created_by: null,
        updated_by: null,
      },
    ],
    created_at: '2026-06-10T10:00:00Z',
    updated_at: '2026-06-10T10:00:00Z',
    created_by: null,
    updated_by: null,
  },
];

describe('BreakageLossPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(api, 'checkEndpointPermission').mockResolvedValue(false);
  });

  it('shows loading state initially', () => {
    vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue([]);
    render(<BreakageLossPanel />);
    expect(screen.getByText('Loading damage assessment...')).toBeInTheDocument();
  });

  it('renders the panel with heading', async () => {
    vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue([]);
    render(<BreakageLossPanel />);
    await waitFor(() => {
      expect(screen.getByText('Damage Assessment')).toBeInTheDocument();
    });
  });

  it('shows empty state when no settlements exist', async () => {
    vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue([]);
    render(<BreakageLossPanel />);
    await waitFor(() => {
      expect(screen.getByText('No damage & loss settlements found.')).toBeInTheDocument();
    });
  });

  it('shows error state when API call fails', async () => {
    vi.spyOn(api, 'getDamageLossSettlements').mockRejectedValue(
      new Error('Network error'),
    );
    render(<BreakageLossPanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('renders settlement details correctly', async () => {
    vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue(MOCK_SETTLEMENTS);
    render(<BreakageLossPanel />);
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
    expect(screen.getByText('150 000,00 MGA')).toBeInTheDocument();
    expect(screen.getAllByText('1 line').length).toBeGreaterThanOrEqual(1);
  });

  it('shows retry button on error and recovers on retry', async () => {
    const spy = vi.spyOn(api, 'getDamageLossSettlements');
    spy.mockRejectedValue(new Error('Network error'));
    render(<BreakageLossPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry loading settlements' });
    expect(retryBtn).toBeInTheDocument();

    spy.mockResolvedValue(MOCK_SETTLEMENTS);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
  });

  it('shows read-only badge when user lacks write permission', async () => {
    vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue([]);
    render(<BreakageLossPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('breakage-write-denied')).toBeInTheDocument();
    });
  });

  it('shows write access badge when user has write permission', async () => {
    vi.spyOn(api, 'checkEndpointPermission').mockResolvedValue(true);
    vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue([]);
    render(<BreakageLossPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('breakage-write-ok')).toBeInTheDocument();
    });
  });
});
