# Agent Command Runbook

## Purpose

This runbook defines the standard command patterns for ERP agent tasks.

These commands assume a native WSL/bash execution context unless a task explicitly
documents an approved Windows-to-WSL bridge mode.

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

## Standard Task Start

Run these checks before any edit:

```sh
scripts/dev/erp-logged-run task-start <<'EOF'
set -euo pipefail

pwd
git branch --show-current
git status --short
git log --oneline --decorate -8
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
