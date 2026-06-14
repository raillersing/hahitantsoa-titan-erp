# Review Agent Prompt Contract

## Version

- contract: `review-agent`
- version: `F138I-v1`

## Purpose

Define a strict review-only prompt surface for non-mutating review agents.

## Required References

- `docs/ai-agents/review-agent-template.md`
- `docs/ai-agents/parallel-agent-policy.md`
- `docs/ai-agents/orchestrator-state.md`

## Required Inputs

- repository path
- branch or PR under review
- scope under review
- relevant files or diff
- review focus areas
- explicit statement whether edits are forbidden or exceptionally allowed

## Mode

Default mode is review-only and non-mutating.

Review agents must not:

- edit files
- commit
- push
- merge
- silently correct findings

## Expected Outputs

- findings ordered by severity
- evidence and rationale
- verdict: `APPROVE`, `REQUEST_CHANGES`, or `BLOCK`
- residual risks
- explicit statement whether no edits were performed

## Stop Conditions

- missing diff or missing evidence
- scope ambiguity
- request to mutate while still labelled review-only
- `.env` or secret-like material appears in evidence
