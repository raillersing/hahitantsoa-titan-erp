import './payment-styles.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { checkEndpointPermission, confirmPayment, createPayment, getPayments } from './api';
import {
  Payment,
  PaymentConfirmPayload,
  PaymentCreatePayload,
  PaymentKind,
  PaymentMethod,
} from './types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: Payment['payment_status']): string {
  const map: Record<Payment['payment_status'], string> = {
    pending: 'var(--payment-status-pending)',
    confirmed: 'var(--payment-status-confirmed)',
    failed: 'var(--payment-status-failed)',
    cancelled: 'var(--payment-status-cancelled)',
    reconciled: 'var(--payment-status-reconciled)',
  };
  return map[status] ?? 'var(--muted-fg)';
}

function formatAmount(amount: string): string {
  return new Intl.NumberFormat('fr-MG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(amount));
}

const PAYMENT_KINDS: PaymentKind[] = [
  'deposit',
  'balance',
  'caution',
  'owner_injection',
  'investor_injection',
  'date_reservation',
  'other',
];
const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'mobile_money',
  'cheque',
  'other',
];

// ─── PaymentRow ───────────────────────────────────────────────────────────────

interface PaymentRowProps {
  payment: Payment;
  onConfirm: (id: string) => void;
  confirming: boolean;
}

function PaymentRow({ payment, onConfirm, confirming }: PaymentRowProps) {
  return (
    <div className="payment-row" data-testid={`payment-row-${payment.id}`}>
      <div className="payment-row__meta">
        <span className="payment-row__kind">{payment.payment_kind.replace(/_/g, ' ')}</span>
        <span className="payment-row__method">{payment.payment_method.replace(/_/g, ' ')}</span>
        {payment.source_label && (
          <span className="payment-row__source">{payment.source_label}</span>
        )}
      </div>
      <div className="payment-row__amount">
        {formatAmount(payment.amount)}{' '}
        <span className="payment-row__currency">MGA</span>
      </div>
      <div
        className="payment-row__status-badge"
        style={{ color: statusColor(payment.payment_status) }}
        aria-label={`Payment status: ${payment.payment_status}`}
      >
        {payment.payment_status}
      </div>
      {payment.payment_status === 'pending' && (
        <button
          className="payment-confirm-btn"
          onClick={() => onConfirm(payment.id)}
          disabled={confirming}
          aria-label={`Confirm payment ${payment.id}`}
        >
          {confirming ? 'Confirming...' : 'Confirm'}
        </button>
      )}
      {payment.receipt_document && (
        <div className="payment-row__receipt-badge" aria-label="Receipt generated">
          Receipt: {payment.receipt_document.status}
        </div>
      )}
    </div>
  );
}

// ─── CreatePaymentForm ────────────────────────────────────────────────────────

const EMPTY_FORM: PaymentCreatePayload = {
  payment_kind: 'deposit',
  payment_method: 'cash',
  amount: '',
  reservation_draft: null,
  source_label: '',
  notes: '',
};

interface CreatePaymentFormProps {
  onCreated: (payment: Payment) => void;
}

function CreatePaymentForm({ onCreated }: CreatePaymentFormProps) {
  const [form, setForm] = useState<PaymentCreatePayload>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      abortRef.current = new AbortController();
      try {
        const payment = await createPayment(
          {
            ...form,
            reservation_draft: form.reservation_draft || null,
            source_label: form.source_label || '',
          },
          abortRef.current.signal,
        );
        onCreated(payment);
        setForm(EMPTY_FORM);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message || 'Failed to create payment.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, onCreated],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const needsSource = !form.reservation_draft && !form.source_label;

  return (
    <form className="payment-create-form" onSubmit={handleSubmit} aria-label="Create payment form">
      <h4 className="payment-form__heading">New Payment</h4>

      <div className="payment-form__row">
        <div className="payment-form__field">
          <label htmlFor="payment_kind">Kind</label>
          <select
            id="payment_kind"
            name="payment_kind"
            value={form.payment_kind}
            onChange={handleChange}
          >
            {PAYMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="payment-form__field">
          <label htmlFor="payment_method">Method</label>
          <select
            id="payment_method"
            name="payment_method"
            value={form.payment_method}
            onChange={handleChange}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="payment-form__field">
          <label htmlFor="payment_amount">Amount (MGA)</label>
          <input
            id="payment_amount"
            type="number"
            name="amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="payment-form__row">
        <div className="payment-form__field payment-form__field--wide">
          <label htmlFor="reservation_draft_id">Reservation Draft UUID (optional)</label>
          <input
            id="reservation_draft_id"
            type="text"
            name="reservation_draft"
            placeholder="Leave blank for standalone payment"
            value={form.reservation_draft ?? ''}
            onChange={handleChange}
          />
        </div>

        <div className="payment-form__field payment-form__field--wide">
          <label htmlFor="source_label">
            Source Label
            {needsSource && (
              <span className="payment-form__required"> (required for standalone)</span>
            )}
          </label>
          <input
            id="source_label"
            type="text"
            name="source_label"
            placeholder="e.g. Direct client payment"
            value={form.source_label}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="payment-form__row">
        <div className="payment-form__field payment-form__field--full">
          <label htmlFor="payment_notes">Notes</label>
          <textarea
            id="payment_notes"
            name="notes"
            rows={2}
            placeholder="Optional notes"
            value={form.notes}
            onChange={handleChange}
          />
        </div>
      </div>

      {error && (
        <div className="payment-form__error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <button
        className="payment-form__submit"
        type="submit"
        disabled={submitting || !form.amount}
        aria-label="Submit new payment"
      >
        {submitting ? 'Creating...' : 'Create Payment'}
      </button>
    </form>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  paymentId: string;
  onDone: (payment: Payment) => void;
  onCancel: () => void;
}

function ConfirmDialog({ paymentId, onDone, onCancel }: ConfirmDialogProps) {
  const [payload, setPayload] = useState<PaymentConfirmPayload>({
    paid_at: new Date().toISOString().slice(0, 16),
    external_reference: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setPayload((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    abortRef.current = new AbortController();
    try {
      const updated = await confirmPayment(
        paymentId,
        {
          paid_at: payload.paid_at ? `${payload.paid_at}:00Z` : undefined,
          external_reference: payload.external_reference || undefined,
          notes: payload.notes || undefined,
        },
        abortRef.current.signal,
      );
      onDone(updated);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Confirmation failed.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [paymentId, payload, onDone]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div
      className="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm payment dialog"
    >
      <div className="confirm-dialog__backdrop" onClick={onCancel} />
      <div className="confirm-dialog__panel">
        <h4 className="confirm-dialog__heading">Confirm Payment</h4>
        <p className="confirm-dialog__hint">
          Confirming will auto-generate a receipt document.
        </p>

        <div className="payment-form__field">
          <label htmlFor="confirm_paid_at">Paid At</label>
          <input
            id="confirm_paid_at"
            type="datetime-local"
            name="paid_at"
            value={payload.paid_at ?? ''}
            onChange={handleChange}
          />
        </div>

        <div className="payment-form__field">
          <label htmlFor="confirm_external_ref">External Reference</label>
          <input
            id="confirm_external_ref"
            type="text"
            name="external_reference"
            placeholder="Bank ref, TxID..."
            value={payload.external_reference ?? ''}
            onChange={handleChange}
          />
        </div>

        <div className="payment-form__field">
          <label htmlFor="confirm_notes">Notes</label>
          <textarea
            id="confirm_notes"
            name="notes"
            rows={2}
            value={payload.notes ?? ''}
            onChange={handleChange}
          />
        </div>

        {error && (
          <div className="payment-form__error" role="alert" aria-live="assertive">
            {error}
          </div>
        )}

        <div className="confirm-dialog__actions">
          <button
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cancel payment confirmation"
          >
            Cancel
          </button>
          <button
            className="confirm-dialog__btn confirm-dialog__btn--confirm"
            onClick={handleConfirm}
            disabled={submitting}
            aria-label="Confirm and generate receipt"
          >
            {submitting ? 'Processing...' : 'Confirm & Generate Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PaymentWorkflowPanel ─────────────────────────────────────────────────────

export default function PaymentWorkflowPanel() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/payments/", "OPTIONS", controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getPayments(abortRef.current.signal);
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Failed to load payments.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadPayments]);

  const handlePaymentCreated = useCallback((payment: Payment) => {
    setPayments((prev) => [payment, ...prev]);
    setShowForm(false);
  }, []);

  const handleConfirmDone = useCallback((updated: Payment) => {
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setConfirmingId(null);
  }, []);

  return (
    <div className="payment-workflow-panel" data-testid="payment-workflow-panel">
      <div className="payment-workflow-panel__header">
        <h3 className="payment-workflow-panel__title">Transactions</h3>
        <div className="payment-workflow-panel__actions">
          <button
            className="payment-workflow-panel__refresh"
            onClick={loadPayments}
            disabled={loading}
            aria-label="Refresh payments"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          {canWrite ? (
          <button
            className="payment-workflow-panel__new"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            aria-label={showForm ? 'Close create payment form' : 'Open create payment form'}
          >
            {showForm ? 'Close' : 'New Payment'}
          </button>
          ) : (
            <p className="status">Sign in with write access to create payments.</p>
          )}
        </div>
      </div>

      {showForm && <CreatePaymentForm onCreated={handlePaymentCreated} />}

      {loading && (
        <div className="payment-workflow-panel__loading" aria-live="polite">
          Loading payments...
        </div>
      )}

      {!loading && error && (
        <div className="payment-workflow-panel__error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="payment-workflow-panel__empty">No payments recorded yet.</div>
      )}

      {!loading && !error && payments.length > 0 && (
        <div className="payment-workflow-panel__list" role="list" aria-label="Payments list">
          {payments.map((p) => (
            <PaymentRow
              key={p.id}
              payment={p}
              onConfirm={(id) => setConfirmingId(id)}
              confirming={confirmingId === p.id}
            />
          ))}
        </div>
      )}

      {confirmingId && (
        <ConfirmDialog
          paymentId={confirmingId}
          onDone={handleConfirmDone}
          onCancel={() => setConfirmingId(null)}
        />
      )}
    </div>
  );
}
