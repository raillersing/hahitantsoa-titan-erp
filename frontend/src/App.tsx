import { useEffect, useState } from "react";

type InventoryItem = {
  id: string;
  name: string;
  kind: "material" | "article" | "material_pack";
  description: string;
};

type InventoryState =
  | { status: "loading" }
  | { status: "loaded"; items: InventoryItem[] }
  | { status: "error"; message: string };

function kindLabel(kind: InventoryItem["kind"]): string {
  if (kind === "material_pack") {
    return "material pack";
  }

  return kind;
}

function App() {
  const [inventoryState, setInventoryState] = useState<InventoryState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadInventoryItems() {
      try {
        const response = await fetch("/api/v1/inventory/items/", {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            "Inventory could not be loaded. A local backend session may be required.",
          );
        }

        const items = (await response.json()) as InventoryItem[];
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
              : "Inventory could not be loaded.",
        });
      }
    }

    void loadInventoryItems();

    return () => controller.abort();
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Titan inventory</p>
          <h1>Available catalog</h1>
        </div>
        <p className="session-note">Uses the existing Django session.</p>
      </header>

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
    </main>
  );
}

export default App;
