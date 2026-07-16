# Frontend Specialist Skills — Usage Guide

## Purpose

This page documents the shared agent skills under `.agents/skills/` for
frontend agents working on the Hahitantsoa/Titan ERP frontend. These skills are
optional helpers — they accelerate repetitive quality checks but never replace the
canonical workflow docs in `docs/ai-agents/`. They live in `.agents/skills/` for
Codex discovery.

## Available Skills

| Skill | File | Purpose |
|---|---|---|
| `erp-ui-ux-design-review` | `.agents/skills/erp-ui-ux-design-review/SKILL.md` | Portable ERP design review checklist that points to `docs/design/DESIGN.md` |
| `erp-frontend-scope-guard` | `.agents/skills/erp-frontend-scope-guard/SKILL.md` | Verify changes stay in approved frontend files and respect business boundaries |
| `erp-frontend-typescript-quality` | `.agents/skills/erp-frontend-typescript-quality/SKILL.md` | TypeScript strictness, React patterns, consistent conventions |
| `erp-frontend-api-contracts` | `.agents/skills/erp-frontend-api-contracts/SKILL.md` | Confirm API calls match confirmed backend contracts |
| `erp-frontend-testing` | `.agents/skills/erp-frontend-testing/SKILL.md` | Vitest + RTL test coverage and resilience |
| `erp-frontend-accessibility-ux` | `.agents/skills/erp-frontend-accessibility-ux/SKILL.md` | WCAG fundamentals, keyboard nav, semantic HTML, UX consistency |
| `erp-frontend-error-recovery` | `.agents/skills/erp-frontend-error-recovery/SKILL.md` | Graceful error handling and user-facing error communication |
| `erp-frontend-state-forms` | `.agents/skills/erp-frontend-state-forms/SKILL.md` | Controlled form state, validation, and data-fetching patterns |
| `erp-frontend-performance-maintainability` | `.agents/skills/erp-frontend-performance-maintainability/SKILL.md` | Render performance, bundle hygiene, and long-term maintainability |

## Canonical Design Source

- `docs/design/DESIGN.md` is the canonical cross-agent UI/UX source for
  Hahitantsoa/Titan ERP.
- The approved frontend redesign reference set also includes:
  - `docs/design/brand/BRAND_ARCHITECTURE.md`
  - `docs/design/CLIENT_APPROVED_UI_REFERENCE.md`
  - `docs/design/UI_MIGRATION_CONTRACT.md`
  - `docs/design/THEME_AND_DARK_MODE_CONTRACT.md`
  - `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md`
  - `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md`
- Agents should read it even if their runtime does not auto-load local skills.
- `erp-ui-ux-design-review` exists to route agents back to that document and to
  the relevant F150A frontend skills.

## When Each Agent Should Load Skills

| Agent | Load |
|---|---|
| Agent FE-A (Implementer) | Read `docs/design/DESIGN.md`; load `erp-frontend-scope-guard` at task start; load `erp-ui-ux-design-review` for workflow/layout guidance; load `erp-frontend-typescript-quality` + `erp-frontend-api-contracts` + `erp-frontend-state-forms` during implementation; load `erp-frontend-testing` when writing tests |
| Agent FE-B (UI/UX Reviewer) | Read `docs/design/DESIGN.md`; load `erp-ui-ux-design-review` + `erp-frontend-accessibility-ux` during review |
| Agent FE-C (Accessibility Reviewer) | `erp-frontend-accessibility-ux` during review |
| Agent FE-D (Test Reviewer) | `erp-frontend-testing` during review |
| Agent FE-E (API Contract Reviewer) | `erp-frontend-api-contracts` during review |
| Agent FE-F (Scope Guardian) | `erp-frontend-scope-guard` during review |

Skills are loaded on demand. An agent can name one explicitly as
`$erp-frontend-scope-guard`; Codex may also select it automatically when its
description clearly matches the task. Skills are optional helpers — the canonical
workflow in `frontend-agent-template.md` and `frontend-quality-workflow.md` remains
authoritative.

## Model Notes

These skills use the repository's Codex skill format and contain no dependency on a
specific Codex model version.

## References

- [Frontend Agent Template](../frontend-agent-template.md)
- [Frontend Quality Workflow](../frontend-quality-workflow.md)
- [Agent Shared Skills Guide](agent-shared-skills.md)
