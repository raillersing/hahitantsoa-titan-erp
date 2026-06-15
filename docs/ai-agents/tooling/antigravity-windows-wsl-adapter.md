# Antigravity Windows-to-WSL Adapter Governance

## Purpose

This document defines the requirements, constraints, and promotion path for the future Windows-to-WSL adapter wrapper. This adapter enables the Windows-hosted Antigravity agent to safely orchestrate full-cycle tasks (commit, push, PR, merge) within WSL.

## Scope and Intent

Direct Windows-to-WSL bridge execution (e.g. `wsl --exec`, `wsl -e`, or raw PowerShell piping) is prone to syntax errors, line-ending corruption, and unlogged actions. To reach full-cycle execution autonomy, the agent must go through an audited, version-controlled project wrapper with strict scope controls.

## Future Adapter Requirements

Any approved adapter wrapper must adhere to the following specifications:
1. **WSL-Logged Wrapper Execution:** Every relayed command must execute inside `scripts/dev/erp-logged-run` on the WSL instance.
2. **SHA-Bound Main CI Verification:** Post-merge main CI validation must verify the exact HEAD SHA of current `main` using native CLI jq (`gh --json --jq`).
3. **No Raw WSL Commands:** The agent must never use raw, unversioned `wsl` or `wsl.exe` commands directly from the host.
4. **No Background Execution:** All PR finalization steps must execute synchronously and return the complete real `erp-logged-run` terminal log to the agent.
5. **No --delete-branch:** Merging must be executed via `gh pr merge --squash` without deleting branch metadata during merge.

## Promotion Path

Before this adapter mode is promoted to production tasks:
1. The adapter wrapper script must be implemented under `scripts/dev/`.
2. Scenario validation tests must be documented and executed, confirming that exit codes are successfully checked.
3. The adapter profile must pass validation audits.

## Approved PowerShell Command Shapes

For the Antigravity adapter, the only authorized Windows host invocation pattern is through the versioned PowerShell script:

1. **Task Start Sequence:**
   ```powershell
   .\scripts\dev\erp-antigravity-windows-wsl-adapter.ps1 -Mode task-start
   ```

2. **PR Finalization Sequence:**
   ```powershell
   .\scripts\dev\erp-antigravity-windows-wsl-adapter.ps1 -Mode finalize-pr -PrNumber <PR_NUMBER> -TaskBranch <BRANCH_NAME> [-TaskWorktree <WORKTREE_PATH>] -Allow <PATH_1>[,<PATH_2>...]
   ```

3. **Orchestrator Repository Status Check:**
   ```powershell
   .\scripts\dev\erp-antigravity-windows-wsl-adapter.ps1 -Mode repo-status
   ```

4. **PR CI Checks Status Audit:**
   ```powershell
   .\scripts\dev\erp-antigravity-windows-wsl-adapter.ps1 -Mode pr-checks -PrNumber <PR_NUMBER>
   ```

5. **Controlled PR Creation:**
   ```powershell
   .\scripts\dev\erp-antigravity-windows-wsl-adapter.ps1 -Mode pr-create -PrHead <branch> [-PrBase <branch>] -PrTitle <title> -PrBody <body>
   ```

6. **Controlled Task Branch/Worktree Start:**
   ```powershell
   .\scripts\dev\erp-antigravity-windows-wsl-adapter.ps1 -Mode task-branch-start -TaskBranch <branch> [-TaskWorktree <path>] [-TaskBase <branch>]
   ```

7. **Frontend Quality Check:**
   ```powershell
   .\scripts\dev\erp-antigravity-windows-wsl-adapter.ps1 -Mode frontend-quality
   ```

### Critical Constraints

- **No Raw WSL Usage:** Direct execution of raw `wsl`, `wsl.exe`, `wsl --exec`, or `wsl -e` on the Windows host outside this approved `.ps1` wrapper remains a strict protocol **FAIL**.
- **Supported Modes:** The adapter currently supports `task-start`, `finalize-pr`, `repo-status`, `pr-checks`, `pr-create`, `task-branch-start`, and `frontend-quality`.
- **Not Enabled Yet:** Automated git actions such as local commit (`commit`) and remote push (`push`) are **not enabled yet** in this first adapter version. Attempting to run them via the adapter will result in an error or a protocol violation.
- **Flattened Arguments:** The PowerShell wrapper must construct a flat array of strings (e.g. `$WslArgs`) containing both the `wsl.exe` command line parameters and the bash entrypoint arguments before executing `Start-Process -ArgumentList`. Passing a nested array (e.g. passing a sub-array `$ArgList` inside `-ArgumentList`) triggers a PowerShell parameter binding failure.

## F140U validation status

- `task-start` smoke test via adapter: PASS
- `finalize-pr` smoke test via adapter: PASS
- raw WSL bridge outside wrapper: forbidden
- `.env` / secrets: not touched

## F141E full orchestration pilot status

- Branch: `docs/f141e-antigravity-full-orchestration-pilot`
- Worktree: `/home/raillersing/projects/hahitantsoa-titan-erp-f141e-pilot`
- Pilot Status: `PASS`


