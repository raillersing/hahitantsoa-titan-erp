import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('creates an item with its entered catalogue code, never a generated local ID', async () => {
    vi.spyOn(api, 'getInventoryItems').mockResolvedValue([]);
    const createItem = vi.spyOn(api, 'createInventoryItem').mockResolvedValue({
      id: 'inventory-uuid', code: 'CHAISE-001', name: 'Chaise', kind: 'material', description: '',
    } as any);
    render(<InventoryManagementPage onNavigate={mockNavigate} />);
    await screen.findByText('Aucun article trouvé.');
    fireEvent.click(screen.getByRole('button', { name: 'Nouvel Article' }));
    fireEvent.change(screen.getByLabelText('Code article'), { target: { value: 'CHAISE-001' } });
    fireEvent.change(screen.getByLabelText("Nom de l'article"), { target: { value: 'Chaise' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(createItem).toHaveBeenCalledWith(expect.objectContaining({
      code: 'CHAISE-001',
    })));
  });

  it('InventoryPage (Catalogue) - renders grid of location articles', async () => {
    vi.spyOn(api, 'getInventoryItems').mockResolvedValue([
      { id: 'MAT-01', name: 'Chaise Napoléon transparente', kind: 'material', description: '' },
    ]);
    render(<InventoryPage onNavigate={mockNavigate} />);
    expect(await screen.findByText('Chaise Napoléon transparente')).toBeDefined();
    expect(screen.getByText('Catalogue')).toBeInTheDocument();
  });

  it('InventoryItemPage - renders stock info and history', async () => {
    vi.spyOn(api, 'getInventoryItem').mockResolvedValue({
      id: 'MAT-01', name: 'Chaise Napoléon transparente', kind: 'material', description: '',
      purchase_price: '1000.00', rental_price: '150.00', breakage_price: '2000.00',
      reported_inventory_quantity: 100, reported_damaged_quantity: 2,
      stock_summary: { reported_inventory_quantity: 100, reported_damaged_quantity: 2, current_stock: 60, available_stock: 60, reserved_stock: 0, out_stock: 40, return_stock: 0, damaged_lost_stock: 0 },
    });
    vi.spyOn(api, 'getStockMovements').mockResolvedValue([
      { id: 'MOV-001', inventory_item: 'MAT-01', reservation_draft: null, movement_type: 'outbound_delivery', direction: 'outbound', quantity: 40, source_label: 'Livraison client', notes: '', effective_at: '2026-06-10', validated_at: '', validated_by: 'Jean R.', created_at: '2026-06-10', updated_at: '' },
    ]);
    render(<InventoryItemPage onNavigate={mockNavigate} param="MAT-01" />);
    expect(await screen.findByText('Chaise Napoléon transparente')).toBeDefined();
    expect(screen.getAllByText('Stock Total').length).toBeGreaterThan(0);
    expect(screen.getAllByText('60')).toHaveLength(2);
    expect(screen.getByText('1,000 Ar')).toBeInTheDocument();
    expect(screen.getByText('150 Ar')).toBeInTheDocument();
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
      { id: 'MAT-01', name: 'Chaise Napoléon transparente', kind: 'material', description: '', stock_summary: { reported_inventory_quantity: 100, reported_damaged_quantity: 0, current_stock: 100, available_stock: 100, reserved_stock: 0, out_stock: 0, return_stock: 0, damaged_lost_stock: 0 } },
      { id: 'MAT-02', name: 'Table rectangulaire 8 places', kind: 'material', description: '', stock_summary: { reported_inventory_quantity: 100, reported_damaged_quantity: 0, current_stock: 100, available_stock: 100, reserved_stock: 0, out_stock: 0, return_stock: 0, damaged_lost_stock: 0 } },
    ]);
    vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue([]);
    vi.spyOn(api, 'createLogisticsEvent').mockResolvedValue({
      id: 'prep-001', event_type: 'preparation', operation: 'outbound', status: 'planned',
      reservation_draft: 'draft-001', hahitantsoa_event_draft: null, scheduled_at: null,
      executed_at: null, address: '', contact_name: '', contact_phone: '', notes: '',
      signature_required: false, signature_received: false, signature_status: 'pending',
      signature_exception_reason: '', signed_document_file: '', signed_document_hash: '',
      signed_by_client_name: '', signed_by: null, signed_at: null, item_lines: [],
      created_at: '', updated_at: '', created_by: null, updated_by: null,
    } as any);
    const addLine = vi.spyOn(api, 'addLogisticsEventItemLine').mockResolvedValue({ id: 'prep-line-001', inventory_item: 'MAT-01', quantity: 20 } as any);
    vi.spyOn(api, 'transitionLogisticsEvent').mockResolvedValue({
      id: 'prep-001', event_type: 'preparation', operation: 'outbound', status: 'completed',
      reservation_draft: 'draft-001', item_lines: [],
    } as any);
    render(<StockPreparationPage onNavigate={mockNavigate} />);
    expect(await screen.findByText('LOC-2026-0089')).toBeDefined();
    const quantities = screen.getAllByRole('spinbutton');
    fireEvent.change(quantities[0], { target: { value: '20' } });
    fireEvent.blur(quantities[0]);
    await waitFor(() => expect(addLine).toHaveBeenCalledWith('prep-001', expect.objectContaining({ inventory_item_id: 'MAT-01', quantity: 20 })));
  });

  describe('LogisticsDispatchPage', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getLogisticsEvents').mockResolvedValue([
        {
          id: 'evt-001',
          event_type: 'delivery',
          operation: 'outbound',
          status: 'planned',
          reservation_draft: 'LOC-2026-0087', hahitantsoa_event_draft: null,
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
          signature_status: "pending",
          signature_exception_reason: "",
          signed_document_file: "",
          signed_document_hash: "",
          signed_by_client_name: "",
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

    it('persists the dispatch transition instead of showing a local-only toast', async () => {
      const transition = vi.spyOn(api, 'transitionLogisticsEvent').mockResolvedValue({
        id: 'evt-001', event_type: 'delivery', operation: 'outbound', status: 'dispatched',
      } as any);
      render(<LogisticsDispatchPage onNavigate={mockNavigate} />);
      await screen.findByText('Livraison Titan');
      fireEvent.click(screen.getByRole('button', { name: 'Démarrer la sortie' }));
      await waitFor(() => expect(transition).toHaveBeenCalledWith('evt-001', expect.objectContaining({ new_status: 'dispatched' })));
    });
  });

  describe('LogisticsReturnsPage', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getReturnOperations').mockResolvedValue([
        {
          id: 'ret-001',
          reservation_draft: 'LOC-2026-0087',
          hahitantsoa_event_draft: null,
          logistics_event: null,
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

    it('validates the return through the backend stock operation', async () => {
      const validate = vi.spyOn(api, 'validateReturnOperation').mockResolvedValue({
        id: 'ret-001', reservation_draft: 'LOC-2026-0087', status: 'validated', lines: [],
      } as any);
      render(<LogisticsReturnsPage onNavigate={mockNavigate} />);
      await screen.findByText('Tous');
      fireEvent.click(screen.getByRole('button', { name: 'Valider le retour' }));
      await waitFor(() => expect(validate).toHaveBeenCalledWith('ret-001'));
    });

    it('filters returns to the dossier supplied by navigation context', async () => {
      render(<LogisticsReturnsPage onNavigate={mockNavigate} param="titan:another-draft" />);
      expect(await screen.findByText('Aucun retour prévu.')).toBeDefined();
    });
  });

  describe('BreakageLossPage', () => {
    beforeEach(() => {
      vi.spyOn(api, 'getDamageLossSettlementExecutions').mockResolvedValue([]);
      vi.spyOn(api, 'getInventoryItems').mockResolvedValue([
        { id: 'MAT-01', name: 'Chaise Napoléon', kind: 'material', description: '' },
      ]);
      vi.spyOn(api, 'getReturnOperations').mockResolvedValue([
        {
          id: 'LOC-2026-0087',
          reservation_draft: 'rd-001',
          hahitantsoa_event_draft: null,
          logistics_event: null,
          document_instance: null,
          status: 'draft',
          notes: '',
          validated_at: null,
          validated_by: null,
          lines: [],
          created_at: '',
          updated_at: '',
          created_by: null,
          updated_by: null,
        },
      ]);
      vi.spyOn(api, 'validateDamageLossSettlement').mockResolvedValue({ id: 'set-001', settlement_status: 'validated' } as any);
      vi.spyOn(api, 'createDamageLossSettlementExecution').mockResolvedValue({ id: 'exec-001', settlement: 'set-001', status: 'draft', excess_receivable: null } as any);
      vi.spyOn(api, 'executeDamageLossSettlementExecution').mockResolvedValue({ id: 'exec-001', settlement: 'set-001', status: 'executed', excess_receivable: null } as any);
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

    it('filters settlements to the dossier supplied by navigation context', async () => {
      render(<BreakageLossPage onNavigate={mockNavigate} param="titan:another-draft" />);
      expect(await screen.findByText('Aucun dossier de casse ou de perte.')).toBeDefined();
    });

    it('executes the validated settlement through the backend lifecycle', async () => {
      const validate = vi.spyOn(api, 'validateDamageLossSettlement');
      const createExecution = vi.spyOn(api, 'createDamageLossSettlementExecution');
      const execute = vi.spyOn(api, 'executeDamageLossSettlementExecution');
      render(<BreakageLossPage onNavigate={mockNavigate} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Valider le règlement' }));
      await waitFor(() => expect(validate).toHaveBeenCalledWith('set-001'));
      expect(createExecution).toHaveBeenCalledWith('set-001');
      expect(execute).toHaveBeenCalledWith('exec-001');
    });

    it('creates a settlement from a validated return with explicit unit amounts', async () => {
      vi.spyOn(api, 'getDamageLossSettlements').mockResolvedValue([]);
      vi.spyOn(api, 'getReturnOperations').mockResolvedValue([
        {
          id: 'ret-002',
          reservation_draft: 'rd-002',
          hahitantsoa_event_draft: null,
          logistics_event: 'out-002',
          document_instance: null,
          status: 'validated',
          notes: '',
          validated_at: '2026-07-20T10:00:00Z',
          validated_by: 'u-01',
          lines: [{
            id: 'rline-002', inventory_item: 'MAT-01', expected_quantity: 3,
            returned_quantity: 3, damaged_quantity: 2, missing_quantity: 0,
            condition_status: 'damaged', notes: 'Rayée', intact_quantity: 1,
            created_at: '', updated_at: '', created_by: null, updated_by: null,
          }],
          created_at: '', updated_at: '', created_by: null, updated_by: null,
        },
      ]);
      const create = vi.spyOn(api, 'createDamageLossSettlement').mockResolvedValue({
        id: 'set-002', return_operation: 'ret-002', settlement_status: 'draft', lines: [],
      } as any);

      render(<BreakageLossPage onNavigate={mockNavigate} />);
      const amount = await screen.findByRole('spinbutton', { name: 'Montant unitaire Chaise Napoléon' });
      fireEvent.change(amount, { target: { value: '75000' } });
      fireEvent.click(screen.getByRole('button', { name: 'Créer le règlement' }));

      await waitFor(() => expect(create).toHaveBeenCalledWith({
        return_operation: 'ret-002',
        document_instance: null,
        notes: 'Déclaration créée depuis le retour contrôlé.',
        lines: [{
          return_operation_line: 'rline-002',
          manual_label: 'Chaise Napoléon',
          settlement_line_kind: 'damage',
          quantity: 2,
          unit_amount: '75000',
          amount_source: 'manual',
          notes: 'Rayée',
        }],
      }));
    });
  });
});
