import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import BillingInvoicePanel from './BillingInvoicePanel';
import type { BillingInvoice, Payment } from './types';

const MOCK_INVOICE: BillingInvoice = {
  id: 'inv-0001',
  excess_receivable: 'er-0001',
  document_instance: null,
  reservation_draft: null,
  source_kind: 'inventory_damage_loss_excess_receivable',
  invoice_status: 'open',
  amount: '150000.00',
  issued_at: '2026-06-18T10:00:00Z',
  settled_at: null,
  settled_by: null,
  notes: '',
  settlement: null,
  created_at: '2026-06-18T10:00:00Z',
  updated_at: '2026-06-18T10:00:00Z',
};

const MOCK_SETTLED_INVOICE: BillingInvoice = {
  ...MOCK_INVOICE,
  id: 'inv-0002',
  invoice_status: 'settled',
  settled_at: '2026-06-18T12:00:00Z',
  amount: '50000.00',
  settlement: {
    id: 'stl-0001',
    payment: {
      id: 'pay-0001',
      reservation_draft: null,
      receipt_document: null,
      payment_kind: 'deposit',
      payment_method: 'cash',
      payment_status: 'confirmed',
      amount: '50000.00',
      paid_at: '2026-06-18T12:00:00Z',
      external_reference: '',
      source_label: 'Billing settlement',
      notes: '',
      confirmed_at: '2026-06-18T12:00:00Z',
      confirmed_by: null,
      created_at: '2026-06-18T12:00:00Z',
      updated_at: '2026-06-18T12:00:00Z',
    },
    amount: '50000.00',
    settled_at: '2026-06-18T12:00:00Z',
    settled_by: null,
    notes: '',
    created_at: '2026-06-18T12:00:00Z',
    updated_at: '2026-06-18T12:00:00Z',
  },
};

describe('BillingInvoicePanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the panel with heading', async () => {
    vi.spyOn(api, 'getBillingInvoices').mockResolvedValue([]);
    render(<BillingInvoicePanel />);
    expect(screen.getByTestId('billing-invoice-panel')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('shows empty state when no invoices exist', async () => {
    vi.spyOn(api, 'getBillingInvoices').mockResolvedValue([]);
    render(<BillingInvoicePanel />);
    await waitFor(() => {
      expect(screen.getByText('No invoices recorded yet.')).toBeInTheDocument();
    });
  });

  it('renders an open invoice with amount and status', async () => {
    vi.spyOn(api, 'getBillingInvoices').mockResolvedValue([MOCK_INVOICE]);
    render(<BillingInvoicePanel />);
    await waitFor(() => {
      expect(screen.getByTestId('invoice-row-inv-0001')).toBeInTheDocument();
    });
    expect(screen.getByText('150 000,00 MGA')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Unsettled')).toBeInTheDocument();
  });

  it('renders a settled invoice showing settlement status', async () => {
    vi.spyOn(api, 'getBillingInvoices').mockResolvedValue([MOCK_SETTLED_INVOICE]);
    render(<BillingInvoicePanel />);
    await waitFor(() => {
      expect(screen.getByTestId('invoice-row-inv-0002')).toBeInTheDocument();
    });
    expect(screen.getByText('50 000,00 MGA')).toBeInTheDocument();
    const settledElements = screen.getAllByText('Settled');
    expect(settledElements.length).toBe(2);
  });

  it('renders multiple invoices in a list', async () => {
    vi.spyOn(api, 'getBillingInvoices').mockResolvedValue([MOCK_INVOICE, MOCK_SETTLED_INVOICE]);
    render(<BillingInvoicePanel />);
    await waitFor(() => {
      expect(screen.getAllByTestId(/invoice-row-/).length).toBe(2);
    });
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('shows error message when the API fails', async () => {
    vi.spyOn(api, 'getBillingInvoices').mockRejectedValue(new Error('Network error'));
    render(<BillingInvoicePanel />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});
