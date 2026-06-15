# Antigravity Workflow Bridge

## Purpose

This bridge defines the approved repository workflow for Antigravity sessions.

## Default Profile

- profile: `antigravity-plan-only` (default), `antigravity-logged-readonly-review`, or `antigravity-docs-only-mutation-pilot`
- default mode: plan-only, wrapped logged review, or docs-only mutation
- mutation: forbidden unless using `antigravity-docs-only-mutation-pilot` within approved docs scope

## Environment mode

Antigravity operates in one of the following environment modes:
1. **Native WSL/Linux:** Shell execution is native to a Linux/WSL environment.
2. **Windows-hosted:** Running directly on a Windows host command line (e.g. PowerShell, cmd.exe).
3. **Approved Windows-to-WSL adapter:** Commands run from a Windows host but relayed to a WSL instance.

### Native WSL versus Windows-to-WSL bridge

In native WSL/Linux modes, the following bridge command wrappers and relays are strictly **forbidden**:
- `wsl`
- `wsl.exe`
- `wsl --exec`
- `wsl -e`
- `bash -c` bridge wrappers
- PowerShell here-string piped to `wsl` (e.g. `@' ... '@ | wsl`)

*Protocol Consequences:*
- If any of these forbidden bridge/adapter command patterns are used during a task assigned under native WSL/Linux, the protocol verdict must be classified as **FAIL** or **PASS WITH PROTOCOL RESERVATIONS**, never a clean PASS.
- Root-finalization pilots (`antigravity-root-finalization-pilot`) are allowed **only** when Antigravity is already inside a native WSL/Linux terminal context.
- If Antigravity is Windows-hosted, it must **STOP** and ask the human supervisor or the root workflow to execute finalization on its behalf.
- Under `antigravity-docs-only-mutation-pilot`, all modifications must be applied strictly via file-editing tools (e.g., `replace_file_content`, `write_to_file`) and never via command-line shell utilities.

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
- The docs-only mutation pilot may not finalize PRs.
- No `gh pr merge` usage from Antigravity temporary worktrees.

## Baseline Behavior

- If the assigned profile is plan-only, propose `bash scripts/dev/erp-agent-task-start` and wait.
- If Antigravity is explicitly promoted into an executable docs-only mode, run the same baseline first through `scripts/dev/erp-logged-run`.
- Live baseline wins over stale docs.

## Validation checks reference

The validation system expects checking for the following terms in the docs:
- antigravity-root-finalization-pilot
- background execution
- Final erp-logged-run log
- PASS WITH PROTOCOL RESERVATIONS
- protocol FAIL
