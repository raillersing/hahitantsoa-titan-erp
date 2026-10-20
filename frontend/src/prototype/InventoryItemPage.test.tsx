import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InventoryItemPage from "./InventoryItemPage";
import * as api from "../api";
import type { InventoryItem } from "../types";
const item: InventoryItem = { id: "chair", name: "Chaise", kind: "material", code: "CH-1", description: "", is_active: true, reported_inventory_quantity: 10 };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getInventoryItem").mockResolvedValue(item);
  vi.spyOn(api, "getStockMovements").mockResolvedValue([]);
});
describe("InventoryItemPage persisted actions", () => {
  it("saves edits against the immutable item ID and displays the server response", async () => {
    const update = vi.spyOn(api, "updateInventoryItem").mockResolvedValue({ ...item, name: "Chaise modifiée" });
    vi.mocked(api.getInventoryItem).mockResolvedValueOnce(item).mockResolvedValue({ ...item, name: "Chaise modifiée" });
    render(<InventoryItemPage param="chair" onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Modifier l'article" }));
    fireEvent.change(screen.getByDisplayValue("Chaise"), { target: { value: "Chaise modifiée" } });
    fireEvent.change(screen.getByDisplayValue("CH-1"), { target: { value: "CH-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("chair", expect.objectContaining({ name: "Chaise modifiée", code: "CH-2" })));
    expect(await screen.findByRole("heading", { name: "Chaise modifiée" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("does not navigate or announce success when deletion fails", async () => {
    const remove = vi.spyOn(api, "deleteInventoryItem").mockRejectedValue(new Error("Article utilisé dans une réservation"));
    const navigate = vi.fn();
    render(<InventoryItemPage param="chair" onNavigate={navigate} />);
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer l'article" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Article utilisé");
    expect(remove).toHaveBeenCalledWith("chair");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("deletes on the server before returning to inventory", async () => {
    const remove = vi.spyOn(api, "deleteInventoryItem").mockResolvedValue(undefined);
    const navigate = vi.fn();
    render(<InventoryItemPage param="chair" onNavigate={navigate} />);
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer l'article" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("inventory-management"));
    expect(remove).toHaveBeenCalledWith("chair");
  });
  it("persists activation and stock movements, then refreshes stock", async () => {
    const update = vi.spyOn(api, "updateInventoryItem").mockResolvedValue({ ...item, is_active: false });
    const movement = vi.spyOn(api, "createStockMovement").mockResolvedValue({} as never);
    render(<InventoryItemPage param="chair" onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Désactiver" }));
    expect(await screen.findByRole("button", { name: "Réactiver" })).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith("chair", { is_active: false });
    fireEvent.click(screen.getByRole("button", { name: "Ajuster stock" }));
    fireEvent.change(screen.getByLabelText("Ajustement (ex: +5, -2)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/Motif de la modification/), { target: { value: "Nouvel achat" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    await waitFor(() => expect(movement).toHaveBeenCalledWith(expect.objectContaining({ inventory_item: "chair", quantity: 3, direction: "inbound" })));
    await waitFor(() => expect(api.getInventoryItem).toHaveBeenCalledTimes(2));
  });
});

it('does not offer a second stock adjustment when the write succeeds but reread fails', async () => {
  vi.mocked(api.getInventoryItem).mockResolvedValueOnce(item).mockRejectedValue(new Error('read unavailable'));
  vi.spyOn(api, 'createStockMovement').mockResolvedValue({} as never);
  render(<InventoryItemPage param="chair" onNavigate={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ajuster stock' }));
  fireEvent.change(screen.getByLabelText('Ajustement (ex: +5, -2)'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText(/Motif de la modification/), { target: { value: 'Nouvel achat' } });
  fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('L’écriture est enregistrée');
  expect(screen.getByRole('button', { name: 'Ajuster stock' })).toBeDisabled();
  vi.mocked(api.getInventoryItem).mockResolvedValue({ ...item, reported_inventory_quantity: 12 });
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser les données' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ajuster stock' })).toBeEnabled());
  expect(api.createStockMovement).toHaveBeenCalledTimes(1);
});
