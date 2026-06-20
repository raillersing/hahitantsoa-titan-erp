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
| Backend task starts without a skill plan | The agent jumps into implementation before selecting backend skills and a validation wrapper | `erp-backend-test-triage`, `erp-backend-pr-finalizer` | Backend Skill Plan in the prompt; `scripts/dev/erp-backend-fast`; `scripts/dev/erp-backend-ci` | The task prompt does not name the selected backend skills or validation plan | Pause, write the Backend Skill Plan first, then continue only after the relevant skills are selected |
| Focused tests pass but backend CI fails | Slice validation is green but the pre-PR backend wrapper catches Ruff, import, or broader quality issues | `erp-quality-gates`, `erp-backend-test-triage`, `erp-backend-pr-finalizer` | `scripts/dev/erp-backend-fast`; `scripts/dev/erp-backend-ci` | Only focused tests were used before PR readiness | Run the full backend CI wrapper before pushing and treat focused tests as necessary but not sufficient |
| Migration guard skipped | Model or schema work reaches PR review without the migration guard | `erp-migration-safety`, `erp-backend-migration-guardian`, `erp-backend-pr-finalizer` | `scripts/dev/erp-backend-migration-guard`; `scripts/dev/erp-backend-ci` | The task touches models, schema, or app registration without the guard | Stop, run the migration guard, and resolve any drift before continuing |
| PR merged without exact-SHA main CI verification | The merge is treated as complete before the exact merged commit is confirmed green on `main` | `erp-ci-workflow`, `erp-post-merge-cleanup`, `erp-backend-pr-finalizer` | `gh run list --branch main --event push --json databaseId,headSha --jq ...`; `gh run watch RUN_ID --interval 30` | The exact merge SHA was not verified green on `main` | Wait for the exact-SHA `main` run to succeed before moving to the next bundle |
| Skills selected but not used | The task plan names skills, but the implementation or review ignores them and falls back to generic behavior | `erp-backend-test-triage`, `erp-backend-pr-finalizer`, `erp-agent-role-assignment` | Backend Skill Plan in the prompt; backend productivity report after merge | The final report cannot show how the selected skills influenced the work | Record skill usage explicitly, then retrain the next prompt to pick only the skills that were actually needed |
| Focused pytest is green but backend quality still fails | Local focused tests pass, then PR CI fails on Ruff or import/order rules | `erp-quality-gates`, `erp-ci-workflow` | `scripts/dev/erp-backend-compose-ci run --rm backend python -m ruff check backend tests`; focused backend pytest command | Backend/tests changed but Ruff or backend quality was not run locally | Run Ruff plus focused tests before push; treat focused pytest as necessary but not sufficient |
| Using `jq` when unavailable instead of `gh --jq` | Finalization scripts fail in shells without `jq` | `erp-ci-workflow` | `gh run list --branch main --event push --json databaseId,headSha --jq ...` | A script depends on external `jq` for PR/CI state | Replace the command with native `gh --jq` output selectors |
| PR finalizer stops on an already merged PR | A resumed finalization step errors because the PR state is `MERGED` instead of `OPEN` | `erp-ci-workflow`, `erp-post-merge-cleanup` | `gh pr view PR-NUMBER --json state,headRefOid,baseRefName`; exact-SHA `gh run list ...`; `gh run watch RUN_ID --interval 30` | The recovery path would require re-merging, mutating code, or guessing the merged SHA | Continue with post-merge `main` CI verification and cleanup; do not re-run merge logic |
| Merge without CLEAN state or SHA protection | PR merges from the wrong commit or with stale head state | `erp-ci-workflow`, `erp-worktree-discipline` | `gh pr view PR-NUMBER --json headRefOid,mergeStateStatus`; `gh pr merge PR-NUMBER --squash --match-head-commit SHA` | `mergeStateStatus` is not `CLEAN`, or the head SHA does not match | Reconfirm the PR state, fetch the head SHA, and retry only with the exact commit |
| Skipping `main` CI after merge | Merge is treated as complete without post-merge validation | `erp-ci-workflow`, `erp-post-merge-cleanup` | `gh run list --branch main --event push --json databaseId,headSha --jq ...`; `gh run watch RUN_ID --interval 30` | Post-merge `main` CI has not been checked for the exact merged SHA | Wait for the exact `main` run to complete successfully before starting the next task |
| Unsafe branch deletion | Branch cleanup is attempted while the worktree is still registered or active | `erp-post-merge-cleanup`, `erp-worktree-discipline` | `bash scripts/dev/erp-worktree-clean-after-merge --apply branch-name`; `git worktree list --porcelain` | Worktree cleanup would require `rm -rf`, `gh pr merge --delete-branch`, or manual `.git/worktrees` deletion | Use the dedicated cleanup wrapper, then prune stale metadata only after registration is gone |
| Scope guard gaps or wrong profile | The wrong agent profile is used, or forbidden files leak into the diff | `erp-scope-guard-setup`, `erp-task-start` | `bash scripts/dev/erp-agent-scope-guard <profile>` | Scope guard reports forbidden paths for the active profile | Re-run with the correct profile and remove the offending paths before proceeding |
| Accidental backend/frontend/test mutation in docs/tooling tasks | Docs work unexpectedly changes code, tests, or `.github/` files | `erp-scope-guard-setup`, `erp-worktree-discipline` | `bash scripts/dev/erp-agent-scope-guard agent-docs`; `git diff --check` | Diff touches backend/, frontend/, tests/, scripts/dev/, or `.github/` during a docs task | Stop, revert the scope breach, and keep the task inside the docs-only surface |
| `vitest: not found` in clean worktrees | Frontend validation fails because `node_modules` is missing or incomplete after `git worktree add` | `erp-frontend-testing` (F152B) | `scripts/dev/erp-frontend-ci` (auto-runs `npm ci` when `node_modules/.bin/vitest` is missing) | Dependency manifests would be mutated outside the approved scope | Use the F152B wrapper — it detects missing deps and runs `npm ci` before validation |
| `.env` or secrets risk | A status or diff check reveals `.env`, key files, or secret-like paths | `erp-secret-handling`, `erp-scope-guard-setup` | `git status --short`; `git diff --check`; `scripts/dev/erp-secret-scan-local` | Any `.env`, `.env.*`, `.pem`, `.key`, token, or private key appears in scope | Stop immediately, do not open the file, and escalate for human-controlled handling |
| Pytest discovery or command mistakes | `python -m pytest` fails because the wrong interpreter or path setup was used | `erp-quality-gates`, `erp-task-start` | `scripts/dev/erp-backend-compose-ci ...`; `scripts/ci/backend-quality` | Host Python or a non-approved test command is being used | Re-run through the approved wrapper or compose path with the repo's environment |
| Docker/Compose cleanup drift | Agent CI containers, networks, or volumes pile up after validation | `erp-post-merge-cleanup`, `erp-quality-gates` | `bash scripts/dev/erp-docker-agent-cleanup --apply` | Cleanup would affect non-ERP containers or require destructive volume removal without approval | Use the dedicated cleanup wrapper and preserve volumes unless explicitly authorized |
| Task worktree is already gone before Docker cleanup | Post-merge cleanup cannot infer the old Compose project from a missing worktree path | `erp-post-merge-cleanup`, `erp-worktree-discipline` | `bash scripts/dev/erp-docker-agent-cleanup --project-name hahitantsoa-titan-erp-task-name`; `docker ps --filter label=com.docker.compose.project=...` | Project targeting is uncertain or could match non-ERP resources | Use explicit ERP worktree basename targeting only; if the project name is uncertain, stop rather than guessing |
| Intermittent GitHub TLS or GraphQL failures during finalization | `gh pr view`, `gh run list`, or `gh run watch` fails sporadically even though repo state is valid | `erp-ci-workflow` | Re-run the same `gh` command; if scripted, use retry-safe wrappers around `gh` | API failures persist and block verification of PR or CI state | Retry exact read-only GitHub checks first, then stop and report if verification still cannot be completed safely |
| API contract drift between backend and frontend | A frontend or backend change assumes an endpoint shape that was never confirmed | `erp-api-contracts`, `erp-security-review` | Confirm route/shape with serializers or contract tests; review the PR diff and endpoint name | The contract is not explicitly approved, or the change would invent a route/payload | Escalate the mismatch before implementation and keep the minimum approved repair only |
| Focused backend pytest passes but full backend quality fails | A slice-specific test looks green, but pre-PR Ruff or migration checks still fail | `erp-quality-gates`, `erp-ci-workflow` | `scripts/dev/erp-backend-fast tests/backend/path_or_module.py -q`; `scripts/dev/erp-backend-ci tests/backend/path_or_module.py -q` | Focused pytest was used without the full backend CI wrapper | Treat `erp-backend-fast` as a slice check only; run `erp-backend-ci` before push or PR |
| Backend migration drift is not caught before PR | Model or app-registration drift slips through until CI or merge time | `erp-migration-safety`, `erp-quality-gates` | `scripts/dev/erp-backend-migration-guard`; `scripts/dev/erp-backend-ci` | Models or migrations changed without the guard being run | Run the migration guard before PR and fix any drift before continuing |
| Migration, security, or payment-sensitive changes without appropriate review | A change touches models, auth, permissions, or payment flows without specialist review | `erp-migration-safety`, `erp-security-review`, `erp-quality-gates` | `python backend/manage.py makemigrations --check --dry-run`; focused security/permission tests | A model, permission, or payment-sensitive change lacks the required specialist review | Stop, assign the relevant reviewer role, and do not merge until the risk is covered |

## Usage Notes

- Use this matrix when the same class of workflow error repeats.
- If the failure is really about assigning the wrong agent family or missing a
  reviewer role, pair the matrix with `erp-agent-role-assignment` before changing
  the task plan.
- Prefer the preventive skill first, then the smallest required validation command.
- Treat hard stops as real stops, not suggestions.
- Keep the recovery action in the same approved scope; do not widen the task to solve the error by accident.
