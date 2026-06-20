import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkEndpointPermission,
  createPayment,
  getDamageLossSettlements,
  getPayments,
} from "./api";
import type {
  InventoryDamageLossSettlement,
  Payment,
  PaymentCreatePayload,
} from "./types";

// ─── helpers ────────────────────────────────────────────────────────────

function formatAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-MG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-MG", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function statusColor(status: Payment["payment_status"]): string {
  const map: Record<Payment["payment_status"], string> = {
    pending: "var(--payment-status-pending)",
    confirmed: "var(--payment-status-confirmed)",
    failed: "var(--payment-status-failed)",
    cancelled: "var(--payment-status-cancelled)",
    reconciled: "var(--payment-status-reconciled)",
  };
  return map[status] ?? "var(--muted-fg)";
}

type ActiveTab = "deposits" | "settlements";

type PaymentsState =
  | { status: "loading" }
  | { status: "loaded"; payments: Payment[] }
  | { status: "empty" }
  | { status: "error"; message: string };

type SettlementsState =
  | { status: "loading" }
  | { status: "loaded"; settlements: InventoryDamageLossSettlement[] }
  | { status: "empty" }
  | { status: "error"; message: string };

// ─── CreateCautionForm ──────────────────────────────────────────────────

const INITIAL_FORM: PaymentCreatePayload = {
  payment_kind: "caution",
  payment_method: "cash",
  amount: "",
  reservation_draft: null,
  source_label: "Caution deposit",
  notes: "",
};

export default function CautionRefundPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("deposits");
  const [paymentsState, setPaymentsState] = useState<PaymentsState>({
    status: "loading",
  });
  const [settlementsState, setSettlementsState] = useState<SettlementsState>({
    status: "loading",
  });
  const [canWrite, setCanWrite] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PaymentCreatePayload>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/payments/", "OPTIONS", controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  const loadPayments = useCallback(() => {
    setPaymentsState({ status: "loading" });
    abortRef.current = new AbortController();
    getPayments(abortRef.current.signal)
      .then((allPayments) => {
        const cautionPayments = allPayments.filter(
          (p) => p.payment_kind === "caution",
        );
        setPaymentsState(
          cautionPayments.length === 0
            ? { status: "empty" }
            : { status: "loaded", payments: cautionPayments },
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setPaymentsState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to load payments.",
        });
      });
  }, []);

  const loadSettlements = useCallback(() => {
    setSettlementsState({ status: "loading" });
    abortRef.current = new AbortController();
    getDamageLossSettlements(abortRef.current.signal)
      .then((settlements) => {
        setSettlementsState(
          settlements.length === 0
            ? { status: "empty" }
            : { status: "loaded", settlements },
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setSettlementsState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to load settlements.",
        });
      });
  }, []);

  useEffect(() => {
    if (activeTab === "deposits") {
      loadPayments();
    } else {
      loadSettlements();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [activeTab, loadPayments, loadSettlements]);

  const handleCreateCaution = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setSubmitting(true);
      try {
        await createPayment(form);
        setForm(INITIAL_FORM);
        setShowForm(false);
        loadPayments();
      } catch (err: unknown) {
        if (err instanceof Error) {
          setFormError(err.message || "Failed to create caution deposit.");
        }
      } finally {
        setSubmitting(false);
      }
    },
    [form, loadPayments],
  );

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  return (
    <section className="caution-refund-panel" aria-label="Caution and Refund Management">
      <div className="section-heading">
        <p className="eyebrow">Caution &amp; Refund Management</p>
        <h2>Caution Deposits &amp; Refunds</h2>
        <p className="section-helper">
          Manage caution deposits and track refund amounts on damage/loss
          settlements.
        </p>
      </div>

      <div className="tab-bar" role="tablist" aria-label="Caution sections">
        <button
          role="tab"
          aria-selected={activeTab === "deposits"}
          aria-controls="deposits-panel"
          className={`tab-button${activeTab === "deposits" ? " tab-button--active" : ""}`}
          onClick={() => setActiveTab("deposits")}
        >
          Caution Deposits
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "settlements"}
          aria-controls="settlements-panel"
          className={`tab-button${activeTab === "settlements" ? " tab-button--active" : ""}`}
          onClick={() => setActiveTab("settlements")}
        >
          Settlements
        </button>
      </div>

      {activeTab === "deposits" && (
        <div
          id="deposits-panel"
          role="tabpanel"
          aria-label="Caution deposits list"
          data-testid="caution-deposits-panel"
        >
          <div className="section-actions">
            {canWrite && (
              <button
                className="action-btn"
                onClick={() => setShowForm((v) => !v)}
                aria-expanded={showForm}
                aria-label={showForm ? "Close caution form" : "New caution deposit"}
              >
                {showForm ? "Close" : "New Caution Deposit"}
              </button>
            )}
          </div>

          {showForm && (
            <form
              className="caution-form"
              onSubmit={handleCreateCaution}
              aria-label="Create caution deposit form"
            >
              <h4>New Caution Deposit</h4>
              <div className="caution-form__row">
                <div className="caution-form__field">
                  <label htmlFor="caution_amount">Amount (MGA)</label>
                  <input
                    id="caution_amount"
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
                <div className="caution-form__field">
                  <label htmlFor="caution_method">Method</label>
                  <select
                    id="caution_method"
                    name="payment_method"
                    value={form.payment_method}
                    onChange={handleChange}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="caution-form__row">
                <div className="caution-form__field caution-form__field--wide">
                  <label htmlFor="caution_source">Source Label</label>
                  <input
                    id="caution_source"
                    type="text"
                    name="source_label"
                    value={form.source_label ?? ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="caution-form__row">
                <div className="caution-form__field caution-form__field--full">
                  <label htmlFor="caution_notes">Notes</label>
                  <textarea
                    id="caution_notes"
                    name="notes"
                    rows={2}
                    value={form.notes}
                    onChange={handleChange}
                  />
                </div>
              </div>
              {formError && (
                <div className="notice" role="alert">
                  {formError}
                </div>
              )}
              <button
                className="action-btn"
                type="submit"
                disabled={submitting || !form.amount}
                aria-label="Submit caution deposit"
              >
                {submitting ? "Creating..." : "Create Caution Deposit"}
              </button>
            </form>
          )}

          {paymentsState.status === "loading" && (
            <p className="status" aria-live="polite">Loading caution deposits...</p>
          )}

          {paymentsState.status === "error" && (
            <div className="notice" role="alert">
              <p>{paymentsState.message}</p>
              <button
                type="button"
                className="retry-btn"
                onClick={loadPayments}
                aria-label="Retry loading caution deposits"
              >
                Retry
              </button>
            </div>
          )}

          {paymentsState.status === "empty" && (
            <p className="status">No caution deposits recorded.</p>
          )}

          {paymentsState.status === "loaded" && (
            <table className="data-table" aria-label="Caution deposits">
              <thead>
                <tr>
                  <th scope="col">Amount</th>
                  <th scope="col">Method</th>
                  <th scope="col">Status</th>
                  <th scope="col">Source</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {paymentsState.payments.map((payment) => (
                  <tr key={payment.id} data-testid={`caution-row-${payment.id}`}>
                    <td>{formatAmount(payment.amount)} MGA</td>
                    <td>{payment.payment_method.replace(/_/g, " ")}</td>
                    <td>
                      <span
                        className="payment-status-badge"
                        style={{ color: statusColor(payment.payment_status) }}
                      >
                        {payment.payment_status}
                      </span>
                    </td>
                    <td>{payment.source_label || <span className="muted">&mdash;</span>}</td>
                    <td>{formatDateTime(payment.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "settlements" && (
        <div
          id="settlements-panel"
          role="tabpanel"
          aria-label="Settlements list"
          data-testid="caution-settlements-panel"
        >
          {settlementsState.status === "loading" && (
            <p className="status" aria-live="polite">Loading settlements...</p>
          )}

          {settlementsState.status === "error" && (
            <div className="notice" role="alert">
              <p>{settlementsState.message}</p>
              <button
                type="button"
                className="retry-btn"
                onClick={loadSettlements}
                aria-label="Retry loading settlements"
              >
                Retry
              </button>
            </div>
          )}

          {settlementsState.status === "empty" && (
            <p className="status">No damage/loss settlements found.</p>
          )}

          {settlementsState.status === "loaded" && (
            <table className="data-table" aria-label="Settlement caution info">
              <thead>
                <tr>
                  <th scope="col">Settlement ID</th>
                  <th scope="col">Damage/Loss Total</th>
                  <th scope="col">Caution Available</th>
                  <th scope="col">Caution Applied</th>
                  <th scope="col">Refund Due</th>
                  <th scope="col">Excess Due</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {settlementsState.settlements.map((s) => (
                  <tr key={s.id} data-testid={`settlement-row-${s.id}`}>
                    <td><code>{s.id.slice(0, 8)}&hellip;</code></td>
                    <td>{formatAmount(s.damage_loss_total)} MGA</td>
                    <td>{formatAmount(s.caution_available)} MGA</td>
                    <td>{formatAmount(s.caution_applied)} MGA</td>
                    <td>{formatAmount(s.refund_due)} MGA</td>
                    <td>{formatAmount(s.excess_due)} MGA</td>
                    <td>{s.settlement_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
