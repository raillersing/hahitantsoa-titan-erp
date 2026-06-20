import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  checkCustomerWritePermission,
} from "./api";
import type {
  Customer,
  CustomerCreatePayload,
  CustomerUpdatePayload,
} from "./types";

type ViewState = "list" | "detail" | "create" | "edit";

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
  onSelectCustomer,
  onCreateNew,
  onRetry,
}: {
  customersState: CustomersState;
  canWrite: boolean;
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

      {customersState.status === "loading" ? (
        <p className="status loading-spinner">Loading customers...</p>
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
          <table className="customer-table">
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
        <p className="status loading-spinner">Loading customer details...</p>
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

  useEffect(() => {
    const controller = new AbortController();
    checkCustomerWritePermission(controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  const loadCustomers = useCallback(() => {
    setCustomersState({ status: "loading" });
    const controller = new AbortController();

    getCustomers(controller.signal)
      .then((customers) => {
        setCustomersState(
          customers.length === 0
            ? { status: "empty" }
            : { status: "loaded", customers },
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setCustomersState({
          status: "error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load customers.",
        });
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cleanup = loadCustomers();
    return cleanup;
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
      setCustomersState({ status: "loading" });
      await getCustomers().then((customers) => {
        setCustomersState(
          customers.length === 0
            ? { status: "empty" }
            : { status: "loaded", customers },
        );
      });
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
        <CustomerListView
          customersState={customersState}
          canWrite={canWrite}
          onSelectCustomer={handleSelectCustomer}
          onCreateNew={handleCreateNew}
          onRetry={loadCustomers}
        />
      ) : null}

      {view === "detail" ? (
        <CustomerDetailView
          detailState={detailState}
          canWrite={canWrite}
          onBack={handleBackToList}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeleteConfirm={handleDeleteConfirm}
          onDeleteCancel={handleDeleteCancel}
          onRetry={() => selectedId && loadDetail(selectedId)}
          deleteConfirming={deleteConfirming}
          deletePending={mutationState.status === "submitting"}
        />
      ) : null}

      {view === "create" || view === "edit" ? (
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
      ) : null}
    </section>
  );
}

export default CustomerPanel;
