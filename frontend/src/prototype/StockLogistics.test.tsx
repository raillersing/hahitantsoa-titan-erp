import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InventoryPage from './InventoryPage';
import InventoryItemPage from './InventoryItemPage';
import StockMovementsPage from './StockMovementsPage';
import StockPreparationPage from './StockPreparationPage';
import LogisticsDispatchPage from './LogisticsDispatchPage';
import LogisticsReturnsPage from './LogisticsReturnsPage';
import BreakageLossPage from './BreakageLossPage';
import InventoryManagementPage from './InventoryManagementPage';
import * as api from '../api';

describe('Stock & Logistics Pages', () => {
  const mockNavigate = vi.fn();

  it('InventoryManagementPage - renders KPIs and articles', async () => {
    vi.spyOn(api, 'getInventoryItems').mockResolvedValue([
      { id: 'MAT-01', name: 'Chaise Napoléon transparente', kind: 'material', description: '' },
    ]);
    render(<InventoryManagementPage onNavigate={mockNavigate} />);
    expect(await screen.findByText('Chaise Napoléon transparente')).toBeDefined();
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dispo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Réservé').length).toBeGreaterThan(0);
  });

  it('InventoryPage (Catalogue) - renders grid of location articles', () => {
    render(<InventoryPage onNavigate={mockNavigate} />);
    expect(screen.getByText('Catalogue')).toBeInTheDocument();
    expect(screen.getByText('Chaise Napoléon transparente')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('InventoryItemPage - renders stock info and history', async () => {
    vi.spyOn(api, 'getInventoryItem').mockResolvedValue({ id: 'MAT-01', name: 'Chaise Napoléon transparente', kind: 'material', description: '' });
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([
      { id: 'MOV-001', inventory_item: 'MAT-01', reservation_draft: null, movement_type: 'outbound_delivery', direction: 'outbound', quantity: 40, source_label: 'Livraison client', notes: '', effective_at: '2026-06-10', validated_at: '', validated_by: 'Jean R.', created_at: '2026-06-10', updated_at: '' },
    ]);
    render(<InventoryItemPage onNavigate={mockNavigate} param="MAT-01" />);
    expect(await screen.findByText('Chaise Napoléon transparente')).toBeDefined();
    expect(screen.getAllByText('Stock Total').length).toBeGreaterThan(0);
    expect(screen.getByText('Historique des mouvements')).toBeDefined();
  });

  describe('StockMovementsPage', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getStockMovements').mockResolvedValue([
        { id: 'MOV-001', inventory_item: 'MAT-01', reservation_draft: null, movement_type: 'outbound_delivery', direction: 'outbound', quantity: 40, source_label: 'Livraison client', notes: 'Livraison client', effective_at: '', validated_at: '', validated_by: 'Jean R.', created_at: '2026-06-10', updated_at: '' },
        { id: 'MOV-002', inventory_item: 'MAT-01', reservation_draft: null, movement_type: 'inbound_return', direction: 'inbound', quantity: 10, source_label: 'Retour anticipé', notes: 'Retour anticipé', effective_at: '', validated_at: '', validated_by: 'Marc T.', created_at: '2026-06-11', updated_at: '' },
      ]);
      vi.spyOn(api, 'getInventoryItems').mockResolvedValue([
        { id: 'MAT-01', name: 'Chaise Napoléon transparente', kind: 'material', description: '' },
      ]);
    });

    it('renders movements with types', async () => {
      render(<StockMovementsPage onNavigate={mockNavigate} />);
      expect(await screen.findByText('Nouveau Mouvement')).toBeDefined();
      expect(screen.getAllByText('Sortie').length).toBeGreaterThan(0);
    });
  });

  it('StockPreparationPage - renders dossiers to prepare', async () => {
    vi.spyOn(api, 'getReservationDrafts').mockResolvedValue([
      {
        id: 'draft-001', public_reference: 'LOC-2026-0089', status: 'confirmed',
        customer_id: 'c-01', customer_display_name: 'Ando Rakoto',
        start_at: '2026-06-14T00:00:00Z', end_at: '2026-06-20T00:00:00Z',
        notes: '', contract_signed_at: null, contract_signed_by_id: null,
        required_deposit_received_at: null, required_deposit_received_by_id: null,
        confirmed_at: '2026-06-10T00:00:00Z', confirmed_by_id: 'u-01',
        cancelled_at: null, cancelled_by_id: null,
        lines: [
          { id: 'l1', inventory_item_id: 'MAT-01', inventory_item_name: 'Chaise Napoléon transparente', inventory_item_kind: 'material', quantity: 50, notes: '' },
          { id: 'l2', inventory_item_id: 'MAT-02', inventory_item_name: 'Table rectangulaire 8 places', inventory_item_kind: 'material', quantity: 5, notes: '' },
        ],
        created_at: '', updated_at: '',
      },
    ]);
    vi.spyOn(api, 'getInventoryItems').mockResolvedValue([
      { id: 'MAT-01', name: 'Chaise Napoléon transparente', kind: 'material', description: '' },
      { id: 'MAT-02', name: 'Table rectangulaire 8 places', kind: 'material', description: '' },
    ]);
    render(<StockPreparationPage onNavigate={mockNavigate} />);
    expect(await screen.findByText('LOC-2026-0089')).toBeDefined();
  });

  describe('LogisticsDispatchPage', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue([
        {
          id: 'evt-001',
          event_type: 'delivery',
          status: 'planned',
          reservation_draft: 'LOC-2026-0087',
          scheduled_at: '2026-07-25T10:00:00Z',
          executed_at: null,
          address: '123 Rue Example',
          contact_name: 'Rakoto',
          contact_phone: '+261340000000',
          notes: '',
          signature_required: false,
          signature_received: false,
          signed_by: null,
          signed_at: null,
          item_lines: [{ id: 'line-001', logistics_event: 'evt-001', inventory_item: 'MAT-001', inventory_item_name: 'Chaise', inventory_item_kind: 'material', quantity: 20, notes: '', created_at: '', updated_at: '', created_by: null, updated_by: null }],
          created_at: '',
          updated_at: '',
          created_by: null,
          updated_by: null,
        },
      ]);
    });

    it('renders logistics events from API', async () => {
      render(<LogisticsDispatchPage onNavigate={mockNavigate} />);
      expect(await screen.findByText('Livraison Titan')).toBeDefined();
    });
  });

  describe('LogisticsReturnsPage', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getReturnOperations').mockResolvedValue([
        {
          id: 'ret-001',
          reservation_draft: 'LOC-2026-0087',
          document_instance: null,
          status: 'draft',
          notes: '',
          validated_at: null,
          validated_by: null,
          lines: [{ id: 'rline-001', inventory_item: 'MAT-001', expected_quantity: 20, returned_quantity: 18, damaged_quantity: 0, missing_quantity: 2, condition_status: 'intact', notes: '', intact_quantity: 18, created_at: '2026-07-20T10:00:00Z', updated_at: '', created_by: null, updated_by: null }],
          created_at: '2026-07-20T10:00:00Z',
          updated_at: '',
          created_by: null,
          updated_by: null,
        },
      ]);
    });

    it('renders return operations from API', async () => {
      render(<LogisticsReturnsPage onNavigate={mockNavigate} />);
      expect(await screen.findByText('Tous')).toBeDefined();
      expect(screen.getByText(/En retard/)).toBeDefined();
    });
  });

  describe('BreakageLossPage', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue([
        {
          id: 'set-001',
          return_operation: 'LOC-2026-0087',
          document_instance: null,
          settlement_status: 'draft',
          damage_loss_total: 150000,
          caution_available: 500000,
          caution_applied: 0,
          refund_due: 0,
          excess_due: 150000,
          notes: 'Casse 2 chaises',
          validated_at: null,
          validated_by: null,
          lines: [{ id: 'sline-001', return_operation_line: null, manual_label: 'Chaise Napoléon', settlement_line_kind: 'damage', quantity: 2, unit_amount: 75000, amount_source: 'manual', total_amount: 150000, notes: '', created_at: '', updated_at: '', created_by: null, updated_by: null }],
          created_at: '2026-07-20T10:00:00Z',
          updated_at: '',
          created_by: null,
          updated_by: null,
        },
      ]);
    });

    it('renders settlements from API', async () => {
      render(<BreakageLossPage onNavigate={mockNavigate} />);
      expect(await screen.findByText('Caution Disponible')).toBeDefined();
      expect(screen.getByText('Différence à payer')).toBeDefined();
    });
  });
});
