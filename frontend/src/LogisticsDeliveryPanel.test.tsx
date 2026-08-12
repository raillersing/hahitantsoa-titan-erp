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
  operation: "outbound",
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
  signature_status: "pending",
  signature_exception_reason: "",
  signed_document_file: "",
  signed_document_hash: "",
  signed_by_client_name: "",
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

const MOCK_PREPARATION_EVENT: LogisticsEvent = {
  ...MOCK_EVENT,
  id: "preparation-1",
  event_type: "preparation",
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
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getTitanClosedDays").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);
    vi.spyOn(api, "getInventoryItems").mockResolvedValue(MOCK_ITEMS);
    vi.spyOn(api, "getLogisticsEventItemLines").mockResolvedValue(MOCK_LINES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(api, "getLogisticsEvents").mockReturnValue(new Promise(() => undefined));
    render(<LogisticsDeliveryPanel />);
    expect(screen.getByText("Chargement des événements...")).toBeInTheDocument();
  });

  it("shows all event types with filter bar", async () => {
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([
      MOCK_EVENT,
      MOCK_HANDOVER_EVENT,
      MOCK_PICKUP_EVENT,
    ]);
    render(<LogisticsDeliveryPanel />);
    expect(await screen.findByTestId("delivery-row-del-1")).toBeInTheDocument();
    expect(screen.getByTestId("delivery-row-handover-1")).toBeInTheDocument();
    expect(screen.getByTestId("delivery-row-pick-1")).toBeInTheDocument();
  });

  it("uses the public reservation reference when available", async () => {
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([
      {
        id: "rd-1111",
        public_reference: "RES-2026-0042",
        status: "draft",
        customer_id: "customer-1",
        customer_display_name: "John",
        start_at: "2026-06-15T08:00:00Z",
        end_at: "2026-06-16T08:00:00Z",
        notes: "",
        contract_signed_at: null,
        contract_signed_by_id: null,
        required_deposit_received_at: null,
        required_deposit_received_by_id: null,
        confirmed_at: null,
        confirmed_by_id: null,
        cancelled_at: null,
        cancelled_by_id: null,
        lines: [],
        created_at: "",
        updated_at: "",
      },
    ]);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_EVENT]);

    render(<LogisticsDeliveryPanel />);

    expect(await screen.findByText("RES-2026-0042")).toBeInTheDocument();
  });

  it("renders selected event detail and line items", async () => {
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_EVENT]);
    render(<LogisticsDeliveryPanel />);
    expect(await screen.findByTestId("delivery-row-del-1")).toBeInTheDocument();
    expect(await screen.findByText("Chair")).toBeInTheDocument();
    expect(await screen.findByText("3 unité(s)")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer l'envoi" }));

    await waitFor(() => {
      expect(transitionSpy).toHaveBeenCalledWith(
        "del-1",
        expect.objectContaining({ new_status: "dispatched" }),
      );
    });
  });

  it("defaults Titan outbound operations to the previous working day and rejects closed hours", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([{
      id: "rd-1111",
      public_reference: "RES-2026-0042",
      status: "draft",
      customer_id: "customer-1",
      customer_display_name: "John",
      start_at: "2026-06-27T08:00:00Z",
      end_at: "2026-06-27T18:00:00Z",
      notes: "",
      contract_signed_at: null,
      contract_signed_by_id: null,
      required_deposit_received_at: null,
      required_deposit_received_by_id: null,
      confirmed_at: null,
      confirmed_by_id: null,
      cancelled_at: null,
      cancelled_by_id: null,
      lines: [],
      created_at: "",
      updated_at: "",
    }]);
    vi.spyOn(api, "getTitanClosedDays").mockResolvedValue([{ id: "holiday", date: "2026-06-26", label: "Férié" }]);

    render(<LogisticsDeliveryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Nouvel événement" }));
    fireEvent.change(screen.getByLabelText("Réservation"), { target: { value: "rd-1111" } });

    const schedule = await screen.findByLabelText("Planifié le") as HTMLInputElement;
    await waitFor(() => expect(schedule.value).toMatch(/T06:00$/));
    expect(screen.getByText(/jour ouvré précédent/)).toBeInTheDocument();

    fireEvent.change(schedule, { target: { value: "2026-06-25T05:00" } });
    expect(screen.getByRole("alert")).toHaveTextContent("06:00 et 22:00");
    expect(screen.getByRole("button", { name: "Créer l'événement" })).toBeDisabled();
  });

  it("defaults Titan returns from the reservation start date to the next working day", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([{
      id: "rd-1111",
      public_reference: "RES-2026-0042",
      status: "draft",
      customer_id: "customer-1",
      customer_display_name: "John",
      start_at: "2026-06-25T08:00:00Z",
      end_at: "2026-06-27T18:00:00Z",
      notes: "",
      contract_signed_at: null,
      contract_signed_by_id: null,
      required_deposit_received_at: null,
      required_deposit_received_by_id: null,
      confirmed_at: null,
      confirmed_by_id: null,
      cancelled_at: null,
      cancelled_by_id: null,
      lines: [],
      created_at: "",
      updated_at: "",
    }]);
    vi.spyOn(api, "getTitanClosedDays").mockResolvedValue([{ id: "holiday", date: "2026-06-26", label: "Férié" }]);

    render(<LogisticsDeliveryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Nouvel événement" }));
    fireEvent.change(screen.getByLabelText("Réservation"), { target: { value: "rd-1111" } });
    fireEvent.change(screen.getByLabelText("Opération"), { target: { value: "return" } });

    const schedule = await screen.findByLabelText("Planifié le") as HTMLInputElement;
    await waitFor(() => expect(schedule.value).toMatch(/2026-06-27T06:00$/));
    expect(screen.getByText(/jour ouvré suivant/)).toBeInTheDocument();
  });

  it("does not apply Titan closures to the Hahitantsoa logistics panel", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([{
      id: "rd-1111",
      public_reference: "RES-2026-0042",
      status: "draft",
      customer_id: "customer-1",
      customer_display_name: "John",
      start_at: "2026-06-27T08:00:00Z",
      end_at: "2026-06-27T18:00:00Z",
      notes: "",
      contract_signed_at: null,
      contract_signed_by_id: null,
      required_deposit_received_at: null,
      required_deposit_received_by_id: null,
      confirmed_at: null,
      confirmed_by_id: null,
      cancelled_at: null,
      cancelled_by_id: null,
      lines: [],
      created_at: "",
      updated_at: "",
    }]);
    const closedDaysSpy = vi.spyOn(api, "getTitanClosedDays");

    render(<LogisticsDeliveryPanel businessScope="hahitantsoa" />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Nouvel événement" }));
    fireEvent.change(screen.getByLabelText("Réservation"), { target: { value: "rd-1111" } });

    expect(await screen.findByLabelText("Planifié le")).toBeInTheDocument();
    expect(closedDaysSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/jour ouvré précédent/)).not.toBeInTheDocument();
  });

  it("adds and removes logistics item lines when write access is granted", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_EVENT]);
    const addSpy = vi.spyOn(api, "addLogisticsEventItemLine").mockResolvedValue(MOCK_LINES[0]);
    const removeSpy = vi.spyOn(api, "removeLogisticsEventItemLine").mockResolvedValue();

    render(<LogisticsDeliveryPanel />);

    expect(await screen.findByTestId("delivery-row-del-1")).toBeInTheDocument();
    await screen.findByText("Chair");

    fireEvent.change(screen.getByLabelText("Article"), {
      target: { value: "item-1" },
    });
    fireEvent.change(screen.getByLabelText("Quantité"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Extra chairs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));

    await waitFor(() => {
      expect(addSpy).toHaveBeenCalledWith(
        "del-1",
        { inventory_item_id: "item-1", quantity: 2, notes: "Extra chairs" },
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Finaliser la remise" }));

    await waitFor(() => {
      expect(passationSpy).toHaveBeenCalledWith("handover-1", {});
    });
    expect(await screen.findByText("Bon de livraison généré.")).toBeInTheDocument();
  });

  it("restores an existing delivery note when selecting an event", async () => {
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_HANDOVER_EVENT]);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([
      { id: "existing-delivery-note", template_key: "titan.delivery_note.v1", status: "generated" } as any,
    ]);

    render(<LogisticsDeliveryPanel />);

    expect(await screen.findByRole("button", { name: "Voir le PDF" })).toBeInTheDocument();
  });

  it("generates and opens the printable preparation sheet", async () => {
    vi.spyOn(api, "checkEndpointPermission").mockResolvedValue(true);
    vi.spyOn(api, "getLogisticsEvents").mockResolvedValue([MOCK_PREPARATION_EVENT]);
    vi.spyOn(api, "getReservationDraftDocumentInstances").mockResolvedValue([]);
    const createSpy = vi.spyOn(api, "createReservationDraftDocumentInstance").mockResolvedValue({
      id: "prep-doc-1",
      status: "prepared",
    } as any);
    const generateSpy = vi.spyOn(api, "generateReservationDraftDocumentInstance").mockResolvedValue({
      id: "prep-doc-1",
      status: "generated",
    } as any);
    const pdfSpy = vi.spyOn(api, "generateReservationDraftDocumentInstancePdf").mockResolvedValue({
      id: "prep-doc-1",
    } as any);
    vi.spyOn(api, "getDocumentInstancePdfBlob").mockResolvedValue(new Blob(["pdf"]));
    vi.stubGlobal("open", vi.fn());
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preparation");

    render(<LogisticsDeliveryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Imprimer le bon de préparation" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith("rd-1111", {
        template_key: "shared.preparation_sheet.v1",
        notes: "Bon de préparation pour l'événement logistique preparation-1",
      });
      expect(generateSpy).toHaveBeenCalledWith("rd-1111", "prep-doc-1");
      expect(pdfSpy).toHaveBeenCalledWith("rd-1111", "prep-doc-1");
      expect(createUrl).toHaveBeenCalled();
    });
  });
});
