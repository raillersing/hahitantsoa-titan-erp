# Claude Code Instructions — Hahitantsoa/Titan ERP

@AGENTS.md

Claude Code is an official WSL-native project agent for this repository. It follows the
shared project rules in `@AGENTS.md` and adds only the WSL-native execution and workflow
notes that are specific to Claude Code sessions.

Claude Code does **not** replace Codex, Antigravity, or OpenCode. It is an additional
approved agent that executes inside native WSL/bash and works through the same
project-approved wrappers, branch discipline, and review gates.

## Mandatory project workflow

Before acting, read and follow:

- `AGENTS.md`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`
- the applicable backend/frontend agent template for the assigned task profile
- task-specific audit or roadmap documents when relevant

## Knowledge graph consultation

Before implementation, consult sources in the order defined in AGENTS.md:
cartography → Graphify report → raw search. See `docs/ai-agents/tooling/graphify.md`.

## Repository rules

- The root repository at `/home/raillersing/projects/hahitantsoa-titan-erp` must remain on
  `main`.
- Work only in the dedicated task worktree assigned by the orchestrator.
- One task branch per task.
- One PR per task.
- Keep changes scoped and reviewable.
- Use medium-sized bundles, not micro-PRs.
- Do not touch `.env` or `.env.*`.
- Do not print, inspect, or modify secrets.
- Do not resume or modify F147F unless explicitly assigned later.
- Keep `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md` untracked and untouched.
- Do not disturb Codex, Antigravity, OpenCode, or their worktrees.
- Do not add Claude Code hooks unless the format is explicitly confirmed from official
  Claude Code documentation and the hook is clearly safe. For F148A, prefer no hooks.

## Worktree discipline

- Every task uses its own dedicated worktree and branch.
- Backend work happens only in a backend worktree.
- Frontend work happens only in a frontend worktree.
- Agent-docs and agent-tools work happen only in their own dedicated worktrees.
- Never edit another agent's worktree.
- Never mix unrelated tasks in one branch.

## Branch and PR discipline

- The assigned branch must match the task.
- Start from a clean baseline on `main`.
- Commit with the project commit-message convention.
- Open exactly one PR per task to `main`.
- Do not merge automatically unless the task explicitly authorizes it and CI is green.
- Human merge control remains the default.

## Command logging

Run every important terminal command through the logged wrapper:

```sh
scripts/dev/erp-logged-run task-name <<'EOF'
set -euo pipefail
# commands here
EOF
```

Do not use `bash -c` inside the wrapper. Do not run significant commands outside the
wrapper.

## Secrets and environment policy

- Never read, source, print, inspect, create, copy, or modify `.env`, `.env.*`, or any
  secret-like file.
- Never touch `secrets/`, `**/*.pem`, `**/*.key`, tokens, or private keys.
- Never pass secrets through command-line arguments or environment variables copied from
  private files.

## Stop conditions

Stop immediately and report when:

- the active worktree or branch does not match the assigned task;
- forbidden files appear in `git status` or `git diff`;
- the task would require reading or using `.env` or secrets;
- CI fails for a reason that would broaden the task beyond approved scope;
- local state shows unrelated user changes that conflict with the task;
- another agent's worktree would need to be modified;
- F147F or its worktree must be touched without explicit authorization.

## CI and merge discipline

- Run `git diff --check` and the smallest relevant local checks before push.
- PR CI must be green before merge.
- `main` CI must be green after merge.
- Confirm the exact post-merge `main` HEAD SHA when validating `main` CI.
- Do not declare a task complete until the post-merge `main` CI passes.

## Coexistence with other agents

- Codex remains the default backend and frontend implementation agent.
- Antigravity remains the Windows/WSL bridge and frontend hardening agent.
- OpenCode remains the WSL-backed review and docs workflow agent.
- Claude Code executes natively in WSL and follows the same project contracts.
- Agent roles do not overlap without explicit orchestrator assignment.

## F148A scope note

F148A integrates Claude Code into the project workflow. It is docs/tooling/governance
only. It does not modify backend, frontend, tests, scripts, `.env`, secrets, or the F140D
audit file.

After F148A is merged and `main` CI is green, F147F may become the first Claude Code pilot
task only if the orchestrator explicitly assigns it.
