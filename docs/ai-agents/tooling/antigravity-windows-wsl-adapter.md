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
