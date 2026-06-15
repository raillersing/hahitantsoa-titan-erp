---
name: hahitantsoa-erp-task-start
description: Run the mandatory Titan ERP executable-task baseline and scope check for Codex in the repo worktree. Use when a Codex task can execute commands or mutate files in this repository. Do not use for plan-only agents or as a replacement for the canonical governance docs.
---

# Hahitantsoa ERP Task Start

Run this skill at the beginning of every executable Codex task in this repository.

## Workflow

1. Confirm the assigned profile is `codex-native-wsl-mutating` or another explicitly assigned executable profile from [docs/ai-agents/agent-profiles.md](../../../../docs/ai-agents/agent-profiles.md).
2. Start from the authorized worktree only.
3. Run the integrated baseline first:

```sh
cd "$HOME/projects/hahitantsoa-titan-erp"

scripts/dev/erp-logged-run task-name <<'AGENTBASELINE'
set -euo pipefail
bash scripts/dev/erp-agent-task-start
AGENTBASELINE
```

4. Treat the live baseline as authoritative over stale static docs.
5. Stop if forbidden files, `.env`, secrets, overlapping mutable scope, or ambiguous ownership appears.

## References

- Read [references/workflow-summary.md](references/workflow-summary.md) for the short checklist.
- Use [docs/ai-agents/agent-command-runbook.md](../../../../docs/ai-agents/agent-command-runbook.md) as the command source of truth.
- Use [docs/ai-agents/prompt-contracts/agent-prompt-procedure.md](../../../../docs/ai-agents/prompt-contracts/agent-prompt-procedure.md) for required prompt fields.
