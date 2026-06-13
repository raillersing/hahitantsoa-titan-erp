import { useEffect, useState } from "react";

import { getInventoryItems } from "./api";
import AvailabilityPanel from "./AvailabilityPanel";
import HahitantsoaDiscoveryPanel from "./HahitantsoaDiscoveryPanel";
import type { InventoryItem } from "./types";

type AppScope = "titan" | "hahitantsoa";

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
];

function isAppScope(value: string | null): value is AppScope {
  return value === "titan" || value === "hahitantsoa";
}

function readScopeFromHash(hash: string): AppScope {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  return isAppScope(normalizedHash) ? normalizedHash : "titan";
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
  const [activeScope, setActiveScope] = useState<AppScope>(() =>
    readScopeFromHash(window.location.hash),
  );
  const [inventoryState, setInventoryState] = useState<InventoryState>({
    status: "loading",
  });

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
        <p className="session-note">Uses the existing Django session.</p>
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

          {activeScope === "titan" ? (
            <>
          {inventoryState.status === "loading" ? (
            <p className="status">Loading inventory...</p>
          ) : null}

          {inventoryState.status === "error" ? (
            <section className="notice" role="alert">
              <h2>Inventory unavailable</h2>
              <p>{inventoryState.message}</p>
              <p>For local development, sign in through the backend Browsable API first.</p>
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
            </>
          ) : (
            <HahitantsoaDiscoveryPanel />
          )}
        </section>
      </div>
    </main>
  );
}

export default App;
