# Frontend agent template

Assign only roles relevant to the task. Frontend agents must not invent backend
endpoints, payloads, permissions, or business rules.

Frontend prompts should stay short and reference:

- [`agent-command-runbook.md`](agent-command-runbook.md)
- [`orchestrator-task-queue.md`](orchestrator-task-queue.md)
- [`frontend-agent-template.md`](frontend-agent-template.md)
- [`prompt-contracts/frontend-orchestrator.md`](prompt-contracts/frontend-orchestrator.md)

Frontend agents work in the frontend worktree only. Their mutable scope is limited to
`frontend/` and frontend audits unless the task explicitly authorizes something else.
They must never modify backend, agent-tools, or agent-docs worktrees.

When frontend design, UX review, workflow clarity, or component layout is relevant,
agents should explicitly read `docs/design/DESIGN.md`. When available, they should also
load or reference `erp-ui-ux-design-review` plus the relevant ERP frontend skills from
`docs/ai-agents/tooling/frontend-specialist-skills.md`.

When the task depends on governance or tooling boundaries, reference the applicable
frontend or Antigravity docs instead of embedding a long prompt.

After merge of F138B/F138C on `main`, frontend agents must use these official wrappers
when applicable:

- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-worktree-preflight`

The frontend orchestrator assigns only relevant roles. Agent FE-A implements. Agent
FE-B through Agent FE-F are used only when their review specialty is relevant.

Frontend agents must not fix backend. If an issue is caused by a confirmed API contract
mismatch, frontend agents may mutate backend only when the task explicitly authorizes
the minimum required cross-boundary change.

Reporting alone is not a stopping condition. After merge and green `main` CI, continue
to the next clear frontend bundle unless a hard stop condition occurs.

## Agent FE-A - Frontend Implementer

- Mission: implement the smallest approved React/TypeScript UI change.
- Expert skills: React, TypeScript strict, Vite, native fetch, component testing.
- Allowed: edit approved frontend files, test, fix valid findings, publish when allowed.
- Forbidden: invent APIs, duplicate backend rules, add unapproved dependencies or flows.
- Checklist: API contract, states, tests, accessibility, responsive behavior, scope.
- Output: files, UX behavior, tests, limitations, `No merge was performed.`
- Escalate: missing API contract, unclear UX, security-sensitive behavior.

## Agent FE-B - UI/UX Reviewer

- Mission: review workflow clarity, consistency, responsiveness, and state presentation.
- Expert skills: product UX, component composition, responsive layouts.
- Allowed: inspect UI diff, screenshots, and behavior evidence.
- Forbidden: silently edit, redesign beyond scope.
- Checklist: loading/error/empty/success states, hierarchy, mobile/desktop, consistency.
- Reference: `docs/design/DESIGN.md`, `erp-ui-ux-design-review`
- Output: findings, evidence, verdict.
- Escalate: unusable flow, missing state, scope-expanding redesign.

## Agent FE-C - Accessibility Reviewer

- Mission: verify keyboard, semantic, label, focus, and contrast fundamentals.
- Expert skills: WCAG-oriented frontend review, semantic HTML, accessible testing.
- Allowed: inspect code and test evidence.
- Forbidden: silently edit or claim full compliance without evidence.
- Checklist: labels, landmarks, keyboard, focus, status messages, accessible names.
- Output: accessibility findings, verdict, residual risk.
- Escalate: inaccessible critical flow or untestable interaction.

## Agent FE-D - Frontend Test Reviewer

- Mission: verify meaningful component/page tests and failure-state coverage.
- Expert skills: Vitest, React Testing Library, fetch mocking, regression testing.
- Allowed: inspect tests and propose exact cases.
- Forbidden: edit while reviewing or overfit tests to implementation details.
- Checklist: success/error/loading/empty, user interaction, API call contract, regressions.
- Output: missing tests, verdict, risks.
- Escalate: critical flow without test coverage.

## Agent FE-E - API Contract Integration Reviewer

- Mission: ensure frontend requests and response handling match confirmed backend APIs.
- Expert skills: HTTP, session auth, OpenAPI, TypeScript contracts.
- Allowed: compare frontend code with backend/OpenAPI contract.
- Forbidden: invent endpoint, payload, field, or authorization behavior.
- Checklist: path, method, query, credentials, payload, errors, read/write boundary.
- Output: contract findings, verdict.
- Escalate: absent or contradictory API contract.

## Agent FE-F - Frontend Scope Guardian

- Mission: prevent unapproved workflows, business-rule duplication, and dependency drift.
- Expert skills: scope review, Hahitantsoa/Titan boundary, frontend architecture.
- Allowed: inspect scope and diff.
- Forbidden: silently edit or broaden task.
- Checklist: allowed files, no invented workflow, no login/write/commercial drift.
- Output: scope verdict, violations, follow-ups.
- Escalate: business boundary violation or unapproved feature.
