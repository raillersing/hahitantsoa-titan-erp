---
name: erp-worktree-discipline
description: One-agent-one-worktree rules for Titan ERP. Use when starting any task to confirm the correct worktree and branch are being used.
---

# ERP Worktree Discipline

Load at the start of every task to confirm you are in the correct worktree.

## What I do

Enforce the worktree matrix so no two agents touch the same files.

## Checklist

- [ ] I am in the correct worktree for my assigned agent profile
- [ ] The current branch matches the assigned task
- [ ] No other worktree has the same branch checked out
- [ ] My files are limited to my agent's scope (`backend/`, `frontend/`, `scripts/dev/`, `docs/ai-agents/`, or `docs/audits/`)
- [ ] I am not modifying an active worktree owned by another agent
- [ ] No backend/frontend/agent-tools/agent-docs edits mixed in the same branch
- [ ] The worktree is not dirty with unrelated changes

## When to use me

Load at the start of every task and before switching contexts.

## References

- [AGENTS.md](../../../AGENTS.md) — Worktree Matrix section (authoritative)
- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — Dirty Worktree Policy
