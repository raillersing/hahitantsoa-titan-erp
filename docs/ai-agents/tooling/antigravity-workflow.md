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

*Rules on Bridge Commands:*
- The use of `wsl`, `wsl.exe`, `wsl -e`, `wsl --exec`, or `bash -c` bridges is classified as **adapter mode**, NOT native WSL/Linux mode.
- Using these bridge/adapter commands does not qualify for a clean native logged-readonly PASS; they must be explicitly declared as adapter mode in the protocol report.
- Adapter mode is **never** allowed for backend or frontend mutations.
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

## Baseline Behavior

- If the assigned profile is plan-only, propose `bash scripts/dev/erp-agent-task-start` and wait.
- If Antigravity is explicitly promoted into an executable docs-only mode, run the same baseline first through `scripts/dev/erp-logged-run`.
- Live baseline wins over stale docs.
