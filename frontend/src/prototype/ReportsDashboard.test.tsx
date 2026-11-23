import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ReportsDashboard from "./ReportsDashboard";
import * as api from "../api";
import * as authContext from "../AuthContext";
import type { ReportCategory, ReportCategoryResponse } from "../types";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeAuthValue(
  user: {
    id: string;
    username: string;
    roles: string[];
    reportCategories: ReportCategory[];
    is_staff?: boolean;
  } | null,
): authContext.AuthContextValue {
  return {
    state: user
      ? {
          status: "authenticated",
          user: {
            id: user.id,
            username: user.username,
            display_name: user.username,
            is_staff: user.is_staff ?? false,
            roles: user.roles,
            capabilities: {},
            reportCategories: user.reportCategories,
          },
          error: null,
        }
      : {
          status: "unauthenticated",
          error: null,
        },
    isSubmitting: false,
    isOnline: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
  };
}

const reportResponse = (category: ReportCategory, label: string, value: number) => ({
  category,
  period: "month",
  kpis: [{ key: "total", label, value, format: "number" as const }],
});

describe("ReportsDashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getReportCategory").mockImplementation(async (category) => {
      if (category === "payments") return reportResponse(category, "Paiements reçus", 42);
      return reportResponse(category, "Total réservations", 124);
    });
  });

  it("renders the dashboard heading and period selector", () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(screen.getByRole("heading", { name: /Rapports & BI/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mois" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Semaine" })).toBeInTheDocument();
  });

  it("renders KPI cards returned by the reporting API", async () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(await screen.findByText("Total réservations")).toBeInTheDocument();
    expect(await screen.findByText("124")).toBeInTheDocument();
  });

  it("switches category tabs and renders different KPIs", async () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    const paymentsTab = screen.getByRole("button", { name: /Paiements/i });
    fireEvent.click(paymentsTab);
    expect(await screen.findByText("Paiements reçus")).toBeInTheDocument();
    expect(await screen.findByText("42")).toBeInTheDocument();
  });

  it("shows an API error instead of fabricated report data", async () => {
    vi.mocked(api.getReportCategory).mockRejectedValueOnce(new Error("Rapports indisponibles"));
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(await screen.findByText("Rapports indisponibles")).toBeInTheDocument();
    expect(screen.queryByText("Total réservations")).not.toBeInTheDocument();
  });

  it("exports the API-backed report as CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ReportsDashboard onNavigate={() => {}} />);
    await screen.findByText("Total réservations");
    fireEvent.click(screen.getByRole("button", { name: /Exporter CSV/i }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it("renders the tabular accounting & operational exports section", () => {
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(screen.getByText("Exports Comptables & Fiscaux (Tabulaires)")).toBeInTheDocument();
    expect(screen.getByText("Facturier des Ventes")).toBeInTheDocument();
    expect(screen.getByText("Journal des Règlements")).toBeInTheDocument();
    expect(screen.getByText("Balance des Cautions")).toBeInTheDocument();
    expect(screen.getByText("Registre de la Casse")).toBeInTheDocument();
  });

  it("calls downloadTabularExport with selected filters when clicking export buttons", async () => {
    const downloadSpy = vi.spyOn(api, "downloadTabularExport").mockResolvedValue(undefined);
    render(<ReportsDashboard onNavigate={() => {}} />);

    // Configure filters
    const scopeSelect = screen.getByLabelText(/Volet d'activité/i);
    fireEvent.change(scopeSelect, { target: { value: "titan" } });

    const startDateInput = screen.getByLabelText(/Date de début/i);
    fireEvent.change(startDateInput, { target: { value: "2026-01-01" } });

    const endDateInput = screen.getByLabelText(/Date de fin/i);
    fireEvent.change(endDateInput, { target: { value: "2026-01-31" } });

    // Click on Exporter Facturier
    const exportSalesBtn = screen.getByRole("button", { name: /Exporter Facturier/i });
    fireEvent.click(exportSalesBtn);

    expect(downloadSpy).toHaveBeenCalledWith("sales", {
      scope: "titan",
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      method: undefined,
    });
    expect(await screen.findByText("Export téléchargé avec succès.")).toBeInTheDocument();
  });

  it("displays an error message when downloadTabularExport fails", async () => {
    vi.spyOn(api, "downloadTabularExport").mockRejectedValue(
      new Error("Vous n'avez pas l'autorisation d'exporter ce document."),
    );
    render(<ReportsDashboard onNavigate={() => {}} />);

    const exportCautionsBtn = screen.getByRole("button", { name: /Exporter Cautions/i });
    fireEvent.click(exportCautionsBtn);

    expect(
      await screen.findByText("Vous n'avez pas l'autorisation d'exporter ce document."),
    ).toBeInTheDocument();
  });

  it("never fetches an unauthorized category on initial mount for accountant or storekeeper", async () => {
    const getReportSpy = vi.mocked(api.getReportCategory);
    const authSpy = vi.spyOn(authContext, "useOptionalAuth").mockReturnValue(
      makeAuthValue({
        id: "u-acct",
        username: "comptable",
        roles: ["accountant"],
        reportCategories: ["payments", "sales_billing"],
      }),
    );

    const { unmount } = render(<ReportsDashboard onNavigate={() => {}} />);
    expect(await screen.findByText("Total réservations")).toBeInTheDocument();
    expect(getReportSpy).toHaveBeenCalledTimes(1);
    expect(getReportSpy.mock.calls[0][0]).toBe("sales_billing");
    expect(getReportSpy.mock.calls.some(([cat]) => cat === "reservations")).toBe(false);
    unmount();

    getReportSpy.mockClear();
    authSpy.mockReturnValue(
      makeAuthValue({
        id: "u-store",
        username: "magasinier",
        roles: ["storekeeper"],
        reportCategories: ["inventory"],
      }),
    );

    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(await screen.findByText("Total réservations")).toBeInTheDocument();
    expect(getReportSpy).toHaveBeenCalledTimes(1);
    expect(getReportSpy.mock.calls[0][0]).toBe("inventory");
    expect(getReportSpy.mock.calls.some(([cat]) => cat === "reservations")).toBe(false);
  });

  it("does not fire any request when an authenticated user has no authorized report categories", async () => {
    const getReportSpy = vi.mocked(api.getReportCategory);
    vi.spyOn(authContext, "useOptionalAuth").mockReturnValue(
      makeAuthValue({
        id: "u-driver",
        username: "livreur",
        roles: ["delivery_driver"],
        reportCategories: [],
      }),
    );

    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(
      screen.getByText("Aucune catégorie de rapport n'est autorisée pour votre session actuelle."),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(getReportSpy).not.toHaveBeenCalled();
    });
  });

  it("ignores stale out-of-order responses and errors when switching categories", async () => {
    const firstDeferred = createDeferred<ReportCategoryResponse>();
    const secondDeferred = createDeferred<ReportCategoryResponse>();
    const signals: Array<AbortSignal | undefined> = [];

    vi.spyOn(authContext, "useOptionalAuth").mockReturnValue(
      makeAuthValue({
        id: "u-acct",
        username: "comptable",
        roles: ["accountant"],
        reportCategories: ["payments", "sales_billing"],
      }),
    );

    vi.mocked(api.getReportCategory).mockImplementation((category, _period, signal) => {
      signals.push(signal);
      if (category === "sales_billing") return firstDeferred.promise;
      return secondDeferred.promise;
    });

    render(<ReportsDashboard onNavigate={() => {}} />);
    // First request is in-flight for sales_billing; switch immediately to payments
    fireEvent.click(screen.getByRole("button", { name: /Paiements/i }));

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    // Second request resolves first with fresh payments data
    await act(async () => {
      secondDeferred.resolve(reportResponse("payments", "Paiements confirmés", 77));
    });
    expect(await screen.findByText("Paiements confirmés")).toBeInTheDocument();
    expect(screen.getByText("77")).toBeInTheDocument();

    // First (stale) request now fails with 403 — must NOT overwrite fresh data or show an error
    await act(async () => {
      firstDeferred.reject(
        new api.ApiError("You do not have permission to view this report category.", 403),
      );
    });
    expect(screen.getByText("Paiements confirmés")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cancels in-flight requests and prevents stale responses from leaking across account switches", async () => {
    const acctDeferred = createDeferred<ReportCategoryResponse>();
    const storeDeferred = createDeferred<ReportCategoryResponse>();
    const signals: Array<AbortSignal | undefined> = [];

    const authSpy = vi.spyOn(authContext, "useOptionalAuth").mockReturnValue(
      makeAuthValue({
        id: "u-acct",
        username: "comptable",
        roles: ["accountant"],
        reportCategories: ["payments", "sales_billing"],
      }),
    );

    vi.mocked(api.getReportCategory).mockImplementation((category, _period, signal) => {
      signals.push(signal);
      if (category === "sales_billing") return acctDeferred.promise;
      return storeDeferred.promise;
    });

    const { rerender } = render(<ReportsDashboard onNavigate={() => {}} />);
    expect(api.getReportCategory).toHaveBeenCalledWith("sales_billing", "month", expect.any(AbortSignal));

    // Switch authenticated user to storekeeper while accountant request is still pending
    authSpy.mockReturnValue(
      makeAuthValue({
        id: "u-store",
        username: "magasinier",
        roles: ["storekeeper"],
        reportCategories: ["inventory"],
      }),
    );
    rerender(<ReportsDashboard onNavigate={() => {}} />);

    expect(signals[0]?.aborted).toBe(true);
    expect(api.getReportCategory).toHaveBeenCalledWith("inventory", "month", expect.any(AbortSignal));

    // Stale accountant request settles late — must NOT overwrite loading state or leak accountant KPIs
    await act(async () => {
      acctDeferred.resolve(reportResponse("sales_billing", "CA Comptable Confidentiel", 999));
    });
    expect(screen.queryByText("CA Comptable Confidentiel")).not.toBeInTheDocument();
    expect(screen.getByText(/Chargement des indicateurs/i)).toBeInTheDocument();

    // Storekeeper request resolves cleanly
    await act(async () => {
      storeDeferred.resolve(reportResponse("inventory", "Articles disponibles", 18));
    });
    expect(await screen.findByText("Articles disponibles")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.queryByText("CA Comptable Confidentiel")).not.toBeInTheDocument();
  });

  it("displays French messages for 403 and 401 report API errors", async () => {
    vi.mocked(api.getReportCategory).mockRejectedValueOnce(
      new api.ApiError("You do not have permission to view this report category.", 403),
    );
    const { unmount } = render(<ReportsDashboard onNavigate={() => {}} />);
    expect(
      await screen.findByText("Vous n'avez pas l'autorisation de consulter cette catégorie de rapport."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You do not have permission/i)).not.toBeInTheDocument();
    unmount();

    vi.mocked(api.getReportCategory).mockRejectedValueOnce(
      new api.ApiError("Authentication credentials were not provided.", 401),
    );
    const { unmount: unmount401 } = render(<ReportsDashboard onNavigate={() => {}} />);
    expect(
      await screen.findByText("Votre session a expiré. Veuillez vous reconnecter pour consulter les rapports."),
    ).toBeInTheDocument();
    unmount401();

    vi.mocked(api.getReportCategory).mockRejectedValueOnce(
      new api.ApiError("The requested data could not be loaded.", 500),
    );
    render(<ReportsDashboard onNavigate={() => {}} />);
    expect(
      await screen.findByText("Erreur serveur lors du chargement des rapports. Veuillez réessayer."),
    ).toBeInTheDocument();
  });

  it("ignores stale out-of-order responses when switching reporting period", async () => {
    const monthDeferred = createDeferred<ReportCategoryResponse>();
    const weekDeferred = createDeferred<ReportCategoryResponse>();
    const signals: Array<AbortSignal | undefined> = [];

    vi.mocked(api.getReportCategory).mockImplementation((_category, period, signal) => {
      signals.push(signal);
      if (period === "week") return weekDeferred.promise;
      return monthDeferred.promise;
    });

    render(<ReportsDashboard onNavigate={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Semaine" }));

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    await act(async () => {
      weekDeferred.resolve(reportResponse("reservations", "Réservations semaine", 19));
    });
    expect(await screen.findByText("Réservations semaine")).toBeInTheDocument();

    await act(async () => {
      monthDeferred.resolve(reportResponse("reservations", "Réservations mois obsolète", 999));
    });
    expect(screen.getByText("Réservations semaine")).toBeInTheDocument();
    expect(screen.queryByText("Réservations mois obsolète")).not.toBeInTheDocument();
  });

  it("prevents stale tabular exports from overwriting state across A -> B -> A account switches and translates export errors to French", async () => {
    const staleExport = createDeferred<void>();
    const downloadSpy = vi.spyOn(api, "downloadTabularExport").mockReturnValueOnce(staleExport.promise);

    const userA = makeAuthValue({
      id: "u-acct",
      username: "comptable",
      roles: ["accountant"],
      reportCategories: ["payments", "sales_billing"],
    });
    const userB = makeAuthValue({
      id: "u-store",
      username: "magasinier",
      roles: ["storekeeper"],
      reportCategories: ["inventory"],
    });
    const authSpy = vi.spyOn(authContext, "useOptionalAuth").mockReturnValue(userA);

    const { rerender } = render(<ReportsDashboard onNavigate={() => {}} />);
    await screen.findByText("Total réservations");

    fireEvent.click(screen.getByRole("button", { name: /Exporter Facturier/i }));

    // Switch A -> B -> A while first export is still pending
    authSpy.mockReturnValue(userB);
    rerender(<ReportsDashboard onNavigate={() => {}} />);
    authSpy.mockReturnValue(userA);
    rerender(<ReportsDashboard onNavigate={() => {}} />);

    // Stale export settles late — must NOT show success banner or alter state
    await act(async () => {
      staleExport.resolve(undefined);
    });
    expect(screen.queryByText("Export téléchargé avec succès.")).not.toBeInTheDocument();

    // Raw English 403 and network errors on export render French inside role="alert"
    downloadSpy.mockRejectedValueOnce(new api.ApiError("Forbidden", 403));
    fireEvent.click(screen.getByRole("button", { name: /Exporter Facturier/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vous n'avez pas l'autorisation d'exporter ce document.",
    );

    downloadSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: /Exporter Facturier/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Impossible de joindre le serveur pour télécharger l'export. Vérifiez votre connexion et réessayez.",
    );
  });
});
