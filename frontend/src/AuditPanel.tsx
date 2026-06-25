import { useEffect, useMemo, useState } from "react";

import { checkEndpointPermission, getAuditEvents } from "./api";
import type { AuditEvent, AuditEventQueryParams } from "./types";

type AuditState =
  | { status: "loading" }
  | { status: "loaded"; events: AuditEvent[] }
  | { status: "empty" }
  | { status: "error"; message: string };

const TARGET_TYPE_OPTIONS = [
  "payment",
  "document_instance",
  "billing_invoice",
  "reservation_draft",
  "hahitantsoa_event_draft",
  "inventory_stock_movement",
  "inventory_damage_loss_settlement",
  "role_assignment",
];

function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("fr-MG", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AuditPanel() {
  const [state, setState] = useState<AuditState>({ status: "loading" });
  const [accessStatus, setAccessStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const [filters, setFilters] = useState<AuditEventQueryParams>({
    action: "",
    target_type: "",
    target_id: "",
    actor_id: "",
    created_after: "",
    created_before: "",
  });

  const effectiveFilters = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filters).filter(([, value]) => Boolean(value)),
      ) as AuditEventQueryParams,
    [filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    checkEndpointPermission("/api/v1/audit/events/", "OPTIONS", controller.signal).then((allowed) => {
      setAccessStatus(allowed ? "allowed" : "denied");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (accessStatus === "loading") {
      setState({ status: "loading" });
      return;
    }

    if (accessStatus === "denied") {
      setState({
        status: "error",
        message: "Audit access requires backend reservation-sensitive permission.",
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });
    getAuditEvents(effectiveFilters, controller.signal)
      .then((events) => {
        setState(events.length === 0 ? { status: "empty" } : { status: "loaded", events });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load audit events.",
        });
      });
    return () => controller.abort();
  }, [accessStatus, effectiveFilters]);

  return (
    <section className="audit-panel" aria-labelledby="audit-panel-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Security activity</p>
          <h2 id="audit-panel-heading">Audit log viewer</h2>
          <p className="section-helper">
            Read-only timeline of backend audit events. Filters map directly to the
            confirmed backend query parameters.
          </p>
        </div>
      </div>

      {accessStatus === "denied" ? (
        <div className="notice error-notice" role="alert">
          <h3>Audit access unavailable</h3>
          <p>The current session cannot read the audit event endpoints.</p>
        </div>
      ) : null}

      <form className="audit-filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          Action
          <input
            type="text"
            value={filters.action}
            onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
            placeholder="document.instance_pdf_generated"
          />
        </label>
        <label>
          Target type
          <select
            value={filters.target_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, target_type: event.target.value }))}
          >
            <option value="">All targets</option>
            {TARGET_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          Actor ID
          <input
            type="text"
            value={filters.actor_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, actor_id: event.target.value }))}
            placeholder="user UUID"
          />
        </label>
        <label>
          Created after
          <input
            type="datetime-local"
            value={filters.created_after}
            onChange={(event) => setFilters((prev) => ({ ...prev, created_after: event.target.value }))}
          />
        </label>
        <label>
          Created before
          <input
            type="datetime-local"
            value={filters.created_before}
            onChange={(event) => setFilters((prev) => ({ ...prev, created_before: event.target.value }))}
          />
        </label>
      </form>

      {state.status === "loading" ? (
        <p className="status notice loading-notice" aria-live="polite">
          Loading audit events...
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="notice error-notice" role="alert">
          <h3>Audit events unavailable</h3>
          <p>{state.message}</p>
        </div>
      ) : null}

      {state.status === "empty" ? (
        <p className="status">No audit events matched the current filters.</p>
      ) : null}

      {state.status === "loaded" ? (
        <div className="audit-table-shell">
          <table className="data-table audit-table" aria-label="Audit events">
            <thead>
              <tr>
                <th scope="col">Created</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Actor</th>
                <th scope="col">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {state.events.map((event) => (
                <tr key={event.id} data-testid={`audit-row-${event.id}`}>
                  <td>{formatDateTime(event.created_at)}</td>
                  <td>
                    <span className="status-tag status-generated">{event.action}</span>
                  </td>
                  <td>
                    <div className="audit-target">
                      <strong>{event.target_type}</strong>
                      <span>{event.target_id}</span>
                    </div>
                  </td>
                  <td>{event.actor_id ?? "—"}</td>
                  <td>
                    <dl className="audit-metadata">
                      {Object.entries(event.metadata ?? {}).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{stringValue(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
