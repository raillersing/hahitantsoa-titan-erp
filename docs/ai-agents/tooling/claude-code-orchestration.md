# Claude Code Orchestration Bridge

## Purpose

This bridge defines the approved repository workflow for Claude Code sessions inside the
Hahitantsoa/Titan ERP project.

Claude Code is an official WSL-native project agent. It executes natively in WSL/bash and
uses the same project contracts as the other approved agents.

## WSL-native operating mode

- Claude Code runs inside WSL with native `bash`, `git`, and `gh`.
- Inside WSL, do **not** use `wsl`, `wsl.exe`, `wsl -d`, PowerShell, `cmd.exe`, or any
  Windows-to-WSL bridge command.
- If a Claude Code session is not inside WSL, it must remain plan-only and ask the human
  supervisor or the root workflow to execute commands on its behalf.

## Coexistence with other agents

Claude Code does **not** replace Codex, Antigravity, or OpenCode.

| Agent | Primary role | Boundary |
| --- | --- | --- |
| Codex | Backend and frontend implementation | Default feature agent |
| Antigravity | Windows/WSL bridge, frontend hardening | Native-WSL-only when executable |
| OpenCode | WSL-backed review and docs workflow | No finalization from temporary worktrees |
| Claude Code | Native WSL execution, docs/tooling governance | Same contracts as Codex/OpenCode |

Claude Code may be assigned docs-only, agent-tools, review, or governance tasks. It does
not take over an active task that is assigned to another agent without explicit
orchestrator reassignment.

## When Claude Code should be used

- Native WSL tasks where the orchestrator assigns Claude Code explicitly.
- Docs, governance, tooling, and audit work where WSL-native execution is useful.
- Tasks that require `scripts/dev/erp-logged-run` and live-baseline verification.
- Recovery and setup tasks that need direct WSL shell access.

## When Claude Code should not be used

- Do not use Claude Code to replace an active Codex, Antigravity, or OpenCode assignment.
- Do not use Claude Code for Windows-hosted plan-only work that belongs to Antigravity or
  OpenCode Desktop.
- Do not use Claude Code to finalize a PR from a temporary or non-dedicated worktree.
- Do not use Claude Code to touch backend, frontend, tests, `.env`, secrets, or another
  agent's worktree unless the task explicitly authorizes it.

## Required worktree/branch/PR workflow

One Claude Code task uses exactly:

- one dedicated worktree
- one task branch
- one PR to `main`

Follow `docs/ai-agents/agent-command-runbook.md` for:

- task-start baseline
- preflight checks
- commit and push
- PR creation
- PR CI wait
- main CI wait after merge

The root repository must stay on `main`. The task worktree must stay on the assigned task
branch.

## Command logging

All significant terminal work must run through:

```sh
scripts/dev/erp-logged-run task-name <<'EOF'
set -euo pipefail
# commands here
EOF
```

Do not replace the heredoc workflow with `bash -c` or inline one-liners.

## Secrets and `.env` policy

- Never read, source, print, inspect, create, copy, or modify `.env` or `.env.*`.
- Never touch `secrets/**`, `**/secrets/**`, keys, tokens, or private certificates.
- If a task would require `.env` or secrets access, stop and escalate.

## Hooks

Claude Code hooks are deferred in F148A. The project will add hooks only after their
format is explicitly confirmed from official Claude Code documentation and the hook is
clearly safe. Until then, `.claude/settings.json` uses only `deny` rules.

## F148B tooling alignment

F148B aligns the project tooling so Claude Code paths are officially accepted:

- `scripts/dev/erp-agent-scope-guard` now recognizes `CLAUDE.md` and `.claude/`
  under the `agent-docs` profile.
- `scripts/dev/erp-pr-worktree-finalize` is executable and safely returns to the
  root worktree to fast-forward `main` after a squash merge, instead of trying to
  pull `origin/main` into the task branch.

Hooks remain deferred until the official Claude Code hook format is confirmed safe.

## F147F pilot path

F147F remains paused while F148A and F148B are open. Do not resume or modify F147F
until F148B is merged and `main` CI is green.

After F148A and F148B are merged and `main` CI is green, F147F may become the first
Claude Code pilot task. That transition requires an explicit new orchestrator
assignment; it does not happen automatically.
