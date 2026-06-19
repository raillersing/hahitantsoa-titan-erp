# F151D - Recurring Errors to Skills Matrix

## Purpose

This matrix maps the recurring ERP workflow errors that keep showing up in agent
sessions to the most relevant ERP skills, validation commands, prevention rules,
and hard stops.

## Current Skill Inventory

The current `.agents/skills/` inventory contains 21 skills:

- `erp-task-start`
- `erp-agent-role-assignment`
- `erp-agent-roles`
- `erp-api-contracts`
- `erp-business-boundaries`
- `erp-ci-workflow`
- `erp-frontend-accessibility-ux`
- `erp-frontend-api-contracts`
- `erp-frontend-error-recovery`
- `erp-frontend-performance-maintainability`
- `erp-frontend-scope-guard`
- `erp-frontend-state-forms`
- `erp-frontend-testing`
- `erp-frontend-typescript-quality`
- `erp-migration-safety`
- `erp-post-merge-cleanup`
- `erp-quality-gates`
- `erp-scope-guard-setup`
- `erp-secret-handling`
- `erp-security-review`
- `erp-worktree-discipline`

## Matrix

| Error pattern | Typical symptom | Preventive skill(s) | Required validation command(s) | Hard stop condition | Recovery action |
|---|---|---|---|---|---|
| `main` dirty before task start | Baseline check shows unexpected changes on `main` | `erp-task-start`, `erp-worktree-discipline` | `scripts/dev/erp-logged-run task-start <<'EOF' ... bash scripts/dev/erp-agent-task-start ... EOF` | Root worktree is dirty or baseline is not `main` | Stop, report the unexpected state, and wait for a clean baseline |
| Wrong worktree or stale worktree | Branch or path does not match the assigned task | `erp-task-start`, `erp-worktree-discipline` | `git worktree list --porcelain`; `git status --short` | Active branch/worktree mismatch, or another worktree owns the same branch | Switch to the correct worktree or stop and resolve ownership first |
| Touching paused or unrelated worktrees | Files appear under F147F, the identity-role-filter worktree, or another agent's scope | `erp-worktree-discipline`, `erp-scope-guard-setup` | `bash scripts/dev/erp-agent-scope-guard <profile>` | Any edit would cross into a paused or unrelated worktree | Abort the edit and move only within the assigned worktree |
| CI watched too early or interpreted too soon | PR checks are read while still pending and treated as final | `erp-ci-workflow` | `gh pr checks PR-NUMBER --watch --interval 30` | Required checks have not completed successfully | Keep waiting until every required check is `SUCCESS` |
| Backend CI duration misunderstood | A long-running backend job is mistaken for a hang | `erp-ci-workflow`, `erp-quality-gates` | `gh pr checks PR-NUMBER --watch --interval 30`; `gh run watch RUN_ID --interval 30` | Required backend quality job fails or is cancelled | Continue watching until terminal status is known, then fix only in scope or stop |
| Using `jq` when unavailable instead of `gh --jq` | Finalization scripts fail in shells without `jq` | `erp-ci-workflow` | `gh run list --branch main --event push --json databaseId,headSha --jq ...` | A script depends on external `jq` for PR/CI state | Replace the command with native `gh --jq` output selectors |
| Merge without CLEAN state or SHA protection | PR merges from the wrong commit or with stale head state | `erp-ci-workflow`, `erp-worktree-discipline` | `gh pr view PR-NUMBER --json headRefOid,mergeStateStatus`; `gh pr merge PR-NUMBER --squash --match-head-commit SHA` | `mergeStateStatus` is not `CLEAN`, or the head SHA does not match | Reconfirm the PR state, fetch the head SHA, and retry only with the exact commit |
| Skipping `main` CI after merge | Merge is treated as complete without post-merge validation | `erp-ci-workflow`, `erp-post-merge-cleanup` | `gh run list --branch main --event push --json databaseId,headSha --jq ...`; `gh run watch RUN_ID --interval 30` | Post-merge `main` CI has not been checked for the exact merged SHA | Wait for the exact `main` run to complete successfully before starting the next task |
| Unsafe branch deletion | Branch cleanup is attempted while the worktree is still registered or active | `erp-post-merge-cleanup`, `erp-worktree-discipline` | `bash scripts/dev/erp-worktree-clean-after-merge --apply branch-name`; `git worktree list --porcelain` | Worktree cleanup would require `rm -rf`, `gh pr merge --delete-branch`, or manual `.git/worktrees` deletion | Use the dedicated cleanup wrapper, then prune stale metadata only after registration is gone |
| Scope guard gaps or wrong profile | The wrong agent profile is used, or forbidden files leak into the diff | `erp-scope-guard-setup`, `erp-task-start` | `bash scripts/dev/erp-agent-scope-guard <profile>` | Scope guard reports forbidden paths for the active profile | Re-run with the correct profile and remove the offending paths before proceeding |
| Accidental backend/frontend/test mutation in docs/tooling tasks | Docs work unexpectedly changes code, tests, or `.github/` files | `erp-scope-guard-setup`, `erp-worktree-discipline` | `bash scripts/dev/erp-agent-scope-guard agent-docs`; `git diff --check` | Diff touches backend/, frontend/, tests/, scripts/dev/, or `.github/` during a docs task | Stop, revert the scope breach, and keep the task inside the docs-only surface |
| `.env` or secrets risk | A status or diff check reveals `.env`, key files, or secret-like paths | `erp-secret-handling`, `erp-scope-guard-setup` | `git status --short`; `git diff --check`; `scripts/dev/erp-secret-scan-local` | Any `.env`, `.env.*`, `.pem`, `.key`, token, or private key appears in scope | Stop immediately, do not open the file, and escalate for human-controlled handling |
| Pytest discovery or command mistakes | `python -m pytest` fails because the wrong interpreter or path setup was used | `erp-quality-gates`, `erp-task-start` | `scripts/dev/erp-backend-compose-ci ...`; `scripts/ci/backend-quality` | Host Python or a non-approved test command is being used | Re-run through the approved wrapper or compose path with the repo's environment |
| Docker/Compose cleanup drift | Agent CI containers, networks, or volumes pile up after validation | `erp-post-merge-cleanup`, `erp-quality-gates` | `bash scripts/dev/erp-docker-agent-cleanup --apply` | Cleanup would affect non-ERP containers or require destructive volume removal without approval | Use the dedicated cleanup wrapper and preserve volumes unless explicitly authorized |
| API contract drift between backend and frontend | A frontend or backend change assumes an endpoint shape that was never confirmed | `erp-api-contracts`, `erp-security-review` | Confirm route/shape with serializers or contract tests; review the PR diff and endpoint name | The contract is not explicitly approved, or the change would invent a route/payload | Escalate the mismatch before implementation and keep the minimum approved repair only |
| Migration, security, or payment-sensitive changes without appropriate review | A change touches models, auth, permissions, or payment flows without specialist review | `erp-migration-safety`, `erp-security-review`, `erp-quality-gates` | `python backend/manage.py makemigrations --check --dry-run`; focused security/permission tests | A model, permission, or payment-sensitive change lacks the required specialist review | Stop, assign the relevant reviewer role, and do not merge until the risk is covered |

## Usage Notes

- Use this matrix when the same class of workflow error repeats.
- If the failure is really about assigning the wrong agent family or missing a
  reviewer role, pair the matrix with `erp-agent-role-assignment` before changing
  the task plan.
- Prefer the preventive skill first, then the smallest required validation command.
- Treat hard stops as real stops, not suggestions.
- Keep the recovery action in the same approved scope; do not widen the task to solve the error by accident.
