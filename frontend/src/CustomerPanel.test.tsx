import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import CustomerPanel from "./CustomerPanel";
import * as api from "./api";
import type { Customer } from "./types";

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    display_name: "Alice Dupont",
    email: "alice@example.test",
    phone: "+261 34 00 000 01",
    address: "Antananarivo",
    notes: "Preferred customer",
    is_active: true,
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-06-01T10:00:00Z",
    is_deleted: false,
    deleted_at: null,
    created_by: null,
    updated_by: null,
  },
  {
    id: "cust-2",
    display_name: "Bob Rajaonarison",
    email: "bob@example.test",
    phone: "+261 34 00 000 02",
    address: "Toamasina",
    notes: "",
    is_active: true,
    created_at: "2026-02-20T10:00:00Z",
    updated_at: "2026-05-15T10:00:00Z",
    is_deleted: false,
    deleted_at: null,
    created_by: null,
    updated_by: null,
  },
];

const MOCK_CUSTOMER_1: Customer = { ...MOCK_CUSTOMERS[0] };

function mockFetchResponse(
  data: unknown,
  status = 200,
  ok = true,
): Promise<Response> {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === "string" ? data : ""),
    headers: new Headers({ "Content-Type": "application/json" }),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CustomerPanel", () => {
  it("shows loading state then list of customers", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(false);
    vi.spyOn(api, "getCustomers").mockResolvedValue(MOCK_CUSTOMERS);

    render(<CustomerPanel />);

    expect(screen.getByText("Loading customers...")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Alice Dupont")).toBeTruthy();
    });

    expect(screen.getByText("Bob Rajaonarison")).toBeTruthy();
    expect(screen.getByText("Customer Directory")).toBeTruthy();
  });

  it("shows empty state when no customers exist", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(false);
    vi.spyOn(api, "getCustomers").mockResolvedValue([]);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/No customer records found/),
      ).toBeTruthy();
    });
  });

  it("shows error state with retry on fetch failure", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(false);
    vi.spyOn(api, "getCustomers").mockRejectedValue(
      new Error("Network error"),
    );

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });

    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("retries loading when retry button is clicked", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(false);
    const getCustomersSpy = vi
      .spyOn(api, "getCustomers")
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(MOCK_CUSTOMERS);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Retry"));

    await waitFor(() => {
      expect(screen.getByText("Alice Dupont")).toBeTruthy();
    });

    expect(getCustomersSpy).toHaveBeenCalledTimes(2);
  });

  it("shows new customer button when user has write permission", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(true);
    vi.spyOn(api, "getCustomers").mockResolvedValue(MOCK_CUSTOMERS);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("+ New Customer")).toBeTruthy();
    });
  });

  it("hides new customer button when user lacks write permission", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(false);
    vi.spyOn(api, "getCustomers").mockResolvedValue(MOCK_CUSTOMERS);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("Alice Dupont")).toBeTruthy();
    });

    expect(screen.queryByText("+ New Customer")).toBeNull();
  });

  it("navigates to detail view when view button is clicked", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(false);
    vi.spyOn(api, "getCustomers").mockResolvedValue(MOCK_CUSTOMERS);
    vi.spyOn(api, "getCustomer").mockResolvedValue(MOCK_CUSTOMER_1);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("Alice Dupont")).toBeTruthy();
    });

    const viewButtons = screen.getAllByLabelText(/View/);
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Back to list/)).toBeTruthy();
    });

    expect(screen.getByText("alice@example.test")).toBeTruthy();
    expect(screen.getByText("+261 34 00 000 01")).toBeTruthy();
    expect(screen.getByText("Antananarivo")).toBeTruthy();
    expect(screen.getByText("Preferred customer")).toBeTruthy();
  });

  it("shows create form and creates a customer", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(true);
    vi.spyOn(api, "getCustomers").mockResolvedValue(MOCK_CUSTOMERS);

    const newCustomer: Customer = {
      id: "cust-3",
      display_name: "New Client",
      email: "new@example.test",
      phone: "+261 34 00 000 03",
      address: "Fianarantsoa",
      notes: "",
      is_active: true,
      created_at: "2026-06-20T10:00:00Z",
      updated_at: "2026-06-20T10:00:00Z",
      is_deleted: false,
      deleted_at: null,
      created_by: null,
      updated_by: null,
    };

    vi.spyOn(api, "createCustomer").mockResolvedValue(newCustomer);
    vi.spyOn(api, "getCustomers").mockResolvedValue([
      ...MOCK_CUSTOMERS,
      newCustomer,
    ]);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("+ New Customer")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("+ New Customer"));

    await waitFor(() => {
      expect(screen.getByText("New Customer")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(/Display Name/);
    fireEvent.change(nameInput, { target: { value: "New Client" } });

    const emailInput = screen.getByLabelText(/Email/);
    fireEvent.change(emailInput, { target: { value: "new@example.test" } });

    const phoneInput = screen.getByLabelText(/Phone/);
    fireEvent.change(phoneInput, {
      target: { value: "+261 34 00 000 03" },
    });

    fireEvent.click(screen.getByText("Create Customer"));

    await waitFor(() => {
      expect(screen.getByText("New Client")).toBeTruthy();
    });
  });

  it("shows validation error when display name is empty", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(true);
    vi.spyOn(api, "getCustomers").mockResolvedValue(MOCK_CUSTOMERS);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("+ New Customer")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("+ New Customer"));

    await waitFor(() => {
      expect(screen.getByText("New Customer")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Create Customer"));

    await waitFor(() => {
      expect(
        screen.getByText("Display name is required."),
      ).toBeTruthy();
    });
  });

  it("shows permission denied on 403 during create", async () => {
    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(true);
    vi.spyOn(api, "getCustomers").mockResolvedValue(MOCK_CUSTOMERS);
    vi.spyOn(api, "createCustomer").mockRejectedValue(
      new api.ApiError("Forbidden", 403),
    );

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("+ New Customer")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("+ New Customer"));

    await waitFor(() => {
      expect(screen.getByText("New Customer")).toBeTruthy();
    });

    const nameInput = screen.getByLabelText(/Display Name/);
    fireEvent.change(nameInput, { target: { value: "New Client" } });

    fireEvent.click(screen.getByText("Create Customer"));

    await waitFor(() => {
      expect(
        screen.getByText(/do not have permission/),
      ).toBeTruthy();
    });
  });

  it("shows status badges for active and inactive customers", async () => {
    const customersWithInactive: Customer[] = [
      MOCK_CUSTOMER_1,
      {
        ...MOCK_CUSTOMERS[1],
        is_active: false,
      },
    ];

    vi.spyOn(api, "checkCustomerWritePermission").mockResolvedValue(false);
    vi.spyOn(api, "getCustomers").mockResolvedValue(customersWithInactive);

    render(<CustomerPanel />);

    await waitFor(() => {
      expect(screen.getByText("Alice Dupont")).toBeTruthy();
    });

    const badges = screen.getAllByText(/Active|Inactive/);
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });
});
