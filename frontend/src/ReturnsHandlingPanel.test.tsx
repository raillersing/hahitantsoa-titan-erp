import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import ReturnsHandlingPanel from './ReturnsHandlingPanel';
import type { InventoryReturnOperation } from './types';

const MOCK_OPERATIONS: InventoryReturnOperation[] = [
  {
    id: 'ret-1',
    reservation_draft: 'rd-1111',
    document_instance: null,
    status: 'draft',
    notes: '',
    validated_at: null,
    validated_by: null,
    lines: [
      {
        id: 'line-1',
        inventory_item: 'item-1',
        expected_quantity: 10,
        returned_quantity: 8,
        damaged_quantity: 1,
        missing_quantity: 1,
        condition_status: 'mixed',
        notes: '',
        intact_quantity: 7,
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

describe('ReturnsHandlingPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    vi.spyOn(api, 'getReturnOperations').mockResolvedValue([]);
    render(<ReturnsHandlingPanel />);
    expect(screen.getByText('Loading return operations...')).toBeInTheDocument();
  });

  it('renders the panel with heading', async () => {
    vi.spyOn(api, 'getReturnOperations').mockResolvedValue([]);
    render(<ReturnsHandlingPanel />);
    await waitFor(() => {
      expect(screen.getByText('Returns Log')).toBeInTheDocument();
    });
  });

  it('shows empty state when no operations exist', async () => {
    vi.spyOn(api, 'getReturnOperations').mockResolvedValue([]);
    render(<ReturnsHandlingPanel />);
    await waitFor(() => {
      expect(screen.getByText('No return operations found.')).toBeInTheDocument();
    });
  });

  it('shows error state when API call fails', async () => {
    vi.spyOn(api, 'getReturnOperations').mockRejectedValue(
      new Error('Network error'),
    );
    render(<ReturnsHandlingPanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('renders return operation details correctly', async () => {
    vi.spyOn(api, 'getReturnOperations').mockResolvedValue(MOCK_OPERATIONS);
    render(<ReturnsHandlingPanel />);
    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
    expect(screen.getByText('8 returned / 1 missing')).toBeInTheDocument();
    expect(screen.getByText('1 line')).toBeInTheDocument();
  });

  it('shows retry button on error and recovers on retry', async () => {
    const spy = vi.spyOn(api, 'getReturnOperations');
    spy.mockRejectedValue(new Error('Network error'));
    render(<ReturnsHandlingPanel />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });

    const retryBtn = screen.getByRole('button', { name: 'Retry loading return operations' });
    expect(retryBtn).toBeInTheDocument();

    spy.mockResolvedValue(MOCK_OPERATIONS);
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
    });
  });
});
