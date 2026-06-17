# Agent Command Runbook

Repo-scoped Codex skills under [`.agents/skills/`](../../.agents/skills) may accelerate
repetitive Codex tasks, but this runbook remains the canonical command source of truth.
Cross-agent bridges live in [tooling/antigravity-workflow.md](tooling/antigravity-workflow.md),
[tooling/opencode-workflow.md](tooling/opencode-workflow.md), and
[cross-agent-compatibility.md](cross-agent-compatibility.md).

## Purpose

This runbook defines the standard command patterns for ERP agent tasks.

These commands assume a native WSL/bash execution context unless a task explicitly
documents an approved Windows-to-WSL bridge mode.

The assigned execution profile must come from
[`agent-profiles.md`](agent-profiles.md), not from agent self-inference.

Task-start baseline is part of the task itself. No separate human pre-baseline command
should be required before every prompt.

Always run important terminal work through:

```sh
scripts/dev/erp-logged-run task-name <<'EOF'
commands
EOF
```

Do not replace this heredoc workflow with inline `bash -c`.

If the agent is already inside WSL, do not wrap commands with `wsl`, `wsl.exe`,
`wsl -d`, PowerShell, `cmd.exe`, or Windows path indirection.

If the agent is Windows-hosted and no approved bridge mode is explicitly authorized,
remain plan-only and propose the WSL heredoc commands for the human supervisor instead of
executing them.

Before trusting static queue or state docs, run a live baseline using the relevant subset
of:

- `git fetch origin --prune`
- `git log --oneline --decorate -8`
- `git status --short`
- `gh pr list`
- `bash scripts/dev/erp-orchestrator-state-check`
- `bash scripts/dev/erp-task-queue-validate`
- `bash scripts/dev/erp-worktree-list-validated`

If static docs disagree with the live baseline, report the mismatch and follow the live
baseline.

## Integrated Task-Start Baseline

Executable agent tasks must begin by running the project-approved task-start baseline as
their first command.

Use:

```sh
scripts/dev/erp-logged-run task-start <<'EOF'
set -euo pipefail

bash scripts/dev/erp-agent-task-start
EOF
```

Plan-only agents must propose the same baseline to the human supervisor and wait. They do
not execute it themselves.

## Standard Task Start

Run the integrated task-start baseline before any edit:

```sh
scripts/dev/erp-logged-run task-start <<'EOF'
set -euo pipefail

bash scripts/dev/erp-agent-task-start
EOF
```

When available after merge of F138B/F138C, also run:

```sh
scripts/dev/erp-logged-run task-preflight <<'EOF'
set -euo pipefail

scripts/dev/erp-worktree-preflight
EOF
```

For profile-specific work, the post-F138B/F138C standard becomes:

```sh
scripts/dev/erp-logged-run task-preflight-profile <<'EOF'
set -euo pipefail

scripts/dev/erp-worktree-preflight backend
scripts/dev/erp-worktree-preflight frontend
scripts/dev/erp-worktree-preflight agent-tools
EOF
```

Run only the profile that matches the active task.

## Standard Backend Commands

Fast local backend static validation:

```sh
scripts/dev/erp-logged-run backend-static <<'EOF'
set -euo pipefail

scripts/dev/erp-quality-check backend-static
EOF
```

When F138B/F138C is merged, backend local DB-backed orchestration must use:

```sh
scripts/dev/erp-logged-run backend-compose-config <<'EOF'
set -euo pipefail

scripts/dev/erp-backend-compose-ci config --quiet
scripts/dev/erp-backend-compose-ci config --services
EOF
```

```sh
scripts/dev/erp-logged-run backend-compose-up <<'EOF'
set -euo pipefail

scripts/dev/erp-backend-compose-ci up -d db redis backend
EOF
```

```sh
scripts/dev/erp-logged-run backend-compose-exec <<'EOF'
set -euo pipefail

scripts/dev/erp-backend-compose-ci exec -T backend python backend/manage.py check
scripts/dev/erp-backend-compose-ci exec -T backend python -m pytest tests/backend -q
EOF
```

```sh
scripts/dev/erp-logged-run backend-compose-run <<'EOF'
set -euo pipefail

scripts/dev/erp-backend-compose-ci run --rm backend python -m ruff check backend tests
EOF
```

```sh
scripts/dev/erp-logged-run backend-compose-down <<'EOF'
set -euo pipefail

scripts/dev/erp-backend-compose-ci down
EOF
```

If F138B/F138C is not merged yet, these wrapper commands are target-state commands and
must be treated as pending repository capability.

## Standard Frontend Commands

Frontend tasks start with a frontend-only scope check after F138B/F138C merge:

```sh
scripts/dev/erp-logged-run frontend-preflight <<'EOF'
set -euo pipefail

scripts/dev/erp-worktree-preflight frontend
scripts/dev/erp-agent-scope-guard frontend
EOF
```

Standard frontend validation:

```sh
scripts/dev/erp-logged-run frontend-quality <<'EOF'
set -euo pipefail

cd frontend
npm ci
npm test
npm run build
EOF
```

Fast existing helper:

```sh
scripts/dev/erp-logged-run frontend-quality-helper <<'EOF'
set -euo pipefail

scripts/dev/erp-quality-check frontend
EOF
```

## Standard PR, CI, And Main CI Commands

Before commit:

```sh
scripts/dev/erp-logged-run task-final-checks <<'EOF'
set -euo pipefail

git diff --check
git status --short
EOF
```

Create a commit:

```sh
scripts/dev/erp-logged-run task-commit <<'EOF'
set -euo pipefail

git add path1 path2
git commit -m "type(scope): concise summary"
EOF
```

Push branch:

```sh
scripts/dev/erp-logged-run task-push <<'EOF'
set -euo pipefail

git push -u origin branch-name
EOF
```

Open or inspect a PR:

```sh
scripts/dev/erp-logged-run task-pr <<'EOF'
set -euo pipefail

gh pr view branch-name --json number,url,state,mergeable,headRefName,baseRefName,title 2>/dev/null || \
gh pr create --base main --head branch-name --title "title" --body "body"
EOF
```

Wait for PR CI:

```sh
scripts/dev/erp-logged-run task-pr-checks <<'EOF'
set -euo pipefail

gh pr checks pr-number --watch --interval 10
EOF
```

Inspect main CI after merge:

```sh
scripts/dev/erp-logged-run task-main-ci <<'EOF'
set -euo pipefail

gh run list --branch main --limit 5
gh run watch run-id --interval 10
EOF
```

Human merge remains mandatory unless a task explicitly says otherwise.

Root-only finalization rule:

- PR finalization is a separate phase from PR creation.
- Task worktrees may commit, push, open PRs, and wait for PR CI.
- Only the main-root worktree at `/home/raillersing/projects/hahitantsoa-titan-erp`
  may merge PRs, sync `main`, wait for post-merge `main` CI, remove task worktrees, and
  delete task branches.
- Do not run `gh pr merge` from a temporary worktree.
- Do not use `gh pr merge --delete-branch` from a task worktree.
- Codex may finalize only through `scripts/dev/erp-pr-finalize-from-root` or an
  equivalent logged command executed from root `main`.

Root-main finalization helper:

```sh
scripts/dev/erp-logged-run task-pr-finalize <<'EOF'
set -euo pipefail

scripts/dev/erp-pr-finalize-from-root PR-NUMBER \
  --task-worktree /home/raillersing/projects/hahitantsoa-titan-erp-agent-lifecycle \
  --task-branch branch-name \
  --allow scripts/dev/erp-pr-finalize-from-root \
  --allow docs/ai-agents/pr-quality-gates.md
EOF
```

### Worktree PR Finalization

_Available after F148B merge._

As an alternative to root-only finalization, a dedicated worktree may finalize its own PR
using `scripts/dev/erp-pr-worktree-finalize`. This avoids the `cannot delete branch used
by worktree` error by:

- merging with `gh pr merge --squash --match-head-commit` without `--delete-branch`
- confirming PR state becomes MERGED and main CI is green
- removing the worktree with `git worktree remove`
- deleting the local and remote branches after the worktree is gone
- pruning stale worktree metadata

Only use this when the worktree is dedicated to the task and the user has explicitly
authorized finalization. Hard stops are enforced for dirty worktrees, unmergeable PRs,
failing CI, and missing arguments.

```sh
scripts/dev/erp-logged-run task-pr-worktree-finalize <<'EOF'
set -euo pipefail

scripts/dev/erp-pr-worktree-finalize PR-NUMBER \
  --worktree /path/to/worktree \
  --branch branch-name
EOF
```

If both `--worktree` and `--branch` are omitted, the script uses the current worktree and
branch.

### PR Check Finalization Rules

- **Required Checks:** Verification of required PR checks via `gh pr checks <PR> --required` is preferred when configured on the branch protection rules.
- **Rollup Fallback:** If no required checks are reported by the CLI (or the check command fails/returns empty because none are configured), the finalizer falls back to statusCheckRollup validation. Under statusCheckRollup validation, both `Backend quality` and `Frontend quality` checks are explicitly required to be `SUCCESS`.
- **JSON Processing:** The use of external `jq` is strictly forbidden in project scripts to maintain environment portability. All JSON parsing and filtering must be handled natively using the `gh --json --jq` option built into the GitHub CLI.

## CI Wait Policy

### Pre-merge CI wait

After opening a PR, the agent must wait for all required CI checks to complete with a
`SUCCESS` conclusion before requesting human merge.

Use:

```sh
scripts/dev/erp-logged-run task-pr-checks <<'EOF'
set -euo pipefail

gh pr checks PR-NUMBER --watch --interval 15
EOF
```

Stop conditions during CI wait:

- a required check fails → stop and report without merging
- CI is cancelled or times out → stop and re-run or escalate
- CI runs but the PR is blocked by merge conflicts → stop and report

### Post-merge main CI wait

After the PR is merged, the agent must verify that the `main` branch CI passes before declaring the task complete.

- **SHA-Bound Validation:** The main CI validation must be bound to the exact current main HEAD SHA. Relying merely on the "latest main CI success" is insufficient and unsafe because it could accept a successful run for a previous commit.
- **Run Identification:** Identify the workflow run triggered for the exact post-merge HEAD SHA using `gh run list --branch main --event push --json databaseId,headSha` and filter by the SHA.

Use:

```sh
scripts/dev/erp-logged-run task-main-ci <<'EOF'
set -euo pipefail

# Compute current main HEAD SHA
current_main_sha="$(git rev-parse HEAD)"

# Find CI run matching the exact SHA
run_id="$(gh run list --branch main --event push --json databaseId,headSha --jq ".[] | select(.headSha == \"$current_main_sha\") | .databaseId" | head -n 1)"

gh run view "$run_id" --json databaseId,headSha,status,conclusion,url
gh run watch "$run_id" --interval 15
EOF
```

If `main` CI fails after merge, or the conclusion of the SHA-bound run is not success:

- report the failure immediately with the run URL
- do not start the next task until `main` CI is green for the current HEAD SHA
- escalate to the human for resolution

The pre-merge and post-merge CI check is required for every mutating task that opens a
PR. Review-only and plan-only tasks are exempt.

## Executable Bit Policy

Script files under `scripts/dev/` must have the executable bit set when:

- they are written as `#!/usr/bin/env bash` or other shebang-executed scripts
- they are intended to be run directly by an agent or CI workflow (directly executed repo helpers must have the executable bit set)
- they are referenced as standalone commands in runbook examples

*Invoking Helpers:*
- Helpers called from another script or orchestrator workflow may be invoked explicitly through bash (e.g. `bash scripts/dev/helper-name`) to prevent execution failures due to missing shebang/permissions.
- If a cleanup or finalization permission failure is encountered (e.g. exit code 126), the script must stop safely, log the error, and produce an actionable recovery path (e.g. suggesting the operator run `chmod +x` or invoke via bash).

When a new script is created or an existing script is modified, verify the executable bit:

```sh
test -x scripts/dev/script-name || echo "MISSING EXECUTABLE BIT"
```

If the bit is missing on a committed script, it must be set in a dedicated fix commit:

```sh
chmod +x scripts/dev/script-name
git add scripts/dev/script-name
git commit -m "chore(agent): mark script-name executable"
```

The `chmod` prohibition in the permanent prohibitions does not apply to setting the
executable bit on approved `scripts/dev/` files as part of a tools-governance task.

## Dirty Worktree Policy

A dirty worktree must be handled according to the following rules:

- If the dirty files are within the approved scope and the task prompt explicitly allows
  them, the task may proceed.
- If the dirty files are outside the approved scope, the agent must stop and report.
- If the dirty files include `.env`, `.env.*`, `.pem`, `.key`, or secret-like paths, the
  agent must stop immediately and escalate.
- If the worktree was already dirty before the task started and the dirtiness is not
  covered by the task, the agent must stop and ask whether to proceed.
- A dirty worktree must never be reset, stashed, or cleaned without explicit human
  approval.

The authoritative dirty-worktree stop condition must be stated in every task prompt.

## Resume After Connection Cut

Use a restart block that re-verifies the exact branch and status before any new action:

```sh
scripts/dev/erp-logged-run task-resume <<'EOF'
set -euo pipefail

pwd
git branch --show-current
git status --short
git log --oneline --decorate -8
git diff --name-only origin/main...HEAD
EOF
```

If the task is backend and F138B/F138C is merged, re-run:

```sh
scripts/dev/erp-logged-run task-resume-backend <<'EOF'
set -euo pipefail

scripts/dev/erp-worktree-preflight backend
scripts/dev/erp-agent-scope-guard backend
scripts/dev/erp-backend-compose-ci config --quiet
EOF
```

If the task is frontend and F138B/F138C is merged, re-run:

```sh
scripts/dev/erp-logged-run task-resume-frontend <<'EOF'
set -euo pipefail

scripts/dev/erp-worktree-preflight frontend
scripts/dev/erp-agent-scope-guard frontend
EOF
```

## Post-Merge Cleanup Commands

Only after merge is confirmed and the human allows cleanup:

```sh
scripts/dev/erp-logged-run task-post-merge <<'EOF'
set -euo pipefail

git fetch origin
git checkout --detach origin/main
git branch --show-current || true
git rev-parse --short HEAD
git status --short
EOF
```

Optional branch cleanup when explicitly authorized:

```sh
scripts/dev/erp-logged-run task-branch-cleanup <<'EOF'
set -euo pipefail

git branch -d branch-name
git push origin --delete branch-name
EOF
```

## Forbidden Commands

Never use:

- `git reset --hard`
- `git checkout -- path`
- `git clean -fd`
- `docker compose --env-file .env ...`
- `source .env`
- `cat .env`
- `cp .env ...`
- ad hoc secret exports copied from private files
- unlogged important commands outside `scripts/dev/erp-logged-run`
- automatic merge commands unless explicitly authorized by a human task

## Secret And Scope Reminder

- Never read, source, print, inspect, create, copy, or modify `.env`.
- Use only the approved worktree for the active task.
- Keep backend, frontend, and agent-docs or agent-tools worktrees separated.
- After merge of F138B/F138C, `scripts/dev/erp-backend-compose-ci`,
  `scripts/dev/erp-agent-scope-guard`, and `scripts/dev/erp-worktree-preflight` become
  standard required wrappers where applicable.
