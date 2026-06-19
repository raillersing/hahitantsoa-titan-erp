# Hahitantsoa / Titan ERP Design Guidance

## Purpose

This document is the canonical cross-agent UI/UX design source for the
Hahitantsoa/Titan ERP project.

It exists to keep frontend implementation and review work operationally clear,
workflow-safe, and consistent across Codex, Claude Code, OpenCode, and future
agents.

This is not a marketing brand document. It does not introduce new branding
claims, colors, fonts, imagery systems, or asset requirements. It defines
interaction and layout guidance for ERP workflows that are already in scope.

## How Agents Must Use This Document

### Codex

- Read `AGENTS.md` first.
- Then read this file: `docs/design/DESIGN.md`.
- Then reference `erp-ui-ux-design-review` if that skill is available in the
  runtime.
- When implementing or reviewing frontend work, also load or reference the
  relevant ERP frontend skills when available.

### Claude Code

- Read `CLAUDE.md` first.
- Then read this file: `docs/design/DESIGN.md`.
- Then reference or load `erp-ui-ux-design-review` if that skill is available.
- Use this file as the canonical UI/UX source even when the runtime does not
  auto-load local skills.

### OpenCode

- Load `erp-ui-ux-design-review` when available.
- Then read or reference `docs/design/DESIGN.md` as the canonical design source.
- Then load the relevant F150A frontend skills for implementation or review,
  especially scope, API contract, testing, accessibility, error recovery, form
  state, and maintainability guidance.

### Future Agents

- Treat `docs/design/DESIGN.md` as the portable source of truth for UI/UX
  expectations.
- If skills are unsupported, this document remains authoritative.
- If skills are supported, they assist this document; they do not replace it.

## Design Principles

- Prioritize operational clarity over aesthetic novelty.
- Prefer stable, readable workflows over decorative density.
- Keep user attention on status, risk, next action, and record integrity.
- Show business consequences clearly before sensitive mutations.
- Support progressive disclosure: summary first, detail on demand.
- Avoid hiding critical state in hover-only or collapsed-only UI.
- Keep Hahitantsoa and Titan visually compatible but workflow-distinct.
- Respect DEC-001: Titan UI must never present forbidden venue/service concepts
  as selectable Titan offerings.

## Business Boundary Principles

### Titan

- Titan is pure rental.
- Titan UI must expose only allowed rental-domain entities and flows tied to
  physical items and valid packs.
- Titan UI must never suggest or normalize venue, room, hall, local, ancillary
  service, or event-service behavior.

### Hahitantsoa

- Hahitantsoa may represent the broader event workflow.
- Hahitantsoa UI may include event drafting, discovery, documents, and broader
  service-oriented orchestration where approved by business rules.

### Shared Rule

- Shared inventory views must not collapse the Titan/Hahitantsoa distinction.
- Reused components may share layout patterns, but labels, filters, and action
  paths must remain domain-correct.

## Information Architecture

### Page Structure

- Use a clear page title, a concise operational subtitle, and a primary action
  area.
- Keep top-of-page summaries short and decision-oriented.
- Reserve the main content region for tables, forms, timelines, or panels.
- Place secondary actions away from destructive or high-risk actions.

### Navigation

- Organize by workflow, not by technical model names.
- Group related actions into domain areas:
  reservations, customers, inventory, logistics, payments, billing,
  documents/contracts, audit/identity/security.
- Show active section context clearly.
- Avoid deep nesting when one level of tabs or sectional panels is enough.

### Panel Usage

- Panels should answer one operational question each.
- Each panel needs a visible title, a short summary, and a dominant next step.
- Avoid panels that combine unrelated editing, reporting, and approval actions.

## Density And Readability

- ERP screens may be information-dense, but density must remain scannable.
- Use strong row/section grouping rather than excessive decoration.
- Prefer whitespace between logical groups over oversized empty surfaces.
- Keep labels explicit; avoid ambiguous shorthand.
- Surface identifiers, dates, status, and financial totals consistently.

## Layout Guidance

### Desktop

- Desktop layouts may use two-column or three-region views when one region is
  clearly primary and secondary regions do not compete.
- Summary + detail is preferred for operational workflows.
- Keep filters and key status controls visible without forcing repeated scrolls.

### Mobile

- Collapse secondary detail into ordered sections, not tiny side panels.
- Stack summary cards above tables/forms when width is constrained.
- Keep primary actions reachable without horizontal scrolling.
- Avoid wide matrix layouts that break on small screens.

## Forms

- Use forms to guide, not merely capture, workflow-critical data.
- Group fields by business meaning: customer, period, items, payment,
  documentation, approval.
- Mark required fields clearly and explain why they matter when risk is high.
- Keep inline validation close to the field that triggered it.
- Use explicit disabled/loading/submitting states on mutation controls.
- Make destructive or irreversible actions visually distinct and text-explicit.

### Sensitive Writes

- Confirmation, settlement, refund, cancellation, and other sensitive writes
  must present:
  - what will change,
  - what preconditions are expected,
  - who is acting,
  - what cannot be undone.
- UI must support future role-aware workflows and CSRF-safe mutations.
- Never design write flows that imply frontend-only authorization.

## Tables

- Tables are the default for list-heavy operational views.
- Prioritize columns that drive action:
  status, name/reference, customer, period, quantity, amount, assignee,
  updated-at.
- Keep row actions predictable and limited.
- Use inline badges only for meaningful state, not decoration.
- Support filters before adding complex table interactions.
- Use sticky headers or visible filter summaries when lists are long.

## Dashboards

- Dashboards should emphasize queue visibility and bottleneck awareness.
- Prefer a small number of meaningful operational metrics over decorative KPIs.
- Good dashboard questions:
  - what needs attention now,
  - what is blocked,
  - what is late,
  - what requires validation,
  - what is financially unresolved.
- If a dashboard cannot drive an action, it should probably be a report instead.

## Loading States

- Never leave operational surfaces blank during loading.
- Use skeletons or explicit loading placeholders for tables and panels.
- Keep page structure stable while data loads.
- Loading copy should describe what is loading when the wait is meaningful.

## Empty States

- Empty states must explain whether:
  - nothing exists yet,
  - the current filter returned no results,
  - the user lacks access,
  - an upstream dependency is missing.
- When appropriate, include the next useful action:
  create, clear filters, request access, or check required prerequisites.

## Error States

- Error messages should be operationally useful, not vague.
- Prefer clear failure context:
  action attempted, likely cause, and safe next step.
- Keep validation errors near fields.
- Keep workflow-level failures in a visible summary region.
- For permission failures, explain the limitation without leaking protected data.

## Confirmation Dialogs

- Use confirmation dialogs only for meaningful irreversible or high-risk actions.
- Dialogs must name the exact action and target record.
- Show the consequence, not just “Are you sure?”
- Use stronger wording for:
  confirmation,
  cancellation,
  refund,
  settlement,
  document issuance,
  audit-sensitive changes.
- If more than one paragraph is needed, consider a review step instead of a
  minimal confirm dialog.

## Accessibility

- Keyboard navigation must remain viable for all critical flows.
- All interactive controls need accessible names.
- Form fields need associated labels and programmatic error linkage.
- Focus order should follow workflow order.
- Dynamic status changes should be announced where needed.
- Color must not be the only indicator of status.
- Dense data screens still need readable hierarchy and focus visibility.

## Responsive Behavior

- Preserve workflow meaning across breakpoints; do not hide critical state only on
  mobile.
- Reflow details into stacked sections instead of clipping columns invisibly.
- Maintain usable touch targets and visible action labels.
- Filters should remain understandable when compressed into drawers or sheets.

## Domain Guidance

### Reservations

- Reservation screens should emphasize period, availability confidence, draft vs
  confirmed state, and required next steps.
- Drafts must be clearly distinct from confirmed operations.
- If confirmation is unavailable, the UI must not imply that a draft is already
  committed.
- Show availability risk, conflicts, and dependencies before action.

### Customers

- Customer screens should prioritize identity, contactability, commercial history,
  and linked operational records.
- Make it easy to move from customer context into reservations, billing, and
  documents without duplicating data entry.

### Inventory

- Inventory views should emphasize item type, availability, condition, movement,
  and reservation impact.
- Condition and stock state should be readable in one scan.
- Titan inventory UI must remain strictly inside DEC-001 boundaries.

### Logistics

- Logistics screens should emphasize timeline, handoff state, return readiness,
  exception handling, and field accountability.
- Separate planning information from execution confirmation where possible.

### Payments

- Payment views should make amount, method, receipt status, allocation, and
  refund context obvious.
- Users should never have to infer whether a payment is draft, recorded, applied,
  or refunded.

### Billing

- Billing screens should foreground amount due, amount settled, remaining balance,
  invoice status, and linked commercial cause.
- Avoid mixing invoice generation and payment execution in a visually ambiguous way.

### Documents / Contracts

- Document screens should distinguish:
  templates,
  generated instances,
  private artifacts,
  signed/unsigned state,
  and customer-visible vs internal-only artifacts.
- If contract signature or deposit is a prerequisite, surface that dependency
  explicitly.

### Audit / Identity / Security

- Identity screens should show role, assignment scope, assignment dates, and actor
  accountability clearly.
- Audit surfaces should privilege chronology, actor, action, and target record.
- Security-sensitive screens should prefer explicitness over convenience.

## Review Heuristics

- Can an operator tell what happened, what is blocked, and what to do next?
- Is draft vs committed state unmistakable?
- Are lists, totals, and actions aligned with the business workflow?
- Does the UI avoid inventing backend behavior or bypass expectations?
- Does Titan stay inside DEC-001 boundaries everywhere?
- Does the flow remain usable on smaller screens and with keyboard navigation?

## Non-Goals

- This document does not define a new visual brand system.
- This document does not override business rules, decisions, or API contracts.
- This document does not authorize frontend-only workarounds for missing backend
  behavior.
