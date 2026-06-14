# Backend Orchestrator Prompt Contract

## Version

- contract: `backend-orchestrator`
- version: `F138I-v1`

## Purpose

Keep backend orchestration prompts short, repeatable, and reviewable.

## Maximum Autonomy

- maximum level: `Level 2`
- Pursue Goal: allowed only when the bounded goal contract is fully specified
- Level 3 auto-repair: allowed only inside the same PR and same approved scope
- Level 4 auto-merge: forbidden

## Required References

Backend prompts should reference, not duplicate:

- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/parallel-agent-policy.md`

## Required Inputs

- repository path
- expected branch
- baseline commit or `origin/main` reference
- objective
- allowed files and forbidden files
- required backend roles
- exact checks to run
- whether commit, push, PR creation are authorized
- whether the prompt is implement-only or review-only

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

## Expected Outputs

- files changed
- behavior delivered
- exact checks run and exact outcomes
- review findings resolved or remaining
- residual risks
- PR URL when created
- explicit statement: `No merge was performed.`

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
