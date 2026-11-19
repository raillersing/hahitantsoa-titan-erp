import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "../App";
import ReportsDashboard from "./ReportsDashboard";
import CommercialOpsPage from "./CommercialOpsPage";
import * as api from "../api";
import type { SessionUser } from "../api";
import type { ReportCategory, BillingInvoice, HahitantsoaCommercialTerms } from "../types";

const authMock = vi.hoisted(() => ({
  value: {
    state: {
      status: "authenticated" as const,
      user: {
        id: "usr-1",
        username: "testuser",
        display_name: "Test User",
        is_staff: false,
        roles: ["accountant"],
        capabilities: {
          canManageFinance: true,
          canSensitiveWrite: false,
          canViewAudit: false,
          canManageIdentity: false,
          canSuperAdminDelete: false,
        },
        reportCategories: ["sales_billing", "payments"],
      } as SessionUser,
      error: null,
    },
    isSubmitting: false,
    isOnline: true,
    refreshSession: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock("../AuthContext", () => ({
  useAuth: () => authMock.value,
  useOptionalAuth: () => authMock.value,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockTerms: HahitantsoaCommercialTerms = {
  base_space_rental_amount: "2500000.00",
  included_guest_count: 300,
  excess_guest_amount: "5000.00",
  bare_deposit_amount: "1000000.00",
  logistics_deposit_amount: "1500000.00",
  contract_validity_days: 15,
  night_option_1_amount: "300000.00",
  night_option_2_amount: "500000.00",
  night_security_amount: "200000.00",
  caution_amount: "1000000.00",
  updated_at: "2026-11-01T00:00:00Z",
  bare_rental_composition: [],
};

const mockInvoices: BillingInvoice[] = [
  {
    id: "inv-open-1",
    amount: "1500000.00",
    invoice_status: "open",
    issued_at: "2026-11-01T10:00:00Z",
    document_instance: {
      id: "doc-1",
      reservation_draft: "draft-1",
      customer_display_name: "Client Test Open",
      template_label: "Facture",
      business_scope: "titan",
      document_type: "facture",
    } as any,
    settlement: null,
    refund_obligation: null,
    installments: [],
    excess_receivable: null,
    reservation_draft: "draft-1",
    hahitantsoa_event_draft: null,
    source_kind: "manual",
    settled_at: null,
    settled_by: null,
    notes: "",
    installment_lifecycle: "pending",
    suggested_due_dates: null,
    closeout_status: "open",
    amount_settled: "0.00",
    amount_refunded: "0.00",
    remaining_balance: "1500000.00",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  },
  {
    id: "inv-settled-1",
    amount: "2000000.00",
    invoice_status: "settled",
    issued_at: "2026-11-01T10:00:00Z",
    document_instance: {
      id: "doc-2",
      reservation_draft: "draft-2",
      customer_display_name: "Client Test Settled",
      template_label: "Facture",
      business_scope: "titan",
      document_type: "facture",
    } as any,
    settlement: null,
    refund_obligation: null,
    installments: [],
    excess_receivable: null,
    reservation_draft: "draft-2",
    hahitantsoa_event_draft: null,
    source_kind: "manual",
    settled_at: "2026-11-02T10:00:00Z",
    settled_by: "usr-1",
    notes: "",
    installment_lifecycle: "settled",
    suggested_due_dates: null,
    closeout_status: "settled",
    amount_settled: "2000000.00",
    amount_refunded: "0.00",
    remaining_balance: "0.00",
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-02T10:00:00Z",
  },
];

describe("Lot B2: Page Visibility & Commercial Preservation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();

    vi.spyOn(api, "getBillingInvoices").mockResolvedValue(mockInvoices);
    vi.spyOn(api, "getPayments").mockResolvedValue([]);
    vi.spyOn(api, "getReservationDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaEventDrafts").mockResolvedValue([]);
    vi.spyOn(api, "getBankProfiles").mockResolvedValue([]);
    vi.spyOn(api, "getHahitantsoaCommercialTerms").mockResolvedValue(mockTerms);
    vi.spyOn(api, "getReportCategory").mockImplementation(async (cat: ReportCategory) => ({
      category: cat,
      period: "month",
      kpis: [{ key: "kpi-1", label: `KPI ${cat}`, value: 100, format: "number" }],
    }));
  });

  describe("Accountant profile (canManageFinance=true, canSensitiveWrite=false)", () => {
    beforeEach(() => {
      authMock.value.state = {
        status: "authenticated",
        user: {
          id: "usr-acc",
          username: "comptable",
          display_name: "M. Comptable",
          is_staff: false,
          roles: ["accountant"],
          capabilities: {
            canManageFinance: true,
            canSensitiveWrite: false,
            canViewAudit: false,
            canManageIdentity: false,
            canSuperAdminDelete: false,
          },
          reportCategories: ["sales_billing", "payments"],
        },
        error: null,
      };
    });

    it("allows access to #bank-settings route", async () => {
      window.history.replaceState(null, "", "/#bank-settings");
      render(<App />);
      expect(await screen.findByRole("heading", { name: /Coordonnées bancaires/i })).toBeInTheDocument();
      expect(screen.queryByText("Accès non autorisé")).not.toBeInTheDocument();
    });

    it("restricts #reports category tabs strictly to authorized categories", async () => {
      render(<ReportsDashboard onNavigate={() => {}} />);
      // Only Ventes & Facturation and Paiements should be visible
      expect(screen.getByRole("button", { name: /Ventes & Facturation/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Paiements/i })).toBeInTheDocument();
      // Unauthorized categories must NOT be displayed
      expect(screen.queryByRole("button", { name: /Réservations/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Logistique/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Inventaire/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Prospects/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Documents/i })).not.toBeInTheDocument();
    });

    it("displays 'Régler' action but hides 'Avoir' and 'Annuler' on CommercialOpsPage", async () => {
      render(<CommercialOpsPage onNavigate={() => {}} />);

      // "Régler" is allowed for open invoice
      expect(await screen.findByRole("button", { name: /Régler/i })).toBeInTheDocument();

      // "Avoir" (credit note) and "Annuler" (cancel) MUST NOT be present
      expect(screen.queryByRole("button", { name: /Avoir/i })).not.toBeInTheDocument();
      expect(screen.queryByTitle(/Annuler cette facture/i)).not.toBeInTheDocument();
    });

    it("blocks access to #audit with restricted notice", () => {
      window.history.replaceState(null, "", "/#audit");
      render(<App />);
      expect(screen.getByText("Accès non autorisé")).toBeInTheDocument();
    });
  });

  describe("Commercial profile (canSensitiveWrite=true, canManageFinance=false)", () => {
    beforeEach(() => {
      authMock.value.state = {
        status: "authenticated",
        user: {
          id: "usr-comm",
          username: "commercial",
          display_name: "Mme Commerciale",
          is_staff: false,
          roles: ["reservation_sensitive_operator"],
          capabilities: {
            canManageFinance: false,
            canSensitiveWrite: true,
            canViewAudit: false,
            canManageIdentity: false,
            canSuperAdminDelete: false,
          },
          reportCategories: ["reservations", "prospects"],
        },
        error: null,
      };
    });

    it("displays 'Avoir' and 'Annuler' on CommercialOpsPage", async () => {
      render(<CommercialOpsPage onNavigate={() => {}} />);

      // Commercial has canSensitiveWrite: Avoir and Annuler should appear
      expect(await screen.findByRole("button", { name: /Avoir/i })).toBeInTheDocument();
      expect(screen.getByTitle(/Annuler cette facture/i)).toBeInTheDocument();
      // Régler is also allowed since canSensitiveWrite permits financial writes or commercial actions
      expect(screen.getByRole("button", { name: /Régler/i })).toBeInTheDocument();
    });
  });

  describe("Owner Manager profile (owner_manager)", () => {
    beforeEach(() => {
      authMock.value.state = {
        status: "authenticated",
        user: {
          id: "usr-owner",
          username: "gerant",
          display_name: "Gérant Propriétaire",
          is_staff: false,
          roles: ["owner_manager"],
          capabilities: {
            canManageFinance: true,
            canSensitiveWrite: true,
            canViewAudit: true,
            canManageIdentity: true,
            canSuperAdminDelete: false,
          },
          reportCategories: [
            "reservations",
            "sales_billing",
            "payments",
            "prospects",
            "logistics",
            "inventory",
            "documents",
          ],
        },
        error: null,
      };
    });

    it("allows access to #hahitantsoa-settings with editing permissions", async () => {
      window.history.replaceState(null, "", "/#hahitantsoa-settings");
      render(<App />);
      expect(await screen.findByRole("heading", { name: /Paramétrage des Tarifs & Modalités Officielles/i })).toBeInTheDocument();
      expect(screen.queryByText("Accès non autorisé")).not.toBeInTheDocument();
    });

    it("displays all 7 report categories in ReportsDashboard", () => {
      render(<ReportsDashboard onNavigate={() => {}} />);
      expect(screen.getByRole("button", { name: /Réservations/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ventes & Facturation/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Paiements/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Prospects/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Logistique/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Inventaire/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Documents/i })).toBeInTheDocument();
    });
  });

  describe("Logistics / Operational profile (no finance, no sensitive write)", () => {
    beforeEach(() => {
      authMock.value.state = {
        status: "authenticated",
        user: {
          id: "usr-cleaner",
          username: "technicien",
          display_name: "Agent d'entretien",
          is_staff: false,
          roles: ["cleaner", "driver"],
          capabilities: {
            canManageFinance: false,
            canSensitiveWrite: false,
            canViewAudit: false,
            canManageIdentity: false,
            canSuperAdminDelete: false,
          },
          reportCategories: [],
        },
        error: null,
      };
    });

    it("blocks access to #reports with Accès restreint message", () => {
      window.history.replaceState(null, "", "/#reports");
      render(<App />);
      expect(screen.getByText("Accès restreint")).toBeInTheDocument();
    });

    it("blocks access to #bank-settings with Accès non autorisé alert", () => {
      window.history.replaceState(null, "", "/#bank-settings");
      render(<App />);
      expect(screen.getByText("Accès non autorisé")).toBeInTheDocument();
    });

    it("blocks access to #hahitantsoa-settings with Accès non autorisé alert", () => {
      window.history.replaceState(null, "", "/#hahitantsoa-settings");
      render(<App />);
      expect(screen.getByText("Accès non autorisé")).toBeInTheDocument();
    });

    it("hides financial action buttons in CommercialOpsPage", async () => {
      render(<CommercialOpsPage onNavigate={() => {}} />);
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /Régler/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Avoir/i })).not.toBeInTheDocument();
        expect(screen.queryByTitle(/Annuler cette facture/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Defensive API 403 handling", () => {
    it("handles 403 rejection on settleInvoice defensively without throwing an unhandled exception", async () => {
      authMock.value.state = {
        status: "authenticated",
        user: {
          id: "usr-acc",
          username: "comptable",
          display_name: "M. Comptable",
          is_staff: false,
          roles: ["accountant"],
          capabilities: {
            canManageFinance: true,
            canSensitiveWrite: false,
            canViewAudit: false,
            canManageIdentity: false,
            canSuperAdminDelete: false,
          },
          reportCategories: ["sales_billing"],
        },
        error: null,
      };

      vi.spyOn(window, "confirm").mockReturnValue(true);
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      vi.spyOn(api, "settleBillingInvoice").mockRejectedValue(new Error("403 Forbidden: Action non autorisée"));

      render(<CommercialOpsPage onNavigate={() => {}} />);
      const settleBtn = await screen.findByRole("button", { name: /Régler/i });
      fireEvent.click(settleBtn);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("403 Forbidden"));
      });
    });
  });
});
