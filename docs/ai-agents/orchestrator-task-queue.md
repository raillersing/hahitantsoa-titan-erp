# Orchestrator Task Queue

## Current State

- `main` includes F137B at merge commit `b9dab44`, F145B at commit `27973be`, F147B at merge commit `26ba1de`, F147C at merge commit `b148de9`, F147D at merge commit `50ec2b0`, the original F148A completion audit at `b5c8dca` (PR #264), F148B at `c8ba67b` (PR #265), F148C at `dbe03ce` (PR #266), F148D at `f355def` (PR #267), F148E at `2d96134` (PR #268), and F148A Claude Code governance at `3b9835c` (PR #269).
- Current `origin/main` HEAD is `298abf3` (Merge pull request #271, F148F campaign plan).
- F148B Claude tooling guard alignment is open as PR #270 on branch `chore/f148b-claude-tooling-guard-alignment`.
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

### F147D

Status:
- completed agents/docs governance task
- baseline: origin/main at 9551caa
- branch: tools/f147d-agent-docs-scope-guard
- scope: add agent-docs profile to erp-agent-scope-guard

Scope delivered:
- scripts/dev/erp-agent-scope-guard — added agent-docs case with check_blocked + check_allowed_only
- docs/audits/F147D_AGENT_DOCS_SCOPE_GUARD_PROFILE.md — audit note
- Profile allows: docs/ai-agents/, docs/audits/, opencode.json, .opencode/
- Profile forbids: backend/, frontend/, tests/, scripts/dev/, .github/, .env*, secrets, dependency manifests

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — correctly blocks script changes
- bash scripts/dev/erp-agent-scope-guard agent-tools — passes for this PR
- git diff --check — PASS
- PR CI green before merge
- main CI green after merge

### F148A

Status:
- merged as PR #269
- baseline: origin/main at `2d96134`
- branch: `docs/f148a-claude-code-project-integration` (merged)
- scope: Claude Code project integration and governance

Scope delivered:
- `CLAUDE.md` — Claude Code workflow instructions
- `.claude/settings.json` — Claude Code project settings
- `docs/ai-agents/tooling/claude-code-orchestration.md` — Claude Code orchestration documentation
- `docs/ai-agents/orchestrator-task-queue.md` — updated

Validation:
- PR CI green (both Backend quality and Frontend quality passed)
- main CI green after merge
- No backend, frontend, test, or script files modified

### F148B

Status:
- open PR — awaiting human merge
- baseline: origin/main at `3b9835c`
- branch: `chore/f148b-claude-tooling-guard-alignment`
- worktree: `/home/raillersing/projects/hahitantsoa-titan-erp-f148b-claude-tooling-guard`
- scope: align Claude Code tooling guards

Scope delivered:
- `scripts/dev/erp-agent-scope-guard` — updated to allow `.claude/` and `CLAUDE.md` paths
- `scripts/dev/erp-pr-worktree-finalize` — minor alignment
- `docs/ai-agents/tooling/claude-code-orchestration.md` — updated
- `docs/ai-agents/orchestrator-task-queue.md` — updated

Validation:
- PR CI pending — awaiting human merge

### F148B

Status:
- merged as PR #265
- baseline: origin/main at 50ec2b0 (main has advanced since)
- branch: docs/f148a-completion-audit (merged as F148B on same branch)
- scope: add safe worktree PR finalization wrapper

Scope delivered:
- scripts/dev/erp-pr-worktree-finalize — worktree-safe PR finalization script
- docs/ai-agents/agent-command-runbook.md — updated with worktree finalization section
- docs/audits/F148B_SAFE_WORKTREE_PR_FINALIZATION.md — audit note

### F148C

Status:
- merged as PR #266
- baseline: origin/main at c8ba67b
- branch: tools/f148c-finalizer-validation (merged)
- scope: validate and harden the worktree PR finalization wrapper

Scope delivered:
- scripts/dev/erp-pr-worktree-finalize — hardened with pending-checks guard,
  branch-uniqueness check, worktree-removal safety (cd to REPO_ROOT after remove),
  and root-worktree refusal
- docs/ai-agents/agent-command-runbook.md — updated worktree finalization section
  with clarified execution context, one-task-one-branch enforcement, simplified
  default invocation
- docs/audits/F148C_FINALIZER_VALIDATION.md — audit note
- F148C runbook documented safe PR validation: materialise-to-tempfile before bash,
  scoped grep for --delete-branch

Validated findings:
- Pending checks bug: statusCheckRollup filter excluded null-conclusion checks,
  allowing merge while CI still running (FIXED: explicit pending check added)
- Orphaned worktree: final git commands ran from removed worktree directory
  (FIXED: cd to REPO_ROOT before branch deletion and status)
- Root-only rule: runbook said only root/main may merge (FIXED: added exception
  for worktree finalization wrapper)
- One-task-one-branch: no cross-worktree check existed
  (FIXED: branch-uniqueness check added before merge)

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-tools — PASS
- bash scripts/dev/erp-pr-worktree-finalize --help — shows usage
- git diff --check — PASS
- PR CI green before merge

### F148D

Status:
- merged as PR #267
- baseline: origin/main at dbe03ce
- branch: docs/f148d-opencode-backend-dry-run (merged)
- scope: OpenCode backend orchestrator dry-run audit (docs-only while Codex is active on F145H)

Scope delivered:
- docs/audits/F148D_OPENCODE_BACKEND_ORCHESTRATOR_DRY_RUN.md — comprehensive dry-run audit
  covering main state, active worktrees, F148A backend findings, safe next bundles,
  recommended next bundle (F145I billing), OpenCode role assessment, risks/stops
- docs/ai-agents/orchestrator-task-queue.md — updated (F148C→merged, F148D→open)
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

### F148E

Status:
- merged as PR #268
- baseline: origin/main at `f355def`
- branch: `docs/f148e-opencode-frontend-dry-run` (merged)
- scope: OpenCode frontend orchestrator dry-run audit (docs-only while Antigravity is active on F147F)

Scope delivered:
- docs/audits/F148E_OPENCODE_FRONTEND_ORCHESTRATOR_DRY_RUN.md — comprehensive dry-run audit
  covering main state, active worktrees, F148A frontend findings, safe next bundles,
  recommended next bundle (F147G wire 3 pending panels), OpenCode role assessment, risks/stops
- docs/ai-agents/orchestrator-task-queue.md — updated (F148D→merged, F148E→open)
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

### F148F

Status:
- open PR — awaiting human merge
- baseline: origin/main at `3b9835c`
- branch: `docs/f148f-campaign-plan`
- scope: docs-only campaign plan + queue refresh (first bundle of docs-only campaign)

Scope delivered:
- `docs/audits/F148F_DOCS_ONLY_CAMPAIGN_PLAN.md` — campaign plan: discovery, bundling, execution order, hard stops
- `docs/ai-agents/orchestrator-task-queue.md` — updated (F148A→merged, F148B→open, F148C/D/E→merged, HEAD→3b9835c)
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

### F148G

Status:
- open PR — awaiting human merge
- baseline: origin/main at `298abf3`
- branch: `docs/f148g-production-readiness`
- scope: production readiness / QA infrastructure audit (docs-only, second bundle of campaign)

Scope delivered:
- `docs/audits/F148G_PRODUCTION_READINESS_AUDIT.md` — audit of QA gaps: no conftest/fixtures,
  no E2E tests, no coverage, no tsc in CI, no production deployment config, no CI concurrency,
  no pre-commit hooks, no secret scanning in CI
- No backend, frontend, test, script, or .github files modified

Validation:
- bash scripts/dev/erp-agent-scope-guard agent-docs — PASS
- git diff --check — PASS
- Confirmed no forbidden mutations

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
