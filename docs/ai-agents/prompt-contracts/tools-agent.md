# Tools Agent Prompt Contract

## Version

- contract: `tools-agent`
- version: `F138I-v1`

## Purpose

Standardize prompt inputs for agent-tooling and orchestration helper work.

## Required References

- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/parallel-agent-policy.md`

## Required Inputs

- repository path
- expected branch
- objective
- allowed tooling files
- forbidden files
- exact validations
- whether commit, push, PR creation are authorized
- explicit safety constraints for cleanup or automation behavior

## Expected Mutable Scope

- `scripts/dev/`
- approved workflow helper docs
- approved audits
- `compose.agent-ci.yaml` only when explicitly allowed

Never touch application code, `.github/workflows/`, dependencies, or `.env`.

## Standard Stop Conditions

- scope expands into app code
- helper would require reading or printing secrets
- helper would delete dirty state without explicit stop
- another active tools agent owns overlapping files

## Expected Outputs

- scripts and docs changed
- exact validation commands and outcomes
- PR URL when created
- residual risks and operator cautions
- `No merge was performed.`
