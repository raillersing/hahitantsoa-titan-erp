---
name: erp-ui-ux-design-review
description: Portable ERP UI/UX review checklist that points agents to docs/design/DESIGN.md as the canonical Hahitantsoa/Titan design source
---

## Purpose

Use this skill for frontend implementation planning, UI review, UX review, and
design consistency checks across Codex, Claude Code, OpenCode, and future agents.

Canonical source:

- `docs/design/DESIGN.md`

This skill assists the canonical frontend workflow. It does not replace
`frontend-agent-template.md`, `frontend-quality-workflow.md`, business rules, or
approved API contracts.

## Use With These ERP Frontend Skills When Available

- `erp-frontend-scope-guard`
- `erp-frontend-typescript-quality`
- `erp-frontend-api-contracts`
- `erp-frontend-testing`
- `erp-frontend-accessibility-ux`
- `erp-frontend-error-recovery`
- `erp-frontend-state-forms`
- `erp-frontend-performance-maintainability`

## Checklist

- [ ] Read `docs/design/DESIGN.md` before reviewing or implementing UI changes
- [ ] Confirm the workflow favors operational clarity over decorative styling
- [ ] Confirm Titan UI does not cross DEC-001 boundaries
- [ ] Confirm draft vs confirmed/committed state is visually unambiguous
- [ ] Confirm loading, error, and empty states are explicit and useful
- [ ] Confirm forms explain sensitive writes and support safe submission states
- [ ] Confirm tables emphasize operational columns and actionable status
- [ ] Confirm responsive behavior preserves critical state and actions
- [ ] Confirm accessibility fundamentals are present for dense ERP workflows
- [ ] Confirm the UI does not imply frontend-only authorization or unsafe writes
- [ ] Confirm future role-aware workflows and CSRF-safe mutations are supported by
      the design

## Runtime Guidance

- Codex: read `AGENTS.md`, then `docs/design/DESIGN.md`, then use this skill if
  available.
- Claude Code: read `CLAUDE.md`, then `docs/design/DESIGN.md`, then use this
  skill if available.
- OpenCode: load this skill first when available, then load the relevant ERP
  frontend skills for implementation or review.
- Future agents: if skills are unsupported, use `docs/design/DESIGN.md` directly
  as the portable source of truth.
