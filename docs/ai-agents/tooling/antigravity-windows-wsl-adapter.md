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

### Critical Constraints

- **No Raw WSL Usage:** Direct execution of raw `wsl`, `wsl.exe`, `wsl --exec`, or `wsl -e` on the Windows host outside this approved `.ps1` wrapper remains a strict protocol **FAIL**.
- **Supported Modes:** The adapter currently supports **only** `task-start` and `finalize-pr`.
- **Not Enabled Yet:** Automated git actions such as branch creation (`create-branch`), local commit (`commit`), remote push (`push`), and pull request creation (`PR creation`) are **not enabled yet** in this first adapter version. Attempting to run them via the adapter will result in an error or a protocol violation.
