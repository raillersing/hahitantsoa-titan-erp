import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  checkCustomerWritePermission,
  getReservationDrafts,
  getHahitantsoaEventDrafts,
  getBillingInvoices,
  getPayments,
  getLogisticsEvents,
  getReservationDraftDocumentInstances,
  type CustomerSearchParams,
} from "./api";
import type {
  Customer,
  CustomerCreatePayload,
  CustomerUpdatePayload,
  ReservationDraft,
  HahitantsoaEventDraft,
  BillingInvoice,
  Payment,
  LogisticsEvent,
  DocumentInstance,
} from "./types";

type ViewState = "list" | "detail" | "create" | "edit" | "fiche";

type CustomersState =
  | { status: "loading" }
  | { status: "loaded"; customers: Customer[] }
  | { status: "empty" }
  | { status: "error"; message: string };

type CustomerDetailState =
  | { status: "loading" }
  | { status: "loaded"; customer: Customer }
  | { status: "not_found" }
  | { status: "error"; message: string };

type MutationState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; customer: Customer }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

type ReservationDraftsState =
  | { status: "loading" }
  | { status: "loaded"; drafts: ReservationDraft[] }
  | { status: "empty" }
  | { status: "error"; message: string };

type EventDraftsState =
  | { status: "loading" }
  | { status: "loaded"; drafts: HahitantsoaEventDraft[] }
  | { status: "empty" }
  | { status: "error"; message: string };

type FicheLinkedState<T> =
  | { status: "loading" }
  | { status: "loaded"; items: T[] }
  | { status: "empty" }
  | { status: "error"; message: string };

const INITIAL_FORM: CustomerCreatePayload = {
  display_name: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  is_active: true,
};

function getFieldError(
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string {
  if (!fieldErrors) return "";
  const msgs = fieldErrors[field];
  return msgs && msgs.length > 0 ? msgs[0] : "";
}

function CustomerListView({
  customersState,
  canWrite,
  searchParams,
  onSearchChange,
  onSearchSubmit,
  onClearSearch,
  onSelectCustomer,
  onCreateNew,
  onRetry,
}: {
  customersState: CustomersState;
  canWrite: boolean;
  searchParams: CustomerSearchParams;
  onSearchChange: (field: keyof CustomerSearchParams, value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onClearSearch: () => void;
  onSelectCustomer: (id: string) => void;
  onCreateNew: () => void;
  onRetry: () => void;
}) {
  return (
    <div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customers</p>
          <h2 id="customers-heading">Customer Directory</h2>
          <p className="section-helper">
            View, create, and manage customer records.
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="primary-btn"
            onClick={onCreateNew}
            aria-label="Create new customer"
          >
            + New Customer
          </button>
        ) : null}
      </div>

      <form className="customer-search-form" onSubmit={onSearchSubmit}>
        <div className="customer-search-fields">
          <label>
            <span className="visually-hidden">Search by name</span>
            <input
              type="text"
              placeholder="Name..."
              value={searchParams.name ?? ""}
              onChange={(e) => onSearchChange("name", e.target.value)}
              aria-label="Search by name"
            />
          </label>
          <label>
            <span className="visually-hidden">Search by email</span>
            <input
              type="text"
              placeholder="Email..."
              value={searchParams.email ?? ""}
              onChange={(e) => onSearchChange("email", e.target.value)}
              aria-label="Search by email"
            />
          </label>
          <label>
            <span className="visually-hidden">Search by phone</span>
            <input
              type="text"
              placeholder="Phone..."
              value={searchParams.phone ?? ""}
              onChange={(e) => onSearchChange("phone", e.target.value)}
              aria-label="Search by phone"
            />
          </label>
          <button type="submit" className="customer-search-btn">
            Search
          </button>
          <button
            type="button"
            className="customer-search-btn secondary"
            onClick={onClearSearch}
          >
            Clear
          </button>
        </div>
      </form>

      {customersState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">Loading customers...</p>
      ) : null}

      {customersState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{customersState.message}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {customersState.status === "empty" ? (
        <div className="notice info-notice" role="status">
          <p>
            No customer records found. Create your first customer to get
            started.
          </p>
        </div>
      ) : null}

      {customersState.status === "loaded" ? (
        <div className="customer-list-wrapper">
          <table className="customer-table" aria-label="Customer directory">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col">Status</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {customersState.customers.map((c) => (
                <tr
                  key={c.id}
                  className="customer-row"
                  data-testid={`customer-row-${c.id}`}
                >
                  <td>
                    <strong>{c.display_name}</strong>
                    {c.address ? (
                      <span className="customer-address-hint">
                        {c.address}
                      </span>
                    ) : null}
                  </td>
                  <td>{c.email || "—"}</td>
                  <td>{c.phone || "—"}</td>
                  <td>
                    {c.is_active ? (
                      <span className="status-badge status-active">Active</span>
                    ) : (
                      <span className="status-badge status-inactive">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="customer-action-btn"
                      onClick={() => onSelectCustomer(c.id)}
                      aria-label={`View ${c.display_name}`}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function CustomerDetailView({
  detailState,
  canWrite,
  onBack,
  onEdit,
  onViewFile,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onRetry,
  deleteConfirming,
  deletePending,
}: {
  detailState: CustomerDetailState;
  canWrite: boolean;
  onBack: () => void;
  onEdit: (id: string) => void;
  onViewFile: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onRetry: () => void;
  deleteConfirming: boolean;
  deletePending: boolean;
}) {
  if (detailState.status === "loading") {
    return (
      <div>
        <button type="button" className="back-btn" onClick={onBack}>
          &larr; Back to list
        </button>
        <p className="status loading-spinner" aria-live="polite">Loading customer details...</p>
      </div>
    );
  }

  if (detailState.status === "error") {
    return (
      <div>
        <button type="button" className="back-btn" onClick={onBack}>
          &larr; Back to list
        </button>
        <div className="notice error-notice" role="alert">
          <p>{detailState.message}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (detailState.status === "not_found") {
    return (
      <div>
        <button type="button" className="back-btn" onClick={onBack}>
          &larr; Back to list
        </button>
        <div className="notice warning-notice" role="status">
          <p>Customer record not found or was removed.</p>
        </div>
      </div>
    );
  }

  const { customer } = detailState;

  return (
    <div>
      <button type="button" className="back-btn" onClick={onBack}>
        &larr; Back to list
      </button>

      <div className="customer-detail-card">
        <div className="detail-header">
          <div>
            <p className="eyebrow">Customer</p>
            <h2>{customer.display_name}</h2>
          </div>
          {customer.is_active ? (
            <span className="status-badge status-active">Active</span>
          ) : (
            <span className="status-badge status-inactive">Inactive</span>
          )}
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{customer.email || "—"}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{customer.phone || "—"}</dd>
          </div>
          <div className="detail-full">
            <dt>Address</dt>
            <dd>{customer.address || "—"}</dd>
          </div>
          <div className="detail-full">
            <dt>Notes</dt>
            <dd>{customer.notes || "—"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{new Date(customer.created_at).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{new Date(customer.updated_at).toLocaleDateString()}</dd>
          </div>
        </dl>

        {canWrite ? (
          <div className="detail-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => onEdit(customer.id)}
              disabled={deletePending}
            >
              Edit
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onViewFile(customer.id)}
              disabled={deletePending}
            >
              Fiche client
            </button>
            {deleteConfirming ? (
              <span className="confirm-delete-group">
                <span className="confirm-delete-hint">
                  Delete this customer?
                </span>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={onDeleteConfirm}
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting..." : "Confirm Delete"}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={onDeleteCancel}
                  disabled={deletePending}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="danger-btn"
                onClick={() => onDelete(customer.id)}
                disabled={deletePending}
              >
                Delete
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomerFormView({
  view,
  mutationState,
  customer,
  onSave,
  onCancel,
}: {
  view: "create" | "edit";
  mutationState: MutationState;
  customer: Customer | null;
  onSave: (payload: CustomerCreatePayload | CustomerUpdatePayload) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CustomerCreatePayload>(() => {
    if (view === "edit" && customer) {
      return {
        display_name: customer.display_name,
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        notes: customer.notes || "",
        is_active: customer.is_active,
      };
    }
    return { ...INITIAL_FORM };
  });
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]>
  >({});

  useEffect(() => {
    if (mutationState.status === "error" && mutationState.fieldErrors) {
      setFieldErrors(mutationState.fieldErrors);
    }
  }, [mutationState]);

  const isSubmitting = mutationState.status === "submitting";

  const setField = (
    field: keyof CustomerCreatePayload,
    value: string | boolean,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name.trim()) {
      setFieldErrors({ display_name: ["Display name is required."] });
      return;
    }
    onSave(form);
  };

  return (
    <div>
      <button type="button" className="back-btn" onClick={onCancel}>
        &larr; {view === "create" ? "Back to list" : "Back to detail"}
      </button>

      <form
        className="customer-form"
        onSubmit={handleSubmit}
        aria-label={view === "create" ? "New customer" : "Edit customer"}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Customers</p>
            <h2 id="customer-form-heading">
              {view === "create" ? "New Customer" : `Edit ${customer?.display_name ?? "Customer"}`}
            </h2>
          </div>
        </div>

        {mutationState.status === "error" && !mutationState.fieldErrors ? (
          <div className="notice error-notice" role="alert">
            <p>{mutationState.message}</p>
          </div>
        ) : null}

        <div className="customer-form-body">
          <div className="form-group">
            <label htmlFor="customer-name">
              Display Name <span className="required-mark">*</span>
            </label>
            <input
              id="customer-name"
              type="text"
              value={form.display_name}
              onChange={(e) => setField("display_name", e.target.value)}
              className={
                getFieldError(fieldErrors, "display_name")
                  ? "invalid-input-highlight"
                  : ""
              }
              disabled={isSubmitting}
              aria-describedby={
                getFieldError(fieldErrors, "display_name")
                  ? "customer-name-error"
                  : undefined
              }
            />
            {getFieldError(fieldErrors, "display_name") ? (
              <span className="field-error-text" id="customer-name-error">
                {getFieldError(fieldErrors, "display_name")}
              </span>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="customer-email">Email</label>
            <input
              id="customer-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setField("email", e.target.value)}
              className={
                getFieldError(fieldErrors, "email")
                  ? "invalid-input-highlight"
                  : ""
              }
              disabled={isSubmitting}
              aria-describedby={
                getFieldError(fieldErrors, "email")
                  ? "customer-email-error"
                  : undefined
              }
            />
            {getFieldError(fieldErrors, "email") ? (
              <span className="field-error-text" id="customer-email-error">
                {getFieldError(fieldErrors, "email")}
              </span>
            ) : null}
          </div>

          <div className="form-group">
            <label htmlFor="customer-phone">Phone</label>
            <input
              id="customer-phone"
              type="text"
              value={form.phone ?? ""}
              onChange={(e) => setField("phone", e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customer-address">Address</label>
            <textarea
              id="customer-address"
              value={form.address ?? ""}
              onChange={(e) => setField("address", e.target.value)}
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customer-notes">Notes</label>
            <textarea
              id="customer-notes"
              value={form.notes ?? ""}
              onChange={(e) => setField("notes", e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={form.is_active !== false}
                onChange={(e) => setField("is_active", e.target.checked)}
                disabled={isSubmitting}
              />
              Active customer
            </label>
          </div>

          <div className="form-actions-row">
            <button
              type="submit"
              className="primary-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving..."
                : view === "create"
                  ? "Create Customer"
                  : "Save Changes"}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function reservationLifecycleLabel(draft: ReservationDraft): string {
  if (draft.status === "cancelled") return "Cancelled";
  if (draft.confirmed_at) return "Confirmed";
  if (draft.required_deposit_received_at) return "Dépôt reçu";
  if (draft.contract_signed_at) return "Contrat signé";
  return "Brouillon";
}

function hahitantsoaStatusLabel(status: HahitantsoaEventDraft["status"]): string {
  if (status === "confirmed") return "Confirmé";
  return "Brouillon";
}

function CustomerFileView({
  customer,
  reservationDraftsState,
  eventDraftsState,
  documentsState,
  invoicesState,
  paymentsState,
  logisticsState,
  onBack,
  onRetry,
  onRetryLinked,
}: {
  customer: Customer;
  reservationDraftsState: ReservationDraftsState;
  eventDraftsState: EventDraftsState;
  documentsState: FicheLinkedState<DocumentInstance>;
  invoicesState: FicheLinkedState<BillingInvoice>;
  paymentsState: FicheLinkedState<Payment>;
  logisticsState: FicheLinkedState<LogisticsEvent>;
  onBack: () => void;
  onRetry: () => void;
  onRetryLinked: () => void;
}) {
  const isLoaded = <T,>(s: FicheLinkedState<T>): s is { status: "loaded"; items: T[] } =>
    s.status === "loaded";
  const isEmpty = <T,>(s: FicheLinkedState<T>): s is { status: "empty" } =>
    s.status === "empty";
  const isError = <T,>(s: FicheLinkedState<T>): s is { status: "error"; message: string } =>
    s.status === "error";

  const allItems = [
    ...(reservationDraftsState.status === "loaded" ? reservationDraftsState.drafts : []),
    ...(eventDraftsState.status === "loaded" ? eventDraftsState.drafts : []),
  ];
  const invoiceItems = isLoaded(invoicesState) ? invoicesState.items : [];
  const paymentItems = isLoaded(paymentsState) ? paymentsState.items : [];
  const docItems = isLoaded(documentsState) ? documentsState.items : [];
  const logisticsItems = isLoaded(logisticsState) ? logisticsState.items : [];

  const totalInvoiced = invoiceItems.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalSettled = invoiceItems.reduce(
    (sum, inv) => sum + (inv.amount_settled ? Number(inv.amount_settled) : 0),
    0,
  );
  const totalOutstanding = invoiceItems.reduce(
    (sum, inv) => sum + (inv.remaining_balance ? Number(inv.remaining_balance) : 0),
    0,
  );

  const timeline: { date: Date; label: string; kind: string }[] = [];

  for (const d of (reservationDraftsState.status === "loaded" ? reservationDraftsState.drafts : [])) {
    timeline.push({ date: new Date(d.created_at), label: `Réservation ${d.public_reference} créée`, kind: "reservation" });
    if (d.confirmed_at) timeline.push({ date: new Date(d.confirmed_at), label: `Réservation ${d.public_reference} confirmée`, kind: "reservation" });
  }
  for (const d of (eventDraftsState.status === "loaded" ? eventDraftsState.drafts : [])) {
    timeline.push({ date: new Date(d.created_at), label: `Événement ${d.event_name} créé`, kind: "event" });
  }
  for (const doc of docItems) {
    timeline.push({ date: new Date(doc.prepared_at), label: `Document ${doc.template_label} préparé`, kind: "document" });
  }
  for (const pmt of paymentItems) {
    if (pmt.confirmed_at) timeline.push({ date: new Date(pmt.confirmed_at), label: `Paiement de ${Number(pmt.amount).toLocaleString()} Ar confirmé`, kind: "payment" });
  }
  for (const evt of logisticsItems) {
    if (evt.scheduled_at) timeline.push({ date: new Date(evt.scheduled_at), label: `Événement logistique ${evt.event_type} planifié`, kind: "logistics" });
  }

  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div>
      <button type="button" className="back-btn" onClick={onBack}>
        &larr; Back to detail
      </button>

      <div className="customer-detail-card">
        <div className="detail-header">
          <div>
            <p className="eyebrow">Fiche client</p>
            <h2>{customer.display_name}</h2>
          </div>
          {customer.is_active ? (
            <span className="status-badge status-active">Actif</span>
          ) : (
            <span className="status-badge status-inactive">Inactif</span>
          )}
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Email</dt>
            <dd>{customer.email || "—"}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>{customer.phone || "—"}</dd>
          </div>
          <div className="detail-full">
            <dt>Adresse</dt>
            <dd>{customer.address || "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="customer-metrics" style={{ marginTop: "1.5rem" }}>
        <article className="customer-metric-card">
          <span>Réservations</span>
          <strong>{allItems.length}</strong>
        </article>
        <article className="customer-metric-card">
          <span>Documents</span>
          <strong>{docItems.length}</strong>
        </article>
        <article className="customer-metric-card">
          <span>Factures</span>
          <strong>{invoiceItems.length}</strong>
        </article>
        <article className="customer-metric-card">
          <span>Paiements</span>
          <strong>{paymentItems.length}</strong>
        </article>
      </div>

      <div className="fiche-summary-cards" style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div className="fiche-summary-card">
          <span className="fiche-summary-label">Total facturé</span>
          <strong className="fiche-summary-value">{totalInvoiced.toLocaleString()} Ar</strong>
        </div>
        <div className="fiche-summary-card">
          <span className="fiche-summary-label">Réglé</span>
          <strong className="fiche-summary-value">{totalSettled.toLocaleString()} Ar</strong>
        </div>
        <div className="fiche-summary-card">
          <span className="fiche-summary-label">Restant dû</span>
          <strong className="fiche-summary-value">{totalOutstanding.toLocaleString()} Ar</strong>
        </div>
      </div>

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <div>
          <h3>Réservations Titan</h3>
          <p className="section-helper">
            Réservation de matériel liées à ce client.
          </p>
        </div>
      </div>

      {reservationDraftsState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">Chargement des réservations...</p>
      ) : null}

      {reservationDraftsState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{reservationDraftsState.message}</p>
          <button type="button" onClick={onRetry}>Réessayer</button>
        </div>
      ) : null}

      {reservationDraftsState.status === "empty" ? (
        <div className="notice info-notice" role="status">
          <p>Aucune réservation Titan trouvée pour ce client.</p>
        </div>
      ) : null}

      {reservationDraftsState.status === "loaded" ? (
        <ul className="preview-list">
          {reservationDraftsState.drafts.map((draft) => (
            <li key={draft.id}>
              <div>
                <strong>{draft.public_reference}</strong>
                <span className="status-badge status-draft">
                  {reservationLifecycleLabel(draft)}
                </span>
              </div>
              <span>
                {new Date(draft.start_at).toLocaleDateString()} &rarr;{" "}
                {new Date(draft.end_at).toLocaleDateString()}
              </span>
              <span>{draft.lines.length} ligne(s)</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <div>
          <h3>Événements Hahitantsoa</h3>
          <p className="section-helper">
            Événements liés à ce client.
          </p>
        </div>
      </div>

      {eventDraftsState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">Chargement des événements...</p>
      ) : null}

      {eventDraftsState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{eventDraftsState.message}</p>
          <button type="button" onClick={onRetry}>Réessayer</button>
        </div>
      ) : null}

      {eventDraftsState.status === "empty" ? (
        <div className="notice info-notice" role="status">
          <p>Aucun événement Hahitantsoa trouvé pour ce client.</p>
        </div>
      ) : null}

      {eventDraftsState.status === "loaded" ? (
        <ul className="preview-list">
          {eventDraftsState.drafts.map((draft) => (
            <li key={draft.id}>
              <div>
                <strong>{draft.event_name}</strong>
                <span className="status-badge status-draft">
                  {hahitantsoaStatusLabel(draft.status)}
                </span>
              </div>
              <span>
                {new Date(draft.start_at).toLocaleDateString()} &rarr;{" "}
                {new Date(draft.end_at).toLocaleDateString()}
              </span>
              <span>{draft.lines.length} ligne(s)</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <div>
          <h3>Documents</h3>
          <p className="section-helper">
            Documents générés liés à ce client.
          </p>
        </div>
      </div>

      {documentsState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">Chargement des documents...</p>
      ) : null}

      {documentsState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{documentsState.message}</p>
          <button type="button" onClick={onRetryLinked}>Réessayer</button>
        </div>
      ) : null}

      {documentsState.status === "empty" ? (
        <div className="notice info-notice" role="status">
          <p>Aucun document trouvé pour ce client.</p>
        </div>
      ) : null}

      {documentsState.status === "loaded" ? (
        <ul className="preview-list">
          {documentsState.items.map((doc) => (
            <li key={doc.id}>
              <div>
                <strong>{doc.template_label}</strong>
                <span className="status-badge status-draft">{doc.status}</span>
              </div>
              <span>{doc.reservation_public_reference || "—"}</span>
              <span>{new Date(doc.prepared_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <div>
          <h3>Facturation</h3>
          <p className="section-helper">
            Factures liées à ce client.
          </p>
        </div>
      </div>

      {invoicesState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">Chargement des factures...</p>
      ) : null}

      {invoicesState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{invoicesState.message}</p>
          <button type="button" onClick={onRetryLinked}>Réessayer</button>
        </div>
      ) : null}

      {invoicesState.status === "empty" ? (
        <div className="notice info-notice" role="status">
          <p>Aucune facture trouvée pour ce client.</p>
        </div>
      ) : null}

      {invoicesState.status === "loaded" ? (
        <ul className="preview-list">
          {invoicesState.items.map((inv) => (
            <li key={inv.id}>
              <div>
                <strong>{Number(inv.amount).toLocaleString()} Ar</strong>
                <span className="status-badge status-draft">{inv.invoice_status}</span>
              </div>
              <span>{inv.source_kind}</span>
              <span>{new Date(inv.issued_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <div>
          <h3>Paiements</h3>
          <p className="section-helper">
            Paiements liés à ce client.
          </p>
        </div>
      </div>

      {paymentsState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">Chargement des paiements...</p>
      ) : null}

      {paymentsState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{paymentsState.message}</p>
          <button type="button" onClick={onRetryLinked}>Réessayer</button>
        </div>
      ) : null}

      {paymentsState.status === "empty" ? (
        <div className="notice info-notice" role="status">
          <p>Aucun paiement trouvé pour ce client.</p>
        </div>
      ) : null}

      {paymentsState.status === "loaded" ? (
        <ul className="preview-list">
          {paymentsState.items.map((pmt) => (
            <li key={pmt.id}>
              <div>
                <strong>{Number(pmt.amount).toLocaleString()} Ar</strong>
                <span className="status-badge status-draft">{pmt.payment_status}</span>
              </div>
              <span>{pmt.payment_method}</span>
              <span>{pmt.confirmed_at ? new Date(pmt.confirmed_at).toLocaleDateString() : "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <div>
          <h3>Logistique</h3>
          <p className="section-helper">
            Événements logistiques liés à ce client.
          </p>
        </div>
      </div>

      {logisticsState.status === "loading" ? (
        <p className="status loading-spinner" aria-live="polite">Chargement des événements logistiques...</p>
      ) : null}

      {logisticsState.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <p>{logisticsState.message}</p>
          <button type="button" onClick={onRetryLinked}>Réessayer</button>
        </div>
      ) : null}

      {logisticsState.status === "empty" ? (
        <div className="notice info-notice" role="status">
          <p>Aucun événement logistique trouvé pour ce client.</p>
        </div>
      ) : null}

      {logisticsState.status === "loaded" ? (
        <ul className="preview-list">
          {logisticsState.items.map((evt) => (
            <li key={evt.id}>
              <div>
                <strong>{evt.event_type}</strong>
                <span className="status-badge status-draft">{evt.status}</span>
              </div>
              <span>{evt.scheduled_at ? new Date(evt.scheduled_at).toLocaleDateString() : "—"}</span>
              <span>{evt.address || "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="section-heading" style={{ marginTop: "2rem" }}>
        <div>
          <h3>Chronologie</h3>
          <p className="section-helper">
            Historique chronologique des événements.
          </p>
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="notice info-notice" role="status">
          <p>Aucun événement enregistré.</p>
        </div>
      ) : (
        <ul className="timeline-list">
          {timeline.slice(0, 20).map((entry, i) => (
            <li key={i} className={`timeline-item timeline-item--${entry.kind}`}>
              <span className="timeline-date">{entry.date.toLocaleDateString()}</span>
              <span className="timeline-label">{entry.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CustomerPanel() {
  const [view, setView] = useState<ViewState>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customersState, setCustomersState] = useState<CustomersState>({
    status: "loading",
  });
  const [detailState, setDetailState] = useState<CustomerDetailState>({
    status: "loading",
  });
  const [mutationState, setMutationState] = useState<MutationState>({
    status: "idle",
  });
  const [canWrite, setCanWrite] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [searchParams, setSearchParams] = useState<CustomerSearchParams>({});
  const [reservationDraftsState, setReservationDraftsState] = useState<ReservationDraftsState>({
    status: "loading",
  });
  const [eventDraftsState, setEventDraftsState] = useState<EventDraftsState>({
    status: "loading",
  });
  const [documentsState, setDocumentsState] = useState<FicheLinkedState<DocumentInstance>>({
    status: "loading",
  });
  const [invoicesState, setInvoicesState] = useState<FicheLinkedState<BillingInvoice>>({
    status: "loading",
  });
  const [paymentsState, setPaymentsState] = useState<FicheLinkedState<Payment>>({
    status: "loading",
  });
  const [logisticsState, setLogisticsState] = useState<FicheLinkedState<LogisticsEvent>>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    checkCustomerWritePermission(controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  const loadCustomers = useCallback(
    (filters?: CustomerSearchParams) => {
      setCustomersState({ status: "loading" });

      getCustomers(filters)
        .then((customers) => {
          setCustomersState(
            customers.length === 0
              ? { status: "empty" }
              : { status: "loaded", customers },
          );
        })
        .catch((err) => {
          setCustomersState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Failed to load customers.",
          });
        });
    },
    [],
  );

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const loadDetail = useCallback((id: string) => {
    setDetailState({ status: "loading" });
    const controller = new AbortController();

    getCustomer(id, controller.signal)
      .then((customer) => {
        setDetailState({ status: "loaded", customer });
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (err instanceof Error && err.message.includes("404")) {
          setDetailState({ status: "not_found" });
          return;
        }
        setDetailState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load customer details.",
        });
      });

    return () => controller.abort();
  }, []);

  const loadCustomerDrafts = useCallback((customerId: string) => {
    setReservationDraftsState({ status: "loading" });
    setEventDraftsState({ status: "loading" });

    getReservationDrafts(customerId)
      .then((drafts) => {
        setReservationDraftsState(
          drafts.length === 0
            ? { status: "empty" }
            : { status: "loaded", drafts },
        );
      })
      .catch((err) => {
        setReservationDraftsState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load reservation drafts.",
        });
      });

    getHahitantsoaEventDrafts(customerId)
      .then((drafts) => {
        setEventDraftsState(
          drafts.length === 0
            ? { status: "empty" }
            : { status: "loaded", drafts },
        );
      })
      .catch((err) => {
        setEventDraftsState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load event drafts.",
        });
      });
  }, []);

  const loadFicheLinkedData = useCallback(async (customerId: string) => {
    setDocumentsState({ status: "loading" });
    setInvoicesState({ status: "loading" });
    setPaymentsState({ status: "loading" });
    setLogisticsState({ status: "loading" });

    const allDraftIds: string[] = [];
    try {
      const drafts = await getReservationDrafts(customerId);
      allDraftIds.push(...drafts.map((d) => d.id));
    } catch {
      // reservation drafts already loaded by loadCustomerDrafts
    }

    const draftSet = new Set(allDraftIds);

    const setLoaded = <T,>(
      setter: (s: FicheLinkedState<T>) => void,
      items: T[],
      getId: (item: T) => string | null,
    ) => {
      const filtered = items.filter((item) => {
        const id = getId(item);
        return id !== null && draftSet.has(id);
      });
      setter(
        filtered.length === 0
          ? { status: "empty" }
          : { status: "loaded", items: filtered },
      );
    };

    const setError = <T,>(
      setter: (s: FicheLinkedState<T>) => void,
      err: unknown,
    ) => {
      setter({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load data.",
      });
    };

    await Promise.all([
      getBillingInvoices()
        .then((items) => setLoaded(setInvoicesState, items, (i: BillingInvoice) => i.reservation_draft))
        .catch((err) => setError(setInvoicesState, err)),
      getPayments()
        .then((items) => setLoaded(setPaymentsState, items, (p: Payment) => p.reservation_draft))
        .catch((err) => setError(setPaymentsState, err)),
      getLogisticsEvents()
        .then((items) => setLoaded(setLogisticsState, items, (l: LogisticsEvent) => l.reservation_draft))
        .catch((err) => setError(setLogisticsState, err)),
      (async () => {
        const allDocs: DocumentInstance[] = [];
        for (const draftId of allDraftIds) {
          try {
            const docs = await getReservationDraftDocumentInstances(draftId);
            allDocs.push(...docs);
          } catch {
            // skip per-draft failures
          }
        }
        setDocumentsState(
          allDocs.length === 0
            ? { status: "empty" }
            : { status: "loaded", items: allDocs },
        );
      })(),
    ]);
  }, []);

  const handleViewFile = (id: string) => {
    setSelectedId(id);
    setView("fiche");
    loadCustomerDrafts(id);
    loadFicheLinkedData(id);
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedId(id);
    setView("detail");
    loadDetail(id);
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedId(null);
    setDetailState({ status: "loading" });
    setDeleteConfirming(false);
  };

  const handleBackFromFiche = () => {
    if (selectedId) {
      setView("detail");
      loadDetail(selectedId);
    } else {
      handleBackToList();
    }
  };

  const handleCreateNew = () => {
    setMutationState({ status: "idle" });
    setView("create");
  };

  const handleEdit = (id: string) => {
    setSelectedId(id);
    setMutationState({ status: "idle" });
    setView("edit");
    setDeleteConfirming(false);
  };

  const handleCancelForm = () => {
    if (view === "edit" && selectedId) {
      setView("detail");
      loadDetail(selectedId);
    } else {
      handleBackToList();
    }
  };

  const handleSave = async (
    payload: CustomerCreatePayload | CustomerUpdatePayload,
  ) => {
    setMutationState({ status: "submitting" });

    try {
      let customer: Customer;
      if (view === "create") {
        customer = await createCustomer(
          payload as CustomerCreatePayload,
        );
      } else if (selectedId) {
        customer = await updateCustomer(
          selectedId,
          payload as CustomerUpdatePayload,
        );
      } else {
        throw new Error("Unexpected state: no customer selected for edit.");
      }
      setMutationState({ status: "success", customer });
      const updated = await getCustomers(
        Object.values(searchParams).some(Boolean) ? searchParams : undefined,
      );
      setCustomersState(
        updated.length === 0
          ? { status: "empty" }
          : { status: "loaded", customers: updated },
      );
      setSelectedId(customer.id);
      setView("detail");
      setDetailState({ status: "loaded", customer });
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 403) {
        setMutationState({
          status: "error",
          message:
            "You do not have permission to modify customers. Contact an administrator.",
        });
        return;
      }
      setMutationState({
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to save customer.",
        fieldErrors: apiErr.errors,
      });
    }
  };

  const handleSearchChange = (
    field: keyof CustomerSearchParams,
    value: string,
  ) => {
    setSearchParams((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers(searchParams);
  };

  const handleClearSearch = () => {
    setSearchParams({});
    loadCustomers({});
  };

  const handleDelete = (_id: string) => {
    setDeleteConfirming(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedId) return;
    setMutationState({ status: "submitting" });

    try {
      await deleteCustomer(selectedId);
      setDeleteConfirming(false);
      handleBackToList();
      loadCustomers();
    } catch (err) {
      setMutationState({ status: "idle" });
      const apiErr = err as ApiError;
      if (apiErr.status === 403) {
        setDetailState({
          status: "error",
          message:
            "You do not have permission to delete customers. Contact an administrator.",
        });
      } else {
        setDetailState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to delete customer.",
        });
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirming(false);
  };

  return (
    <section
      className="customer-panel"
      aria-labelledby={
        view === "list"
          ? "customers-heading"
          : view === "create" || view === "edit"
            ? "customer-form-heading"
            : undefined
      }
    >
      {view === "list" ? (
        <div className="customer-metrics">
          <article className="customer-metric-card">
            <span>Clients visibles</span>
            <strong>{customersState.status === "loaded" ? customersState.customers.length : "—"}</strong>
          </article>
          <article className="customer-metric-card">
            <span>Mode</span>
            <strong>{canWrite ? "Lecture + écriture" : "Lecture seule"}</strong>
          </article>
          <article className="customer-metric-card">
            <span>Recherche</span>
            <strong>{searchParams.name || searchParams.email || searchParams.phone ? "Filtrée" : "Complète"}</strong>
          </article>
        </div>
      ) : null}

      {view === "list" ? (
        <CustomerListView
          customersState={customersState}
          canWrite={canWrite}
          searchParams={searchParams}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          onClearSearch={handleClearSearch}
          onSelectCustomer={handleSelectCustomer}
          onCreateNew={handleCreateNew}
          onRetry={() => loadCustomers(searchParams)}
        />
      ) : null}

      {view === "detail" && selectedId ? (
        <div className="customer-detail-shell">
          <CustomerDetailView
            detailState={detailState}
            canWrite={canWrite}
            onBack={handleBackToList}
            onEdit={handleEdit}
            onViewFile={handleViewFile}
            onDelete={handleDelete}
            onDeleteConfirm={handleDeleteConfirm}
            onDeleteCancel={handleDeleteCancel}
            onRetry={() => selectedId && loadDetail(selectedId)}
            deleteConfirming={deleteConfirming}
            deletePending={mutationState.status === "submitting"}
          />
        </div>
      ) : null}

      {view === "fiche" && detailState.status === "loaded" ? (
        <div className="customer-detail-shell">
          <CustomerFileView
            customer={detailState.customer}
            reservationDraftsState={reservationDraftsState}
            eventDraftsState={eventDraftsState}
            documentsState={documentsState}
            invoicesState={invoicesState}
            paymentsState={paymentsState}
            logisticsState={logisticsState}
            onBack={handleBackFromFiche}
            onRetry={() => selectedId && loadCustomerDrafts(selectedId)}
            onRetryLinked={() => selectedId && loadFicheLinkedData(selectedId)}
          />
        </div>
      ) : null}

      {view === "fiche" && detailState.status !== "loaded" && selectedId ? (
        <div className="customer-detail-shell">
          <button type="button" className="back-btn" onClick={handleBackFromFiche}>
            &larr; Back to list
          </button>
          <p className="status loading-spinner" aria-live="polite">Loading customer...</p>
        </div>
      ) : null}

      {view === "create" || view === "edit" ? (
        <div className="customer-form-shell">
          <CustomerFormView
            view={view}
            mutationState={mutationState}
            customer={
              view === "edit" && detailState.status === "loaded"
                ? detailState.customer
                : null
            }
            onSave={handleSave}
            onCancel={handleCancelForm}
          />
        </div>
      ) : null}
    </section>
  );
}

export default CustomerPanel;
