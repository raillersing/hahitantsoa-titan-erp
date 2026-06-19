# Frontend Specialist Skills — OpenCode Usage Guide

## Purpose

This page documents the OpenCode skills available under `.opencode/skills/` for
frontend agents working on the Hahitantsoa/Titan ERP frontend. These skills are
optional helpers — they accelerate repetitive quality checks but never replace the
canonical workflow docs in `docs/ai-agents/`.

## Available Skills

| Skill | File | Purpose |
|---|---|---|
| `frontend-scope-guard` | `.opencode/skills/frontend-scope-guard/SKILL.md` | Verify changes stay in approved frontend files and respect business boundaries |
| `react-typescript-quality` | `.opencode/skills/react-typescript-quality/SKILL.md` | TypeScript strictness, React patterns, consistent conventions |
| `frontend-api-contracts` | `.opencode/skills/frontend-api-contracts/SKILL.md` | Confirm API calls match confirmed backend contracts |
| `frontend-testing` | `.opencode/skills/frontend-testing/SKILL.md` | Vitest + RTL test coverage and resilience |
| `frontend-accessibility-ux` | `.opencode/skills/frontend-accessibility-ux/SKILL.md` | WCAG fundamentals, keyboard nav, semantic HTML, UX consistency |
| `frontend-error-recovery` | `.opencode/skills/frontend-error-recovery/SKILL.md` | Graceful error handling and user-facing error communication |
| `frontend-state-forms` | `.opencode/skills/frontend-state-forms/SKILL.md` | Controlled form state, validation, and data-fetching patterns |
| `frontend-performance-maintainability` | `.opencode/skills/frontend-performance-maintainability/SKILL.md` | Render performance, bundle hygiene, and long-term maintainability |

## When Each Agent Should Load Skills

| Agent | Load |
|---|---|
| Agent FE-A (Implementer) | `frontend-scope-guard` at task start; `react-typescript-quality` + `frontend-api-contracts` + `frontend-state-forms` during implementation; `frontend-testing` when writing tests |
| Agent FE-B (UI/UX Reviewer) | `frontend-accessibility-ux` during review |
| Agent FE-C (Accessibility Reviewer) | `frontend-accessibility-ux` during review |
| Agent FE-D (Test Reviewer) | `frontend-testing` during review |
| Agent FE-E (API Contract Reviewer) | `frontend-api-contracts` during review |
| Agent FE-F (Scope Guardian) | `frontend-scope-guard` during review |

Skills are loaded on demand via the `skill` tool. Agents call `skill({ name: "frontend-scope-guard" })` to load the full checklist. Skills are optional — the canonical workflow in `frontend-agent-template.md` and `frontend-quality-workflow.md` remains authoritative.

## Model Notes

These skills are model-agnostic. They were authored using Deepseek-v4-flash as the
reference model but do not depend on any specific provider capabilities.

## References

- [Frontend Agent Template](../frontend-agent-template.md)
- [Frontend Quality Workflow](../frontend-quality-workflow.md)
- [OpenCode Workflow Bridge](opencode-workflow.md)
- [OpenCode Skills Documentation](https://opencode.ai/docs/skills/)