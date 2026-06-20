import { useEffect, useState } from "react";

import { getInventoryItems } from "./api";
import { useAuth } from "./AuthContext";
import LoginPanel from "./LoginPanel";
import AvailabilityPanel from "./AvailabilityPanel";
import DocumentArtifactPreviewPanel from "./DocumentArtifactPreviewPanel";
import HahitantsoaDiscoveryPanel from "./HahitantsoaDiscoveryPanel";
import HahitantsoaEventDraftsPanel from "./HahitantsoaEventDraftsPanel";
import DashboardPanel from "./DashboardPanel";
import HahitantsoaCommercialOpsPanel from "./HahitantsoaCommercialOpsPanel";
import TitanStockMovementPanel from "./TitanStockMovementPanel";
import CustomerPanel from "./CustomerPanel";
import IdentityPanel from "./IdentityPanel";
import type { InventoryItem } from "./types";


type AppScope = "dashboard" | "titan" | "hahitantsoa" | "commercial-ops" | "customers" | "identity";

type InventoryState =
  | { status: "loading" }
  | { status: "loaded"; items: InventoryItem[] }
  | { status: "error"; message: string };

type ModuleDefinition = {
  scope: AppScope;
  navLabel: string;
  heading: string;
  eyebrow: string;
  description: string;
  boundaryNote: string;
};

const MODULES: ModuleDefinition[] = [
  {
    scope: "dashboard",
    navLabel: "Dashboard",
    heading: "ERP Overview",
    eyebrow: "System Dashboard",
    description:
      "A consolidated view of the ERP modules, providing quick access and summary metrics across business scopes.",
    boundaryNote:
      "This panel operates in read-only mode to visualize general system status.",
  },
  {
    scope: "titan",
    navLabel: "Titan",
    heading: "Titan inventory",
    eyebrow: "Titan module",
    description:
      "Operational inventory and reservation draft preparation for Titan materials, articles and material packs.",
    boundaryNote:
      "Titan stays limited to rental inventory. Venue, room, hall and service concepts are excluded from this module.",
  },
  {
    scope: "hahitantsoa",
    navLabel: "Hahitantsoa",
    heading: "Hahitantsoa discovery",
    eyebrow: "Hahitantsoa module",
    description:
      "Read-only discovery for the broader event domain, kept separate from Titan inventory and commercial reservation workflows.",
    boundaryNote:
      "This module remains exploratory. It does not expose reservation creation, payment, contract or inventory blocking controls.",
  },
  {
    scope: "customers",
    navLabel: "Customers",
    heading: "Customer Management",
    eyebrow: "Customer module",
    description:
      "Create, view, and manage customer records. Supports search and write operations for authorised operators.",
    boundaryNote:
      "Read operations are available to all authenticated users. Write operations require reservation-sensitive access.",
  },
  {
    scope: "commercial-ops",
    navLabel: "Commercial Ops",
    heading: "Commercial Operations",
    eyebrow: "Operations module",
    description:
      "Operational closeout tracking across Hahitantsoa and Titan business scopes: documents, payments, billing, logistics, returns, breakage, and stock ledger.",
    boundaryNote:
      "This panel acts as a foundation. Actions not yet supported by backend services are marked as pending integration.",
  },
  {
    scope: "identity",
    navLabel: "Identity",
    heading: "Roles & Permissions",
    eyebrow: "Identity module",
    description:
      "View application roles and user role assignments. Write operations for role and assignment management require backend identity endpoints.",
    boundaryNote:
      "Read operations display current roles and assignments. Write operations are gated behind backend identity management availability.",
  },
];

function isAppScope(value: string | null): value is AppScope {
  return (
    value === "dashboard" ||
    value === "titan" ||
    value === "hahitantsoa" ||
    value === "customers" ||
    value === "commercial-ops" ||
    value === "identity"
  );
}

function readScopeFromHash(hash: string): AppScope {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  return isAppScope(normalizedHash) ? normalizedHash : "dashboard";
}

function writeScopeHash(scope: AppScope) {
  window.history.replaceState(null, "", `#${scope}`);
}

function kindLabel(kind: InventoryItem["kind"]): string {
  if (kind === "material_pack") {
    return "material pack";
  }

  return kind;
}

function App() {
  const { state: authState, logout } = useAuth();
  const [activeScope, setActiveScope] = useState<AppScope>(() =>
    readScopeFromHash(window.location.hash),
  );
  const [inventoryState, setInventoryState] = useState<InventoryState>({
    status: "loading",
  });
  const [prefillEventName, setPrefillEventName] = useState("");
  const [prefillVenueName, setPrefillVenueName] = useState("");

  if (authState.status === "loading") {
    return (
      <main className="app-shell">
        <header className="app-header">
          <div className="app-intro">
            <p className="eyebrow">Hahitantsoa / Titan ERP</p>
            <h1>Loading...</h1>
          </div>
        </header>
      </main>
    );
  }

  if (authState.status === "unauthenticated") {
    return <LoginPanel />;
  }

  const activeModule =
    MODULES.find((moduleDefinition) => moduleDefinition.scope === activeScope) ??
    MODULES[0];

  useEffect(() => {
    writeScopeHash(activeScope);
  }, [activeScope]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInventoryItems() {
      try {
        const items = await getInventoryItems(controller.signal);
        setInventoryState({ status: "loaded", items });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setInventoryState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The requested data could not be loaded.",
        });
      }
    }

    void loadInventoryItems();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    function handleHashChange() {
      setActiveScope(readScopeFromHash(window.location.hash));
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-intro">
          <p className="eyebrow">Hahitantsoa / Titan ERP</p>
          <h1>Frontend module shell</h1>
          <p className="shell-summary">
            Session-authenticated navigation between the Titan rental surface and the
            Hahitantsoa read-only discovery surface.
          </p>
        </div>
        <button
          className="session-logout"
          type="button"
          onClick={logout}
          aria-label="Sign out"
        >
          Sign out
        </button>
      </header>

      <div className="shell-layout">
        <nav className="module-nav" aria-label="Business modules">
          <div className="module-nav-header">
            <p className="eyebrow">Modules</p>
            <p className="module-nav-copy">
              Navigation stays inside approved frontend surfaces and keeps each business
              boundary visible.
            </p>
          </div>
          <ul className="module-nav-list">
            {MODULES.map((moduleDefinition) => {
              const isActive = moduleDefinition.scope === activeScope;

              return (
                <li key={moduleDefinition.scope}>
                  <button
                    aria-current={isActive ? "page" : undefined}
                    aria-label={moduleDefinition.navLabel}
                    aria-pressed={isActive}
                    className="module-nav-button"
                    type="button"
                    onClick={() => setActiveScope(moduleDefinition.scope)}
                  >
                    <span>{moduleDefinition.navLabel}</span>
                    <small>{moduleDefinition.heading}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          aria-labelledby="active-module-heading"
          className="module-panel"
        >
          <div className="module-hero">
            <div>
              <p className="eyebrow">{activeModule.eyebrow}</p>
              <h2 id="active-module-heading">{activeModule.heading}</h2>
              <p className="module-description">{activeModule.description}</p>
            </div>
            <p className="module-boundary">{activeModule.boundaryNote}</p>
          </div>

          {activeScope === "dashboard" && (
            <DashboardPanel onNavigate={(scope) => setActiveScope(scope)} />
          )}

          {activeScope === "titan" && (
            <>
              {inventoryState.status === "loading" ? (
                <p className="status">Loading inventory...</p>
              ) : null}

              {inventoryState.status === "error" ? (
                <section className="notice" role="alert">
                  <h2>Inventory unavailable</h2>
                  <p>{inventoryState.message}</p>
                  <p>Your session may have expired. Sign in again to continue.</p>
                </section>
              ) : null}

              {inventoryState.status === "loaded" ? (
                <section className="inventory-section" aria-label="Inventory items">
                  <div className="section-heading">
                    <h2>Items</h2>
                    <span>{inventoryState.items.length}</span>
                  </div>

                  {inventoryState.items.length === 0 ? (
                    <p className="status">No inventory items are currently visible.</p>
                  ) : (
                    <ul className="inventory-list">
                      {inventoryState.items.map((item) => (
                        <li className="inventory-row" key={item.id}>
                          <div>
                            <h3>{item.name}</h3>
                            {item.description ? <p>{item.description}</p> : null}
                          </div>
                          <span className="kind-pill">{kindLabel(item.kind)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}

              <AvailabilityPanel
                inventoryItems={
                  inventoryState.status === "loaded" ? inventoryState.items : []
                }
              />
              <TitanStockMovementPanel
                inventoryItems={
                  inventoryState.status === "loaded" ? inventoryState.items : []
                }
              />
              <DocumentArtifactPreviewPanel />
            </>
          )}

          {activeScope === "hahitantsoa" && (
            <>
              <HahitantsoaDiscoveryPanel
                onSelectConcept={(eventName, venueName) => {
                  setPrefillEventName(eventName);
                  setPrefillVenueName(venueName);
                }}
              />
              <HahitantsoaEventDraftsPanel
                inventoryItems={
                  inventoryState.status === "loaded" ? inventoryState.items : []
                }
                prefillEventName={prefillEventName}
                prefillVenueName={prefillVenueName}
              />
            </>
          )}

          {activeScope === "customers" && (
            <CustomerPanel />
          )}

          {activeScope === "commercial-ops" && (
            <HahitantsoaCommercialOpsPanel />
          )}

          {activeScope === "identity" && (
            <IdentityPanel />
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
