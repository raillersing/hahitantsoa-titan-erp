import { useEffect, useRef, useState } from "react";
import { formatHash, isAppScope, parseHash, type AppRoute, type AppScope } from "./app-routes";
import { useAuth } from "./AuthContext";
import LoginPanel from "./LoginPanel";
import AppShell from "./prototype/AppShell";
import DashboardPage from "./prototype/DashboardPage";
import PlanningPage from "./prototype/PlanningPage";
import PlaceholderPage from "./prototype/PlaceholderPage";
import HahitantsoaPage from "./prototype/HahitantsoaPage";
import TitanPage from "./prototype/TitanPage";
import CommercialOpsPage from "./prototype/CommercialOpsPage";
import CustomersPage from "./prototype/CustomersPage";
import CashboxPage from "./prototype/CashboxPage";
import CautionPage from "./prototype/CautionPage";
import ReservationNewPage from "./prototype/ReservationNewPage";
import ReservationDetailPage from "./prototype/ReservationDetailPage";
import CustomerDetailPage from "./prototype/CustomerDetailPage";
import PackageBuilderPage from "./prototype/PackageBuilderPage";
import AuditPage from "./prototype/AuditPage";
import ReportsPage from "./prototype/ReportsPage";
import HelpPage from "./prototype/HelpPage";
import ServicesPage from "./prototype/ServicesPage";
import BlacklistPage from "./prototype/BlacklistPage";
import InventoryPage from "./prototype/InventoryPage";
import InventoryManagementPage from "./prototype/InventoryManagementPage";
import InventoryItemPage from "./prototype/InventoryItemPage";
import StockMovementsPage from "./prototype/StockMovementsPage";
import StockPreparationPage from "./prototype/StockPreparationPage";
import LogisticsDispatchPage from "./prototype/LogisticsDispatchPage";
import LogisticsReturnsPage from "./prototype/LogisticsReturnsPage";
import BreakageLossPage from "./prototype/BreakageLossPage";
import ReservationsPage from "./prototype/ReservationsPage";
import VenuesPage from "./prototype/VenuesPage";
import AdminPage from "./prototype/AdminPage";
import DocumentsPage from "./prototype/DocumentsPage";
import AgendaVisitorsPage from "./prototype/AgendaVisitorsPage";
import ProfilePage from "./prototype/ProfilePage";
import { RouteNotFoundPage } from "./prototype/RouteNotFoundPage";
import { capabilitiesForUser } from "./capabilities";

export type { AppScope } from "./app-routes";

type ReturnContext = { from: AppScope; param?: string };

function returnContextFromHistoryState(value: unknown): ReturnContext | null {
  if (typeof value !== "object" || value === null || !("erpReturnContext" in value)) return null;
  const context = value.erpReturnContext;
  if (typeof context !== "object" || context === null || !("from" in context) || !isAppScope(context.from)) return null;
  return {
    from: context.from,
    ...("param" in context && typeof context.param === "string" ? { param: context.param } : {}),
  };
}

function App() {
  const { state, isSubmitting, isOnline, refreshSession, logout } = useAuth();
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash));
  const [returnContext, setReturnContext] = useState<ReturnContext | null>(() =>
    returnContextFromHistoryState(window.history.state),
  );
  const routeContentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", formatHash("dashboard"));
    }
  }, []);

  useEffect(() => {
    function syncRouteFromLocation() {
      setRoute(parseHash(window.location.hash));
      setReturnContext(returnContextFromHistoryState(window.history.state));
    }
    window.addEventListener("hashchange", syncRouteFromLocation);
    window.addEventListener("popstate", syncRouteFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncRouteFromLocation);
      window.removeEventListener("popstate", syncRouteFromLocation);
    };
  }, []);

  const authenticatedLoginRoute = state.status === "authenticated" && route.kind === "known" && route.scope === "login";
  useEffect(() => {
    if (authenticatedLoginRoute) {
      const dashboardRoute: AppRoute = { kind: "known", scope: "dashboard" };
      window.history.replaceState(null, "", formatHash("dashboard"));
      setRoute(dashboardRoute);
      setReturnContext(null);
    }
  }, [authenticatedLoginRoute]);

  const effectiveRoute: AppRoute = authenticatedLoginRoute ? { kind: "known", scope: "dashboard" } : route;
  const activeScope = effectiveRoute.kind === "known" ? effectiveRoute.scope : "dashboard";
  const activeParam = effectiveRoute.kind === "known" ? effectiveRoute.param : undefined;
  const capabilities = state.status === "authenticated" ? capabilitiesForUser(state.user) : undefined;
  const routeFocusKey = effectiveRoute.kind === "known"
    ? `${effectiveRoute.scope}/${effectiveRoute.param ?? ""}`
    : effectiveRoute.requestedHash;

  useEffect(() => {
    if (state.status === "authenticated") routeContentRef.current?.focus({ preventScroll: true });
  }, [routeFocusKey, state.status]);

  const navigate = (scope: AppScope, param?: string) => {
    const nextReturnContext =
      (scope === "customer" || scope === "reservation-detail" || scope === "inventory-item") && effectiveRoute.kind === "known"
        ? { from: effectiveRoute.scope, ...(effectiveRoute.param ? { param: effectiveRoute.param } : {}) }
        : null;
    window.history.pushState(
      nextReturnContext ? { erpReturnContext: nextReturnContext } : null,
      "",
      formatHash(scope, param),
    );
    setRoute({ kind: "known", scope, ...(param ? { param } : {}) });
    setReturnContext(nextReturnContext);
  };

  const navigateBack = () => {
    if (returnContext) {
      window.history.back();
    } else {
      navigate("dashboard");
    }
  };

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6" role="status" aria-live="polite">
        <p className="rounded-xl bg-white px-6 py-4 shadow">Vérification de la session…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" role="alert">
          <h1 className="text-xl font-semibold text-slate-900">Session indisponible</h1>
          <p className="mt-2 text-slate-600">{state.error}</p>
          <button
            className="mt-5 rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white"
            type="button"
            onClick={() => void refreshSession().catch(() => undefined)}
          >
            Réessayer
          </button>
        </section>
      </main>
    );
  }

  if (state.status === "unauthenticated") {
    return <LoginPanel />;
  }

  if (effectiveRoute.kind === "not-found") {
    return (
      <main
        ref={routeContentRef}
        tabIndex={-1}
        className="min-h-screen bg-slate-50 outline-none dark:bg-slate-900"
      >
        <RouteNotFoundPage requestedHash={effectiveRoute.requestedHash} onNavigateHome={() => navigate("dashboard")} />
      </main>
    );
  }

  const deniedRoute = effectiveRoute.kind === "known" && (
    (effectiveRoute.scope === "admin" && capabilities && !capabilities.canManageIdentity) ||
    (effectiveRoute.scope === "audit" && capabilities && !capabilities.canViewAudit) ||
    (effectiveRoute.scope === "reservation-new" && capabilities && !capabilities.canSensitiveWrite)
  );

  const renderKnownRoute = (scope: AppScope) => {
    switch (scope) {
      case "dashboard": return <DashboardPage onNavigate={navigate} canSensitiveWrite={capabilities?.canSensitiveWrite ?? false} />;
      case "planning": return <PlanningPage onNavigate={navigate} />;
      case "hahitantsoa": return <HahitantsoaPage onNavigate={navigate} canSensitiveWrite={capabilities?.canSensitiveWrite ?? false} />;
      case "titan": return <TitanPage onNavigate={navigate} canSensitiveWrite={capabilities?.canSensitiveWrite ?? false} />;
      case "commercial-ops": return <CommercialOpsPage onNavigate={navigate} />;
      case "customers": return <CustomersPage onNavigate={navigate} canSensitiveWrite={capabilities?.canSensitiveWrite ?? false} />;
      case "cashbox": return <CashboxPage onNavigate={navigate} />;
      case "caution": return <CautionPage onNavigate={navigate} />;
      case "help": return <HelpPage onNavigate={navigate} />;
      case "reservation-new": return <ReservationNewPage onNavigate={navigate} param={activeParam} />;
      case "reservation-detail": return <ReservationDetailPage onNavigate={navigate} param={activeParam} onBack={navigateBack} returnContext={returnContext} />;
      case "reservations": return <ReservationsPage onNavigate={navigate} canSensitiveWrite={capabilities?.canSensitiveWrite ?? false} />;
      case "customer": return <CustomerDetailPage onNavigate={navigate} param={activeParam} onBack={navigateBack} returnContext={returnContext} canSensitiveWrite={capabilities?.canSensitiveWrite ?? false} />;
      case "packages": return <PackageBuilderPage />;
      case "services": return <ServicesPage />;
      case "blacklist-intervenants": return <BlacklistPage />;
      case "inventory": return <InventoryPage onNavigate={navigate} canSensitiveWrite={capabilities?.canSensitiveWrite ?? false} />;
      case "inventory-management": return <InventoryManagementPage onNavigate={navigate} />;
      case "inventory-item": return <InventoryItemPage onNavigate={navigate} param={activeParam} onBack={navigateBack} returnContext={returnContext} />;
      case "stock-movements": return <StockMovementsPage onNavigate={navigate} />;
      case "stock-preparation": return <StockPreparationPage onNavigate={navigate} />;
      case "logistics-dispatch": return <LogisticsDispatchPage onNavigate={navigate} />;
      case "logistics-returns": return <LogisticsReturnsPage onNavigate={navigate} />;
      case "breakage-loss": return <BreakageLossPage onNavigate={navigate} />;
      case "audit": return <AuditPage onNavigate={navigate} />;
      case "reports": return <ReportsPage onNavigate={navigate} />;
      case "venues": return <VenuesPage />;
      case "admin": return <AdminPage onNavigate={navigate} />;
      case "documents": return <DocumentsPage onNavigate={navigate} />;
      case "agenda-visitors": return <AgendaVisitorsPage onNavigate={navigate} />;
      case "profile": return <ProfilePage user={state.user} />;
      case "login": return <DashboardPage onNavigate={navigate} />;
      case "import-excel":
      case "hr-payroll":
      case "purchasing":
      case "notifications":
      case "mobile-tablet":
        return <PlaceholderPage title={scope.toUpperCase()} scope={scope} onNavigate={navigate} />;
    }
  };

  return (
    <AppShell
      activeScope={activeScope}
      activeParam={activeParam}
      onNavigate={navigate}
      returnContext={returnContext}
      user={state.user}
      capabilities={capabilities}
      isOnline={isOnline}
      isLoggingOut={isSubmitting}
      sessionError={state.error}
      onLogout={logout}
    >
      <section ref={routeContentRef} tabIndex={-1} className="min-w-0 outline-none" data-testid="route-content">
        {deniedRoute ? (
          <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm" role="alert">
            <h1 className="text-xl font-bold">Accès non autorisé</h1>
            <p className="mt-2">Votre session ne dispose pas de la capacité nécessaire pour ouvrir cette page.</p>
            <button
              type="button"
              className="mt-4 rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white"
              onClick={() => navigate("dashboard")}
            >
              Retour au tableau de bord
            </button>
          </section>
        ) : renderKnownRoute(effectiveRoute.scope)}
      </section>
    </AppShell>
  );
}

export default App;
