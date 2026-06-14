# Docs Agent Prompt Contract

## Version

- contract: `docs-agent`
- version: `F138I-v1`

## Purpose

Standardize small, versioned prompt inputs for documentation-only work.

## Required References

- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/parallel-agent-policy.md`

## Required Inputs

- repository path
- expected branch
- objective
- allowed docs files
- forbidden files
- validation requirements
- whether commit, push, PR creation are authorized
- whether the task may add minimal links in existing docs

## Expected Mutable Scope

- `docs/ai-agents/`
- approved audit docs
- minimal approved doc links in existing agent docs

Never modify `backend/`, `frontend/`, `scripts/`, `.github/`, dependencies, Compose, or
`.env`.

## Standard Stop Conditions

- scope expands outside docs
- another active docs agent already owns overlapping files
- the task requires unapproved code or workflow edits
- `.env` or secret-like path appears in status or requested scope

## Expected Outputs

- docs files added or changed
- exact validations
- open PR URL when created
- residual documentation limits
- `No merge was performed.`
