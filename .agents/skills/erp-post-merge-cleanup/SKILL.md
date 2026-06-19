---
name: erp-post-merge-cleanup
description: Branch, worktree, and Docker cleanup procedure after Titan ERP PR merge. Use after a PR is merged and post-merge main CI is green.
---

# ERP Post-Merge Cleanup

Load after a PR is merged and post-merge main CI is confirmed green.

## What I do

Safely clean up task resources without data loss or orphaned containers.

## Checklist

- [ ] Post-merge main CI is green (SHA-bound verification)
- [ ] Human has authorized cleanup
- [ ] Local branch deleted: `git branch -d branch-name`
- [ ] Remote branch deleted: `git push origin --delete branch-name`
- [ ] Worktree removed using dedicated wrapper: `bash scripts/dev/erp-worktree-clean-after-merge --apply branch-name`
- [ ] Docker containers cleaned: `bash scripts/dev/erp-docker-agent-cleanup --apply`
- [ ] Stale worktree metadata pruned: `git worktree prune`
- [ ] No orphaned containers remaining

## Rules

- Never use `gh pr merge --delete-branch` (unsafe with active worktrees)
- Never manually delete `.git/worktrees/` metadata — use `git worktree prune` or dedicated wrappers
- Never run `rm -rf` on worktree directories
- Docker cleanup preserves volumes by default (no `--dangerous-allow-volume-removal`)
- Cleanup runs automatically in `erp-pr-worktree-finalize` and `erp-worktree-clean-after-merge`

## When to use me

Load after every PR merge when the task authorizes cleanup.

## References

- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — Post-Merge Cleanup Commands section (authoritative)
- [docs/ai-agents/pr-quality-gates.md](../../../docs/ai-agents/pr-quality-gates.md) — merge and CI gates
