# Frontend Specialist Skills — Usage Guide

## Purpose

This page documents the shared agent skills under `.agents/skills/` for
frontend agents working on the Hahitantsoa/Titan ERP frontend. These skills are
optional helpers — they accelerate repetitive quality checks but never replace the
canonical workflow docs in `docs/ai-agents/`. They were promoted from
`.opencode/skills/` to `.agents/skills/` for cross-agent compatibility.

## Available Skills

| Skill | File | Purpose |
|---|---|---|
| `erp-frontend-scope-guard` | `.agents/skills/erp-frontend-scope-guard/SKILL.md` | Verify changes stay in approved frontend files and respect business boundaries |
| `erp-frontend-typescript-quality` | `.agents/skills/erp-frontend-typescript-quality/SKILL.md` | TypeScript strictness, React patterns, consistent conventions |
| `erp-frontend-api-contracts` | `.agents/skills/erp-frontend-api-contracts/SKILL.md` | Confirm API calls match confirmed backend contracts |
| `erp-frontend-testing` | `.agents/skills/erp-frontend-testing/SKILL.md` | Vitest + RTL test coverage and resilience |
| `erp-frontend-accessibility-ux` | `.agents/skills/erp-frontend-accessibility-ux/SKILL.md` | WCAG fundamentals, keyboard nav, semantic HTML, UX consistency |
| `erp-frontend-error-recovery` | `.agents/skills/erp-frontend-error-recovery/SKILL.md` | Graceful error handling and user-facing error communication |
| `erp-frontend-state-forms` | `.agents/skills/erp-frontend-state-forms/SKILL.md` | Controlled form state, validation, and data-fetching patterns |
| `erp-frontend-performance-maintainability` | `.agents/skills/erp-frontend-performance-maintainability/SKILL.md` | Render performance, bundle hygiene, and long-term maintainability |

## When Each Agent Should Load Skills

| Agent | Load |
|---|---|
| Agent FE-A (Implementer) | `erp-frontend-scope-guard` at task start; `erp-frontend-typescript-quality` + `erp-frontend-api-contracts` + `erp-frontend-state-forms` during implementation; `erp-frontend-testing` when writing tests |
| Agent FE-B (UI/UX Reviewer) | `erp-frontend-accessibility-ux` during review |
| Agent FE-C (Accessibility Reviewer) | `erp-frontend-accessibility-ux` during review |
| Agent FE-D (Test Reviewer) | `erp-frontend-testing` during review |
| Agent FE-E (API Contract Reviewer) | `erp-frontend-api-contracts` during review |
| Agent FE-F (Scope Guardian) | `erp-frontend-scope-guard` during review |

Skills are loaded on demand via the `skill` tool. Agents call `skill({ name: "erp-frontend-scope-guard" })` to load the full checklist. Skills are optional — the canonical workflow in `frontend-agent-template.md` and `frontend-quality-workflow.md` remains authoritative.

## Model Notes

These skills are model-agnostic. They were authored using Deepseek-v4-flash as the
reference model but do not depend on any specific provider capabilities.

## References

- [Frontend Agent Template](../frontend-agent-template.md)
- [Frontend Quality Workflow](../frontend-quality-workflow.md)
- [Agent Shared Skills Guide](agent-shared-skills.md)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)