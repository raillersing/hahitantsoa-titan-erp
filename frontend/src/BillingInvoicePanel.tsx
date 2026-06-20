import './operational-styles.css';
import './billing-styles.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getBillingInvoices } from './api';
import type { BillingInvoice } from './types';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  settled: 'Settled',
  cancelled: 'Cancelled',
};

const STATUS_CLASSES: Record<string, string> = {
  open: 'status-open',
  settled: 'status-settled',
  cancelled: 'status-cancelled',
};

function formatAmount(amount: string): string {
  return new Intl.NumberFormat('fr-MG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(amount));
}

function InvoiceRow({ invoice }: { invoice: BillingInvoice }) {
  return (
    <div className="ops-row" data-testid={`invoice-row-${invoice.id}`}>
      <span className="ops-row__ref">
        {invoice.document_instance
          ? invoice.document_instance.template_label
          : invoice.id.slice(0, 8)}
      </span>
      <span className="ops-row__detail">
        {formatAmount(invoice.amount)} MGA
      </span>
      <span
        className={`ops-row__status ${STATUS_CLASSES[invoice.invoice_status] || ''}`}
      >
        {STATUS_LABELS[invoice.invoice_status] || invoice.invoice_status}
      </span>
      <span className="ops-row__qty">
        {invoice.settlement ? 'Settled' : 'Unsettled'}
      </span>
    </div>
  );
}

export function BillingInvoicePanel() {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    setLoading(true);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const data = await getBillingInvoices(abortRef.current.signal);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Failed to load billing invoices.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  return (
    <div className="ops-panel" data-testid="billing-invoice-panel">
      <div className="ops-panel__header">
        <h3 className="ops-panel__title">Invoices</h3>
      </div>

      {loading && (
        <div className="billing-loading" aria-live="polite">
          Loading invoices...
        </div>
      )}

      {!loading && error && (
        <div className="billing-error" role="alert">
          {error}
          <button onClick={load} aria-label="Retry loading invoices">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="billing-empty">No invoices recorded yet.</div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <ul className="ops-list" role="list" aria-label="Billing invoices list">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <InvoiceRow invoice={inv} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BillingInvoicePanel;
