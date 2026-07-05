import { useEffect, useState } from "react";
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

export type AppScope =
  | "dashboard"
  | "planning"
  | "customers"
  | "hahitantsoa"
  | "titan"
  | "commercial-ops"
  | "cashbox"
  | "caution"
  | "audit"
  | "reports"
  | "help"
  | "reservation-new"
  | "reservation-detail"
  | "reservations"
  | "customer"
  | "login"
  | "packages"
  | "services"
  | "blacklist-intervenants"
  | "inventory"
  | "inventory-management"
  | "inventory-item"
  | "stock-movements"
  | "stock-preparation"
  | "logistics-dispatch"
  | "logistics-returns"
  | "breakage-loss"
  | "venues"
  | "agenda-visitors"
  | "import-excel"
  | "documents"
  | "hr-payroll"
  | "purchasing"
  | "notifications"
  | "admin"
  | "mobile-tablet";

function parseHash(hash: string): { scope: AppScope; param?: string } {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const parts = normalizedHash.split("/");
  const rawScope = parts[0];
  const param = parts[1];

  const validScopes: AppScope[] = [
    "dashboard",
    "planning",
    "customers",
    "hahitantsoa",
    "titan",
    "commercial-ops",
    "cashbox",
    "caution",
    "audit",
    "reports",
    "help",
    "reservation-new",
    "reservation-detail",
    "reservations",
    "customer",
    "login",
    "packages",
    "services",
    "blacklist-intervenants",
    "inventory",
    "inventory-management",
    "inventory-item",
    "stock-movements",
    "stock-preparation",
    "logistics-dispatch",
    "logistics-returns",
    "breakage-loss",
    "venues",
    "agenda-visitors",
    "import-excel",
    "documents",
    "hr-payroll",
    "purchasing",
    "notifications",
    "admin",
    "mobile-tablet"
  ];

  const scope = validScopes.includes(rawScope as AppScope) ? (rawScope as AppScope) : "dashboard";
  return { scope, param };
}

function writeScopeHash(scope: AppScope, param?: string) {
  const hash = param ? `#${scope}/${param}` : `#${scope}`;
  window.history.replaceState(null, "", hash);
}

function App() {
  const initialHash = parseHash(window.location.hash);
  const [activeScope, setActiveScope] = useState<AppScope>(initialHash.scope);
  const [activeParam, setActiveParam] = useState<string | undefined>(initialHash.param);

  useEffect(() => {
    writeScopeHash(activeScope, activeParam);
  }, [activeScope, activeParam]);

  useEffect(() => {
    function handleHashChange() {
      const parsed = parseHash(window.location.hash);
      setActiveScope(parsed.scope);
      setActiveParam(parsed.param);
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const [returnContext, setReturnContext] = useState<{ from: AppScope; param?: string } | null>(null);

  const navigate = (scope: AppScope, param?: string) => {
    // Remember where we came from when entering customer, reservation detail, or inventory-item
    if (scope === 'customer' || scope === 'reservation-detail' || scope === 'inventory-item') {
      setReturnContext({ from: activeScope, param: activeParam });
    }
    setActiveScope(scope);
    setActiveParam(param);
  };

  const navigateBack = () => {
    if (returnContext) {
      setActiveScope(returnContext.from);
      setActiveParam(returnContext.param);
      setReturnContext(null);
    } else {
      setActiveScope('dashboard');
      setActiveParam(undefined);
    }
  };

  // If login page, don't show shell
  if (activeScope === "login") {
    return <PlaceholderPage title="Connexion" scope="login" onNavigate={navigate} />;
  }

  return (
    <AppShell activeScope={activeScope} activeParam={activeParam} onNavigate={navigate} returnContext={returnContext}>
      {activeScope === "dashboard" && <DashboardPage onNavigate={navigate} />}
      {activeScope === "planning" && <PlanningPage onNavigate={navigate} />}
      {activeScope === "hahitantsoa" && <HahitantsoaPage onNavigate={navigate} />}
      {activeScope === "titan" && <TitanPage onNavigate={navigate} />}
      {activeScope === "commercial-ops" && <CommercialOpsPage onNavigate={navigate} />}
      {activeScope === "customers" && <CustomersPage onNavigate={navigate} />}
      {activeScope === "cashbox" && <CashboxPage onNavigate={navigate} />}
      {activeScope === "caution" && <CautionPage onNavigate={navigate} />}
      {activeScope === "help" && <HelpPage onNavigate={navigate} />}
      {activeScope === "reservation-new" && <ReservationNewPage onNavigate={navigate} param={activeParam} />}
      {activeScope === "reservation-detail" && <ReservationDetailPage onNavigate={navigate} param={activeParam} onBack={navigateBack} returnContext={returnContext} />}
      {activeScope === "reservations" && <ReservationsPage onNavigate={navigate} />}
      {activeScope === "customer" && <CustomerDetailPage onNavigate={navigate} param={activeParam} onBack={navigateBack} returnContext={returnContext} />}
      {activeScope === "packages" && <PackageBuilderPage />}
      {activeScope === "services" && <ServicesPage />}
      {activeScope === "blacklist-intervenants" && <BlacklistPage />}
      {activeScope === "inventory" && <InventoryPage onNavigate={navigate} />}
      {activeScope === "inventory-management" && <InventoryManagementPage onNavigate={navigate} />}
      {activeScope === "inventory-item" && <InventoryItemPage onNavigate={navigate} param={activeParam} onBack={navigateBack} returnContext={returnContext} />}
      {activeScope === "stock-movements" && <StockMovementsPage onNavigate={navigate} />}
      {activeScope === "stock-preparation" && <StockPreparationPage onNavigate={navigate} />}
      {activeScope === "logistics-dispatch" && <LogisticsDispatchPage onNavigate={navigate} />}
      {activeScope === "logistics-returns" && <LogisticsReturnsPage onNavigate={navigate} />}
      {activeScope === "breakage-loss" && <BreakageLossPage onNavigate={navigate} />}
      {activeScope === "audit" && <AuditPage onNavigate={navigate} />}
      {activeScope === "reports" && <ReportsPage onNavigate={navigate} />}
      {activeScope === "venues" && <VenuesPage />}
      {activeScope !== "dashboard" &&
        activeScope !== "planning" &&
        activeScope !== "hahitantsoa" &&
        activeScope !== "titan" &&
        activeScope !== "commercial-ops" &&
        activeScope !== "customers" &&
        activeScope !== "cashbox" &&
        activeScope !== "caution" &&
        activeScope !== "help" &&
        activeScope !== "reservation-new" &&
        activeScope !== "reservation-detail" &&
        activeScope !== "reservations" &&
        activeScope !== "reports" &&
        activeScope !== "packages" &&
        activeScope !== "services" &&
        activeScope !== "blacklist-intervenants" &&
        activeScope !== "customer" &&
        activeScope !== "inventory" &&
        activeScope !== "inventory-management" &&
        activeScope !== "inventory-item" &&
        activeScope !== "stock-movements" &&
        activeScope !== "stock-preparation" &&
        activeScope !== "logistics-dispatch" &&
        activeScope !== "logistics-returns" &&
        activeScope !== "breakage-loss" &&
        activeScope !== "venues" && (
          <PlaceholderPage title={(activeScope as string).toUpperCase()} scope={activeScope} onNavigate={navigate} />
      )}
    </AppShell>
  );
}

export default App;
