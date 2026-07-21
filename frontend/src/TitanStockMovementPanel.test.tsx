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
    expect(screen.getByText('Mouvements de stock')).toBeInTheDocument();
    expect(screen.getByLabelText('Actualiser les mouvements de stock')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Ouvrir le formulaire d'enregistrement")).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching movements', async () => {
    vi.spyOn(api, 'getStockMovements').mockImplementation(
      () => new Promise(() => {}),
    );
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });

  it('shows empty state when no movements exist', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => {
      expect(screen.getByText(/Aucun mouvement de stock enregistré/)).toBeInTheDocument();
    });
  });

  it('renders a loaded movement with direction, type, quantity and date', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([MOCK_MOVEMENT]);
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => {
      expect(screen.getByTestId(`stock-movement-row-${MOCK_MOVEMENT.id}`)).toBeInTheDocument();
    });
    expect(screen.getAllByText('Sortant').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Livraison sortante').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('×10')).toBeInTheDocument();
    expect(screen.getByText('DR-2026-001')).toBeInTheDocument();
  });

  it('opens and shows the create movement form', async () => {
    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => screen.getByLabelText("Ouvrir le formulaire d'enregistrement"));
    fireEvent.click(screen.getByLabelText("Ouvrir le formulaire d'enregistrement"));
    expect(screen.getByLabelText("Formulaire d'enregistrement d'un mouvement de stock")).toBeInTheDocument();
    expect(screen.getByLabelText("Sélectionner un article d'inventaire")).toBeInTheDocument();
    expect(screen.getByLabelText('Type de mouvement')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantité')).toBeInTheDocument();
  });

  it('submits a new movement and appends it to the list', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    vi.spyOn(api, 'createStockMovement').mockResolvedValue(MOCK_MOVEMENT);

    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => screen.getByLabelText("Ouvrir le formulaire d'enregistrement"));
    fireEvent.click(screen.getByLabelText("Ouvrir le formulaire d'enregistrement"));

    fireEvent.change(screen.getByLabelText("Sélectionner un article d'inventaire"), {
      target: { value: 'item-0001' },
    });
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Référence source'), { target: { value: 'DR-2026-001' } });

    fireEvent.click(screen.getByLabelText('Enregistrer le mouvement de stock'));

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

  it('disables form inputs and submit button while submitting', async () => {
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([]);
    vi.spyOn(api, 'createStockMovement').mockImplementationOnce(() => new Promise(() => {}));

    render(<TitanStockMovementPanel inventoryItems={MOCK_ITEMS} />);
    await waitFor(() => screen.getByLabelText("Ouvrir le formulaire d'enregistrement"));
    fireEvent.click(screen.getByLabelText("Ouvrir le formulaire d'enregistrement"));

    fireEvent.change(screen.getByLabelText("Sélectionner un article d'inventaire"), {
      target: { value: 'item-0001' },
    });
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '10' } });

    fireEvent.click(screen.getByLabelText('Enregistrer le mouvement de stock'));

    expect(screen.getByLabelText('Enregistrer le mouvement de stock')).toBeDisabled();
    expect(screen.getByLabelText("Sélectionner un article d'inventaire")).toBeDisabled();
    expect(screen.getByLabelText('Quantité')).toBeDisabled();
  });
});
