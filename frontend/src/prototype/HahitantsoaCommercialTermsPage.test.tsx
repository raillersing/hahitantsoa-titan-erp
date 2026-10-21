import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import * as api from "../api";
import HahitantsoaCommercialTermsPage from "./HahitantsoaCommercialTermsPage";
import type { HahitantsoaCommercialTerms } from "../types";

vi.mock("../api", () => ({ getHahitantsoaCommercialTerms: vi.fn(), updateHahitantsoaCommercialTerms: vi.fn() }));
const terms: HahitantsoaCommercialTerms = {
  base_space_rental_amount: "6500000", included_guest_count: 250, excess_guest_amount: "5000", bare_deposit_amount: "1000000", logistics_deposit_amount: "1500000", night_option_1_amount: "300000", night_option_2_amount: "500000", night_security_amount: "150000", caution_amount: "500000", updated_at: "2026-10-21",
  bare_rental_composition: [{ label: "Salle", quantity: 1 }, { label: "Chaises pliables", quantity: 10 }],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getHahitantsoaCommercialTerms).mockResolvedValue(terms);
  vi.mocked(api.updateHahitantsoaCommercialTerms).mockImplementation(async payload => ({ ...terms, ...payload }));
});

it("edits quantities and order and keeps the server composition after save", async () => {
  render(<HahitantsoaCommercialTermsPage canEdit />);
  expect(await screen.findByDisplayValue("Chaises pliables")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Quantité 2"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Monter l’élément 2" }));
  fireEvent.submit(screen.getByLabelText("Élément 1").closest("form")!);
  await waitFor(() => expect(api.updateHahitantsoaCommercialTerms).toHaveBeenCalledWith(expect.objectContaining({ bare_rental_composition: [{ label: "Chaises pliables", quantity: 12 }, { label: "Salle", quantity: 1 }] })));
  expect(await screen.findByRole("status")).toHaveTextContent("enregistrés avec succès");
  expect(screen.getByLabelText("Élément 1")).toHaveValue("Chaises pliables");
});

it("keeps the composition read-only without management permission", async () => {
  render(<HahitantsoaCommercialTermsPage canEdit={false} />);
  expect(await screen.findByDisplayValue("Salle")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Ajouter un élément" })).toBeDisabled();
  expect(api.updateHahitantsoaCommercialTerms).not.toHaveBeenCalled();
});
