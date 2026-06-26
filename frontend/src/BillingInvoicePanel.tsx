import { useEffect, useMemo, useState } from "react";

import {
  cancelBillingCreditNote,
  cancelBillingInvoice,
  checkEndpointPermission,
  createBillingInvoiceInstallments,
  executeBillingRefundObligation,
  getBillingCreditNotes,
  getBillingInvoices,
  issueBillingCreditNote,
  settleBillingInvoice,
} from "./api";
import type {
  BillingCreditNote,
  BillingInvoice,
  BillingInvoiceInstallment,
} from "./types";

type BillingActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

type InstallmentDraft = {
  amount: string;
  due_at: string;
};

const EMPTY_SETTLE = { payment: "", notes: "" };
const EMPTY_CREDIT_NOTE = { amount: "", reason: "", notes: "" };
const EMPTY_REFUND = { notes: "" };

function formatAmount(amount: string | number): string {
  return new Intl.NumberFormat("fr-MG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(typeof amount === "number" ? amount : Number.parseFloat(amount || "0"));
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function InvoiceStatusBadge({ invoice }: { invoice: BillingInvoice }) {
  const className =
    invoice.invoice_status === "open"
      ? "ops-status-badge ops-status-badge--draft"
      : invoice.invoice_status === "settled"
        ? "ops-status-badge ops-status-badge--validated"
        : "ops-status-badge ops-status-badge--cancelled";

  return <span className={className}>{statusLabel(invoice.invoice_status)}</span>;
}

function InvoiceRow({
  invoice,
  selected,
  onSelect,
}: {
  invoice: BillingInvoice;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="ops-row"
      onClick={onSelect}
      aria-pressed={selected}
      data-testid={`billing-row-${invoice.id}`}
    >
      <span className="ops-row__primary">
        <span className="ops-row__title">
          {invoice.document_instance?.template_label ?? invoice.id.slice(0, 8)}
        </span>
        <span className="ops-row__subtext">{invoice.source_kind}</span>
      </span>
      <span className="ops-row__detail">{formatAmount(invoice.amount)} MGA</span>
      <InvoiceStatusBadge invoice={invoice} />
      <span className="ops-row__qty">{formatAmount(invoice.remaining_balance)} restant</span>
    </button>
  );
}

function InstallmentList({ installments }: { installments: BillingInvoiceInstallment[] }) {
  if (installments.length === 0) {
    return <p className="ops-empty">Aucun échéancier pour cette facture.</p>;
  }

  return (
    <ul className="ops-list" aria-label="Échéancier">
      {installments.map((installment) => (
        <li key={installment.id}>
          <div className="ops-row" data-testid={`installment-row-${installment.id}`}>
            <span className="ops-row__primary">
              <span className="ops-row__title">{formatAmount(installment.amount)} MGA</span>
              <span className="ops-row__subtext">{formatDate(installment.due_at)}</span>
            </span>
            <span className="ops-row__detail">
              Payé {formatAmount(installment.paid_amount)} MGA
            </span>
            <span className={`ops-status-badge ops-status-badge--${installment.status}`}>
              {statusLabel(installment.status)}
            </span>
            <span className="ops-row__qty">
              {installment.is_overdue ? "En retard" : `${installment.allocations.length} allocation(s)`}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CreditNoteList({
  invoiceId,
  creditNotes,
  canWrite,
  onCancelCreditNote,
}: {
  invoiceId: string;
  creditNotes: BillingCreditNote[];
  canWrite: boolean;
  onCancelCreditNote: (creditNote: BillingCreditNote) => void;
}) {
  if (creditNotes.length === 0) {
    return <p className="ops-empty">Aucune note de crédit pour cette facture.</p>;
  }

  return (
    <ul className="ops-list" aria-label="Notes de crédit">
      {creditNotes.map((creditNote) => (
        <li key={creditNote.id}>
          <div className="ops-row" data-testid={`credit-note-row-${creditNote.id}`}>
            <span className="ops-row__primary">
              <span className="ops-row__title">{formatAmount(creditNote.amount)} MGA</span>
              <span className="ops-row__subtext">{creditNote.reason}</span>
            </span>
            <span className="ops-row__detail">
              {creditNote.invoice_detail?.document_instance?.template_label ?? invoiceId.slice(0, 8)}
            </span>
            <span className={`ops-status-badge ops-status-badge--${creditNote.status}`}>
              {statusLabel(creditNote.status)}
            </span>
            <span className="ops-row__qty">
              {creditNote.applied_at ? formatDate(creditNote.applied_at) : formatDate(creditNote.issued_at)}
            </span>
            {canWrite && creditNote.status === "issued" ? (
              <button type="button" className="ops-button-secondary" onClick={() => onCancelCreditNote(creditNote)}>
                Annuler la note
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BillingInvoicePanel() {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canWrite, setCanWrite] = useState(false);
  const [actionState, setActionState] = useState<BillingActionState>({ status: "idle" });
  const [settleForm, setSettleForm] = useState(EMPTY_SETTLE);
  const [creditNoteForm, setCreditNoteForm] = useState(EMPTY_CREDIT_NOTE);
  const [refundForm, setRefundForm] = useState(EMPTY_REFUND);
  const [installmentDrafts, setInstallmentDrafts] = useState<InstallmentDraft[]>([
    { amount: "", due_at: "" },
  ]);
  const [cancelNotes, setCancelNotes] = useState("");
  const [creditNotes, setCreditNotes] = useState<BillingCreditNote[]>([]);

  const selectedInvoice =
    useMemo(
      () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? invoices[0] ?? null,
      [invoices, selectedInvoiceId],
    );

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/billing/invoices/", "OPTIONS", controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInvoices() {
      setLoading(true);
      setError("");
      try {
        const data = await getBillingInvoices();
        if (!cancelled) {
          setInvoices(Array.isArray(data) ? data : []);
          setSelectedInvoiceId((current) => current || data[0]?.id || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load billing invoices.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadInvoices();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCreditNotes(invoiceId: string) {
      try {
        const data = await getBillingCreditNotes(invoiceId);
        if (!cancelled) {
          setCreditNotes(data);
        }
      } catch {
        if (!cancelled) {
          setCreditNotes([]);
        }
      }
    }

    if (selectedInvoice?.id) {
      void loadCreditNotes(selectedInvoice.id);
    } else {
      setCreditNotes([]);
    }

    return () => {
      cancelled = true;
    };
  }, [selectedInvoice?.id]);

  const updateInvoice = (nextInvoice: BillingInvoice) => {
    setInvoices((current) =>
      current.map((invoice) => (invoice.id === nextInvoice.id ? nextInvoice : invoice)),
    );
    setSelectedInvoiceId(nextInvoice.id);
  };

  const handleSettle = async () => {
    if (!selectedInvoice || !settleForm.payment) {
      return;
    }
    setActionState({ status: "loading" });
    try {
      const updated = await settleBillingInvoice(selectedInvoice.id, {
        payment: settleForm.payment,
        notes: settleForm.notes,
      });
      updateInvoice(updated);
      setActionState({ status: "success", message: "Facture réglée avec succès." });
      setSettleForm(EMPTY_SETTLE);
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Échec du règlement de la facture.",
      });
    }
  };

  const handleCancelInvoice = async () => {
    if (!selectedInvoice) {
      return;
    }
    setActionState({ status: "loading" });
    try {
      const updated = await cancelBillingInvoice(selectedInvoice.id, cancelNotes);
      updateInvoice(updated);
      setActionState({ status: "success", message: "Facture annulée avec succès." });
      setCancelNotes("");
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Échec de l'annulation de la facture.",
      });
    }
  };

  const handleCreateInstallments = async () => {
    if (!selectedInvoice) {
      return;
    }
    const payload = installmentDrafts
      .filter((draft) => draft.amount && draft.due_at)
      .map((draft) => ({
        amount: draft.amount,
        due_at: new Date(draft.due_at).toISOString(),
      }));
    if (payload.length === 0) {
      return;
    }
    setActionState({ status: "loading" });
    try {
      const created = await createBillingInvoiceInstallments(selectedInvoice.id, {
        installments: payload,
        notes: "Created from FE-C billing panel.",
      });
      updateInvoice({ ...selectedInvoice, installments: created });
      setActionState({ status: "success", message: "Échéancier créé." });
      setInstallmentDrafts([{ amount: "", due_at: "" }]);
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Échec de la création de l'échéancier.",
      });
    }
  };

  const handleIssueCreditNote = async () => {
    if (!selectedInvoice || !creditNoteForm.amount || !creditNoteForm.reason) {
      return;
    }
    setActionState({ status: "loading" });
    try {
      const note = await issueBillingCreditNote(selectedInvoice.id, creditNoteForm);
      const nextNotes = [note, ...creditNotes];
      setCreditNotes(nextNotes);
      setActionState({ status: "success", message: "Note de crédit émise." });
      setCreditNoteForm(EMPTY_CREDIT_NOTE);
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Échec de l'émission de la note de crédit.",
      });
    }
  };

  const handleCancelCreditNote = async (creditNote: BillingCreditNote) => {
    if (!selectedInvoice) {
      return;
    }
    setActionState({ status: "loading" });
    try {
      const updated = await cancelBillingCreditNote(selectedInvoice.id, creditNote.id, "Cancelled from FE-C.");
      const nextNotes = creditNotes.map((note) => (note.id === updated.id ? updated : note));
      setCreditNotes(nextNotes);
      setActionState({ status: "success", message: "Note de crédit annulée." });
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Échec de l'annulation de la note de crédit.",
      });
    }
  };

  const handleExecuteRefund = async () => {
    if (!selectedInvoice?.refund_obligation) {
      return;
    }
    setActionState({ status: "loading" });
    try {
      const updated = await executeBillingRefundObligation(selectedInvoice.refund_obligation.id, refundForm);
      updateInvoice({ ...selectedInvoice, refund_obligation: updated });
      setActionState({ status: "success", message: "Remboursement exécuté." });
      setRefundForm(EMPTY_REFUND);
    } catch (err) {
      setActionState({
        status: "error",
        message: err instanceof Error ? err.message : "Échec de l'exécution du remboursement.",
      });
    }
  };

  return (
    <section className="ops-panel" data-testid="billing-invoice-panel">
      <div className="ops-panel__header">
        <div className="ops-panel__header-copy">
          <h3 className="ops-panel__title">Factures et notes de crédit</h3>
          <p className="ops-panel__summary">
            Gestion des factures : échéanciers, notes de crédit, remboursements.
          </p>
        </div>
        <div className="ops-panel__actions">
          <span className={canWrite ? "permission-tag permission-ok" : "permission-tag permission-denied"} data-testid={canWrite ? "billing-write-ok" : "billing-write-denied"}>
            {canWrite ? "Accès écriture" : "Lecture seule"}
          </span>
        </div>
      </div>

      {loading ? <div className="ops-empty">Chargement des factures...</div> : null}
      {!loading && error ? (
        <div className="ops-callout" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && !error && invoices.length === 0 ? (
        <div className="ops-empty">Aucune facture pour le moment.</div>
      ) : null}

      {!loading && !error && invoices.length > 0 ? (
        <div className="ops-layout">
          <aside className="ops-list-panel">
            <div className="ops-section-heading">
              <h4>Liste des factures</h4>
              <span className="ops-section-helper">{invoices.length} facture(s)</span>
            </div>
            <ul className="ops-list">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <InvoiceRow
                    invoice={invoice}
                    selected={invoice.id === selectedInvoice?.id}
                    onSelect={() => setSelectedInvoiceId(invoice.id)}
                  />
                </li>
              ))}
            </ul>
          </aside>

          <main className="ops-detail-panel">
            {selectedInvoice ? (
              <>
                <div className="ops-section-heading">
                  <div>
                    <h4>{selectedInvoice.document_instance?.template_label ?? "Détail de la facture"}</h4>
                    <p className="ops-section-helper">
                      Source {selectedInvoice.source_kind} · {formatAmount(selectedInvoice.amount)} MGA
                    </p>
                  </div>
                  <InvoiceStatusBadge invoice={selectedInvoice} />
                </div>

                <div className="ops-detail-section">
                  <h5>Résumé financier</h5>
                  <div className="ops-metric-grid">
                    <div className="ops-metric-card">
                      <span className="ops-metric-card__label">Émise le</span>
                      <strong>{formatDate(selectedInvoice.issued_at)}</strong>
                    </div>
                    <div className="ops-metric-card">
                      <span className="ops-metric-card__label">Montant réglé</span>
                      <strong>{formatAmount(selectedInvoice.amount_settled)} MGA</strong>
                    </div>
                    <div className="ops-metric-card">
                      <span className="ops-metric-card__label">Remboursé</span>
                      <strong>{formatAmount(selectedInvoice.amount_refunded)} MGA</strong>
                    </div>
                    <div className="ops-metric-card">
                      <span className="ops-metric-card__label">Restant</span>
                      <strong>{formatAmount(selectedInvoice.remaining_balance)} MGA</strong>
                    </div>
                  </div>
                </div>

                <div className="ops-detail-section">
                  <h5>Échéancier</h5>
                  <InstallmentList installments={selectedInvoice.installments} />
                  {canWrite && selectedInvoice.invoice_status === "open" ? (
                    <div className="ops-inline-form">
                      <div className="ops-inline-form__fields">
                        {installmentDrafts.map((draft, index) => (
                          <div key={`${index}-${draft.due_at}`} className="ops-inline-form__row">
                            <label>
                              Montant
                              <input
                                value={draft.amount}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setInstallmentDrafts((current) =>
                                    current.map((row, rowIndex) => (rowIndex === index ? { ...row, amount: value } : row)),
                                  );
                                }}
                                placeholder="0.00"
                              />
                            </label>
                            <label>
                              Échéance
                              <input
                                type="datetime-local"
                                value={draft.due_at}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setInstallmentDrafts((current) =>
                                    current.map((row, rowIndex) => (rowIndex === index ? { ...row, due_at: value } : row)),
                                  );
                                }}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                      <div className="ops-panel__actions">
                        <button
                          type="button"
                          className="ops-button-secondary"
                          onClick={() => setInstallmentDrafts((current) => [...current, { amount: "", due_at: "" }])}
                        >
                          Ajouter une échéance
                        </button>
                        <button type="button" className="ops-button" onClick={() => void handleCreateInstallments()}>
                          Créer l'échéancier
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="ops-detail-section">
                  <h5>Règlement ou annulation</h5>
                  {canWrite && selectedInvoice.invoice_status === "open" ? (
                    <div className="ops-inline-form">
                      <div className="ops-inline-form__fields">
                        <label>
                          ID Paiement
                          <input
                            value={settleForm.payment}
                            onChange={(e) => setSettleForm((current) => ({ ...current, payment: e.target.value }))}
                            placeholder="UUID paiement"
                          />
                        </label>
                        <label>
                          Notes
                          <input
                            value={settleForm.notes}
                            onChange={(e) => setSettleForm((current) => ({ ...current, notes: e.target.value }))}
                            placeholder="Notes optionnelles"
                          />
                        </label>
                      </div>
                      <div className="ops-panel__actions">
                        <button type="button" className="ops-button" onClick={() => void handleSettle()} disabled={!settleForm.payment}>
                          Régler la facture
                        </button>
                        <label>
                          Notes d'annulation
                          <input
                            value={cancelNotes}
                            onChange={(e) => setCancelNotes(e.target.value)}
                            placeholder="Motif d'annulation"
                          />
                        </label>
                        <button type="button" className="ops-button-danger" onClick={() => void handleCancelInvoice()}>
                          Annuler la facture
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="ops-empty">Les actions de règlement sont disponibles uniquement sur les factures ouvertes.</p>
                  )}
                </div>

                <div className="ops-detail-section">
                  <h5>Notes de crédit</h5>
                  <div className="ops-inline-form">
                    <div className="ops-inline-form__fields">
                      <label>
                        Amount
                        <input
                          value={creditNoteForm.amount}
                          onChange={(e) => setCreditNoteForm((current) => ({ ...current, amount: e.target.value }))}
                          placeholder="0.00"
                        />
                      </label>
                      <label>
                        Motif
                        <input
                          value={creditNoteForm.reason}
                          onChange={(e) => setCreditNoteForm((current) => ({ ...current, reason: e.target.value }))}
                          placeholder="Motif"
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          value={creditNoteForm.notes}
                          onChange={(e) => setCreditNoteForm((current) => ({ ...current, notes: e.target.value }))}
                          placeholder="Notes optionnelles"
                        />
                      </label>
                    </div>
                    <div className="ops-panel__actions">
                        <button type="button" className="ops-button-secondary" onClick={() => void handleIssueCreditNote()} disabled={!canWrite || !creditNoteForm.amount || !creditNoteForm.reason}>
                          Émettre une note de crédit
                        </button>
                    </div>
                  </div>
                  <CreditNoteList
                    invoiceId={selectedInvoice.id}
                    creditNotes={creditNotes}
                    canWrite={canWrite}
                    onCancelCreditNote={(creditNote) => void handleCancelCreditNote(creditNote)}
                  />
                </div>

                <div className="ops-detail-section">
                  <h5>Obligation de remboursement</h5>
                  {selectedInvoice.refund_obligation ? (
                    <>
                      <p className="ops-section-helper">
                        Statut {statusLabel(selectedInvoice.refund_obligation.status)} · Montant {formatAmount(selectedInvoice.refund_obligation.refund_amount)} MGA
                      </p>
                      <p className="ops-note">{selectedInvoice.refund_obligation.notes || "Aucune note."}</p>
                      {canWrite && selectedInvoice.refund_obligation.status === "pending" ? (
                        <div className="ops-inline-form">
                          <label>
                            Notes
                            <input
                              value={refundForm.notes}
                              onChange={(e) => setRefundForm({ notes: e.target.value })}
                              placeholder="Notes d'exécution"
                            />
                          </label>
                          <div className="ops-panel__actions">
                            <button type="button" className="ops-button" onClick={() => void handleExecuteRefund()}>
                              Exécuter le remboursement
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="ops-empty">Aucun remboursement lié à cette facture.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="ops-empty">Sélectionnez une facture pour voir les détails.</p>
            )}

            {actionState.status === "error" ? (
              <div className="ops-callout" role="alert">
                <p>{actionState.message}</p>
              </div>
            ) : null}
            {actionState.status === "success" ? (
              <div className="ops-callout">
                <p>{actionState.message}</p>
              </div>
            ) : null}
          </main>
        </div>
      ) : null}
    </section>
  );
}

export default BillingInvoicePanel;
