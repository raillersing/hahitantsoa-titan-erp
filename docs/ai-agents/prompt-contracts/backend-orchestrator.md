# Backend Orchestrator Prompt Contract

## Version

- contract: `backend-orchestrator`
- version: `F138I-v1`

## Purpose

Keep backend orchestration prompts short, repeatable, and reviewable.
This contract consolidates the existing backend orchestration workflow; it does not
define a new one.

## Maximum Autonomy

- maximum level: `Level 2`
- Pursue Goal: allowed only when the bounded goal contract is fully specified
- Level 3 auto-repair: allowed only inside the same PR and same approved scope
- Level 4 auto-merge: forbidden

## Required References

Backend prompts should stay short and reference, not duplicate:

- `docs/ai-agents/agent-profiles.md`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- `docs/ai-agents/backend-agent-template.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/parallel-agent-policy.md`

Every backend orchestration prompt must explicitly reference:

- `docs/ai-agents/agent-command-runbook.md` (includes knowledge graph consultation section)
- `docs/ai-agents/orchestrator-task-queue.md`
- Agent A through Agent F in `docs/ai-agents/backend-agent-template.md`
- `docs/ai-agents/tooling/graphify.md` — Graphify knowledge graph pilot
- `graphify-out/GRAPH_REPORT.md` — generated code graph (consult before implementation)
- AGENTS.md — knowledge graph consultation order (cartography → Graphify → raw search)
- official wrappers when applicable:
  - `scripts/dev/erp-backend-compose-ci`
  - `scripts/dev/erp-agent-scope-guard`
  - `scripts/dev/erp-worktree-preflight`
- medium-bundle policy
- hard stop conditions

## Required Inputs

- assigned agent profile
- repository path
- expected branch
- baseline commit or `origin/main` reference
- objective
- allowed files and forbidden files
- required backend roles
- exact checks to run
- whether commit, push, PR creation are authorized
- whether the prompt is implement-only or review-only
- whether the orchestrator should continue automatically after merge and green `main` CI
- a short Backend Skill Plan that names the task slice, selected skills, validation plan, hard stops, and completion plan

Executable profiles run the integrated task-start baseline first. Live baseline wins over
stale docs.

## Backend Skill Plan

Every backend task prompt must start with a short Backend Skill Plan:

1. Task slice

   - one sentence describing the backend slice

2. Selected skills

   - list only the relevant backend skills, not all skills by default

3. Validation plan

   - focused loop: `scripts/dev/erp-backend-fast ...`
   - migration-sensitive check: `scripts/dev/erp-backend-migration-guard`
   - final backend gate: `scripts/dev/erp-backend-ci`

4. Hard stops

   - auth/security ambiguity
   - payment/idempotency ambiguity
   - transaction/data-integrity risk
   - migration drift
   - API contract ambiguity
   - CI failure
   - scope drift
   - `.env`/secret need

5. Completion plan

   - PR checks with `gh pr checks --watch --interval 30`
   - merge with head-SHA protection
   - exact-SHA main CI verification
   - cleanup only after main CI success

## Expected Mutable Scope

- `backend/`
- `tests/backend/`
- backend audit docs when explicitly allowed

Never broaden into `frontend/`, `scripts/`, `.github/`, or docs worktrees unless the
task explicitly authorizes it.

## Standard Stop Conditions

- branch mismatch
- wrong worktree
- required scope expands into frontend or secrets
- `.env` or secret-like path appears
- missing or contradictory backend contract
- CI failure that would require unapproved scope expansion
- the agent would need to extend scope to "finish faster"

## Backend Medium-Bundle Policy

Backend orchestration prompts must assign medium-sized coherent bundles.

A valid backend medium bundle:

- has one clear backend theme
- contains 2 to 4 closely related sub-tasks maximum
- touches one bounded backend area
- has one coherent test surface
- avoids mixing unrelated domains

Avoid:

- one-assertion or one-tiny-serializer PRs
- broad bundles that mix amendment, inventory, documents, payment, frontend, or unrelated
  refactors

## Backend Agent Assignment Policy

The orchestrator assigns only relevant backend agents.

- Agent A implements the approved backend scope.
- Agent B performs an independent review before merge readiness.
- Agent C is used only when test, rollback, or failure-mode review is relevant.
- Agent D is used only when architecture or scope-boundary review is relevant.
- Agent E is used only when migrations, constraints, locking, or data integrity are
  relevant.
- Agent F is used only when documentation, status, runbook, or PR reporting review is
  relevant.

Review agents report findings; they do not silently mutate files.

## Required Backend Continuation Rule

Reporting alone is not a stopping condition.

After a successful merge and green `main` CI:

- sync `main`
- confirm the merged commit is green on `main`
- clean task branches and worktrees when authorized
- immediately continue to the next clear backend bundle unless a hard stop condition
  occurs

## Expected Outputs

- files changed
- behavior delivered
- exact checks run and exact outcomes
- review findings resolved or remaining
- residual risks
- PR URL when created
- explicit statement: `No merge was performed.`

Deliverables must be in chat and/or an approved repository file. A private-only report
must not be the sole deliverable.

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

For backend workflow measurement, also reference
[`docs/audits/F153D_BACKEND_PRODUCTIVITY_AND_SKILL_ADOPTION.md`](../../audits/F153D_BACKEND_PRODUCTIVITY_AND_SKILL_ADOPTION.md)
when the final report includes a productivity summary.
