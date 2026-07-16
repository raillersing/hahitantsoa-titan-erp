# Agent Shared Skills Guide

This document describes the repo-scoped Codex skills under [`.agents/skills/`](../../../.agents/skills) and how to use them in the official Codex-only workflow.

## Overview

Shared skills provide load-on-demand checklists and procedures for repetitive agent tasks. They accelerate the canonical workflow; they do not replace it.

## Available Skills

| Skill | Purpose | Applies to |
|-------|---------|------------|
| [`erp-task-start`](../../../.agents/skills/erp-task-start/SKILL.md) | Mandatory task-start baseline and scope check | All executable agents |
| [`erp-quality-gates`](../../../.agents/skills/erp-quality-gates/SKILL.md) | Pre-commit quality verification for backend PRs | Backend agents |
| [`erp-agent-roles`](../../../.agents/skills/erp-agent-roles/SKILL.md) | Role-specific checklists for backend agents A–F | Backend agents |
| [`erp-ci-workflow`](../../../.agents/skills/erp-ci-workflow/SKILL.md) | CI wait, authorized finalization, and post-merge validation | All agents opening PRs |
| [`erp-worktree-discipline`](../../../.agents/skills/erp-worktree-discipline/SKILL.md) | One-agent-one-worktree rules | All agents |
| [`erp-secret-handling`](../../../.agents/skills/erp-secret-handling/SKILL.md) | Never-read-.env and log hygiene rules | All agents |
| [`erp-business-boundaries`](../../../.agents/skills/erp-business-boundaries/SKILL.md) | Titan vs Hahitantsoa domain rules | All agents |
| [`erp-post-merge-cleanup`](../../../.agents/skills/erp-post-merge-cleanup/SKILL.md) | Safe post-merge worktree and branch cleanup | All agents after merge |
| [`erp-migration-safety`](../../../.agents/skills/erp-migration-safety/SKILL.md) | Migration necessity, reversibility, and rollback checklist | Backend agents |
| [`erp-security-review`](../../../.agents/skills/erp-security-review/SKILL.md) | Authorization, permissions, and input validation checklist | Backend agents |
| [`erp-agent-role-assignment`](../../../.agents/skills/erp-agent-role-assignment/SKILL.md) | Role assignment quick reference for orchestrators | Orchestrator agents |
| [`erp-api-contracts`](../../../.agents/skills/erp-api-contracts/SKILL.md) | API contract design and cross-boundary protocol | Backend & frontend agents |
| [`erp-scope-guard-setup`](../../../.agents/skills/erp-scope-guard-setup/SKILL.md) | Scope guard profiles, usage, and troubleshooting | All agents |

### Backend Specialist Skills

| Skill | Purpose | Applies to |
|-------|---------|------------|
| [`erp-backend-api-contracts`](../../../.agents/skills/erp-backend-api-contracts/SKILL.md) | Backend endpoint and serializer contract review | Backend agents |
| [`erp-backend-auth-permission-auditor`](../../../.agents/skills/erp-backend-auth-permission-auditor/SKILL.md) | DRF authorization and object-level permission review | Backend agents |
| [`erp-backend-data-integrity`](../../../.agents/skills/erp-backend-data-integrity/SKILL.md) | Model invariants and lifecycle integrity review | Backend agents |
| [`erp-backend-migration-guardian`](../../../.agents/skills/erp-backend-migration-guardian/SKILL.md) | Migration drift and schema-safety review | Backend agents |
| [`erp-backend-payment-idempotency`](../../../.agents/skills/erp-backend-payment-idempotency/SKILL.md) | Payment replay and idempotency review | Backend payment agents |
| [`erp-backend-pr-finalizer`](../../../.agents/skills/erp-backend-pr-finalizer/SKILL.md) | Backend pre-PR readiness | Backend orchestrators |
| [`erp-backend-test-triage`](../../../.agents/skills/erp-backend-test-triage/SKILL.md) | Focused backend test selection and failure triage | Backend agents |
| [`erp-backend-transaction-concurrency`](../../../.agents/skills/erp-backend-transaction-concurrency/SKILL.md) | Atomicity and concurrent-write review | Backend agents |

### Frontend Skills

| Skill | Purpose | Applies to |
|-------|---------|------------|
| [`erp-ui-ux-design-review`](../../../.agents/skills/erp-ui-ux-design-review/SKILL.md) | Canonical ERP design and UX review routing | Frontend agents |
| [`erp-frontend-scope-guard`](../../../.agents/skills/erp-frontend-scope-guard/SKILL.md) | Verify frontend scope and business boundaries | Frontend agents |
| [`erp-frontend-typescript-quality`](../../../.agents/skills/erp-frontend-typescript-quality/SKILL.md) | TypeScript strictness and React patterns | Frontend agents |
| [`erp-frontend-api-contracts`](../../../.agents/skills/erp-frontend-api-contracts/SKILL.md) | Confirm API calls match backend contracts | Frontend agents |
| [`erp-frontend-testing`](../../../.agents/skills/erp-frontend-testing/SKILL.md) | Vitest + RTL test coverage | Frontend agents |
| [`erp-frontend-accessibility-ux`](../../../.agents/skills/erp-frontend-accessibility-ux/SKILL.md) | WCAG and UX consistency | Frontend agents |
| [`erp-frontend-error-recovery`](../../../.agents/skills/erp-frontend-error-recovery/SKILL.md) | Error handling and graceful degradation | Frontend agents |
| [`erp-frontend-state-forms`](../../../.agents/skills/erp-frontend-state-forms/SKILL.md) | Form state and data fetching patterns | Frontend agents |
| [`erp-frontend-performance-maintainability`](../../../.agents/skills/erp-frontend-performance-maintainability/SKILL.md) | Performance and maintainability | Frontend agents |

Frontend specialist skills are documented in detail in [`frontend-specialist-skills.md`](frontend-specialist-skills.md).

## Usage Rules

1. **Load on demand** — only load a skill when the current task phase requires it. Do not load all skills at session start.
2. **Canonical docs win** — skills summarize but do not replace the canonical source documents. If a skill and its source document disagree, the source document is authoritative.
3. **Codex-compatible** — use the native skill discovery and invocation syntax documented below.
4. **Each skill references its source** — every skill links back to its canonical document.
5. **One phase, one primary skill** — load the smallest skill that owns the current
   phase. Add a specialist only for a distinct risk; never load a router and a
   specialist merely to repeat the same checklist.
6. **Routers coordinate, specialists inspect** — route cross-boundary work through
   the general skill, then delegate detailed checks without copying them into it.

## Non-overlapping Selection

| Situation | Primary skill | Exception |
|---|---|---|
| Normal executable task start | `erp-task-start` | Load a worktree, secret, or scope specialist only to diagnose its specific failure |
| Cross-boundary API decision | `erp-api-contracts` | Assign backend/frontend specialists later to their respective side |
| Backend API implementation/review | `erp-backend-api-contracts` | Add the router only for an unresolved cross-boundary mismatch |
| Frontend API integration/review | `erp-frontend-api-contracts` | Add the router only for an unresolved cross-boundary mismatch |
| Broad security review | `erp-security-review` | Add the permission auditor only for distinct object-level or sensitive-action risk |
| Backend permission-only review | `erp-backend-auth-permission-auditor` | Add broad security only when another trust boundary changes |
| Migration design | `erp-migration-safety` | Switch to the guardian for validation |
| Migration drift/PR validation | `erp-backend-migration-guardian` | Return to migration safety only if validation exposes a design risk |
| Focused backend tests or failure triage | `erp-backend-test-triage` | Switch to `erp-quality-gates` only after implementation stabilizes |
| Complete backend local readiness | `erp-quality-gates` | Do not repeat triage when focused evidence is already green |
| Role selection | `erp-agent-role-assignment` | The assigned backend agent loads `erp-agent-roles` afterward |
| Backend readiness before PR | `erp-backend-pr-finalizer` | `erp-ci-workflow` begins after PR creation |
| PR and exact-SHA CI | `erp-ci-workflow` | Cleanup begins only after green main CI and authorization |
| Cleanup | `erp-post-merge-cleanup` | Do not reload CI/finalizer skills when their evidence is confirmed |

## Skill Loading

### Codex

Codex discovers `.agents/skills/` automatically. Name a skill explicitly as
`$erp-quality-gates`, or allow Codex to select it from its description when the task
clearly matches. Use `/skills` in an interactive Codex surface to inspect discovery.

## For Each Skill, Know

- **When to load** — at which phase of the task
- **What it checks** — the core checklist items
- **Where the source is** — which canonical document to reference if clarification is needed

## Onboarding for New Skills

When a new skill is added to `.agents/skills/`:

1. Add a row to the table above.
2. Update the skills portfolio audit (`F151C0`) if relevant.
3. Ensure the skill has `name` and `description` frontmatter.
4. Confirm no duplicate `name` values across `.agents/skills/`.
5. Verify the skill follows the Codex skill format and repository governance.
6. Update this guide if the skill changes existing loading or usage rules.

## Discovery

Agents can discover available skills by listing directories under `.agents/skills/`:

```sh
ls .agents/skills/*/SKILL.md
```

Each skill's `name` and `description` frontmatter fields allow agents to determine relevance without loading the full content.

## References

- [docs/ai-agents/pr-quality-gates.md](../pr-quality-gates.md) — canonical quality gates
- [docs/ai-agents/agent-command-runbook.md](../agent-command-runbook.md) — standard commands
- [docs/ai-agents/backend-agent-template.md](../backend-agent-template.md) — backend roles
- [docs/ai-agents/secret-handling-policy.md](../secret-handling-policy.md) — secret rules
