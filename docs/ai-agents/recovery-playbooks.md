# Recovery Playbooks

## Purpose

These playbooks define how to recover from interrupted or partial agent operations
without widening scope or touching secrets.

Use prompt setup together with
[`prompt-contracts/agent-prompt-procedure.md`](prompt-contracts/agent-prompt-procedure.md)
so recovery tasks explicitly declare worktree, dirty-state policy, command mode, and stop
conditions before execution.

Always use:

```sh
scripts/dev/erp-logged-run task-recovery <<'EOF'
set -euo pipefail
commands
EOF
```

Never recover by improvising destructive Git commands. Never read, source, print, copy,
or create `.env`.

## Common First Step

Before any recovery action:

1. verify the current worktree and branch;
2. print `git status --short`;
3. print the recent log;
4. re-check the approved scope;
5. stop if `.env` or secret-like paths appear.

Recommended baseline:

```sh
scripts/dev/erp-logged-run recovery-baseline <<'EOF'
set -euo pipefail

pwd
git branch --show-current
git status --short
git log --oneline --decorate -8
scripts/dev/erp-worktree-list-validated
EOF
```

## Connection Cut During Task

Symptoms:

- terminal session interrupted;
- branch exists but task state is uncertain;
- local files may already be edited.

Recovery:

1. run the common first step;
2. inspect `git diff --name-only origin/main...HEAD`;
3. re-run the relevant scope and preflight checks;
4. resume only if branch, worktree, and file scope still match the task.

If the task is backend after F138B/F138C merge:

- run `scripts/dev/erp-worktree-preflight backend`
- run `scripts/dev/erp-agent-scope-guard backend`
- run `scripts/dev/erp-backend-compose-ci config --quiet`

If the task is frontend after F138B/F138C merge:

- run `scripts/dev/erp-worktree-preflight frontend`
- run `scripts/dev/erp-agent-scope-guard frontend`

## PR Merged But Branch Deletion Failed

Symptoms:

- PR is merged;
- CI on `main` is green;
- branch or worktree still exists locally.

Recovery:

1. confirm merge commit and main CI;
2. run `scripts/dev/erp-worktree-clean-after-merge branch-name` in dry-run mode;
3. if the target worktree is clean, rerun with `--apply`;
4. if branch deletion still fails, inspect whether another worktree still owns the branch.

Stop if:

- the worktree is dirty;
- the target branch is still active in the current shell;
- the merge into `origin/main` is not confirmed.

If the old worktree directory still exists but `git worktree list` no longer shows it, use:

- `scripts/dev/erp-worktree-clean-after-merge --orphan-path /path/to/worktree branch-name`

Use this only when:

- the PR merge is confirmed;
- `main` CI is green;
- the orphan path is not a registered worktree anymore;
- the path still contains a stale `.git` file pointing to missing worktree metadata.

## Branch Already In Use By Another Worktree

Symptoms:

- `git branch -d` fails because the branch is checked out elsewhere;
- `git worktree add` or reuse fails because the branch is already in use.

Recovery:

1. run `scripts/dev/erp-worktree-list-validated`;
2. identify the owning worktree path;
3. stop and coordinate cleanup or handoff;
4. do not force-delete the branch.

Safe follow-up:

- remove the old worktree only when it is clean and human-approved;
- otherwise keep the branch and worktree intact.

If the branch ownership conflict appears during PR merge/finalization:

- stop any temporary-worktree merge attempt immediately
- return to `/home/raillersing/projects/hahitantsoa-titan-erp` on branch `main`
- finalize only with `scripts/dev/erp-pr-finalize-from-root`
- let that helper remove the task worktree and delete the task branch only after green
  `main` CI

## Worktree Permission Denied

Symptoms:

- `git worktree remove` fails with permission denied;
- shell, editor, or OS process still holds the directory;
- filesystem access is blocked.

Recovery:

1. stop the cleanup attempt;
2. close the shell, editor, or process using the worktree;
3. rerun `scripts/dev/erp-worktree-clean-after-merge branch-name` in dry-run mode;
4. rerun with `--apply` only after the path is accessible.

Never bypass this with destructive filesystem deletion.

If the permission-denied failure already caused Git to drop the worktree registration while
leaving the directory behind, switch to the orphan-path recovery above instead of retrying
manual deletion loops.

## Backend WIP Behind `origin/main`

Symptoms:

- backend worktree branch is behind current `origin/main`;
- local backend task was started from an older base;
- merge conflicts or stale assumptions are likely.

Recovery:

1. stop feature editing;
2. fetch `origin/main`;
3. inspect divergence and current diff;
4. ask whether the task should rebase, merge `origin/main`, or be restarted from a fresh
   branch;
5. resume only with explicit approval.

Do not silently rewrite or reset a backend WIP branch.

## Stop On `.env` Or Secrets

Symptoms:

- `.env`, `.env.*`, `.pem`, `.key`, `id_rsa`, or `id_ed25519` appears in status, diff, or
  requested scope;
- a prompt requests reading or copying secrets;
- a command sequence would require `source .env`.

Recovery:

1. stop immediately;
2. report the exact path pattern that triggered the stop;
3. do not open the file;
4. ask for a scope-safe alternative or human intervention;
5. continue only when the task no longer requires secret interaction.

## Untracked Audit Report Handling

Symptoms:

- a task generates an audit report in `docs/audits/` that is untracked
- the task prompt forbids committing the report
- the report contains findings that should influence future work

Recovery:

1. confirm the report file is listed in `git status --short` as untracked (`??`)
2. do not stage or commit the report unless explicitly authorized
3. if the report contains actionable findings, promote each finding to:
   - a task description in the orchestrator queue, or
   - a docs change in the appropriate runbook or procedure, or
   - a script enhancement
4. leave the report untracked if no promotion is required and the prompt forbids commit
5. do not delete the report without human approval — deletion counts as mutation

Stop if:

- the report contains secrets or credentials (treat as secret exposure)
- the prompt explicitly forbids both promotion and retention

## Post-Recovery Exit Criteria

A recovery attempt is complete only when:

- the correct worktree and branch are confirmed;
- status and scope are understood;
- no secret-like path is in play;
- the next action is explicit and logged;
- no destructive cleanup remains pending without approval.
