import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import ReturnsHandlingPanel from "./ReturnsHandlingPanel";
import type { InventoryReturnOperation } from "./types";

const MOCK_OPERATION: InventoryReturnOperation = {
  id: "ret-1",
  reservation_draft: "rd-1111",
  document_instance: null,
  status: "draft",
  notes: "Client return inspection",
  validated_at: null,
  validated_by: null,
  lines: [
    {
      id: "line-1",
      inventory_item: "item-1",
      expected_quantity: 10,
      returned_quantity: 8,
      damaged_quantity: 1,
      missing_quantity: 1,
      condition_status: "mixed",
      notes: "",
      intact_quantity: 7,
      created_at: "",
      updated_at: "",
      created_by: null,
      updated_by: null,
    },
  ],
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
};

describe("ReturnsHandlingPanel", () => {
  beforeEach(() => {
    vi.spyOn(api, "checkReturnsWritePermission").mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(api, "getReturnOperations").mockReturnValue(new Promise(() => undefined));
    render(<ReturnsHandlingPanel />);
    expect(screen.getByText("Loading return operations...")).toBeInTheDocument();
  });

  it("renders list and detail", async () => {
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([MOCK_OPERATION]);
    render(<ReturnsHandlingPanel />);
    expect(await screen.findByText("Inspection detail")).toBeInTheDocument();
    expect(screen.getByText("Expected 10")).toBeInTheDocument();
    expect(screen.getByText("Returned 8")).toBeInTheDocument();
  });

  it("shows error state and retry button", async () => {
    const spy = vi.spyOn(api, "getReturnOperations");
    spy.mockRejectedValue(new Error("Network error"));
    render(<ReturnsHandlingPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
    spy.mockResolvedValue([MOCK_OPERATION]);
    fireEvent.click(screen.getByRole("button", { name: "Retry loading return operations" }));
    expect(await screen.findByText("Inspection detail")).toBeInTheDocument();
  });

  it("shows read-only badge when write permission is absent", async () => {
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([MOCK_OPERATION]);
    render(<ReturnsHandlingPanel />);
    expect(await screen.findByTestId("returns-write-denied")).toBeInTheDocument();
  });

  it("validates returns when write permission is granted", async () => {
    vi.spyOn(api, "checkReturnsWritePermission").mockResolvedValue(true);
    vi.spyOn(api, "getReturnOperations").mockResolvedValue([MOCK_OPERATION]);
    const validateSpy = vi.spyOn(api, "validateReturnOperation").mockResolvedValue({
      ...MOCK_OPERATION,
      status: "validated",
      validated_at: "2026-06-20T10:00:00Z",
    });
    render(<ReturnsHandlingPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Validate return" }));
    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith("ret-1");
    });
    expect((await screen.findAllByText("Validated")).length).toBeGreaterThan(0);
  });
});
