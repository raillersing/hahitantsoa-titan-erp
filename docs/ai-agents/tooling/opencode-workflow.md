# OpenCode Workflow Bridge

## Purpose

This bridge defines the approved repository workflow for OpenCode sessions.

Use `docs/ai-agents/AI_ORCHESTRATION_INDEX.md` as the task-routing entry point before
choosing the OpenCode profile and command mode.

## Profiles

- `opencode-web-wsl-review`: WSL-backed review/docs workflow
- `opencode-desktop-windows-plan-only`: Windows-hosted plan-only workflow

## Rules

- OpenCode Web launched from WSL is native WSL/bash.
- Inside WSL, do not use `wsl.exe`, `wsl -d`, or PowerShell-to-WSL bridge commands.
- OpenCode Desktop Windows remains plan-only unless a future promoted profile explicitly changes that.
- No PowerShell-to-WSL bridge unless explicitly authorized by the task.
- Codex skills may be read as reference runbooks, but OpenCode must not assume they auto-load.
- OpenCode review agents may not finalize PRs.
- No OpenCode workflow should run `gh pr merge` from a temporary worktree.

## Baseline Behavior

- Executable OpenCode WSL sessions run `bash scripts/dev/erp-agent-task-start` inside `scripts/dev/erp-logged-run` first.
- Plan-only OpenCode sessions propose the same baseline and wait.
- Live baseline wins over stale docs.

## Knowledge graph consultation

Before any implementation task within OpenCode, follow the consultation order defined
in AGENTS.md: cartography → Graphify report → raw search. See
`docs/ai-agents/tooling/graphify.md` for the full pilot governance rules.
