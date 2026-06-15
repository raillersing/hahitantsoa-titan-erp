# Docs Agent Prompt Contract

## Version

- contract: `docs-agent`
- version: `F138I-v1`

## Purpose

Standardize small, versioned prompt inputs for documentation-only work.

## Maximum Autonomy

- maximum level: `Level 2`
- Pursue Goal: allowed for bounded docs-only outcomes
- Level 3 auto-repair: allowed only for same-PR docs conflicts or docs CI issues
- Level 4 auto-merge: forbidden by default

## Required References

- `docs/ai-agents/agent-profiles.md`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/parallel-agent-policy.md`

## Required Inputs

- assigned agent profile
- repository path
- expected branch
- objective
- allowed docs files
- forbidden files
- validation requirements
- whether commit, push, PR creation are authorized
- whether the task may add minimal links in existing docs

Executable profiles run `bash scripts/dev/erp-agent-task-start` inside
`scripts/dev/erp-logged-run` first. Live baseline wins over stale docs.

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
- the agent would need to extend scope to "finish faster"

## Expected Outputs

- docs files added or changed
- exact validations
- open PR URL when created
- residual documentation limits
- `No merge was performed.`

Deliverables must be in chat and/or an approved repository file. A private-only report
must not be the sole deliverable.
