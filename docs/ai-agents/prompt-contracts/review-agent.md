# Review Agent Prompt Contract

## Version

- contract: `review-agent`
- version: `F138I-v1`

## Purpose

Define a strict review-only prompt surface for non-mutating review agents.

## Maximum Autonomy

- maximum level: `Level 0`
- Pursue Goal: not allowed for mutation
- Level 3 auto-repair: not allowed in review-only mode
- Level 4 auto-merge: forbidden

## Required References

- `docs/ai-agents/agent-profiles.md`
- `docs/ai-agents/review-agent-template.md`
- `docs/ai-agents/parallel-agent-policy.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/tooling/antigravity-workflow.md` or `docs/ai-agents/tooling/opencode-workflow.md` when relevant

## Required Inputs

- assigned agent profile
- repository path
- branch or PR under review
- scope under review
- relevant files or diff
- review focus areas
- explicit statement whether edits are forbidden or exceptionally allowed

## Mode

Default mode is review-only and non-mutating.

Executable review profiles run the integrated task-start baseline first. Plan-only
profiles propose it and wait. Live baseline wins over stale docs.

Review agents must not:

- edit files
- commit
- push
- merge
- silently correct findings
- extend their scope to "finish faster"

## Expected Outputs

- findings ordered by severity
- evidence and rationale
- verdict: `APPROVE`, `REQUEST_CHANGES`, or `BLOCK`
- residual risks
- explicit statement whether no edits were performed

Deliverables must be in chat and/or an approved repository file. A private-only report
must not be the sole deliverable.

## Stop Conditions

- missing diff or missing evidence
- scope ambiguity
- request to mutate while still labelled review-only
- `.env` or secret-like material appears in evidence
