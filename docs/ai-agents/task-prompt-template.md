# Multi-agent task prompt template

Use this template with the canonical procedure in
[`docs/ai-agents/prompt-contracts/agent-prompt-procedure.md`](prompt-contracts/agent-prompt-procedure.md).
Every field required by that procedure must appear in the final task prompt.

```text
Task:
<task ID and title>

Working directory:
- <path>

Authorized worktree:
- <path>

Forbidden worktrees:
- <path>
- <path>

Agent role:
- <backend|frontend|docs/tools governance|review-only|other approved role>

Autonomy:
- <level>

Read first:
- docs/ai-agents/prompt-contracts/agent-prompt-procedure.md
- docs/ai-agents/agent-command-runbook.md
- docs/ai-agents/worktree-registry.md
- docs/ai-agents/parallel-agent-policy.md
- <task-specific file>

Current repo baseline:
- main branch: <branch>
- main SHA: <sha>
- current green main CI: <run or pending>
- active PR state: <none|PR #...>
- allowed dirty files: <none or explicit list>

Dirty-worktree stop condition:
- stop if any dirty file exists outside the explicitly allowed dirty set for this task

Allowed scope:
- <list>

Forbidden scope:
- <list>
- forbidden behavior: <list>

Command mode:
- all important commands run through `scripts/dev/erp-logged-run <task-name> <<'EOF' ... EOF`
- Codex/native WSL-bash agents may execute approved repo commands
- Windows-hosted agents are plan-only unless an explicit WSL adapter is approved
- no improvised PowerShell-to-WSL bridge

Validation commands:
- <focused command>
- <focused command>

Permanent prohibitions:
- no `.env` read/source/copy/display/create`
- no secrets
- no `/tmp` scripts as primary mechanism
- no `chmod` unless explicitly authorized
- no host python for backend Django tests
- no merge/push without human approval

Expected output:
- files read
- files changed
- validation commands and results
- final git status
- recommended PR title if relevant

Stop conditions:
- <condition>
- <condition>

Merge/push policy:
- inspect: <yes/no>
- edit: <yes/no>
- commit: <yes/no>
- push: <yes/no>
- open PR: <yes/no>
- merge: no unless explicitly authorized
```
