# New Conversation Starters

## Purpose

Use these short official starters for new AI conversations in this repository.

Each starter assumes the agent will read the referenced docs instead of requiring a long
inline prompt.

## ChatGPT handoff

```text
Use the repository AI workflow in `AGENTS.md` and start at
`docs/ai-agents/AI_ORCHESTRATION_INDEX.md`.

Read the correct route, then use:
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`

Keep the prompt short, stay inside the approved scope, and apply the correct hard stop
conditions.
```

## Codex backend orchestration

```text
Backend-only task. Start at `docs/ai-agents/AI_ORCHESTRATION_INDEX.md`, then follow:
- `docs/ai-agents/prompt-contracts/backend-orchestrator.md`
- `docs/ai-agents/backend-agent-template.md`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`

Assign only relevant backend agents. Use official wrappers when applicable. Keep the
bundle medium-sized. Reporting alone is not a stopping condition.
```

## Codex frontend orchestration

```text
Frontend-only task. Start at `docs/ai-agents/AI_ORCHESTRATION_INDEX.md`, then follow:
- `docs/ai-agents/prompt-contracts/frontend-orchestrator.md`
- `docs/ai-agents/frontend-agent-template.md`
- `docs/ai-agents/agent-command-runbook.md`
- `docs/ai-agents/orchestrator-task-queue.md`

Assign only relevant frontend agents. Keep backend/frontend boundaries intact and stop if
the task requires unauthorized backend mutation.
```

## Antigravity or tooling orchestration

```text
Tooling or orchestration-governance task only. Start at
`docs/ai-agents/AI_ORCHESTRATION_INDEX.md`, then follow:
- `docs/ai-agents/tooling/antigravity-workflow.md`
- `docs/ai-agents/tooling/antigravity-orchestration-capability-model.md`
- `docs/ai-agents/prompt-contracts/agent-prompt-procedure.md`
- `docs/ai-agents/agent-command-runbook.md`

Use the assigned Antigravity profile only. Do not drift into backend or frontend feature
work.
```

## OpenCode orchestration

```text
OpenCode task. Start at `docs/ai-agents/AI_ORCHESTRATION_INDEX.md`, then follow:
- `docs/ai-agents/tooling/opencode-workflow.md`
- `docs/ai-agents/cross-agent-compatibility.md`
- `docs/ai-agents/agent-profiles.md`
- `docs/ai-agents/prompt-contracts/agent-prompt-procedure.md`
- `docs/ai-agents/agent-command-runbook.md`

Use the assigned OpenCode profile only. OpenCode Web from WSL is bounded review/docs
compatible in smoke coverage. OpenCode Desktop Windows remains plan-only and must not
mutate repository files.
```
