import './payment-styles.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelPayment,
  checkEndpointPermission,
  confirmPayment,
  createPayment,
  getPayments,
  reconcilePayment,
} from './api';
import {
  Payment,
  PaymentActionPayload,
  PaymentConfirmPayload,
  PaymentCreateKind,
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

const STATUS_LABELS: Record<Payment['payment_status'], string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  failed: 'Échoué',
  cancelled: 'Annulé',
  reconciled: 'Rapproché',
};

const PAYMENT_KINDS: PaymentCreateKind[] = [
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
const PAYMENT_KIND_LABELS: Record<PaymentKind, string> = {
  deposit: 'Dépôt',
  balance: 'Solde',
  caution: 'Caution',
  refund: 'Remboursement',
  owner_injection: 'Apport propriétaire',
  investor_injection: 'Apport investisseur',
  date_reservation: 'Date de réservation',
  other: 'Autre',
};
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  bank_transfer: 'Virement',
  mobile_money: 'Mobile Money',
  cheque: 'Chèque',
  other: 'Autre',
};

// ─── PaymentRow ───────────────────────────────────────────────────────────────

interface PaymentRowProps {
  payment: Payment;
  onConfirm: (trigger: HTMLButtonElement) => void;
  onCancel: (trigger: HTMLButtonElement) => void;
  onReconcile: (trigger: HTMLButtonElement) => void;
  canWrite: boolean;
  actionActive: boolean;
  actionBlocked: boolean;
}

function PaymentRow({
  payment,
  onConfirm,
  onCancel,
  onReconcile,
  canWrite,
  actionActive,
  actionBlocked,
}: PaymentRowProps) {
  return (
    <div className="payment-row" data-testid={`payment-row-${payment.id}`} tabIndex={-1}>
      <div className="payment-row__meta">
        <span className="payment-row__kind">{PAYMENT_KIND_LABELS[payment.payment_kind]}</span>
        <span className="payment-row__method">{PAYMENT_METHOD_LABELS[payment.payment_method]}</span>
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
        aria-label={`Statut du paiement : ${STATUS_LABELS[payment.payment_status]}`}
      >
        {STATUS_LABELS[payment.payment_status]}
      </div>
      {canWrite && !actionBlocked && payment.payment_status === 'pending' && (
        <div className="payment-row__lifecycle-actions">
          {payment.payment_kind !== 'refund' && (
            <button
              className="payment-confirm-btn"
              type="button"
              onClick={(event) => onConfirm(event.currentTarget)}
              disabled={actionActive}
              aria-label={`Confirmer le paiement ${payment.id}`}
            >
              Confirmer
            </button>
          )}
          <button
            className="payment-cancel-btn"
            type="button"
            onClick={(event) => onCancel(event.currentTarget)}
            disabled={actionActive}
            aria-label={`Annuler le paiement ${payment.id}`}
          >
            Annuler
          </button>
        </div>
      )}
      {canWrite && !actionBlocked && payment.payment_status === 'confirmed' && (
        <div className="payment-row__lifecycle-actions">
          <button
            className="payment-reconcile-btn"
            type="button"
            onClick={(event) => onReconcile(event.currentTarget)}
            disabled={actionActive}
            aria-label={`Rapprocher le paiement ${payment.id}`}
          >
            Rapprocher
          </button>
        </div>
      )}
      {payment.receipt_document && (
        <div className="payment-row__receipt-badge" aria-label="Reçu généré">
          Reçu : {payment.receipt_document.status}
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
          setError(err.message || 'Échec de la création du paiement.');
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
    <form className="payment-create-form" onSubmit={handleSubmit} aria-label="Formulaire de paiement">
      <h4 className="payment-form__heading">Nouveau paiement</h4>

      <div className="payment-form__row">
        <div className="payment-form__field">
          <label htmlFor="payment_kind">Type</label>
          <select
            id="payment_kind"
            name="payment_kind"
            value={form.payment_kind}
            onChange={handleChange}
          >
            {PAYMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {PAYMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="payment-form__field">
          <label htmlFor="payment_method">Moyen</label>
          <select
            id="payment_method"
            name="payment_method"
            value={form.payment_method}
            onChange={handleChange}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="payment-form__field">
          <label htmlFor="payment_amount">Montant (MGA)</label>
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
          <label htmlFor="reservation_draft_id">UUID réservation (optionnel)</label>
          <input
            id="reservation_draft_id"
            type="text"
            name="reservation_draft"
            placeholder="Laisser vide pour paiement autonome"
            value={form.reservation_draft ?? ''}
            onChange={handleChange}
          />
        </div>

        <div className="payment-form__field payment-form__field--wide">
          <label htmlFor="source_label">
            Libellé source
            {needsSource && (
              <span className="payment-form__required"> (obligatoire pour paiement autonome)</span>
            )}
          </label>
          <input
            id="source_label"
            type="text"
            name="source_label"
            placeholder="Ex : Paiement direct client"
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
            placeholder="Notes optionnelles"
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
        aria-label="Soumettre le paiement"
      >
        {submitting ? 'Création...' : 'Créer le paiement'}
      </button>
    </form>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

const DIALOG_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function useDialogKeyboard(
  panelRef: React.RefObject<HTMLDivElement | null>,
  initialFocusRef: React.RefObject<HTMLElement | null>,
  onCancel: () => void,
  submitting: boolean,
) {
  useEffect(() => {
    initialFocusRef.current?.focus();
  }, [initialFocusRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, panelRef, submitting]);
}

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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLInputElement | null>(null);

  useDialogKeyboard(panelRef, initialFocusRef, onCancel, submitting);

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
        setError(err.message || 'Échec de la confirmation du paiement.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [paymentId, payload, onDone]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div
      className="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmer le paiement"
    >
      <div
        className="confirm-dialog__backdrop"
        onClick={submitting ? undefined : onCancel}
        data-testid="confirm-dialog-backdrop"
      />
      <div className="confirm-dialog__panel" ref={panelRef} tabIndex={-1}>
        <h4 className="confirm-dialog__heading">Confirmer le paiement</h4>
        <p className="confirm-dialog__hint">
          La confirmation générera un reçu automatiquement.
        </p>

        <div className="payment-form__field">
          <label htmlFor="confirm_paid_at">Payé le</label>
          <input
            id="confirm_paid_at"
            type="datetime-local"
            name="paid_at"
            value={payload.paid_at ?? ''}
            onChange={handleChange}
            ref={initialFocusRef}
          />
        </div>

        <div className="payment-form__field">
          <label htmlFor="confirm_external_ref">Référence externe</label>
          <input
            id="confirm_external_ref"
            type="text"
            name="external_reference"
            placeholder="Réf. bancaire, TxID..."
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
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Annuler la confirmation"
          >
            Annuler
          </button>
          <button
            className="confirm-dialog__btn confirm-dialog__btn--confirm"
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            aria-label="Confirmer et générer le reçu"
          >
            {submitting ? 'Traitement...' : 'Confirmer et générer le reçu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LifecycleActionDialog ───────────────────────────────────────────────────

type LifecycleAction = 'cancel' | 'reconcile';

interface LifecycleActionDialogProps {
  action: LifecycleAction;
  payment: Payment;
  onDone: (payment: Payment) => void;
  onCancel: () => void;
  onStaleResponse: (paymentId: string, message: string) => Promise<void>;
}

function getApiStatus(error: unknown): number | null {
  if (
    error instanceof Error
    && 'status' in error
    && typeof (error as Error & { status?: unknown }).status === 'number'
  ) {
    return (error as Error & { status: number }).status;
  }
  return null;
}

function lifecycleErrorMessage(error: unknown, action: LifecycleAction): string {
  const status = getApiStatus(error);
  const verb = action === 'cancel' ? 'annuler' : 'rapprocher';
  const backendMessage = error instanceof Error ? error.message : '';

  if (status === 400) {
    return `Action impossible : ${backendMessage || 'le paiement a changé d’état.'}`;
  }
  if (status === 403) {
    return `Vous n’avez pas l’autorisation de ${verb} ce paiement.`;
  }
  if (status === 404) {
    return 'Ce paiement est introuvable.';
  }
  if (status === null) {
    return `Connexion au serveur impossible. Le paiement n’a pas été modifié ; réessayez pour le ${verb}.`;
  }
  return `Impossible de ${verb} le paiement pour le moment.`;
}

function LifecycleActionDialog({
  action,
  payment,
  onDone,
  onCancel,
  onStaleResponse,
}: LifecycleActionDialogProps) {
  const [payload, setPayload] = useState<PaymentActionPayload>({ notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLTextAreaElement | null>(null);
  const isCancellation = action === 'cancel';
  const title = isCancellation ? 'Annuler le paiement' : 'Rapprocher le paiement';
  const target = `Paiement ${payment.id} — ${formatAmount(payment.amount)} MGA`;

  useDialogKeyboard(panelRef, initialFocusRef, onCancel, submitting);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    abortRef.current = new AbortController();
    try {
      const actionPayload = payload.notes?.trim() ? { notes: payload.notes.trim() } : {};
      const updated = isCancellation
        ? await cancelPayment(payment.id, actionPayload, abortRef.current.signal)
        : await reconcilePayment(payment.id, actionPayload, abortRef.current.signal);
      onDone(updated);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = lifecycleErrorMessage(err, action);
      const status = getApiStatus(err);
      if (status === 400 || status === 404) {
        await onStaleResponse(payment.id, message);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [action, isCancellation, onDone, onStaleResponse, payment.id, payload.notes]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div
      className="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-action-dialog-title"
      aria-describedby="payment-action-dialog-description"
    >
      <div
        className="confirm-dialog__backdrop"
        onClick={submitting ? undefined : onCancel}
        data-testid="payment-action-dialog-backdrop"
      />
      <div className="confirm-dialog__panel" ref={panelRef} tabIndex={-1}>
        <h4 id="payment-action-dialog-title" className="confirm-dialog__heading">
          {title}
        </h4>
        <p className="confirm-dialog__target">{target}</p>
        <p id="payment-action-dialog-description" className="confirm-dialog__hint">
          {isCancellation
            ? 'Ce paiement en attente passera à l’état Annulé et ne pourra plus être confirmé.'
            : 'Ce paiement confirmé passera à l’état Rapproché pour indiquer son contrôle comptable.'}
        </p>

        <div className="payment-form__field">
          <label htmlFor="payment_action_notes">Notes (optionnel)</label>
          <textarea
            id="payment_action_notes"
            name="notes"
            rows={3}
            value={payload.notes ?? ''}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
              setPayload({ notes: event.target.value });
            }}
            disabled={submitting}
            ref={initialFocusRef}
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
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            Retour
          </button>
          <button
            className={`confirm-dialog__btn ${
              isCancellation
                ? 'confirm-dialog__btn--destructive'
                : 'confirm-dialog__btn--confirm'
            }`}
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Traitement...' : title}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PaymentWorkflowPanel ─────────────────────────────────────────────────────

type WriteAccessState = 'checking' | 'allowed' | 'unavailable';

type ActivePaymentDialog = {
  action: 'confirm' | LifecycleAction;
  payment: Payment;
  trigger: HTMLButtonElement;
};

export default function PaymentWorkflowPanel() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActivePaymentDialog | null>(null);
  const activeDialogRef = useRef<ActivePaymentDialog | null>(null);
  const [blockedPaymentIds, setBlockedPaymentIds] = useState<Set<string>>(() => new Set());
  const [showForm, setShowForm] = useState(false);
  const [writeAccess, setWriteAccess] = useState<WriteAccessState>('checking');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeDialogRef.current = activeDialog;
  }, [activeDialog]);

  useEffect(() => {
    const controller = new AbortController();
    void checkEndpointPermission('/api/v1/payments/', 'OPTIONS', controller.signal)
      .then((allowed) => {
        if (!controller.signal.aborted) {
          setWriteAccess(allowed ? 'allowed' : 'unavailable');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWriteAccess('unavailable');
        }
      });
    return () => controller.abort();
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getPayments(abortRef.current.signal);
      setPayments(Array.isArray(data) ? data : []);
      setActionError(null);
      setBlockedPaymentIds(new Set());
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Échec du chargement des paiements.');
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

  const restoreDialogFocus = useCallback((dialog: ActivePaymentDialog | null) => {
    if (!dialog) {
      return;
    }
    window.setTimeout(() => {
      if (dialog.trigger.isConnected && !dialog.trigger.disabled) {
        dialog.trigger.focus();
        return;
      }
      const row = document.querySelector<HTMLElement>(
        `[data-testid="payment-row-${dialog.payment.id}"]`,
      );
      (row ?? panelRef.current)?.focus();
    }, 0);
  }, []);

  const handleActionDone = useCallback((updated: Payment) => {
    const dialog = activeDialogRef.current;
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setActiveDialog(null);
    restoreDialogFocus(dialog);
  }, [restoreDialogFocus]);

  const closeDialog = useCallback(() => {
    const dialog = activeDialogRef.current;
    setActiveDialog(null);
    restoreDialogFocus(dialog);
  }, [restoreDialogFocus]);

  const openDialog = useCallback(
    (action: ActivePaymentDialog['action'], payment: Payment, trigger: HTMLButtonElement) => {
      setActiveDialog({ action, payment, trigger });
    },
    [],
  );

  const refreshPaymentsAfterStale = useCallback(async (paymentId: string, message: string) => {
    const alertPrefix = /[.!?]$/.test(message) ? message : `${message}.`;
    setBlockedPaymentIds((current) => new Set(current).add(paymentId));
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await getPayments(controller.signal);
      setPayments(Array.isArray(data) ? data : []);
      setError(null);
      setBlockedPaymentIds((current) => {
        const next = new Set(current);
        next.delete(paymentId);
        return next;
      });
      setActionError(`${alertPrefix} La liste a été actualisée depuis le serveur.`);
    } catch (refreshError: unknown) {
      if (!(refreshError instanceof Error && refreshError.name === 'AbortError')) {
        setActionError(
          `${alertPrefix} L’actualisation a échoué ; utilisez « Actualiser » avant une nouvelle action.`,
        );
      }
    } finally {
      const dialog = activeDialogRef.current;
      setActiveDialog(null);
      restoreDialogFocus(dialog);
    }
  }, [restoreDialogFocus]);

  return (
    <div
      className="payment-workflow-panel"
      data-testid="payment-workflow-panel"
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="payment-workflow-panel__header">
        <h3 className="payment-workflow-panel__title">Paiements</h3>
        <div className="payment-workflow-panel__actions">
          <button
            className="payment-workflow-panel__refresh"
            onClick={loadPayments}
            disabled={loading}
            aria-label="Actualiser les paiements"
          >
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
          {writeAccess === 'allowed' ? (
          <button
            className="payment-workflow-panel__new"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            aria-label={showForm ? 'Fermer le formulaire' : 'Ouvrir le formulaire de paiement'}
          >
            {showForm ? 'Fermer' : 'Nouveau paiement'}
          </button>
          ) : writeAccess === 'checking' ? (
            <p className="status" aria-live="polite">Vérification de la disponibilité des actions...</p>
          ) : (
            <p className="status">Actions indisponibles pour cette session.</p>
          )}
        </div>
      </div>

      {showForm && <CreatePaymentForm onCreated={handlePaymentCreated} />}

      {actionError && (
        <div className="payment-workflow-panel__error" role="alert" aria-live="assertive">
          {actionError}
        </div>
      )}

      {loading && (
        <div className="payment-workflow-panel__loading" aria-live="polite">
          Chargement des paiements...
        </div>
      )}

      {!loading && error && (
        <div className="payment-workflow-panel__error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {!loading && !error && payments.length === 0 && (
        <div className="payment-workflow-panel__empty">Aucun paiement enregistré.</div>
      )}

      {!loading && !error && payments.length > 0 && (
        <div className="payment-workflow-panel__list" role="list" aria-label="Liste des paiements">
          {payments.map((p) => (
            <PaymentRow
              key={p.id}
              payment={p}
              onConfirm={(trigger) => openDialog('confirm', p, trigger)}
              onCancel={(trigger) => openDialog('cancel', p, trigger)}
              onReconcile={(trigger) => openDialog('reconcile', p, trigger)}
              canWrite={writeAccess === 'allowed'}
              actionActive={activeDialog !== null}
              actionBlocked={blockedPaymentIds.has(p.id)}
            />
          ))}
        </div>
      )}

      {activeDialog?.action === 'confirm' && (
        <ConfirmDialog
          paymentId={activeDialog.payment.id}
          onDone={handleActionDone}
          onCancel={closeDialog}
        />
      )}
      {activeDialog && activeDialog.action !== 'confirm' && (
        <LifecycleActionDialog
          action={activeDialog.action}
          payment={activeDialog.payment}
          onDone={handleActionDone}
          onCancel={closeDialog}
          onStaleResponse={refreshPaymentsAfterStale}
        />
      )}
    </div>
  );
}
