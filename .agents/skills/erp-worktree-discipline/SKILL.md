---
name: erp-worktree-discipline
description: Diagnose Titan ERP worktree ownership, branch, and overlapping-scope problems. Use when task-start reports an ambiguity or before changing worktrees; do not load after a normal integrated baseline succeeds.
---

# ERP Worktree Discipline

Load only when the integrated baseline reports an ownership, branch, or scope problem,
or before an explicitly authorized worktree transition.

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

## References

- [AGENTS.md](../../../AGENTS.md) — Worktree Matrix section (authoritative)
- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — Dirty Worktree Policy
