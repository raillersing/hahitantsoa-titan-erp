# Parallel Agent Policy

## Core Rule

Two agents may work in parallel only when their mutable file globs do not overlap.

If mutable globs overlap, the tasks must be serialized or one task must be reduced to
review-only.

## Allowed Parallel Examples

- backend agent on `backend/**` and `tests/backend/**` plus frontend agent on
  `frontend/**`
- agent-tools on `scripts/dev/**` plus agent-docs on `docs/ai-agents/**`
- agent-security on `docs/ai-agents/**` security docs plus backend review-only agent with
  no file edits

## Forbidden Parallel Examples

- two docs agents both editing `docs/ai-agents/README.md`
- backend implementer and backend reviewer both editing the same backend branch
- frontend implementer and docs agent both changing the same frontend audit file
- two tools agents both editing `scripts/dev/**`

## Conflict Policy

Stop and re-coordinate when:

- two active tasks require the same file
- one task needs to broaden into another agent's live scope
- a review-only agent is asked to become mutating mid-stream without explicit reassigning
- rebasing or merge conflict resolution would require silent ownership override

## Resolution Options

- serialize the tasks
- split the file ownership more narrowly
- convert one agent to review-only
- create a follow-up task after the active PR merges
