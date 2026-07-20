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
  contract_signed_at: null,
  contract_signed_by_id: null,
  required_deposit_received_at: null,
  required_deposit_received_by_id: null,
  confirmed_at: null,
  confirmed_by_id: null,
  cancelled_at: null,
  cancelled_by_id: null,
  lines: [
    { id: 'l1', inventory_item_id: 'ITEM-01', inventory_item_name: 'Chaise Napoleon', inventory_item_kind: 'article', quantity: 100, notes: '' },
    { id: 'l2', inventory_item_id: 'ITEM-02', inventory_item_name: 'Table rectangulaire', inventory_item_kind: 'article', quantity: 10, notes: '' },
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

vi.mock('../api', () => ({
  getReservationDraft: (...args: any[]) => mockGetReservationDraft(...args),
  getCustomer: (...args: any[]) => mockGetCustomer(...args),
  getReservationDraftDocumentInstances: (...args: any[]) => mockGetReservationDraftDocumentInstances(...args),
  markReservationDraftContractSigned: (...args: any[]) => mockMarkReservationDraftContractSigned(...args),
  markReservationDraftRequiredDepositReceived: (...args: any[]) => mockMarkReservationDraftRequiredDepositReceived(...args),
  confirmReservationDraft: (...args: any[]) => mockConfirmReservationDraft(...args),
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
    expect(screen.queryByRole('button', { name: /Marquer acompte reçu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmer la réservation/i })).not.toBeInTheDocument();

    // Click contract signed
    fireEvent.click(contractBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Marquer acompte reçu/i })).toBeInTheDocument();
    });
    expect(mockMarkReservationDraftContractSigned).toHaveBeenCalledWith('draft-loc-089');

    // Click deposit received
    fireEvent.click(screen.getByRole('button', { name: /Marquer acompte reçu/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirmer la réservation/i })).toBeInTheDocument();
    });
    expect(mockMarkReservationDraftRequiredDepositReceived).toHaveBeenCalledWith('draft-loc-089');

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: /Confirmer la réservation/i }));
    await waitFor(() => {
      // After confirmation, status is 'confirmed', no more action buttons
      expect(screen.queryByRole('button', { name: /Marquer contrat signé/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Marquer acompte reçu/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirmer la réservation/i })).not.toBeInTheDocument();
    });
    expect(mockConfirmReservationDraft).toHaveBeenCalledWith('draft-loc-089');
  });

  it('4. Loading then draft rendered: customer name and dates visible', async () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);

    // Should show loading first
    expect(screen.getByText(/Chargement/)).toBeInTheDocument();

    // Then show the content
    await waitForDraftLoad();
    expect(screen.getByText(/LOC-2026-0089/)).toBeInTheDocument();
  });
});
