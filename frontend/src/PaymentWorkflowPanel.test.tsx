import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import PaymentWorkflowPanel from './PaymentWorkflowPanel';

// ─── mocks ────────────────────────────────────────────────────────────────────

const MOCK_PAYMENT_PENDING = {
  id: 'aaaa-1111',
  reservation_draft: null,
  receipt_document: null,
  payment_kind: 'deposit' as const,
  payment_method: 'cash' as const,
  payment_status: 'pending' as const,
  amount: '150000.00',
  paid_at: null,
  external_reference: '',
  source_label: 'Direct client',
  notes: '',
  confirmed_at: null,
  confirmed_by: null,
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

const MOCK_PAYMENT_CONFIRMED = {
  ...MOCK_PAYMENT_PENDING,
  id: 'bbbb-2222',
  payment_status: 'confirmed' as const,
  paid_at: '2026-06-01T11:00:00Z',
  receipt_document: {
    id: 'doc-0001',
    status: 'generated' as const,
    template_key: 'shared.payment_receipt.v1',
    template_version: '1',
    template_label: 'Payment Receipt',
    business_scope: 'hahitantsoa',
    document_type: 'receipt',
    template_status: 'active',
    template_source_kind: 'static',
    template_source_reference: '',
    template_path: '',
    template_preview_path: '',
    template_validated_by_client: true,
    template_notes: '',
    reservation_public_reference: '',
    reservation_status: '',
    customer_display_name: 'Direct client',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    prepared_at: '2026-06-01T11:00:00Z',
    prepared_by: 'system',
    voided_at: null,
    voided_by: null,
    void_reason: '',
    content_checksum: 'abc123',
    storage_path: '/receipts/doc-0001.html',
    generated_content_size_bytes: 1024,
    notes: '',
    created_at: '2026-06-01T11:00:00Z',
    updated_at: '2026-06-01T11:00:00Z',
  },
};

vi.mock('./api', () => ({
  getPayments: vi.fn(),
  createPayment: vi.fn(),
  confirmPayment: vi.fn(),
}));

import * as api from './api';

// ─── tests ────────────────────────────────────────────────────────────────────

describe('PaymentWorkflowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders payment list after loading', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByTestId(`payment-row-${MOCK_PAYMENT_PENDING.id}`)).toBeInTheDocument();
    });

    expect(screen.getByText('deposit')).toBeInTheDocument();
    expect(screen.getByText(/Direct client/)).toBeInTheDocument();
  });

  it('shows empty state when no payments', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByText(/No payments recorded yet/)).toBeInTheDocument();
    });
  });

  it('shows Confirm button for pending payments', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Confirm payment aaaa-1111/ }),
      ).toBeInTheDocument();
    });
  });

  it('shows receipt info for confirmed payments', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_CONFIRMED]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Receipt generated')).toBeInTheDocument();
    });
  });

  it('opens and submits the create payment form', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([]);
    vi.mocked(api.createPayment).mockResolvedValueOnce(MOCK_PAYMENT_PENDING);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByText(/No payments recorded yet/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Open create payment form'));

    expect(screen.getByLabelText('Create payment form')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Amount (MGA)'), {
      target: { name: 'amount', value: '150000' },
    });
    fireEvent.change(screen.getByLabelText(/Source Label/), {
      target: { name: 'source_label', value: 'Direct client' },
    });

    fireEvent.submit(screen.getByLabelText('Create payment form'));

    await waitFor(() => {
      expect(api.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '150000', source_label: 'Direct client' }),
        expect.any(AbortSignal),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId(`payment-row-${MOCK_PAYMENT_PENDING.id}`)).toBeInTheDocument();
    });
  });

  it('opens confirm dialog when Confirm button is clicked', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Confirm payment aaaa-1111/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirm payment aaaa-1111'));

    expect(screen.getByRole('dialog', { name: 'Confirm payment dialog' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm and generate receipt')).toBeInTheDocument();
  });

  it('confirms payment and updates the list', async () => {
    const confirmed = {
      ...MOCK_PAYMENT_PENDING,
      payment_status: 'confirmed' as const,
      receipt_document: MOCK_PAYMENT_CONFIRMED.receipt_document,
    };

    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);
    vi.mocked(api.confirmPayment).mockResolvedValueOnce(confirmed);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Confirm payment aaaa-1111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirm payment aaaa-1111'));
    fireEvent.click(screen.getByLabelText('Confirm and generate receipt'));

    await waitFor(() => {
      expect(api.confirmPayment).toHaveBeenCalledWith(
        MOCK_PAYMENT_PENDING.id,
        expect.objectContaining({ paid_at: expect.any(String) }),
        expect.any(AbortSignal),
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Receipt generated')).toBeInTheDocument();
    });
  });

  it('shows error when confirm API fails', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);
    vi.mocked(api.confirmPayment).mockRejectedValueOnce(new Error('Confirmation failed.'));

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Confirm payment aaaa-1111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirm payment aaaa-1111'));
    fireEvent.click(screen.getByLabelText('Confirm and generate receipt'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Confirmation failed.');
    });
  });
});
