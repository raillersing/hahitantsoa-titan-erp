type FutureScope =
  | "planning"
  | "reports"
  | "catalog"
  | "procurement"
  | "hr"
  | "help";

type FutureWorkspacePanelProps = {
  scope: FutureScope;
};

type PlaceholderCard = {
  title: string;
  status: string;
  description: string;
  decision: string;
};

const PANEL_CONTENT: Record<
  FutureScope,
  {
    eyebrow: string;
    heading: string;
    helper: string;
    cards: PlaceholderCard[];
  }
> = {
  planning: {
    eyebrow: "Prototype placeholder",
    heading: "Planning and calendar workspace",
    helper:
      "Prototype 4 expects a richer planning surface, but the current ERP keeps planning flows split across reservation drafts and logistics APIs.",
    cards: [
      {
        title: "Reservation scheduling",
        status: "Future route",
        description: "Calendar layout and operator filters are still routed through reservation and logistics views.",
        decision: "Requires a dedicated planning route before a full implementation bundle.",
      },
      {
        title: "Operational calendar",
        status: "Contract pending",
        description: "No standalone planning API contract exists on the frozen backend.",
        decision: "Keep read-only placeholder until a mapped route is approved.",
      },
    ],
  },
  reports: {
    eyebrow: "Business gate",
    heading: "Reports and exports",
    helper:
      "The prototype exposes report surfaces, but export formats and business/legal expectations are not fully confirmed for the ERP.",
    cards: [
      {
        title: "Financial exports",
        status: "Decision required",
        description: "No export format or accounting handoff contract is approved in the current frontend scope.",
        decision: "Do not implement export actions before business confirmation.",
      },
      {
        title: "Operational reporting",
        status: "Future route",
        description: "Dashboard metrics exist, but drill-down reporting remains a future slice.",
        decision: "Use current dashboards and audit views until report contracts are approved.",
      },
    ],
  },
  catalog: {
    eyebrow: "Scope guard",
    heading: "Catalog and pack management",
    helper:
      "The prototype suggests a richer catalog surface, but Titan and Hahitantsoa boundaries must remain explicit and no standalone catalog route is approved yet.",
    cards: [
      {
        title: "Titan articles and packs",
        status: "Future route",
        description: "Inventory is still managed from the Titan scope and stock panels.",
        decision: "Promote to a dedicated catalog only after workflow approval.",
      },
      {
        title: "Hahitantsoa concepts",
        status: "Boundary protected",
        description: "Venue and event concepts must stay out of Titan and remain clearly separated.",
        decision: "Any catalog merge requires an explicit business-boundary review.",
      },
    ],
  },
  procurement: {
    eyebrow: "Not mapped",
    heading: "Procurement workspace",
    helper:
      "Prototype procurement cues are preserved as visual intent only. No confirmed frontend workflow or backend contract is mapped for procurement in the current ERP.",
    cards: [
      {
        title: "Purchase requests",
        status: "Non confirme",
        description: "No procurement endpoints are exposed in the live frontend integration map.",
        decision: "Stop at placeholder state until cartography and backend contracts are extended.",
      },
    ],
  },
  hr: {
    eyebrow: "Out of current scope",
    heading: "HR and staffing",
    helper:
      "The client prototype contains HR-like surfaces, but current ERP frontend priorities and application map do not confirm an HR implementation path.",
    cards: [
      {
        title: "Staff planning",
        status: "Non confirme",
        description: "No active HR route or backend slice is approved on the frozen backend.",
        decision: "Keep informational placeholder only.",
      },
    ],
  },
  help: {
    eyebrow: "Operator support",
    heading: "Help and onboarding",
    helper:
      "The prototype includes support cues. This ERP keeps them as guidance only until curated help content and role-based onboarding journeys are documented.",
    cards: [
      {
        title: "Getting started",
        status: "Future content",
        description: "Operators should currently rely on approved workflows, brand/theme docs, and panel-level helper text.",
        decision: "Add curated onboarding content in a dedicated documentation slice.",
      },
      {
        title: "Feature coverage",
        status: "Read-only notice",
        description: "This placeholder avoids suggesting unsupported backend or legal workflows.",
        decision: "Use existing modules for all live operations.",
      },
    ],
  },
};

function FutureWorkspacePanel({ scope }: FutureWorkspacePanelProps) {
  const content = PANEL_CONTENT[scope];

  return (
    <section className="future-workspace-panel" aria-labelledby={`future-workspace-${scope}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id={`future-workspace-${scope}`}>{content.heading}</h2>
          <p className="section-helper">{content.helper}</p>
        </div>
      </div>

      <div className="notice warning-notice" role="status">
        <h3>Frontend placeholder only</h3>
        <p>
          This screen preserves prototype navigation intent without inventing backend
          behavior, export formats, or legal workflows.
        </p>
      </div>

      <div className="future-workspace-grid">
        {content.cards.map((card) => (
          <article className="future-workspace-card" key={card.title}>
            <div className="future-workspace-card__header">
              <h3>{card.title}</h3>
              <span className="scope-chip scope-chip--neutral">{card.status}</span>
            </div>
            <p>{card.description}</p>
            <div className="future-workspace-card__decision">
              <strong>Rule:</strong> {card.decision}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default FutureWorkspacePanel;
