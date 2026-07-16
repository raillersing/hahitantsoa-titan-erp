import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

import {
  getRoles,
  getRoleAssignments,
  checkEndpointPermission,
  checkIdentityWritePermission,
  cancelPayment,
  reconcilePayment,
  checkAuth,
  login,
  logout,
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

beforeEach(() => {
  document.cookie = "csrftoken=test-csrf-token; path=/";
});

describe("session authentication", () => {
  it("loads the real session with credentials", async () => {
    const payload = { authenticated: false as const, user: null };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(payload),
    );

    await expect(checkAuth()).resolves.toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/auth/session/",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("posts JSON credentials with the current CSRF token", async () => {
    const payload = {
      authenticated: true as const,
      user: { id: "1", username: "ada", display_name: "Ada", is_staff: false, roles: ["commercial"] },
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(payload),
    );

    await expect(login("ada", "secret")).resolves.toEqual(payload);
    const [, init] = fetchSpy.mock.calls[0];
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/auth/login/");
    expect(init).toEqual(expect.objectContaining({ method: "POST", credentials: "include", body: JSON.stringify({ username: "ada", password: "secret" }) }));
    expect(new Headers(init?.headers).get("X-CSRFToken")).toBe("test-csrf-token");
  });

  it("bootstraps the CSRF cookie before a write when it is missing", async () => {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
    const payload = {
      authenticated: true as const,
      user: { id: "1", username: "ada", display_name: "Ada", is_staff: false, roles: [] },
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => {
        document.cookie = "csrftoken=bootstrapped-token; path=/";
        return mockFetchResponse({ authenticated: false, user: null });
      })
      .mockImplementationOnce(() => mockFetchResponse(payload));

    await login("ada", "secret");
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/auth/session/");
    expect(fetchSpy.mock.calls[1][0]).toBe("/api/v1/auth/login/");
    expect(new Headers(fetchSpy.mock.calls[1][1]?.headers).get("X-CSRFToken")).toBe("bootstrapped-token");
  });

  it("posts logout and rejects an API failure", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })))
      .mockImplementationOnce(() => mockFetchResponse({ detail: "CSRF verification failed." }, 403, false));

    await expect(logout()).resolves.toBeUndefined();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/auth/logout/");
    expect(fetchSpy.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST", credentials: "include" }));
    await expect(logout()).rejects.toThrow("CSRF verification failed.");
  });
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

describe("payment lifecycle actions", () => {
  it.each([
    ["cancel", cancelPayment],
    ["reconcile", reconcilePayment],
  ] as const)("posts the optional notes payload to the %s endpoint", async (action, request) => {
    const response = { id: "payment-1", payment_status: action === "cancel" ? "cancelled" : "reconciled" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse(response),
    );
    const controller = new AbortController();

    await expect(request("payment-1", { notes: "Contrôle opérateur" }, controller.signal))
      .resolves.toEqual(response);

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/v1/payments/payment-1/${action}/`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ notes: "Contrôle opérateur" }),
        signal: controller.signal,
      }),
    );
    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
  });

  it("surfaces backend detail and status for a rejected lifecycle action", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse({ detail: "Payment cannot be cancelled." }, 400, false),
    );

    await expect(cancelPayment("payment-1", {})).rejects.toMatchObject({
      message: "Payment cannot be cancelled.",
      status: 400,
    });
  });

  it.each([
    ["cancel", cancelPayment],
    ["reconcile", reconcilePayment],
  ] as const)("uses an empty payload by default for %s", async (action, request) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => mockFetchResponse({ id: "payment-1" }),
    );

    await request("payment-1");

    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/v1/payments/payment-1/${action}/`,
      expect.objectContaining({ body: "{}" }),
    );
  });
});
