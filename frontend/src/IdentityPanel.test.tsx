import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import IdentityPanel from "./IdentityPanel";
import * as api from "./api";
import type { ApplicationRole, UserRoleAssignment } from "./types";

const MOCK_ROLES: ApplicationRole[] = [
  {
    id: "role-1",
    name: "Admin",
    slug: "admin",
    description: "Full system access",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-2",
    name: "Operator",
    slug: "operator",
    description: "Standard operational access",
    is_system_managed: false,
    is_active: true,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "role-3",
    name: "Deprecated",
    slug: "deprecated",
    description: "Inactive role",
    is_system_managed: false,
    is_active: false,
    created_at: "2026-01-03T00:00:00Z",
    updated_at: "2026-01-03T00:00:00Z",
  },
];

const MOCK_ASSIGNMENTS: UserRoleAssignment[] = [
  {
    id: "assign-1",
    user_id: "user-001",
    role: MOCK_ROLES[0],
    assigned_by_id: "user-admin",
    assigned_at: "2026-02-01T00:00:00Z",
    revoked_at: null,
    is_active: true,
    notes: "Initial assignment",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
  {
    id: "assign-2",
    user_id: "user-002",
    role: MOCK_ROLES[1],
    assigned_by_id: null,
    assigned_at: "2026-02-15T00:00:00Z",
    revoked_at: "2026-03-01T00:00:00Z",
    is_active: false,
    notes: "",
    created_at: "2026-02-15T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
  },
];

describe("IdentityPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders heading and tab bar", async () => {
    vi.spyOn(api, "getRoles").mockResolvedValue([]);
    vi.spyOn(api, "getRoleAssignments").mockResolvedValue([]);

    render(<IdentityPanel />);

    expect(screen.getByText("Roles & Permissions")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Roles" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Assignments" })).toBeInTheDocument();
  });

  it("shows loading state for roles initially", async () => {
    vi.spyOn(api, "getRoles").mockImplementation(
      () => new Promise(() => {}),
    );

    render(<IdentityPanel />);

    expect(screen.getByText("Loading roles...")).toBeInTheDocument();
  });

  it("shows error state with retry when roles API fails", async () => {
    vi.spyOn(api, "getRoles").mockRejectedValue(new Error("Network error"));

    render(<IdentityPanel />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Retry loading roles" });
    expect(retryBtn).toBeInTheDocument();
  });

  it("shows empty state when no roles exist", async () => {
    vi.spyOn(api, "getRoles").mockResolvedValue([]);

    render(<IdentityPanel />);

    await waitFor(() => {
      expect(screen.getByText("No roles defined.")).toBeInTheDocument();
    });
  });

  it("renders a list of roles in a table", async () => {
    vi.spyOn(api, "getRoles").mockResolvedValue(MOCK_ROLES);

    render(<IdentityPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("role-row-role-1")).toBeInTheDocument();
      expect(screen.getByTestId("role-row-role-2")).toBeInTheDocument();
      expect(screen.getByTestId("role-row-role-3")).toBeInTheDocument();
    });

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Operator")).toBeInTheDocument();
    expect(screen.getByText("Deprecated")).toBeInTheDocument();
  });

  it("switches to assignments tab and loads assignments", async () => {
    vi.spyOn(api, "getRoles").mockResolvedValue([]);
    vi.spyOn(api, "getRoleAssignments").mockResolvedValue(MOCK_ASSIGNMENTS);

    render(<IdentityPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("identity-roles-panel")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Assignments" }));

    await waitFor(() => {
      expect(screen.getByTestId("identity-assignments-panel")).toBeInTheDocument();
    });

    expect(screen.getByTestId("assignment-row-assign-1")).toBeInTheDocument();
    expect(screen.getByTestId("assignment-row-assign-2")).toBeInTheDocument();
  });

  it("shows pending backend overlay when canWrite is true", async () => {
    vi.spyOn(api, "getRoles").mockResolvedValue([]);
    vi.spyOn(api, "checkIdentityWritePermission").mockResolvedValue(true);

    render(<IdentityPanel />);

    await waitFor(() => {
      expect(screen.getByText("Pending Backend Contract")).toBeInTheDocument();
    });
  });

  it("hides pending backend overlay when canWrite is false", async () => {
    vi.spyOn(api, "getRoles").mockResolvedValue([]);
    vi.spyOn(api, "checkIdentityWritePermission").mockResolvedValue(false);

    render(<IdentityPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("identity-roles-panel")).toBeInTheDocument();
    });

    expect(screen.queryByText("Pending Backend Contract")).not.toBeInTheDocument();
  });

  it("shows retry and recovers on retry for assignments error", async () => {
    vi.spyOn(api, "getRoles").mockResolvedValue([]);
    const assignmentsSpy = vi
      .spyOn(api, "getRoleAssignments")
      .mockRejectedValueOnce(new Error("Server unavailable"))
      .mockResolvedValueOnce(MOCK_ASSIGNMENTS);

    render(<IdentityPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "Assignments" }));

    await waitFor(() => {
      expect(screen.getByText("Server unavailable")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", {
      name: "Retry loading assignments",
    });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId("assignment-row-assign-1")).toBeInTheDocument();
    });

    expect(assignmentsSpy).toHaveBeenCalledTimes(2);
  });
});
