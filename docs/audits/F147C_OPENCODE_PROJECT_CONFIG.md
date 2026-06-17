# F147C — OpenCode Project Configuration Audit Note

## Purpose

Add a controlled OpenCode project configuration that adapts OpenCode to the existing
Hahitantsoa/Titan ERP AI-agent workflow without modifying or replacing the Codex workflow.

## Files Changed

| File | Type |
|---|---|
| `opencode.json` | Updated with agents, commands, permissions |
| `.opencode/agents/backend-orchestrator.md` | New — backend adapter |
| `.opencode/agents/frontend-orchestrator.md` | New — frontend adapter |
| `.opencode/agents/docs-agent.md` | New — docs/audit adapter |
| `.opencode/agents/review-agent.md` | New — review adapter |
| `.opencode/commands/task-start.md` | New — task start command |
| `.opencode/commands/worktree-preflight.md` | New — preflight command |
| `.opencode/commands/pr-create.md` | New — PR creation command |
| `docs/ai-agents/orchestrator-task-queue.md` | Updated — F147C completion, F147D recommendation |

## Design Decisions

1. **Reference, don't duplicate**: All agent adapters and commands reference existing
   `docs/ai-agents` contracts. No workflow logic is redefined.
2. **Permissions default to ask**: Global `*` permission is `ask`. Agent-level permissions
   are tighter: reviewers get `deny` on edit/write, all get `ask` on bash by default.
3. **Thin wrappers**: Each agent adapter is a short prompt file that references the relevant
   contract doc and restates key rules — never recreating the full workflow.
4. **No automatic merge**: All agents and commands forbid automatic merge.
5. **Scope safe**: Only `opencode.json`, `.opencode/`, `docs/ai-agents/`, `docs/audits/`
   are touched. No backend, frontend, tests, or secrets.

## Validation

- `git diff --check` — PASS
- Worktree clean and on correct branch: `docs/f147c-opencode-project-config`
- Baseline: `origin/main` at `84a76ea` — green CI
