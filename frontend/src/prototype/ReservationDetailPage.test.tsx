import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import ReservationDetailPage from './ReservationDetailPage';
import type { ReservationDraft, Customer } from '../types';

/* ── mock data ──────────────────────────────────────────────────── */

const MOCK_DRAFT: ReservationDraft = {
  id: 'draft-loc-089',
  public_reference: 'LOC-2026-0089',
  status: 'draft',
  customer_id: 'CUST-001',
  customer_display_name: 'Rakoto Andry',
  start_at: '2026-06-14T09:00:00Z',
  end_at: '2026-06-16T12:00:00Z',
  notes: 'Location chaises pour mariage',
  subtotal_amount: '550000.00',
  delivery_fee: '50000.00',
  discount_amount: '20000.00',
  discount_reason: 'Remise commerciale validée',
  total_amount: '580000.00',
  contract_signed_at: null,
  contract_signed_by_id: null,
  required_deposit_received_at: null,
  required_deposit_received_by_id: null,
  confirmed_at: null,
  confirmed_by_id: null,
  cancelled_at: null,
  cancelled_by_id: null,
  lines: [
    { id: 'l1', inventory_item_id: 'ITEM-01', inventory_item_name: 'Chaise Napoleon', inventory_item_kind: 'article', quantity: 100, unit_rental_price: '5000.00', notes: '' },
    { id: 'l2', inventory_item_id: 'ITEM-02', inventory_item_name: 'Table rectangulaire', inventory_item_kind: 'article', quantity: 10, unit_rental_price: '5000.00', notes: '' },
  ],
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

const MOCK_CUSTOMER: Customer = {
  id: 'CUST-001',
  display_name: 'Rakoto Andry',
  lifecycle_status: 'client',
  party_type: 'individual',
  email: 'rakoto@example.com',
  phone: '+261 34 000 0000',
  address: 'Antananarivo',
  notes: '',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  is_deleted: false,
  deleted_at: null,
  created_by: null,
  updated_by: null,
};

/* ── mock api module ────────────────────────────────────────────── */

const mockGetReservationDraft = vi.fn();
const mockGetCustomer = vi.fn();
const mockGetReservationDraftDocumentInstances = vi.fn();
const mockMarkReservationDraftContractSigned = vi.fn();
const mockConfirmReservationDraft = vi.fn();
const mockGetPayments = vi.fn();
const mockRecordConfirmedDeposit = vi.fn();
const mockGetLifecycle = vi.fn();
const mockCreateReservationDraftAmendment = vi.fn();
const mockGetInventoryItems = vi.fn();

vi.mock('../api', () => ({
  getReservationDraft: (...args: any[]) => mockGetReservationDraft(...args),
  getCustomer: (...args: any[]) => mockGetCustomer(...args),
  getReservationDraftDocumentInstances: (...args: any[]) => mockGetReservationDraftDocumentInstances(...args),
  markReservationDraftContractSigned: (...args: any[]) => mockMarkReservationDraftContractSigned(...args),
  confirmReservationDraft: (...args: any[]) => mockConfirmReservationDraft(...args),
  getPayments: (...args: any[]) => mockGetPayments(...args),
  recordConfirmedDeposit: (...args: any[]) => mockRecordConfirmedDeposit(...args),
  getReservationDraftLifecycle: (...args: any[]) => mockGetLifecycle(...args),
  createReservationDraftAmendment: (...args: any[]) => mockCreateReservationDraftAmendment(...args),
  getInventoryItems: (...args: any[]) => mockGetInventoryItems(...args),
}));

/* ── helper: wait for the draft page to load ────────────────────── */

async function waitForDraftLoad() {
  await waitFor(() => {
    expect(screen.getByText('Rakoto Andry')).toBeInTheDocument();
  });
}

/* ── tests ──────────────────────────────────────────────────────── */

describe('ReservationDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetReservationDraft
      .mockResolvedValueOnce(MOCK_DRAFT)
      .mockResolvedValue({
        ...MOCK_DRAFT,
        contract_signed_at: '2026-07-01T10:00:00Z',
        required_deposit_received_at: '2026-07-02T10:00:00Z',
      });
    mockGetCustomer.mockResolvedValue(MOCK_CUSTOMER);
    mockGetReservationDraftDocumentInstances.mockResolvedValue([]);
    mockGetPayments.mockResolvedValue([]);
    mockRecordConfirmedDeposit.mockResolvedValue({ payment: { id: 'payment-deposit-1' }, replayed: false });
    mockGetLifecycle.mockResolvedValue({
      domain: 'titan',
      dossier_id: MOCK_DRAFT.id,
      public_reference: MOCK_DRAFT.public_reference,
      status: 'draft',
      next_action: 'sign_contract',
      blockers: ['contract_signature_required'],
      owner_id: null,
      steps: [{ key: 'contract', label: 'Contrat signé', status: 'pending', occurred_at: null }],
    });
    mockMarkReservationDraftContractSigned.mockResolvedValue({
      status: 'draft',
      public_reference: 'LOC-2026-0089',
      reservation_draft: { ...MOCK_DRAFT, contract_signed_at: '2026-07-01T10:00:00Z' },
    });
    mockConfirmReservationDraft.mockResolvedValue({
      status: 'confirmed',
      public_reference: 'LOC-2026-0089',
      reservation_draft: {
        ...MOCK_DRAFT,
        status: 'confirmed',
        contract_signed_at: '2026-07-01T10:00:00Z',
        required_deposit_received_at: '2026-07-02T10:00:00Z',
        confirmed_at: '2026-07-03T10:00:00Z',
      },
      blocked_item_count: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the persisted lifecycle next action without replacing the existing dossier flow', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    expect(screen.getByRole('heading', { name: /parcours opérationnel/i })).toBeInTheDocument();
    expect(screen.getByText(/faire signer le contrat/i)).toBeInTheDocument();
    expect(mockGetLifecycle).toHaveBeenCalledWith(MOCK_DRAFT.id);
  });

  it('1. Préparation Titan: redirects quantity entry to the persisted preparation workflow', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    fireEvent.click(screen.getByRole('button', { name: /^Préparation$/i }));

    expect(await screen.findAllByText('À renseigner dans la préparation réelle')).toHaveLength(2);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('2. Retour Titan: redirects quantity and condition entry to the persisted return workflow', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    fireEvent.click(screen.getByRole('button', { name: /Retour \/ Restitution/i }));

    expect(await screen.findAllByText('À saisir dans le retour réel')).toHaveLength(2);
    expect(screen.getAllByText('État enregistré dans le retour réel')).toHaveLength(2);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('3. Actions: contract-signed, deposit-received, confirm buttons appear in sequence', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    // Initially: only "Marquer contrat signé" should appear
    const contractBtn = screen.getByRole('button', { name: /Marquer contrat signé/i });
    expect(contractBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enregistrer et confirmer l'acompte/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmer la réservation/i })).not.toBeInTheDocument();

    // Click contract signed
    fireEvent.click(contractBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enregistrer et confirmer l'acompte/i })).toBeInTheDocument();
    });
    expect(mockMarkReservationDraftContractSigned).toHaveBeenCalledWith('draft-loc-089');

    // Click deposit received
    fireEvent.change(screen.getByLabelText(/Montant de l'acompte/i), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et confirmer l'acompte/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirmer la réservation/i })).toBeInTheDocument();
    });
    expect(mockRecordConfirmedDeposit).toHaveBeenCalledWith(expect.objectContaining({
      reservation_draft: 'draft-loc-089',
      amount: '250000.00',
      idempotency_key: expect.any(String),
    }));

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la réservation/i }));
    await waitFor(() => {
      // After confirmation, status is 'confirmed', no more action buttons
      expect(screen.queryByRole('button', { name: /Marquer contrat signé/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Enregistrer et confirmer l'acompte/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirmer la réservation/i })).not.toBeInTheDocument();
    });
    expect(mockConfirmReservationDraft).toHaveBeenCalledWith('draft-loc-089');
  });

  it("reprend l'enregistrement d'acompte Titan avec la même clé après une erreur réseau", async () => {
    const signedDraft = {
      ...MOCK_DRAFT,
      contract_signed_at: '2026-07-01T10:00:00Z',
    };
    mockGetReservationDraft.mockReset().mockResolvedValue({
      ...signedDraft,
      required_deposit_received_at: '2026-07-02T10:00:00Z',
    });
    mockGetReservationDraft.mockResolvedValueOnce(signedDraft);
    mockRecordConfirmedDeposit.mockReset()
      .mockRejectedValueOnce(new Error('Réseau indisponible'))
      .mockResolvedValueOnce({ payment: { id: 'payment-deposit-1' }, replayed: true });

    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    fireEvent.change(screen.getByLabelText(/Montant de l'acompte/i), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et confirmer l'acompte/i }));
    await waitFor(() => expect(screen.getByText('Réseau indisponible')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et confirmer l'acompte/i }));
    await waitFor(() => expect(mockRecordConfirmedDeposit).toHaveBeenCalledTimes(2));

    expect(mockRecordConfirmedDeposit.mock.calls[1][0].idempotency_key)
      .toBe(mockRecordConfirmedDeposit.mock.calls[0][0].idempotency_key);
    expect(screen.getByText(/repris sans doublon/i)).toBeInTheDocument();
  });

  it("conserve la clé d'acompte quand le rechargement après écriture échoue", async () => {
    const signedDraft = {
      ...MOCK_DRAFT,
      contract_signed_at: '2026-07-01T10:00:00Z',
    };
    mockGetReservationDraft.mockReset()
      .mockResolvedValueOnce(signedDraft)
      .mockRejectedValueOnce(new Error('Lecture indisponible'))
      .mockResolvedValue({
        ...signedDraft,
        required_deposit_received_at: '2026-07-02T10:00:00Z',
      });
    mockRecordConfirmedDeposit.mockReset()
      .mockResolvedValue({ payment: { id: 'payment-deposit-1' }, replayed: true });

    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    fireEvent.change(screen.getByLabelText(/Montant de l'acompte/i), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et confirmer l'acompte/i }));
    await waitFor(() => expect(screen.getByText('Lecture indisponible')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer et confirmer l'acompte/i }));
    await waitFor(() => expect(mockRecordConfirmedDeposit).toHaveBeenCalledTimes(2));

    expect(mockRecordConfirmedDeposit.mock.calls[1][0].idempotency_key)
      .toBe(mockRecordConfirmedDeposit.mock.calls[0][0].idempotency_key);
  });

  it('affiche les avertissements contractuels Titan sans bloquer le dossier', async () => {
    mockGetReservationDraftDocumentInstances.mockResolvedValue([
      {
        id: 'contract-1',
        template_key: 'titan.material_contract.v1',
        contract_warnings: [
          {
            code: 'missing_customer_birth_date',
            message: 'La date de naissance du client est à compléter.',
          },
        ],
      },
    ]);

    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    expect(screen.getByText('Informations contractuelles à compléter')).toBeInTheDocument();
    expect(screen.getByText('La date de naissance du client est à compléter.')).toBeInTheDocument();
    expect(screen.getByText('Le contrat reste générable. Complétez ces informations dès que possible.')).toBeInTheDocument();
  });

  it('4. Loading then draft rendered: customer name and dates visible', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);

    // Should show loading first
    expect(screen.getByText(/Chargement/)).toBeInTheDocument();

    // Then show the content
    await waitForDraftLoad();
    expect(screen.getAllByText(/LOC-2026-0089/).length).toBeGreaterThan(0);
  });

  it('affiche le détail commercial persisté par le serveur', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    const totalLabel = screen.getByText('Total TTC');
    expect(totalLabel).toBeInTheDocument();
    expect(totalLabel.parentElement).toHaveTextContent(/580.*Ar/);
    expect(screen.getByText('Sous-total location').parentElement).toHaveTextContent(/550.*Ar/);
    expect(screen.getByText('Livraison').parentElement).toHaveTextContent(/50.*Ar/);
    expect(screen.getByText(/Remise — Remise commerciale validée/).parentElement).toHaveTextContent(/20.*Ar/);
  });

  it('affiche le bandeau de liste d attente et le bouton d arbitrage', async () => {
    mockGetReservationDraft.mockReset();
    mockGetReservationDraft.mockResolvedValue({
      ...MOCK_DRAFT,
      notes: "[LISTE D'ATTENTE] Demande en attente de disponibilité matériels",
    });

    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    expect(screen.getByText(/Dossier en liste d'attente/i)).toBeInTheDocument();
    expect(screen.getByText(/Demande en attente de disponibilité matériels/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arbitrer \/ Déplacer la période/i })).toBeInTheDocument();

    // Click arbitration button
    fireEvent.click(screen.getByRole('button', { name: /Arbitrer \/ Déplacer la période/i }));
    expect(await screen.findByText(/Arbitrage & Relocalisation/i)).toBeInTheDocument();
  });

  it('ouvre le formulaire d avenant Titan, ajuste les articles et recharge le dossier', async () => {
    mockCreateReservationDraftAmendment.mockResolvedValue({ id: 'amend-1' });
    mockGetInventoryItems.mockResolvedValue([
      { id: 'ITEM-03', name: 'Tente Blanche 3x3m', kind: 'material', rental_price: '75000.00' },
    ]);

    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    // Switch to avenants tab
    const avenantsTab = screen.getByRole('button', { name: /Avenants/i });
    fireEvent.click(avenantsTab);

    // Click on Nouvel avenant Titan
    const openBtn = screen.getByRole('button', { name: /Créer un avenant|Nouvel avenant/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole('heading', { name: /Nouvel avenant Titan/i })).toBeInTheDocument();

    // Step 1: Motif
    const reasonInput = screen.getByLabelText(/Motif de l’avenant/i);
    fireEvent.change(reasonInput, { target: { value: 'Ajout chaises et tente' } });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continuer/i }));
    expect(await screen.findByText(/Modifier la période de location/i)).toBeInTheDocument();

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /Continuer/i }));
    expect(await screen.findByText(/Modifier les articles loués/i)).toBeInTheDocument();

    // Search catalog
    const searchInput = screen.getByPlaceholderText(/Rechercher un article Titan/i);
    fireEvent.change(searchInput, { target: { value: 'Tente' } });

    expect(await screen.findByText('Tente Blanche 3x3m')).toBeInTheDocument();
    const addBtn = screen.getByRole('button', { name: /\+ Ajouter/i });
    fireEvent.click(addBtn);

    // Step 3 -> Step 4
    fireEvent.click(screen.getByRole('button', { name: /Continuer/i }));

    // Step 4: Resume & Submit
    expect(screen.getByText(/Vérifier l’avenant/i)).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /Générer l’avenant/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateReservationDraftAmendment).toHaveBeenCalledWith(
        'draft-loc-089',
        expect.objectContaining({
          reason: 'Ajout chaises et tente',
          changed_lines: expect.arrayContaining([
            expect.objectContaining({ inventory_item_id: 'ITEM-01', quantity: 100 }),
            expect.objectContaining({ inventory_item_id: 'ITEM-02', quantity: 10 }),
            expect.objectContaining({ inventory_item_id: 'ITEM-03', quantity: 1 }),
          ]),
        }),
      );
      // Reload draft after amendment
      expect(mockGetReservationDraft).toHaveBeenCalledTimes(2);
    });
  });
});
