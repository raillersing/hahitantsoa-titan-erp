import { useEffect, useState } from "react";

import { getHahitantsoaDiscoveryItems } from "./api";
import type { HahitantsoaDiscoveryItem } from "./types";

type DiscoveryState =
  | { status: "loading" }
  | { status: "loaded"; items: HahitantsoaDiscoveryItem[]; count: number }
  | { status: "error"; message: string };

function HahitantsoaDiscoveryPanel() {
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>({
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadDiscoveryItems() {
      try {
        const discovery = await getHahitantsoaDiscoveryItems(controller.signal);
        setDiscoveryState({
          status: "loaded",
          items: discovery.items,
          count: discovery.count,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDiscoveryState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The requested data could not be loaded.",
        });
      }
    }

    void loadDiscoveryItems();

    return () => controller.abort();
  }, []);

  return (
    <section className="discovery-section" aria-labelledby="hahitantsoa-discovery-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Hahitantsoa discovery</p>
          <h2 id="hahitantsoa-discovery-heading">Complete-event concepts</h2>
          <p className="section-helper">
            Read-only discovery and planning. This surface does not create reservations,
            contracts or commercial workflows.
          </p>
        </div>
        {discoveryState.status === "loaded" ? <span>{discoveryState.count}</span> : null}
      </div>

      {discoveryState.status === "loading" ? (
        <div className="notice loading-notice discovery-status" role="status">
          <p className="loading-spinner">Loading Hahitantsoa discovery...</p>
        </div>
      ) : null}

      {discoveryState.status === "error" ? (
        <div className="notice error-notice discovery-notice" role="alert">
          <div>
            <h3>Hahitantsoa discovery unavailable</h3>
            <p>{discoveryState.message}</p>
          </div>
        </div>
      ) : null}

      {discoveryState.status === "loaded" ? (
        discoveryState.items.length === 0 ? (
          <div className="notice info-notice discovery-notice" role="status">
            <p>No discovery items found.</p>
          </div>
        ) : (
          <ul className="discovery-list">
            {discoveryState.items.map((item) => (
              <li key={item.concept}>
                <span>{item.label}</span>
                <strong>{item.concept}</strong>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

export default HahitantsoaDiscoveryPanel;
