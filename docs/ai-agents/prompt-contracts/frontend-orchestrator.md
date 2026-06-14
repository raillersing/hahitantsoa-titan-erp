# Frontend Orchestrator Prompt Contract

## Version

- contract: `frontend-orchestrator`
- version: `F138I-v1`

## Purpose

Keep frontend orchestration prompts short, referenced, and API-contract-safe.

## Required References

- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/parallel-agent-policy.md`

## Required Inputs

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

## Expected Mutable Scope

- `frontend/`
- frontend audit docs when explicitly allowed

Never invent backend endpoints, payloads, permissions, or workflows.

## Standard Stop Conditions

- branch mismatch
- wrong worktree
- any required backend code change
- `.env` or secret-like path appears
- absent or contradictory backend contract
- any request to create public document URLs or expose protected storage paths

## Expected Outputs

- files changed
- UI behavior delivered
- exact tests and build results
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
