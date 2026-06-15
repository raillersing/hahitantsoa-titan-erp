# Antigravity Workflow Bridge

## Purpose

This bridge defines the approved repository workflow for Antigravity sessions.

## Default Profile

- profile: `antigravity-plan-only` (default) or `antigravity-logged-readonly-review`
- default mode: plan-only or wrapped logged review
- mutation: forbidden

## Rules

- No backend mutation.
- No frontend mutation.
- No `/tmp` scripts.
- No `chmod`.
- No improvised `wsl -d` or similar bridge commands.
- No direct shell, git, or gh commands (e.g. `git status`, `git log`, `git diff`, `gh pr view`, `gh pr checks`, `ls` must never be run directly).
- Any required inspection commands must be executed strictly wrapped in:
  ```sh
  cd "$HOME/projects/hahitantsoa-titan-erp"
  scripts/dev/erp-logged-run task-name <<'EOF'
  [command]
  EOF
  ```
  Direct unwrapped execution is a protocol violation.
- Deliverables belong in chat and/or approved repo docs only.
- Codex skills may be read as reference runbooks only.

## Baseline Behavior

- If the assigned profile is plan-only, propose `bash scripts/dev/erp-agent-task-start` and wait.
- If Antigravity is explicitly promoted into an executable docs-only mode, run the same baseline first through `scripts/dev/erp-logged-run`.
- Live baseline wins over stale docs.
