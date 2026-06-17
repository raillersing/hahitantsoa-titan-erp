# Orchestrator Task Queue

## Current State

- `main` includes F137B at merge commit `b9dab44`, F145B at commit `27973be`, and F147B at merge commit `26ba1de`.
- Current `origin/main` HEAD is `84a76ea` (Merge pull request #259).
- Human merge control remains mandatory.
- Agent prompts should use the official runbook and this queue instead of repeating long
  procedural instructions.
- The script wrappers from F138B/F138C are mandatory only after that PR is merged.

## Active Backend Task

### F145A

Status:
- active backend task

Scope:
- source-traced commercial operations completion plan only
- docs/task-queue updates only
- no backend business-code implementation
- no frontend modification

Expected worktree:
- backend-dedicated worktree only

Stop conditions:
- any required frontend change
- any required backend business-code implementation
- any need to inspect or use `.env`
- any missing legal/fiscal/business source that would force invention
- any touch to F140D, quarantine, or unrelated worktrees

Expected validation:
- `git diff --check`
- `bash scripts/dev/erp-task-queue-validate` when queue changes
- docs validation when present
- Agent F docs review
- Agent B final review
- PR CI green before merge
- main CI green after merge

## Backend Next Task

### F145B

Status:
- next backend task after F145A approval

Scope:
- documents runtime and commercial artifact completion
- backend-only implementation
- no frontend modification

Expected worktree:
- backend-dedicated worktree only

Stop conditions:
- any required frontend change
- any fiscal/payment rule invention
- any `.env` interaction
- any scope drift into logistics, payment, returns, or unrelated frontend work

Expected validation:
- backend-focused quality checks
- focused document/runtime tests
- `git diff --check`
- PR CI green before merge
- main CI green after merge

## Backend Follow-Up Queue

### F145C

Status:
- queued after F145B

Scope:
- billing and payment foundation
- backend-only implementation

### F145D

Status:
- queued after F145C

Scope:
- stock movement and logistics foundation
- backend-only implementation

### F145E

Status:
- queued after F145D

Scope:
- returns and damage/loss foundation
- backend-only implementation

### F145F

Status:
- active backend task after F145E

Scope:
- damage/loss settlement foundation
- backend-only implementation

### F145G

Status:
- active backend task after F145F

Scope:
- damage/loss settlement execution foundation
- backend-only implementation

### F145H

Status:
- queued after F145G

Scope:
- caution refund execution and excess invoice foundations
- backend-only implementation

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

## Agents/Docs Governance Queue

### F147B

Status:
- merged
- baseline: origin/main at db9fd45
- branch: docs/f147b-orchestrator-compliance-smoke-test (merged as PR #253)
- scope: orchestrator compliance smoke test, docs/audits audit file, task queue update

Result:
- PASS across all compliance checkpoints
- gap identified: erp-agent-scope-guard lacks a dedicated `agent-docs` profile
- agent-command-runbook.md reviewed — no correction needed

### F147C

Status:
- completed agents/docs governance task
- baseline: origin/main at 84a76ea
- branch: docs/f147c-opencode-project-config
- scope: OpenCode project config with adapter agents, commands, and permissions

Scope delivered:
- opencode.json — updated with agent/command/permission config
- .opencode/agents/ — backend-orchestrator, frontend-orchestrator, docs-agent, review-agent adapters
- .opencode/commands/ — task-start, worktree-preflight, pr-create commands
- All agents reference existing docs/ai-agents contracts — no duplication
- Permissions default to ask/deny for risky actions
- No automatic merge

Expected validation:
- git diff --check
- PR CI green before merge
- main CI green after merge

### F147D (recommended next safe bundle)

Status:
- recommended next agents/docs governance task after F147C merge

Scope:
- add `agent-docs` profile to erp-agent-scope-guard
- profile should allow: `docs/ai-agents/`, `docs/audits/`
- profile should forbid: `backend/`, `frontend/`, `.env` and secret-like files
- no other scope expansion

Expected worktree:
- agent-tools or agent-docs dedicated worktree only

Stop conditions:
- any backend or frontend code change
- any scope drift beyond the scope guard change
- any .env interaction

Expected validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs
- git diff --check
- PR CI green before merge
- main CI green after merge

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
