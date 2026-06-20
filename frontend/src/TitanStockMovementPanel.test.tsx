import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import TitanStockMovementPanel from './TitanStockMovementPanel';
import type { InventoryItem, InventoryStockMovement } from './types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ITEMS: InventoryItem[] = [
  {
    id: 'item-0001',
    name: 'Folding Chair',
    description: 'Standard folding chair',
    kind: 'article',
  },
  {
    id: 'item-0002',
    name: 'Round Table',
    description: 'Round banquet table',
    kind: 'article',
  },
];

const MOCK_MOVEMENT: InventoryStockMovement = {
  id: 'mv-0001',
  inventory_item: 'item-0001',
  reservation_draft: null,
  movement_type: 'outbound_delivery',
  direction: 'outbound',
  quantity: 10,
  source_label: 'DR-2026-001',
  notes: 'Delivery for event',
  effective_at: '2026-06-17T10:00:00Z',
  validated_at: '2026-06-17T10:00:00Z',
  validated_by: null,
  created_at: '2026-06-17T10:00:00Z',
  updated_at: '2026-06-17T10:00:00Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TitanStockMovementPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    vi.spyOn(api, 'checkEndpointPermission').mockResolvedValue(true);
  });

  it('renders the panel heading and action buttons', async () => {
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    expect(screen.getByTestId('titan-stock-movement-panel')).toBeInTheDocument();
    expect(screen.getByText('Stock Movements')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh stock movements')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Open record movement form')).toBeInTheDocument();
    });
  });

  it('shows empty state when no movements exist', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => {
      expect(screen.getByText(/No stock movements recorded yet/)).toBeInTheDocument();
    });
  });

  it('renders a loaded movement with direction, type, quantity and date', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([MOCK_MOVEMENT]);
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => {
      expect(screen.getByTestId(`stock-movement-row-${MOCK_MOVEMENT.id}`)).toBeInTheDocument();
    });
    expect(screen.getByText('Outbound')).toBeInTheDocument();
    expect(screen.getByText('Outbound Delivery')).toBeInTheDocument();
    expect(screen.getByText('×10')).toBeInTheDocument();
    expect(screen.getByText('DR-2026-001')).toBeInTheDocument();
  });

  it('opens and shows the create movement form', async () => {
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => screen.getByLabelText('Open record movement form'));
    fireEvent.click(screen.getByLabelText('Open record movement form'));
    expect(screen.getByLabelText('Record stock movement form')).toBeInTheDocument();
    expect(screen.getByLabelText('Select inventory item')).toBeInTheDocument();
    expect(screen.getByLabelText('Movement type')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
  });

  it('submits a new movement and appends it to the list', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    vi.spyOn(api, 'createStockMovement').mockResolvedValue(MOCK_MOVEMENT);

    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => screen.getByLabelText('Open record movement form'));
    fireEvent.click(screen.getByLabelText('Open record movement form'));

    fireEvent.change(screen.getByLabelText('Select inventory item'), {
      target: { value: 'item-0001' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Source label'), { target: { value: 'DR-2026-001' } });

    fireEvent.click(screen.getByLabelText('Submit stock movement'));

    await waitFor(() => {
      expect(api.createStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({ inventory_item: 'item-0001', quantity: 10 }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId(`stock-movement-row-${MOCK_MOVEMENT.id}`)).toBeInTheDocument();
    });
  });

  it('shows an error message when the API fails to load', async () => {
    vi.spyOn(api, 'getStockMovements').mockRejectedValue(new Error('Service unavailable'));
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
    });
  });
});
