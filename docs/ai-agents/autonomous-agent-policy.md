# Autonomous Agent Policy

## Purpose

This policy defines the allowed autonomy levels for orchestrated Codex execution.

## Level 0 - Plan Only

Allowed:

- read and analyze
- inspect diffs, CI, and docs
- propose bounded next steps

Forbidden:

- file edits
- commits
- pushes
- PR creation
- merges

Use case:

- Codex Plan mode
- early triage
- ambiguity reduction before mutation

## Level 1 - Mutating Bounded Task

Allowed:

- edit only within one approved worktree and one approved branch
- run approved validations
- commit, push, and open a PR only when the task authorizes it

Forbidden:

- scope expansion across worktrees
- automatic merge
- secret access

Use case:

- ordinary implementation slices
- docs-only tasks
- approved tooling tasks

## Level 2 - Pursue Goal Bounded Execution

Allowed only when the task defines all of:

- measurable outcome
- verification surface
- constraints
- boundaries
- iteration policy
- stop conditions
- required final report

Additional rules:

- commands must go through `scripts/dev/erp-logged-run`
- the agent may continue iterating until the bounded objective is satisfied
- no scope widening to "finish faster"
- no second worktree mutation

Use case:

- bounded backend or frontend completion work
- bounded docs or tooling completion work

## Level 3 - Conditional Auto-Repair

Allowed only for:

- CI failure
- lint failure
- test failure
- same-PR conflict repair

Restrictions:

- same PR only
- same approved scope only
- no feature expansion
- stop after 2 failed repair cycles
- human escalation required after repeated failure

## Level 4 - Auto-Merge

Default state:

- disabled

Future possibility only if all are true:

- docs-only and non-sensitive scope
- PR CI green
- scope guard passes
- no conflict
- no secret risk
- no backend/frontend/scripts/.github changes
- explicit written policy authorizes it

Current rule:

- auto-merge is not allowed

## Permanent Prohibitions

- auto-merge backend or frontend business changes
- auto-merge migrations
- auto-merge auth, permissions, or security changes
- auto-merge finance, payment, or invoicing changes
- auto-merge destructive data changes
- auto-merge `.github/workflows` changes
- read or expose `.env`
- use secrets
- remove a dirty worktree
- mutate multiple worktrees in one agent task
