import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';


import PaymentWorkflowPanel from './PaymentWorkflowPanel';

// ─── mocks ────────────────────────────────────────────────────────────────────

const MOCK_PAYMENT_PENDING = {
  id: 'aaaa-1111',
  reservation_draft: null,
  hahitantsoa_event_draft: null,
  receipt_document: null,
  refund_obligation: null,
  billing_refund_obligation: null,
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
    reservation_draft: 'draft-0001',
    customer: 'cust-0001',
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
    valid_until: null,
    notes: '',
    created_at: '2026-06-01T11:00:00Z',
    updated_at: '2026-06-01T11:00:00Z',
  },
};

vi.mock('./api', () => ({
  getPayments: vi.fn(),
  createPayment: vi.fn(),
  confirmPayment: vi.fn(),
  cancelPayment: vi.fn(),
  reconcilePayment: vi.fn(),
  checkEndpointPermission: vi.fn().mockResolvedValue(true),
}));

import * as api from './api';

// ─── tests ────────────────────────────────────────────────────────────────────

describe('PaymentWorkflowPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.checkEndpointPermission).mockResolvedValue(true);
  });

  it('shows loading state initially', () => {
    render(<PaymentWorkflowPanel />);
    expect(screen.getByText('Chargement des paiements...')).toBeInTheDocument();
  });

  it('renders payment list after loading', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByTestId(`payment-row-${MOCK_PAYMENT_PENDING.id}`)).toBeInTheDocument();
    });

    expect(screen.getByText('Dépôt')).toBeInTheDocument();
    expect(screen.getByText(/Direct client/)).toBeInTheDocument();
  });

  it('shows empty state when no payments', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Aucun paiement enregistré/)).toBeInTheDocument();
    });
  });

  it('shows Confirm button for pending payments', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Confirmer le paiement aaaa-1111/ }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Annuler le paiement aaaa-1111' })).toBeInTheDocument();
  });

  it('shows Reconcile only for a confirmed payment and no lifecycle action for terminal states', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([
      MOCK_PAYMENT_CONFIRMED,
      { ...MOCK_PAYMENT_PENDING, id: 'failed-1', payment_status: 'failed' as const },
      { ...MOCK_PAYMENT_PENDING, id: 'cancelled-1', payment_status: 'cancelled' as const },
      { ...MOCK_PAYMENT_PENDING, id: 'reconciled-1', payment_status: 'reconciled' as const },
    ]);

    render(<PaymentWorkflowPanel />);

    expect(await screen.findByRole('button', { name: 'Rapprocher le paiement bbbb-2222' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /failed-1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelled-1/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reconciled-1/ })).not.toBeInTheDocument();
  });

  it('uses neutral copy and keeps lifecycle actions hidden when coarse write gating is unavailable', async () => {
    vi.mocked(api.checkEndpointPermission).mockResolvedValueOnce(false);
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    expect(await screen.findByTestId('payment-row-aaaa-1111')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Actions indisponibles pour cette session.')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Confirmer le paiement/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Annuler le paiement/ })).not.toBeInTheDocument();
  });

  it('shows neutral capability-checking copy without flashing write controls', async () => {
    vi.mocked(api.checkEndpointPermission).mockImplementationOnce(() => new Promise(() => {}));
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    expect(await screen.findByText('Vérification de la disponibilité des actions...')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ouvrir le formulaire de paiement')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmer le paiement/ })).not.toBeInTheDocument();
  });

  it('shows receipt info for confirmed payments', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_CONFIRMED]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Reçu généré')).toBeInTheDocument();
    });
  });

  it('renders refund in French without exposing generic creation or confirmation', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([
      {
        ...MOCK_PAYMENT_PENDING,
        id: 'refund-1',
        payment_kind: 'refund' as const,
      },
    ]);

    render(<PaymentWorkflowPanel />);

    expect(await screen.findByText('Remboursement')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmer le paiement refund-1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler le paiement refund-1' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Ouvrir le formulaire de paiement'));
    expect(screen.queryByRole('option', { name: 'Remboursement' })).not.toBeInTheDocument();
  });

  it('opens and submits the create payment form', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([]);
    vi.mocked(api.createPayment).mockResolvedValueOnce(MOCK_PAYMENT_PENDING);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Aucun paiement enregistré/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Ouvrir le formulaire de paiement'));

    expect(screen.getByLabelText('Formulaire de paiement')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Montant (MGA)'), {
      target: { name: 'amount', value: '150000' },
    });
    fireEvent.change(screen.getByLabelText(/Libellé source/), {
      target: { name: 'source_label', value: 'Direct client' },
    });

    fireEvent.submit(screen.getByLabelText('Formulaire de paiement'));

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
      expect(screen.getByLabelText(/Confirmer le paiement aaaa-1111/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirmer le paiement aaaa-1111'));

    expect(screen.getByRole('dialog', { name: 'Confirmer le paiement' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmer et générer le reçu')).toBeInTheDocument();
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
      expect(screen.getByLabelText('Confirmer le paiement aaaa-1111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirmer le paiement aaaa-1111'));
    fireEvent.click(screen.getByLabelText('Confirmer et générer le reçu'));

    await waitFor(() => {
      expect(api.confirmPayment).toHaveBeenCalledWith(
        MOCK_PAYMENT_PENDING.id,
        expect.objectContaining({ paid_at: expect.any(String) }),
        expect.any(AbortSignal),
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Reçu généré')).toBeInTheDocument();
    });
  });

  it('shows error when confirm API fails', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);
    vi.mocked(api.confirmPayment).mockRejectedValueOnce(new Error('Confirmation failed.'));

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Confirmer le paiement aaaa-1111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirmer le paiement aaaa-1111'));
    fireEvent.click(screen.getByLabelText('Confirmer et générer le reçu'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Confirmation failed.');
    });
  });

  it('has accessible confirm dialog with aria-modal', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Confirmer le paiement aaaa-1111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirmer le paiement aaaa-1111'));

    const dialog = screen.getByRole('dialog', { name: 'Confirmer le paiement' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(screen.getByLabelText('Payé le')).toHaveFocus());

    const lastButton = screen.getByLabelText('Confirmer et générer le reçu');
    lastButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Payé le')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastButton).toHaveFocus();
  });

  it('restores focus to the confirm trigger after Escape closes the dialog', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    const trigger = await screen.findByLabelText('Confirmer le paiement aaaa-1111');
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByLabelText('Payé le')).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('disables confirm dialog buttons while submitting', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);
    vi.mocked(api.confirmPayment).mockImplementationOnce(() => new Promise(() => {}));

    render(<PaymentWorkflowPanel />);

    await waitFor(() => {
      expect(screen.getByLabelText('Confirmer le paiement aaaa-1111')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirmer le paiement aaaa-1111'));

    await waitFor(() => {
      expect(screen.getByLabelText('Confirmer et générer le reçu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Confirmer et générer le reçu'));

    await waitFor(() => {
      expect(screen.getByLabelText('Confirmer et générer le reçu')).toBeDisabled();
      expect(screen.getByLabelText('Annuler la confirmation')).toBeDisabled();
    });
  });

  it('cancels a pending payment with optional notes and replaces the returned row', async () => {
    const cancelled = {
      ...MOCK_PAYMENT_PENDING,
      payment_status: 'cancelled' as const,
      notes: 'Doublon saisi',
    };
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);
    vi.mocked(api.cancelPayment).mockResolvedValueOnce(cancelled);

    render(<PaymentWorkflowPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le paiement aaaa-1111' }));
    const dialog = screen.getByRole('dialog', { name: 'Annuler le paiement' });
    expect(dialog).toHaveTextContent('Paiement aaaa-1111 — 150 000,00 MGA');
    expect(dialog).toHaveTextContent('ne pourra plus être confirmé');

    fireEvent.change(screen.getByLabelText('Notes (optionnel)'), {
      target: { value: '  Doublon saisi  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le paiement' }));

    await waitFor(() => {
      expect(api.cancelPayment).toHaveBeenCalledWith(
        MOCK_PAYMENT_PENDING.id,
        { notes: 'Doublon saisi' },
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByLabelText('Statut du paiement : Annulé')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler le paiement aaaa-1111' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('payment-row-aaaa-1111')).toHaveFocus());
  });

  it('reconciles a confirmed payment and sends an empty payload when notes are blank', async () => {
    const reconciled = {
      ...MOCK_PAYMENT_CONFIRMED,
      payment_status: 'reconciled' as const,
    };
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_CONFIRMED]);
    vi.mocked(api.reconcilePayment).mockResolvedValueOnce(reconciled);

    render(<PaymentWorkflowPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rapprocher le paiement bbbb-2222' }));
    expect(screen.getByRole('dialog', { name: 'Rapprocher le paiement' })).toHaveTextContent(
      'passera à l’état Rapproché',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rapprocher le paiement' }));

    await waitFor(() => {
      expect(api.reconcilePayment).toHaveBeenCalledWith(
        MOCK_PAYMENT_CONFIRMED.id,
        {},
        expect.any(AbortSignal),
      );
    });
    expect(await screen.findByLabelText('Statut du paiement : Rapproché')).toBeInTheDocument();
  });

  it('closes the lifecycle dialog with Escape or its backdrop before submission', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);

    render(<PaymentWorkflowPanel />);

    const trigger = await screen.findByRole('button', { name: 'Annuler le paiement aaaa-1111' });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByLabelText('Notes (optionnel)')).toHaveFocus());

    const submitButton = screen.getByRole('button', { name: 'Annuler le paiement' });
    submitButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByLabelText('Notes (optionnel)')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(submitButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Annuler le paiement' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByLabelText('Notes (optionnel)')).toHaveFocus());
    fireEvent.click(screen.getByTestId('payment-action-dialog-backdrop'));
    expect(screen.queryByRole('dialog', { name: 'Annuler le paiement' })).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('disables lifecycle dialog controls while submitting', async () => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);
    vi.mocked(api.cancelPayment).mockImplementationOnce(() => new Promise(() => {}));

    render(<PaymentWorkflowPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le paiement aaaa-1111' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le paiement' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Traitement...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Retour' })).toBeDisabled();
      expect(screen.getByLabelText('Notes (optionnel)')).toBeDisabled();
    });
  });

  it.each([
    [400, 'Le paiement est déjà confirmé', 'Action impossible : Le paiement est déjà confirmé'],
    [404, 'Not found', 'Ce paiement est introuvable.'],
  ])('closes stale %i dialog and reports a successful list refresh', async (status, detail, expected) => {
    vi.mocked(api.getPayments)
      .mockResolvedValueOnce([MOCK_PAYMENT_PENDING])
      .mockResolvedValueOnce([]);
    vi.mocked(api.cancelPayment).mockRejectedValueOnce(
      Object.assign(new Error(detail), { status }),
    );

    render(<PaymentWorkflowPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le paiement aaaa-1111' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le paiement' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert).toHaveTextContent('La liste a été actualisée depuis le serveur.');
    await waitFor(() => expect(api.getPayments).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog', { name: 'Annuler le paiement' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('payment-workflow-panel')).toHaveFocus());
  });

  it('closes a stale dialog, preserves the warning and blocks stale actions when refresh fails', async () => {
    vi.mocked(api.getPayments)
      .mockResolvedValueOnce([MOCK_PAYMENT_PENDING])
      .mockRejectedValueOnce(new Error('Refresh failed'));
    vi.mocked(api.cancelPayment).mockRejectedValueOnce(
      Object.assign(new Error('État modifié'), { status: 400 }),
    );

    render(<PaymentWorkflowPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le paiement aaaa-1111' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le paiement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Action impossible : État modifié. L’actualisation a échoué',
    );
    expect(screen.queryByRole('dialog', { name: 'Annuler le paiement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler le paiement aaaa-1111' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('payment-row-aaaa-1111')).toHaveFocus());
  });

  it('aborts an in-flight lifecycle request when the panel unmounts', async () => {
    let actionSignal: AbortSignal | undefined;
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_PENDING]);
    vi.mocked(api.cancelPayment).mockImplementationOnce((_id, _payload, signal) => {
      actionSignal = signal;
      return new Promise(() => {});
    });

    const { unmount } = render(<PaymentWorkflowPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler le paiement aaaa-1111' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le paiement' }));
    await waitFor(() => expect(actionSignal).toBeDefined());

    unmount();
    expect(actionSignal?.aborted).toBe(true);
  });

  it.each([
    [403, Object.assign(new Error('Forbidden'), { status: 403 }), /n’avez pas l’autorisation/],
    [0, new TypeError('Failed to fetch'), /Connexion au serveur impossible/],
  ])('maps action failure case %i to a useful French message', async (_case, failure, expected) => {
    vi.mocked(api.getPayments).mockResolvedValueOnce([MOCK_PAYMENT_CONFIRMED]);
    vi.mocked(api.reconcilePayment).mockRejectedValueOnce(failure);

    render(<PaymentWorkflowPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rapprocher le paiement bbbb-2222' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rapprocher le paiement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });

  it('disables Refresh button while loading', () => {
    vi.mocked(api.getPayments).mockImplementationOnce(() => new Promise(() => {}));

    render(<PaymentWorkflowPanel />);

    expect(screen.getByLabelText('Actualiser les paiements')).toBeDisabled();
    expect(screen.getByLabelText('Actualiser les paiements')).toHaveTextContent('Chargement...');
  });
});
