---
name: erp-post-merge-cleanup
description: Clean Titan ERP task branches, worktrees, and containers after an authorized merge and green exact-SHA main CI. Use only for cleanup; CI verification belongs to erp-ci-workflow.
---

# ERP Post-Merge Cleanup

Load after a PR is merged and post-merge main CI is confirmed green.

## What I do

Safely clean up task resources without data loss or orphaned containers.

## Checklist

- [ ] Post-merge main CI is green (SHA-bound verification)
- [ ] Human has authorized cleanup
- [ ] Prefer the cleanup phase of `scripts/dev/erp-pr-finalize-from-root` from root `main`
- [ ] Otherwise use `bash scripts/dev/erp-worktree-clean-after-merge --apply branch-name`; it cleans task containers, removes the worktree, then deletes the local branch
- [ ] Delete the remote task branch only after the worktree is gone and only when cleanup authorization covers it
- [ ] Stale worktree metadata pruned: `git worktree prune`
- [ ] No orphaned containers remaining

## Rules

- Never use `gh pr merge --delete-branch` (unsafe with active worktrees)
- Never manually delete `.git/worktrees/` metadata — use `git worktree prune` or dedicated wrappers
- Never run `rm -rf` on worktree directories
- Docker cleanup preserves volumes by default (no `--dangerous-allow-volume-removal`)
- Cleanup runs through the approved finalization or cleanup wrappers; do not reconstruct their sequence manually

## When to use me

Load after every PR merge when the task authorizes cleanup.

## References

- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — Post-Merge Cleanup Commands section (authoritative)
- [docs/ai-agents/pr-quality-gates.md](../../../docs/ai-agents/pr-quality-gates.md) — merge and CI gates
