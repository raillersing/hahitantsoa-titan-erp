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
| `erp-replicate-from-source` | `.agents/skills/erp-replicate-from-source/SKILL.md` | Approved-source replication for UI, workflows, HTML/PDF, DOCX, and print documents |
| `erp-frontend-scope-guard` | `.agents/skills/erp-frontend-scope-guard/SKILL.md` | Verify changes stay in approved frontend files and respect business boundaries |
| `erp-frontend-typescript-quality` | `.agents/skills/erp-frontend-typescript-quality/SKILL.md` | Strict boundary types, safe React contracts, and minimal maintainable changes |
| `erp-frontend-api-contracts` | `.agents/skills/erp-frontend-api-contracts/SKILL.md` | Confirm API calls match confirmed backend contracts |
| `erp-frontend-testing` | `.agents/skills/erp-frontend-testing/SKILL.md` | User journeys plus visual and print evidence when fidelity matters |
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
- `erp-replicate-from-source` is mandatory when an approved UI, workflow, or
  document source must be reproduced. It routes agents to compare the rendered
  result with that source instead of improvising a redesign.

## When Each Agent Should Load Skills

| Agent | Load |
|---|---|
| Agent FE-A (Implementer) | Read `docs/design/DESIGN.md`; load `erp-frontend-scope-guard` at task start; load `erp-replicate-from-source` when an approved source exists; load `erp-frontend-typescript-quality` + `erp-frontend-api-contracts` + `erp-frontend-state-forms` during implementation; load `erp-frontend-testing` when writing tests |
| Agent FE-B (Fidelity and Interaction Reviewer) | Read the approved source and `docs/design/DESIGN.md`; load `erp-replicate-from-source` + `erp-frontend-accessibility-ux` during review |
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
