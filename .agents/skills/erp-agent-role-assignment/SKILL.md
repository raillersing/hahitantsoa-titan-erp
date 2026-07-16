---
name: erp-agent-role-assignment
description: Select the minimum relevant ERP agent roles for an orchestrated task. Use only while planning delegation; assigned backend agents use erp-agent-roles for their role checklist.
---

## What I do

Help orchestrators and agents quickly determine which roles to assign for a given task type — backend, frontend, docs, or review.

## Default Role Policy

### Backend tasks

| Role | When to assign |
|------|----------------|
| Agent A — Implementer | Always — implements the approved change |
| Agent B — Reviewer | Always — independent review |
| Agent C — Test Reviewer | When tests are complex or failure-mode coverage matters |
| Agent D — Scope Guardian | When scope boundaries or architecture decisions are at stake |
| Agent E — Migration Reviewer | When models, migrations, or data integrity changes |
| Agent F — Documentation Reviewer | When docs, status, or PR reports need verification |

**Default:** A (implement) + B (review). Add C–F only when relevant.

### Frontend tasks

| Role | When to assign |
|------|----------------|
| Agent FE-A — Implementer | Always — implements the approved change |
| Agent FE-B — UI/UX Reviewer | When workflow clarity or responsive behavior needs review |
| Agent FE-C — Accessibility Reviewer | When a11y is a concern or WCAG compliance is required |
| Agent FE-D — Test Reviewer | When component tests need independent review |
| Agent FE-E — API Contract Reviewer | When frontend calls a new or changed backend endpoint |
| Agent FE-F — Scope Guardian | When scope boundaries or business rules are at stake |

**Default:** FE-A (implement) + FE-E (API contract check, if applicable). Add FE-B–F only when relevant.

### Docs/Tooling tasks

| Role | When to assign |
|------|----------------|
| Agent A / FE-A — Implementer | Always |
| Agent B / FE-B — Reviewer | Always — independent review |

Docs/tooling tasks use backend or frontend roles depending on which worktree they touch.

### Cross-cutting rules

- The orchestrator assigns only relevant agents — do not dispatch unused roles
- Reporting alone is not a stopping condition
- After merge and green main CI, continue to the next clear bundle unless a hard stop occurs

## Source

- [Backend Agent Template — Default role policy](../../../docs/ai-agents/backend-agent-template.md)
- [Frontend Agent Template — Default role policy](../../../docs/ai-agents/frontend-agent-template.md)
- [AGENTS.md — Official multi-agent workflow](../../../AGENTS.md#official-multi-agent-workflow)
