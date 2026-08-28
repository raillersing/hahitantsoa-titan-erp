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
const mockMarkReservationDraftRequiredDepositReceived = vi.fn();
const mockConfirmReservationDraft = vi.fn();
const mockGetPayments = vi.fn();
const mockCreatePayment = vi.fn();
const mockConfirmPayment = vi.fn();

vi.mock('../api', () => ({
  getReservationDraft: (...args: any[]) => mockGetReservationDraft(...args),
  getCustomer: (...args: any[]) => mockGetCustomer(...args),
  getReservationDraftDocumentInstances: (...args: any[]) => mockGetReservationDraftDocumentInstances(...args),
  markReservationDraftContractSigned: (...args: any[]) => mockMarkReservationDraftContractSigned(...args),
  markReservationDraftRequiredDepositReceived: (...args: any[]) => mockMarkReservationDraftRequiredDepositReceived(...args),
  confirmReservationDraft: (...args: any[]) => mockConfirmReservationDraft(...args),
  getPayments: (...args: any[]) => mockGetPayments(...args),
  createPayment: (...args: any[]) => mockCreatePayment(...args),
  confirmPayment: (...args: any[]) => mockConfirmPayment(...args),
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
    mockGetReservationDraft.mockResolvedValue(MOCK_DRAFT);
    mockGetCustomer.mockResolvedValue(MOCK_CUSTOMER);
    mockGetReservationDraftDocumentInstances.mockResolvedValue([]);
    mockGetPayments.mockResolvedValue([]);
    mockCreatePayment.mockResolvedValue({ id: 'payment-deposit-1' });
    mockConfirmPayment.mockResolvedValue({ id: 'payment-deposit-1', payment_status: 'confirmed' });
    mockMarkReservationDraftContractSigned.mockResolvedValue({
      status: 'draft',
      public_reference: 'LOC-2026-0089',
      reservation_draft: { ...MOCK_DRAFT, contract_signed_at: '2026-07-01T10:00:00Z' },
    });
    mockMarkReservationDraftRequiredDepositReceived.mockResolvedValue({
      status: 'draft',
      public_reference: 'LOC-2026-0089',
      reservation_draft: {
        ...MOCK_DRAFT,
        contract_signed_at: '2026-07-01T10:00:00Z',
        required_deposit_received_at: '2026-07-02T10:00:00Z',
      },
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

  it('1. Préparation Titan: clamp prep quantities to ordered quantity', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    fireEvent.click(screen.getByRole('button', { name: /^Préparation$/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2);
    });

    const inputs = screen.getAllByRole('spinbutton');
    const prepQty1 = inputs[0] as HTMLInputElement;
    const prepQty2 = inputs[1] as HTMLInputElement;

    expect(prepQty1).toHaveAttribute('max', '100');
    expect(prepQty2).toHaveAttribute('max', '10');

    // Clamp > max
    fireEvent.change(prepQty1, { target: { value: '150' } });
    expect(prepQty1).toHaveValue(100);

    // Clamp < min
    fireEvent.change(prepQty1, { target: { value: '-10' } });
    expect(prepQty1).toHaveValue(0);
  });

  it('2. Retour Titan: clamp return quantities to ordered quantity', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    await waitForDraftLoad();

    fireEvent.click(screen.getByRole('button', { name: /Retour \/ Restitution/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThanOrEqual(2);
    });

    const inputs = screen.getAllByRole('spinbutton');
    const returnQty1 = inputs[0] as HTMLInputElement;
    const returnQty2 = inputs[1] as HTMLInputElement;

    expect(returnQty1).toHaveAttribute('max', '100');
    expect(returnQty2).toHaveAttribute('max', '10');

    // Clamp > max
    fireEvent.change(returnQty1, { target: { value: '120' } });
    expect(returnQty1).toHaveValue(100);

    // Clamp < min
    fireEvent.change(returnQty1, { target: { value: '-5' } });
    expect(returnQty1).toHaveValue(0);
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
    expect(mockMarkReservationDraftRequiredDepositReceived).toHaveBeenCalledWith('draft-loc-089');
    expect(mockCreatePayment).toHaveBeenCalledWith(expect.objectContaining({ amount: '250000.00' }));
    expect(mockConfirmPayment).toHaveBeenCalledWith('payment-deposit-1', {});

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
    expect(screen.getByText(/LOC-2026-0089/)).toBeInTheDocument();
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
});
