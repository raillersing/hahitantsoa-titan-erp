# Orchestrator Task Queue

## Current State

- `main` includes F137B at merge commit `b9dab44`.
- Human merge control remains mandatory.
- Agent prompts should use the official runbook and this queue instead of repeating long
  procedural instructions.
- The script wrappers from F138B/F138C are mandatory only after that PR is merged.

## Active Backend Task

### F135B

Status:
- active backend task

Scope:
- private reservation confirmation API only
- backend-focused implementation and validation
- no frontend feature broadening

Expected worktree:
- backend-dedicated worktree only

Stop conditions:
- any required change in `frontend/`
- any need to inspect or use `.env`
- any unapproved contract, payment, or document workflow expansion
- any migration or endpoint broadening beyond approved F135B scope

Expected validation:
- backend static checks
- backend focused tests
- `git diff --check`
- PR CI green before merge
- main CI green after merge

## Frontend Next Task

### F137C

Status:
- next frontend task

Scope:
- continue the frontend delivery sequence after F137B
- stay inside approved frontend files and approved backend contracts

Expected worktree:
- frontend-dedicated worktree only

Stop conditions:
- any required backend code change
- any `.env` interaction
- any public document URL, storage-path exposure, or unapproved API invention

Expected validation:
- frontend tests
- frontend build
- `git diff --check`
- PR CI green before merge
- main CI green after merge

## Frontend Follow-Up Queue

### F137D

Status:
- queued after F137C

Scope:
- frontend-only continuation
- exact scope must be restated in the task prompt before implementation

Stop conditions:
- any backend dependency that is not already approved
- any cross-worktree contamination

Expected validation:
- frontend-focused checks only unless the approved scope says otherwise

### F137E

Status:
- queued after F137D

Scope:
- frontend-only continuation
- keep the Titan boundary and approved backend contract constraints intact

Stop conditions:
- same stop conditions as F137D unless the approved task says otherwise

Expected validation:
- frontend-focused checks only unless the approved scope says otherwise

## Later Repair Track

### F138E

Status:
- planned repair or recovery track after the current orchestration foundation work

Purpose:
- resume or repair any lingering workflow or WIP reliability issues not solved by
  F138B/F138C/F138D

Scope:
- smallest safe workflow or documentation repair only
- no opportunistic feature expansion

Stop conditions:
- any attempt to convert the repair track into product feature work
- any change outside the explicitly approved repair surface

Expected validation:
- focused workflow checks
- `git diff --check`
- PR CI green when code or workflow files require it

## Worktree Separation Rules

- backend task work happens in the backend worktree only
- frontend task work happens in the frontend worktree only
- agent-tools and agent-docs work happen in their own dedicated worktrees only
- never mix F135B and F137C edits in one branch
- never fix unrelated WIP while delivering the active task

## Standard Orchestrator Stops

Stop immediately and ask for human direction when:

- the active worktree is not the expected one
- the branch does not match the assigned task
- forbidden files appear in diff or status
- the task would require reading or using `.env`
- CI fails for a reason that would broaden the task beyond approved scope
- local state shows unrelated user changes that conflict with the task

## Validation Policy

For every task:

- run the baseline branch and status check first
- keep the diff scoped and reviewable
- run the smallest relevant local checks
- open a PR only when authorized
- do not merge automatically
- verify PR CI before merge
- verify `main` and main CI after merge

After merge of F138B/F138C, the default orchestrator preflight becomes:

- `scripts/dev/erp-worktree-preflight`
- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-backend-compose-ci` for backend DB-backed local validation

## Queue Update Rule

Update this document when one of these changes occurs:

- the active task changes
- the next frontend task changes
- a task is merged and the queue advances
- a repair track becomes necessary
- the required standard wrappers or gates change
