import { useCallback, useEffect, useRef, useState } from "react";
import { getRoleAssignments, getRoles, checkIdentityWritePermission } from "./api";
import type { ApplicationRole, UserRoleAssignment } from "./types";

type RolesState =
  | { status: "loading" }
  | { status: "loaded"; roles: ApplicationRole[] }
  | { status: "empty" }
  | { status: "error"; message: string };

type AssignmentsState =
  | { status: "loading" }
  | { status: "loaded"; assignments: UserRoleAssignment[] }
  | { status: "empty" }
  | { status: "error"; message: string };

type ActiveTab = "roles" | "assignments";

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

export default function IdentityPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("roles");
  const [rolesState, setRolesState] = useState<RolesState>({ status: "loading" });
  const [assignmentsState, setAssignmentsState] = useState<AssignmentsState>({
    status: "loading",
  });
  const [canWrite, setCanWrite] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    checkIdentityWritePermission(controller.signal).then(setCanWrite);
    return () => controller.abort();
  }, []);

  const loadRoles = useCallback(() => {
    setRolesState({ status: "loading" });
    abortRef.current = new AbortController();
    getRoles(undefined, abortRef.current.signal)
      .then((roles) => {
        setRolesState(
          roles.length === 0
            ? { status: "empty" }
            : { status: "loaded", roles },
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setRolesState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load roles.",
        });
      });
  }, []);

  const loadAssignments = useCallback(() => {
    setAssignmentsState({ status: "loading" });
    abortRef.current = new AbortController();
    getRoleAssignments(undefined, abortRef.current.signal)
      .then((assignments) => {
        setAssignmentsState(
          assignments.length === 0
            ? { status: "empty" }
            : { status: "loaded", assignments },
        );
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setAssignmentsState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Failed to load assignments.",
        });
      });
  }, []);

  useEffect(() => {
    if (activeTab === "roles") {
      loadRoles();
    } else {
      loadAssignments();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [activeTab, loadRoles, loadAssignments]);

  return (
    <section className="identity-panel">
      <div className="section-heading">
        <p className="eyebrow">Identity Management</p>
        <h2>Roles &amp; Permissions</h2>
        <p className="section-helper">
          View application roles and user role assignments. Write operations
          require backend identity management support.
        </p>
      </div>

      <div className="tab-bar" role="tablist" aria-label="Identity sections">
        <button
          role="tab"
          aria-selected={activeTab === "roles"}
          aria-controls="roles-panel"
          className={`tab-button${activeTab === "roles" ? " tab-button--active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          Roles
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "assignments"}
          aria-controls="assignments-panel"
          className={`tab-button${activeTab === "assignments" ? " tab-button--active" : ""}`}
          onClick={() => setActiveTab("assignments")}
        >
          Assignments
        </button>
      </div>

      {activeTab === "roles" && (
        <div
          id="roles-panel"
          role="tabpanel"
          aria-label="Roles list"
          data-testid="identity-roles-panel"
        >
          <div className="section-actions">
            {canWrite && (
              <div className="pending-state-overlay">
                <span className="pending-badge">Pending Backend Contract</span>
                <p className="pending-helper">
                  Create, edit, and delete operations for roles require backend
                  identity management endpoints.
                </p>
              </div>
            )}
          </div>

          {rolesState.status === "loading" && (
            <p className="status" aria-live="polite">Loading roles...</p>
          )}

          {rolesState.status === "error" && (
            <div className="notice" role="alert">
              <p>{rolesState.message}</p>
              <button
                type="button"
                className="retry-btn"
                onClick={loadRoles}
                aria-label="Retry loading roles"
              >
                Retry
              </button>
            </div>
          )}

          {rolesState.status === "empty" && (
            <p className="status">No roles defined.</p>
          )}

          {rolesState.status === "loaded" && (
            <table className="data-table" aria-label="Application roles">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Description</th>
                  <th>System</th>
                  <th>Active</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rolesState.roles.map((role) => (
                  <tr key={role.id} data-testid={`role-row-${role.id}`}>
                    <td>{role.name}</td>
                    <td><code>{role.slug}</code></td>
                    <td>{role.description}</td>
                    <td>
                      <span
                        className={`status-tag status-${role.is_system_managed ? "active" : "inactive"}`}
                      >
                        {role.is_system_managed ? "Yes" : "No"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-tag status-${role.is_active ? "active" : "inactive"}`}
                      >
                        {role.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{formatDateTime(role.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "assignments" && (
        <div
          id="assignments-panel"
          role="tabpanel"
          aria-label="Role assignments list"
          data-testid="identity-assignments-panel"
        >
          <div className="section-actions">
            {canWrite && (
              <div className="pending-state-overlay">
                <span className="pending-badge">Pending Backend Contract</span>
                <p className="pending-helper">
                  Assign and revoke operations for role assignments require
                  backend identity management endpoints.
                </p>
              </div>
            )}
          </div>

          {assignmentsState.status === "loading" && (
            <p className="status" aria-live="polite">Loading assignments...</p>
          )}

          {assignmentsState.status === "error" && (
            <div className="notice" role="alert">
              <p>{assignmentsState.message}</p>
              <button
                type="button"
                className="retry-btn"
                onClick={loadAssignments}
                aria-label="Retry loading assignments"
              >
                Retry
              </button>
            </div>
          )}

          {assignmentsState.status === "empty" && (
            <p className="status">No role assignments found.</p>
          )}

          {assignmentsState.status === "loaded" && (
            <table className="data-table" aria-label="User role assignments">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Assigned By</th>
                  <th>Assigned At</th>
                  <th>Active</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {assignmentsState.assignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    data-testid={`assignment-row-${assignment.id}`}
                  >
                    <td><code>{assignment.user_id}</code></td>
                    <td>{assignment.role.name}</td>
                    <td>
                      {assignment.assigned_by_id ? (
                        <code>{assignment.assigned_by_id}</code>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{formatDateTime(assignment.assigned_at)}</td>
                    <td>
                      <span
                        className={`status-tag status-${assignment.is_active ? "active" : "inactive"}`}
                      >
                        {assignment.is_active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td>{assignment.notes || <span className="muted">—</span>}</td>
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
