# Agent Profiles

## Purpose

This document defines the approved multi-agent compatibility layer for this repository.

The orchestrator must assign one explicit profile before assigning a task. Agents must not
infer their own execution profile from vague tool availability or UI context.

Use this document with:

- [Agent prompt procedure](prompt-contracts/agent-prompt-procedure.md)
- [Agent command runbook](agent-command-runbook.md)
- [Orchestrator delegation protocol](orchestrator-delegation-protocol.md)
- [Worktree registry](worktree-registry.md)
- [Parallel agent policy](parallel-agent-policy.md)

## Global Rules

- Live baseline wins over stale static docs.
- Agents must not infer current repository state from static docs alone.
- The orchestrator must assign a profile before assigning a task.
- Task-start baseline is part of the task itself.
- No separate human pre-baseline command should be required before every prompt.
- One agent profile operates in one approved worktree scope at a time.
- `.env`, secrets, `/tmp` script workflows, and unauthorized `chmod` remain forbidden
  across all profiles.
- Review-only or plan-only profiles are not mutation-capable until explicit promotion plus
  acceptance-test evidence are recorded.

## Required Live Baseline

Every active profile that is allowed to execute commands must begin with a relevant subset
of:

- `git fetch origin --prune`
- `git log --oneline --decorate -8`
- `git status --short`
- `gh pr list`
- `bash scripts/dev/erp-orchestrator-state-check`
- `bash scripts/dev/erp-task-queue-validate`
- `bash scripts/dev/erp-worktree-list-validated`

Executable agents should normally satisfy this requirement by running:

- `bash scripts/dev/erp-agent-task-start`

inside `scripts/dev/erp-logged-run` as their first command.

Plan-only agents must propose the same baseline to the human supervisor and wait.

If static docs disagree with the live baseline:

- the live baseline wins
- the mismatch must be reported
- the task must not continue on stale assumptions

## Profile Matrix

### `codex-native-wsl-mutating`

- Approved environment:
  - native Ubuntu/WSL bash session
- Allowed autonomy levels:
  - Level 1 through Level 4, only as explicitly authorized by the task
- Allowed command mode:
  - native WSL/bash only
  - `scripts/dev/erp-logged-run ... <<'EOF'`
- Allowed worktree behavior:
  - may inspect and mutate the single authorized worktree
  - may not mutate sibling worktrees
- Allowed mutation scope:
  - task-approved docs, tools, backend, or frontend scope only
- Forbidden actions:
  - `wsl`, `wsl.exe`, `wsl -d`, PowerShell, `cmd.exe`, Windows paths, improvised bridges
  - `.env` or secret handling
  - scope drift outside the task
- Required live baseline behavior:
  - run the integrated task-start baseline as the first command before trusting state
- Required deliverable format:
  - chat report and/or approved repo docs
- Merge/push policy:
  - only when explicitly authorized by the task

### `antigravity-review-docs`

- Approved environment:
  - Antigravity review or docs session under human supervision
- Allowed autonomy levels:
  - Level 0 or Level 1 by default
  - docs-only mutation only if the task explicitly promotes it
- Allowed command mode:
  - plan-only by default
  - if promoted, use only approved repo command patterns
- Allowed worktree behavior:
  - inspect only by default
  - may mutate docs-only scope when explicitly promoted
- Allowed mutation scope:
  - `docs/ai-agents/**`, docs audits, approved governance docs only
- Forbidden actions:
  - no `/tmp` scripts
  - no `chmod`
  - no backend mutation
  - no frontend mutation
  - no tool-script mutation unless explicitly reassigned
- Required live baseline behavior:
  - propose the integrated task-start baseline to the human supervisor before review or docs edits
- Required deliverable format:
  - review findings or docs/governance report in chat and/or repo docs
- Merge/push policy:
  - no merge
  - push only if explicitly authorized in a docs-governance task

### `antigravity-plan-only`

- Approved environment:
  - Antigravity plan/review session
- Allowed autonomy levels:
  - Level 0 only
- Allowed command mode:
  - plan-only
  - no terminal commands or shell execution of any kind
- Allowed worktree behavior:
  - inspect via file-reading tools only
- Allowed mutation scope:
  - none (read-only)
- Forbidden actions:
  - any direct terminal command execution (e.g. `git`, `gh`, `ls`, or shell execution)
  - `/tmp` scripts, `chmod`, backend/frontend mutation
- Required live baseline behavior:
  - propose the integrated task-start baseline inside standard heredoc wrapper for human/Codex execution
- Required deliverable format:
  - review findings or plan proposals in chat only
- Merge/push policy:
  - no push
  - no merge

### `antigravity-logged-readonly-review`

- Approved environment:
  - Antigravity review session under human supervision
- Allowed autonomy levels:
  - Level 1 only for non-mutating checks
- Allowed command mode:
  - wrapped readonly commands only
  - all shell execution MUST be wrapped inside `scripts/dev/erp-logged-run`
- Allowed worktree behavior:
  - inspect/read-only
- Allowed mutation scope:
  - none
- Forbidden actions:
  - direct git/gh/shell execution without `erp-logged-run` wrapper
  - any backend or frontend file mutation, `chmod`, or `/tmp` scripts
- Required live baseline behavior:
  - run the integrated task-start baseline through `erp-logged-run` as the first step
- Required deliverable format:
  - review report including protocol audit details
- Merge/push policy:
  - no push
  - no merge

### `antigravity-docs-only-mutation-pilot`

- Approved environment:
  - Antigravity docs-only mutation session under human supervision
- Allowed autonomy levels:
  - Level 1 only for authorized documents mutation
- Allowed command mode:
  - plan-only or wrapped readonly commands (for baseline checking)
  - no command-based edits allowed; mutations must be done strictly via file-editing tools
- Allowed worktree behavior:
  - requires isolated worktree usage (docs/review scope worktree only)
- Allowed mutation scope:
  - `docs/ai-agents/**` and `docs/audits/**` only when explicitly scoped
- Forbidden actions:
  - any backend mutation (`backend/**`), frontend mutation (`frontend/**`), Github workflows (`.github/**`), Docker/compose setup (`compose*`, `Docker*`), `.env` or secrets
  - direct git/gh/shell commands, `/tmp` scripts, and `chmod`
- Required live baseline behavior:
  - run or propose the integrated task-start baseline before applying mutations
- Required deliverable format:
  - updated document files in the authorized worktree and/or chat report
- Merge/push policy:
  - no commit, no push, no merge
  - requires human or Codex validation before any PR is created or integrated

### `opencode-web-wsl-review`

- Approved environment:
  - OpenCode Web where the execution backend terminal is already inside WSL
- Allowed autonomy levels:
  - Level 0 or Level 1 by default
  - higher levels only if explicitly promoted and proven stable
- Allowed command mode:
  - native WSL/bash only
  - no Windows-to-WSL bridge commands
- Allowed worktree behavior:
  - inspect by default
  - mutate only the authorized scope if explicitly promoted
- Allowed mutation scope:
  - default review-only
  - promoted scope must still be task-bounded
- Forbidden actions:
  - `wsl -d`, `wsl.exe`, PowerShell relays, host-shell bridges
  - unauthorized backend/frontend mutation
- Required live baseline behavior:
  - run the integrated task-start baseline first when execution is allowed
- Required deliverable format:
  - review output first; if promoted, repo-doc or bounded task report
- Merge/push policy:
  - no merge
  - push only if explicitly authorized

### `opencode-desktop-windows-plan-only`

- Approved environment:
  - OpenCode Desktop on Windows
- Allowed autonomy levels:
  - Level 0 only unless a future stable WSL backend mode is explicitly approved
- Allowed command mode:
  - plan-only
- Allowed worktree behavior:
  - no direct worktree mutation
- Allowed mutation scope:
  - none
- Forbidden actions:
  - autonomous mutation
  - PowerShell-to-WSL improvisation
  - backend or frontend validation execution
- Required live baseline behavior:
  - may only propose the integrated task-start baseline for a human or approved executing agent
- Required deliverable format:
  - plan, review, or escalation notes in chat
- Merge/push policy:
  - no push
  - no merge

### `windows-hosted-agent-plan-only`

- Approved environment:
  - Windows desktop app
  - PowerShell-hosted agent
  - unknown host shell
- Allowed autonomy levels:
  - Level 0 only by default
- Allowed command mode:
  - plan-only unless a bridge adapter is explicitly approved
- Allowed worktree behavior:
  - no direct worktree mutation
- Allowed mutation scope:
  - none
- Forbidden actions:
  - improvised PowerShell-to-WSL bridges
  - host Python backend validation
  - pretending bridge mode is native WSL mode
- Required live baseline behavior:
  - propose the integrated task-start baseline in standard heredoc format for human execution
- Required deliverable format:
  - plan, review notes, or command proposal
- Merge/push policy:
  - no push
  - no merge

### `human-supervisor`

- Approved environment:
  - human-controlled terminal, browser, and GitHub session
- Allowed autonomy levels:
  - not applicable; human final authority
- Allowed command mode:
  - may run approved repo commands or approve agents to do so
- Allowed worktree behavior:
  - may coordinate across worktrees
  - should still respect explicit scope separation where possible
- Allowed mutation scope:
  - any approved scope under human responsibility
- Forbidden actions:
  - none at policy level, but humans should still avoid bypassing secret and scope rules
- Required live baseline behavior:
  - must confirm merge, CI, and current branch state before override decisions
- Required deliverable format:
  - approval, escalation, merge decision, or operator note
- Merge/push policy:
  - human-controlled

### `future-crewai-orchestrator-framework`

- Approved environment:
  - future orchestrator framework only after explicit repository adoption
- Allowed autonomy levels:
  - none at present
- Allowed command mode:
  - not active
- Allowed worktree behavior:
  - none at present
- Allowed mutation scope:
  - none at present
- Forbidden actions:
  - acting as an active coding agent before explicit approval
- Required live baseline behavior:
  - if adopted later, it must honor the same live-baseline and scope rules
- Required deliverable format:
  - orchestration design or future integration proposal only
- Merge/push policy:
  - no push
  - no merge

## Assignment Rule

Every delegated task must name:

- one agent profile
- one authorized worktree
- one allowed mutation scope
- one command mode

If any of these are missing, the task assignment is incomplete.

## Validation

Run:

```sh
bash scripts/dev/erp-agent-profile-validate
```

This validates the required profiles and contract fields without inspecting secrets.
