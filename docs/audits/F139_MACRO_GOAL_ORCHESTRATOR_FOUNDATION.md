# F139 Macro-Goal Orchestrator Foundation

## Why F139 is needed

F138 established the local safety rails, worktree hygiene, secret hygiene, prompt
contracts, review-only mode, and parallelism policy. It did not yet define how an
orchestrator should receive a large goal, decompose it, delegate it, and track it over
multiple PRs.

F139 adds that missing orchestration layer.

## What F139 adds

- a macro-goal lifecycle document
- a versioned macro-goal contract
- a delegation protocol for specialized agents
- a required micro-task queue schema
- an orchestrator action ledger
- initial non-definitive backend and frontend completion plans
- non-destructive scripts to inspect orchestrator state and validate queue structure

## How it builds on F138

F139 reuses the F138 foundations rather than duplicating them:

- `erp-worktree-preflight`, `erp-agent-scope-guard`, and `erp-backend-compose-ci`
- secret handling policy
- recovery playbooks
- autonomy levels and pursue-goal contract
- review-only workflow
- parallel agent policy

The orchestrator should reference those documents instead of restating them in long
prompts.

## Expected usage

1. Create or select a macro-goal such as `MG-BACKEND-FINALIZATION` or
   `MG-FRONTEND-FINALIZATION`.
2. Run `scripts/dev/erp-orchestrator-state-check`.
3. Prepare or update the macro-goal plan and queue items.
4. Validate the queue format with `scripts/dev/erp-task-queue-validate`.
5. Delegate one bounded micro-task to one specialized agent.
6. Wait for review-only, PR CI, human merge, and `main` CI gates before advancing the
   ledger.

## Stop conditions

F139 explicitly requires the orchestrator to stop when:

- `.env` or secret-like paths appear
- mutable globs overlap
- queue ownership becomes ambiguous
- recovery would require destructive cleanup
- review or CI gates fail and the failure is outside the approved micro-task scope

## Limits

- no global auto-merge is introduced
- no autonomous bypass of human merge exists
- backend and frontend work remain delegated, not directly implemented by the
  orchestrator
- macro-goal plans are intentionally non-definitive until audits confirm actual code
  state

## Multi-agent compatibility

F139 is compatible with parallel work only when mutable globs do not overlap. Shared
index files remain single-writer files under orchestrator control unless reassigned in a
later dedicated task.
