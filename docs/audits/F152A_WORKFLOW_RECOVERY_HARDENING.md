# F152A - Workflow Recovery Hardening

## Scope

F152A is an agent-tools/docs hardening bundle derived from the recurring failures seen
while finalizing PR #318.

Allowed mutable scope:

- `scripts/dev/erp-pr-worktree-finalize`
- `scripts/dev/erp-docker-agent-cleanup`
- `scripts/dev/erp-agent-scope-guard`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/audits/F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md`
- `docs/ai-agents/orchestrator-task-queue.md`

No product code, frontend code, backend code, tests, `.github/`, dependency manifests,
or secrets are touched.

## Triggering Failures

Observed recurring failures:

1. Focused backend pytest was green, but PR CI still failed on Ruff quality gates.
2. PR finalization stopped incorrectly when the PR was already `MERGED`.
3. Docker cleanup could not target the old task resources after the worktree was already
   absent.
4. Root `main` contained unrelated dirty docs state before new work started.
5. GitHub CLI checks experienced intermittent TLS or GraphQL failures that needed
   retry-safe handling.

## Changes

### 1. Docker cleanup recovery is now project-name aware

Source:

- [erp-docker-agent-cleanup](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/scripts/dev/erp-docker-agent-cleanup)

Hardening:

- Cleanup now defaults to the active worktree basename, which matches Docker Compose's
  default project naming in ERP worktrees.
- Added `--project-name <name>` so operators can safely target the former task worktree
  basename after the worktree is already gone.
- Added ERP-only validation so non-ERP Compose projects are refused.
- `docker compose down` now uses `-p "$COMPOSE_PROJECT"` for exact targeting.

Result:

- Cleanup can be resumed safely from another ERP worktree without guessing labels or
  touching unrelated Docker resources.

### 2. PR finalization now supports already-merged recovery

Source:

- [erp-pr-worktree-finalize](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/scripts/dev/erp-pr-worktree-finalize)

Hardening:

- The finalizer now accepts PR state `MERGED` as a valid recovery path.
- Mergeability checks run only when the PR is still `OPEN`.
- The script continues into exact-SHA `main` CI verification and cleanup when merge work
  is already complete.
- Docker cleanup is now called with the explicit task worktree project name before
  worktree removal.
- Added retry-safe GitHub CLI handling for metadata lookup and CI verification commands.
- Updated post-merge `gh run watch` cadence to `--interval 30`.

Result:

- A resumed post-merge session no longer fails just because the PR is already merged.

### 3. Root dirty-state preflight is now explicit

Source:

- [agent-command-runbook.md](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/docs/ai-agents/agent-command-runbook.md)

Hardening:

- Added a root dirty-state preflight rule that treats unrelated dirty or untracked files
  on root `main` as a hard stop before starting or resyncing task worktrees.

Result:

- Future tasks have an explicit baseline gate instead of relying on memory or ad hoc
  operator judgment.

### 4. Backend quality guidance now reflects the real gate

Source:

- [agent-command-runbook.md](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/docs/ai-agents/agent-command-runbook.md)
- [F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/docs/audits/F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md)

Hardening:

- The runbook now states that focused pytest is not enough when `backend/` or
  `tests/backend/` changes.
- Added the minimum approved pre-push combination: Ruff plus focused backend pytest.
- Added the PR #318 lesson to the recurring-errors matrix.

Result:

- Agents have a clearer local quality bar before push, reducing avoidable CI churn.

### 5. Queue and recurring-error routing updated

Source:

- [F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/docs/audits/F151D_RECURRING_ERRORS_TO_SKILLS_MATRIX.md)
- [orchestrator-task-queue.md](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/docs/ai-agents/orchestrator-task-queue.md)

Hardening:

- Added PR #318-specific recurring error patterns:
  - focused pytest green but Ruff failed
  - already-merged PR finalization recovery
  - missing worktree Docker cleanup recovery
  - transient GitHub API/TLS failures
- Recorded F152A as the active workflow-improvement bundle in the queue.

### 6. Scope guard now validates mixed governance bundles explicitly

Source:

- [erp-agent-scope-guard](/home/raillersing/projects/hahitantsoa-titan-erp-f152a-workflow-recovery-hardening/scripts/dev/erp-agent-scope-guard)

Hardening:

- The `agent-docs` profile now allows the narrow ERP workflow helper surface
  `scripts/dev/erp-*` plus `compose.agent-ci.yaml` for combined docs/tooling governance
  bundles.
- Backend, frontend, tests, `.github/`, dependency manifests, `.env`, and secret-like
  files remain forbidden.

Result:

- The required dual validation for agent-tools plus agent-docs can succeed on approved
  mixed governance bundles without broadening into product-code scope.

## Expected Outcome

After F152A:

- post-merge cleanup is safer and more resumable
- backend pre-push validation guidance matches actual CI behavior
- root dirty-state is treated as a first-class preflight gate
- recurring GitHub CLI verification failures have a documented retry-safe path

## Remaining Limits

- F152A does not change product behavior.
- F152A does not authorize deletion of non-ERP Docker resources.
- If the exact former ERP project name is unknown, Docker cleanup still must stop rather
  than guess.
