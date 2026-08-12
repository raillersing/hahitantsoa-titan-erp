import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PayrollRulesPanel from "./PayrollRulesPanel";
import * as api from "../api";

const draft = {
  id: "rules-1",
  status: "draft" as const,
  label: "Configuration DRH",
  effective_from: "2099-01-01",
  effective_until: null,
  source_reference: "À confirmer",
  validation_note: "",
  irsa_brackets: [],
  irsa_minimum: null,
  irsa_abatement: null,
  dependent_allowance: null,
  contribution_base_definition: "",
  cnaps_employee_rate: null,
  cnaps_employer_rate: null,
  ostie_employee_rate: null,
  ostie_employer_rate: null,
  fmfp_rate: null,
  contribution_cap: null,
  overtime_rules: {},
  payslip_contexture: {},
  dns_format: {},
  ostie_format: {},
  collective_agreement: {},
  field_confirmations: {},
  completeness_errors: { irsa_minimum: "À renseigner" },
  created_at: "2098-01-01T00:00:00Z",
  updated_at: "2098-01-01T00:00:00Z",
};

describe("PayrollRulesPanel", () => {
  const drhAccess = { canView: true, canEdit: true, canActivate: false };

  it("loads versions and displays incomplete fields", async () => {
    vi.spyOn(api, "getPayrollRuleSets").mockResolvedValue([draft]);

    render(<PayrollRulesPanel access={drhAccess} />);

    expect(await screen.findByText("Configuration DRH")).toBeInTheDocument();
    expect(screen.getByText(/Champs restant à compléter/)).toBeInTheDocument();
    expect(screen.getByText(/irsa minimum/)).toBeInTheDocument();
  });

  it("does not submit invalid JSON and keeps the draft form visible", async () => {
    vi.spyOn(api, "getPayrollRuleSets").mockResolvedValue([]);
    const create = vi.spyOn(api, "createPayrollRuleSet");

    render(<PayrollRulesPanel access={drhAccess} />);
    await screen.findByText("Aucune configuration enregistrée.");

    fireEvent.click(screen.getByRole("button", { name: "Nouveau brouillon" }));
    fireEvent.change(screen.getByLabelText("irsa brackets"), { target: { value: "[" } });
    fireEvent.change(screen.getByLabelText("Intitulé *"), { target: { value: "Test" } });
    fireEvent.change(screen.getByLabelText("Date d’effet *"), { target: { value: "2099-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le brouillon" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("tranches IRSA");
    expect(create).not.toHaveBeenCalled();
  });

  it("submits a selected draft only after the API confirms it", async () => {
    vi.spyOn(api, "getPayrollRuleSets").mockResolvedValue([draft]);
    const submit = vi.spyOn(api, "submitPayrollRuleSet").mockResolvedValue({ ...draft, status: "pending_review" });
    vi.spyOn(api, "updatePayrollRuleSet").mockResolvedValue(draft);

    render(<PayrollRulesPanel access={drhAccess} />);
    await screen.findByText("Configuration DRH");
    fireEvent.click(screen.getByRole("button", { name: "Soumettre à validation" }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith("rules-1"));
  });

  it("hides write actions for a read-only accounting user", async () => {
    vi.spyOn(api, "getPayrollRuleSets").mockResolvedValue([{ ...draft, status: "pending_review" }]);

    render(<PayrollRulesPanel access={{ canView: true, canEdit: false, canActivate: false }} />);

    expect(await screen.findByText("Configuration DRH")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nouveau brouillon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activer la configuration" })).not.toBeInTheDocument();
  });
});
