# Frontend Orchestrator Prompt Contract

## Version

- contract: `frontend-orchestrator`
- version: `F138I-v1`

## Purpose

Keep frontend orchestration prompts short, referenced, and API-contract-safe.
This contract consolidates the existing frontend orchestration workflow; it does not
define a new one.

## Maximum Autonomy

- maximum level: `Level 2`
- Pursue Goal: allowed only when the bounded goal contract is fully specified
- Level 3 auto-repair: allowed only inside the same PR and same approved scope
- Level 4 auto-merge: forbidden

## Required References

Frontend prompts should stay short and reference, not duplicate:

- `docs/ai-agents/agent-profiles.md`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- `docs/ai-agents/frontend-agent-template.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/parallel-agent-policy.md`
- `docs/ai-agents/frontend-quality-workflow.md`

Every frontend orchestration prompt must explicitly reference:

- `docs/ai-agents/agent-command-runbook.md` (includes knowledge graph consultation section)
- `docs/ai-agents/orchestrator-task-queue.md`
- Agent FE-A through Agent FE-F in `docs/ai-agents/frontend-agent-template.md`
- `docs/ai-agents/tooling/graphify.md` — Graphify knowledge graph pilot
- `docs/ai-agents/tooling/ponytail.md` — ERP Ponytail anti-overengineering ladder
- `graphify-out/GRAPH_REPORT.md` — generated code graph (consult before implementation)
- AGENTS.md — knowledge graph consultation order + ERP Ponytail ladder
- `docs/design/DESIGN.md` when UI/UX, layout, workflow clarity, or review is relevant
- `docs/design/brand/BRAND_ARCHITECTURE.md` when brand usage, shell identity, or scope indicators are relevant
- `docs/design/CLIENT_APPROVED_UI_REFERENCE.md` when prototype-derived UI is relevant
- `docs/design/UI_MIGRATION_CONTRACT.md` when component/token/layout migration is relevant
- `docs/design/THEME_AND_DARK_MODE_CONTRACT.md` when theme or dark mode is relevant
- `docs/design/FRONTEND_PROTOTYPE_GAP_ANALYSIS.md` when scope sequencing or gap classification is relevant
- `docs/design/FRONTEND_MIGRATION_ROADMAP_FROM_PROTOTYPE.md` when bundle planning is relevant
- `docs/ai-agents/tooling/frontend-specialist-skills.md` when skill-loading guidance is relevant
- official wrappers when applicable:
  - `scripts/dev/erp-agent-scope-guard`
  - `scripts/dev/erp-worktree-preflight`
- applicable frontend or Antigravity governance docs when the task depends on them
- hard stop conditions

## Required Inputs

- assigned agent profile
- repository path
- expected branch
- baseline commit or `origin/main` reference
- objective
- allowed frontend files and explicit forbidden areas
- confirmed backend contract or approved audit reference
- required frontend roles
- exact tests and build checks
- whether commit, push, PR creation are authorized
- whether the prompt is implement-only or review-only
- whether the orchestrator should continue automatically after merge and green `main` CI

Executable profiles run the integrated task-start baseline first. Live baseline wins over
stale docs.

## Expected Mutable Scope

- `frontend/`
- frontend audit docs when explicitly allowed

Never invent backend endpoints, payloads, permissions, or workflows.
Frontend agents must not mutate backend files unless an explicit API contract mismatch
authorization says they may make the minimum required cross-boundary change.

## Standard Stop Conditions

- branch mismatch
- wrong worktree
- any required backend code change
- `.env` or secret-like path appears
- absent or contradictory backend contract
- absent or contradictory frontend governance source
- the task would drift into backend orchestration or Antigravity/tooling orchestration
- any request to create public document URLs or expose protected storage paths
- the agent would need to extend scope to "finish faster"

## Frontend Agent Assignment Policy

The orchestrator assigns only relevant frontend agents.

- Agent FE-A implements the approved frontend scope.
- Agent FE-B performs independent UI/UX review when user-visible behavior changes.
- Agent FE-C is used only when accessibility review is relevant.
- Agent FE-D is used only when frontend test or failure-state review is relevant.
- Agent FE-E is used only when backend/OpenAPI contract integration review is relevant.
- Agent FE-F is used only when scope, workflow-boundary, or governance review is
  relevant.

Review agents report findings; they do not silently mutate files.

## Orchestration Separation Rule

- backend orchestration follows `docs/ai-agents/prompt-contracts/backend-orchestrator.md`
- frontend orchestration follows this contract
- Antigravity or tooling orchestration follows the applicable docs in
  `docs/ai-agents/tooling/`

Backend agents must not fix frontend issues. Frontend agents must not mutate backend
unless an explicit API contract mismatch authorization allows the minimum required fix.

## Required Frontend Continuation Rule

Reporting alone is not a stopping condition.

After a successful merge and green `main` CI:

- sync `main`
- confirm the merged commit is green on `main`
- clean task branches and worktrees when authorized
- immediately continue to the next clear frontend bundle unless a hard stop condition
  occurs

## Expected Outputs

- files changed
- UI behavior delivered
- exact tests and build results
- review findings resolved or remaining
- residual risks
- PR URL when created
- explicit statement: `No merge was performed.`

Deliverables must be in chat and/or an approved repository file. A private-only report
must not be the sole deliverable.

## Design Guidance Rule

Frontend orchestration should keep `frontend-agent-template.md` and
`frontend-quality-workflow.md` authoritative while adding explicit design references:

- Agents must read `docs/design/DESIGN.md` for ERP UI/UX guidance when relevant.
- Agents must also read the prototype/brand/theme contracts when the task touches
  navigation, shell layout, design system, responsive behavior, or light/dark support.
- If skills are supported, agents should load or reference
  `erp-ui-ux-design-review` and any relevant ERP frontend skills.
- If skills are not supported, agents still use `docs/design/DESIGN.md` directly.

## Final Report Format

- branch
- commit SHA
- PR number and URL when created
- files changed
- validations
- findings
- blockers or residual risks
- scope confirmation
- `No merge was performed.`
