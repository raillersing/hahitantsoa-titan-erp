---
name: erp-task-start
description: Establish a non-mutating Titan ERP task baseline. Use before an authorized executable task after the worktree, branch, and expected scope are known; never use it to synchronize Git or to override a dirty or unexpected worktree.
---

# ERP Task Start

Use this skill at the beginning of an authorized executable task. For a plan, audit,
or report-only task, inspect the local state read-only and do not start an
implementation baseline.

## Workflow

1. Confirm the assigned profile, authorized worktree, expected branch, and approved
   scope before running any command.
2. Run a local read-only preflight: branch, HEAD, `git status --short`, and registered
   worktrees. Stop if the worktree is dirty, detached, unexpected, or owned by another
   task. Do not fetch, pull, checkout, reset, stash, or change branches to resolve it.
3. Run the integrated, non-mutating baseline only after the preflight is clean:

```sh
cd "<authorized-worktree>"

scripts/dev/erp-logged-run task-name <<'AGENTBASELINE'
set -euo pipefail
bash scripts/dev/erp-agent-task-start
AGENTBASELINE
```

4. Confirm the baseline reports the same branch and HEAD before and after it runs.
   Treat unavailable remote PR or CI information as `UNCONFIRMED`, not as a reason to
   mutate Git state.
5. Run the profile-specific worktree preflight and scope guard required by the runbook
   when they apply.
6. Treat the live baseline as authoritative over stale static docs.
7. Stop if forbidden files, `.env`, secrets, overlapping mutable scope, or ambiguous
   ownership appears.

## Hard boundaries

- Task start never synchronizes `main`. A separate, explicit, human-authorized clean
  main synchronization may do that work.
- A dirty worktree is evidence to report, not a condition an agent may repair.
- Do not continue from a baseline whose branch or HEAD changed during execution.

## References

- Use [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) as the command source of truth.
- Use [docs/ai-agents/prompt-contracts/agent-prompt-procedure.md](../../../docs/ai-agents/prompt-contracts/agent-prompt-procedure.md) for required prompt fields.
