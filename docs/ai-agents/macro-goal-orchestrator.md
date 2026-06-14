# Macro-Goal Orchestrator

## Core rule

A macro-goal never modifies code directly. It creates a plan and a queue of micro-tasks.

The orchestrator owns the shared planning files, delegates bounded work to specialized
agents, waits for review and CI gates, then updates state before selecting the next
micro-task.

## Purpose

Use this workflow when the request is larger than one bounded PR, for example:

- "Finalize the backend"
- "Finalize the frontend"
- "Finish the reservations module"
- "Bring the current WIP branches back to a safe baseline"

## Full cycle

1. Macro-goal intake
   - assign a stable macro-goal ID
   - capture goal statement, domain, desired outcome, and explicit constraints
   - select allowed agent types and maximum autonomy level
2. Context audit
   - inspect `origin/main`, current worktrees, open PRs, and last green `main` CI
   - inspect shared workflow docs such as `orchestrator-state.md`,
     `orchestrator-task-queue.md`, `parallel-agent-policy.md`, and recovery playbooks
   - stop if the worktree baseline, scope, or secret policy is violated
3. Plan generation
   - convert the macro-goal into a non-speculative execution method
   - separate known tasks from unknown tasks that require audit first
   - identify prerequisites such as `F138E`, `F135B`, or backend API availability
4. Task queue creation
   - create or update micro-task records using the official queue schema
   - assign one worktree, one branch, one agent type, and one allowed scope per
     micro-task
   - keep shared index files under orchestrator ownership
5. Delegation
   - send a short prompt that references the runbook, prompt contracts, queue item, and
     required scripts
   - delegate only one mutable scope per implementing agent
   - use review-only agents when overlap would otherwise occur
6. Review-only gate
   - require an independent review before merge readiness for backend and frontend
   - collect findings, resolutions, and residual risks in the delegated task report
7. Merge gate
   - require PR CI green and `mergeable` status before a human merges
   - stop if the PR has conflicts, failing checks, or scope drift
8. Main CI gate
   - wait for `main` CI after merge
   - stop if the merged commit does not become green on `main`
9. State update
   - update the orchestrator ledger and queue status
   - update shared docs only after the current micro-task reaches a safe state
10. Next task selection
   - pick the next ready micro-task whose dependencies are satisfied
   - prefer tasks that unblock suspended backend or frontend flows
11. Stop conditions
   - stop on secret-like files, `.env` paths, forbidden scope changes, blocked CI,
     ambiguous contracts, overlapping mutable globs, or repeated failed repair cycles

## Ownership model

- The orchestrator owns macro-goal planning documents, the global queue format, and the
  action ledger.
- Specialized agents own their delegated branch and bounded file globs only.
- Shared index files such as `docs/ai-agents/README.md` stay single-writer files.

## Required inputs

- macro-goal contract
- latest `origin/main` HEAD
- validated worktree list
- open PR inventory
- last green `main` CI
- active backend/frontend/docs/tools state

## Required outputs

- approved macro-goal record
- micro-task queue entries
- delegation packet per assigned agent
- ledger update after each significant state change
- final macro-goal status: active, paused, blocked, or completed

## Review and merge policy

- backend and frontend implementation tasks require independent review before merge
- docs and tools tasks may use lighter review when explicitly authorized
- human merge remains mandatory; no global auto-merge policy is introduced by F139

## Relationship with F138

F139 depends on the F138 foundation:

- worktree lifecycle and recovery
- secret hygiene
- prompt contracts and autonomy boundaries
- review-only workflow
- parallelism rules
- official wrappers in `scripts/dev`

F139 adds orchestration on top of that foundation rather than replacing it.
