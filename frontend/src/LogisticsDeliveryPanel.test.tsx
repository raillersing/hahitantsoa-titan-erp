import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import LogisticsDeliveryPanel from "./LogisticsDeliveryPanel";
import type { InventoryItem, LogisticsEvent, LogisticsEventItemLine } from "./types";

const MOCK_ITEMS: InventoryItem[] = [
  {
    id: "item-1",
    name: "Chair",
    kind: "article",
    description: "Chair",
  },
];

const MOCK_EVENT: LogisticsEvent = {
  id: "del-1",
  reservation_draft: "rd-1111",
  event_type: "delivery",
  status: "planned",
  scheduled_at: "2026-06-15T08:00:00Z",
  executed_at: null,
  address: "123 Main St",
  contact_name: "John",
  contact_phone: "+261",
  notes: "",
  signature_required: false,
  signature_received: false,
  signed_by: null,
  signed_at: null,
  item_lines: [],
  created_at: "2026-06-10T10:00:00Z",
  updated_at: "2026-06-10T10:00:00Z",
  created_by: null,
  updated_by: null,
};

const MOCK_HANDOVER_EVENT: LogisticsEvent = {
  ...MOCK_EVENT,
  id: "handover-1",
  event_type: "handover",
  status: "completed",
  signature_required: true,
};

const MOCK_PICKUP_EVENT: LogisticsEvent = {
  ...MOCK_EVENT,
  id: "pick-1",
  event_type: "pickup",
  status: "completed",
};

const MOCK_LINES: LogisticsEventItemLine[] = [
  {
    id: "line-1",
    logistics_event: "del-1",
    inventory_item: "item-1",
    inventory_item_name: "Chair",
    inventory_item_kind: "article",
    quantity: 3,
    notes: "Fragile",
    created_at: "",
    updated_at: "",
    created_by: null,
    updated_by: null,
  },
];

describe("LogisticsDeliveryPanel", () => {
  beforeEach(() => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(false);
    vi.spyOn(api, "getInventoryItems").mockResolvedValue(MOCK_ITEMS);
    vi.spyOn(api, "getLogisticsEventItemLines").mockResolvedValue(MOCK_LINES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(api, "getLogisticsEvents").mockReturnValue(new Promise(() => undefined));
    render(<LogisticsDeliveryPanel />);
    expect(screen.getByText("Loading delivery events...")).toBeInTheDocument();
  });

  it("shows only delivery and handover events", async () => {
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([
      MOCK_EVENT,
      MOCK_HANDOVER_EVENT,
      MOCK_PICKUP_EVENT,
    ]);
    render(<LogisticsDeliveryPanel />);
    expect(await screen.findByTestId("delivery-row-del-1")).toBeInTheDocument();
    expect(screen.getByTestId("delivery-row-handover-1")).toBeInTheDocument();
    expect(screen.queryByTestId("delivery-row-pick-1")).not.toBeInTheDocument();
  });

  it("renders selected event detail and line items", async () => {
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_EVENT]);
    render(<LogisticsDeliveryPanel />);
    expect(await screen.findByText("Delivery detail")).toBeInTheDocument();
    expect(await screen.findByText("Chair")).toBeInTheDocument();
    expect(await screen.findByText("3 unit(s)")).toBeInTheDocument();
  });

  it("shows error state when API call fails", async () => {
    vi.spyOn(api, "getLogisticsEvents").mockRejectedValue(new Error("Network error"));
    render(<LogisticsDeliveryPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network error");
  });

  it("shows read-only badge by default", async () => {
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_EVENT]);
    render(<LogisticsDeliveryPanel />);
    expect(await screen.findByTestId("logistics-read-only")).toBeInTheDocument();
  });

  it("shows write badge and dispatch action when permission is granted", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    const transitionSpy = vi.spyOn(api, "transitionLogisticsEvent").mockResolvedValue({
      ...MOCK_EVENT,
      status: "dispatched",
    });
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_EVENT]);
    render(<LogisticsDeliveryPanel />);

    expect(await screen.findByTestId("logistics-write-ok")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dispatch" }));

    await waitFor(() => {
      expect(transitionSpy).toHaveBeenCalledWith(
        "del-1",
        expect.objectContaining({ new_status: "dispatched" }),
      );
    });
  });

  it("adds and removes logistics item lines when write access is granted", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_EVENT]);
    const addSpy = vi.spyOn(api, "addLogisticsEventItemLine").mockResolvedValue(MOCK_LINES[0]);
    const removeSpy = vi.spyOn(api, "removeLogisticsEventItemLine").mockResolvedValue();

    render(<LogisticsDeliveryPanel />);

    await screen.findByText("Delivery detail");
    await screen.findByText("Chair");

    fireEvent.change(screen.getByLabelText("Inventory item"), {
      target: { value: "item-1" },
    });
    fireEvent.change(screen.getByLabelText("Quantity"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Line note"), {
      target: { value: "Extra chairs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add item line" }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(
        "del-1",
        { inventory_item_id: "item-1", quantity: 2, notes: "Extra chairs" },
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(removeSpy).toHaveBeenCalledWith("del-1", "line-1");
    });
  });

  it("completes passation for completed handover events", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_HANDOVER_EVENT]);
    const passationSpy = vi.spyOn(api, "completeLogisticsPassation").mockResolvedValue({
      event: { ...MOCK_HANDOVER_EVENT, signature_received: true, signed_at: "2026-06-15T08:30:00Z" },
      document_instance_id: "doc-123",
    });

    render(<LogisticsDeliveryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Complete passation" }));

    await waitFor(() => {
      expect(passationSpy).toHaveBeenCalledWith("handover-1", {});
    });
    expect(await screen.findByText(/Document instance ID: doc-123/i)).toBeInTheDocument();
  });
});
