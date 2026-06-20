import { describe, expect, it, vi, afterEach } from "vitest";

import {
  getRoles,
  getRoleAssignments,
  checkEndpointPermission,
  checkIdentityWritePermission,
} from "./api";
import type { ApplicationRole, UserRoleAssignment } from "./types";

function mockFetchResponse(
  data: unknown,
  status = 200,
  ok = true,
): Promise<Response> {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const MOCK_ROLES: ApplicationRole[] = [
  {
    id: "role-1",
    name: "Admin",
    slug: "admin",
    description: "System administrator",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "role-2",
    name: "Operator",
    slug: "operator",
    description: "Day-to-day operator",
    is_system_managed: true,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const MOCK_ASSIGNMENTS: UserRoleAssignment[] = [
  {
    id: "assign-1",
    user_id: "user-1",
    role: MOCK_ROLES[0],
    assigned_by_id: null,
    assigned_at: "2026-01-15T10:00:00Z",
    revoked_at: null,
    is_active: true,
    notes: "",
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-01-15T10:00:00Z",
  },
];

describe("getRoles", () => {
  it("fetches roles without query params", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(MOCK_ROLES),
    );

    const roles = await getRoles();

    expect(roles).toEqual(MOCK_ROLES);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/roles/",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("fetches roles with name filter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse([MOCK_ROLES[0]]),
    );

    const roles = await getRoles({ name: "admin" });

    expect(roles).toEqual([MOCK_ROLES[0]]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/roles/?name=admin",
      expect.anything(),
    );
  });

  it("fetches roles with is_active filter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(MOCK_ROLES),
    );

    await getRoles({ is_active: true });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/roles/?is_active=true",
      expect.anything(),
    );
  });

  it("returns empty array when no roles exist", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse([]),
    );

    const roles = await getRoles();

    expect(roles).toEqual([]);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse({ detail: "Forbidden" }, 403, false),
    );

    await expect(getRoles()).rejects.toThrow("Forbidden");
  });

  it("passes signal to fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(MOCK_ROLES),
    );

    const controller = new AbortController();
    await getRoles(undefined, controller.signal);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/roles/",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe("getRoleAssignments", () => {
  it("fetches assignments without query params", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(MOCK_ASSIGNMENTS),
    );

    const assignments = await getRoleAssignments();

    expect(assignments).toEqual(MOCK_ASSIGNMENTS);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/assignments/",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("fetches assignments with user_id filter", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(MOCK_ASSIGNMENTS),
    );

    await getRoleAssignments({ user_id: "user-1" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/assignments/?user_id=user-1",
      expect.anything(),
    );
  });

  it("fetches assignments with is_active=false", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse([]),
    );

    await getRoleAssignments({ is_active: false });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/assignments/?is_active=false",
      expect.anything(),
    );
  });

  it("returns empty array when no assignments exist", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse([]),
    );

    const assignments = await getRoleAssignments();

    expect(assignments).toEqual([]);
  });

  it("throws on error response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse({ detail: "Not found" }, 404, false),
    );

    await expect(getRoleAssignments()).rejects.toThrow("Not found");
  });
});

describe("checkEndpointPermission", () => {
  it("returns true when endpoint responds ok", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(null, 200, true),
    );

    const result = await checkEndpointPermission("/api/v1/identity/roles/");

    expect(result).toBe(true);
  });

  it("returns false when endpoint responds 403", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(null, 403, false),
    );

    const result = await checkEndpointPermission("/api/v1/identity/roles/");

    expect(result).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const result = await checkEndpointPermission("/api/v1/identity/roles/");

    expect(result).toBe(false);
  });

  it("uses provided method and signal", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(null, 200, true),
    );

    const controller = new AbortController();
    await checkEndpointPermission("/api/v1/identity/roles/", "OPTIONS", controller.signal);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/roles/",
      expect.objectContaining({
        method: "OPTIONS",
        signal: controller.signal,
        credentials: "include",
      }),
    );
  });
});

describe("checkIdentityWritePermission", () => {
  it("returns true when OPTIONS succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(null, 200, true),
    );

    const result = await checkIdentityWritePermission();

    expect(result).toBe(true);
  });

  it("returns false when OPTIONS fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(null, 403, false),
    );

    const result = await checkIdentityWritePermission();

    expect(result).toBe(false);
  });

  it("passes signal through", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(null, 200, true),
    );

    const controller = new AbortController();
    await checkIdentityWritePermission(controller.signal);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/identity/roles/",
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
