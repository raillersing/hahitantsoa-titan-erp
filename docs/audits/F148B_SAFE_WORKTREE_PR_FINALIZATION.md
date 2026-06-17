# F148B — Safe Worktree PR Finalization Wrapper

## Summary

Add `scripts/dev/erp-pr-worktree-finalize`, an official wrapper for finalizing PRs from
dedicated worktrees without triggering the `cannot delete branch used by worktree`
failure caused by `gh pr merge --delete-branch`.

## Problem

The existing finalization workflow relies on:

- `scripts/dev/erp-pr-finalize-from-root` — runs only from the main-root worktree
- Manipulating worktrees from the root repo

When an agent tries to finalize a PR from within the task worktree (e.g. to merge and
clean up the worktree it is running inside), `gh pr merge --delete-branch` fails because
git refuses to delete a branch that is still checked out in a linked worktree. After a
squash merge, `git branch -d` also fails because the branch commit is not an ancestor of
main, even when the PR is MERGED.

## Solution

`scripts/dev/erp-pr-worktree-finalize` avoids the problem by:

1. Merging without `--delete-branch`: `gh pr merge --squash --match-head-commit`
2. Confirming PR state becomes `MERGED` and main CI is green
3. Removing the clean worktree with `git worktree remove` after merge
4. Deleting the local branch with `git branch -D` after confirming `PR_STATE=MERGED` and
   worktree is gone
5. Deleting the remote branch with `git push origin --delete "$BRANCH" || true`
6. Pruning stale worktree metadata

## Hard Stops

The script enforces:

- Worktree must be clean (no dirty files)
- PR must be `OPEN` and `MERGEABLE`
- PR must target `main`
- PR head branch must match the task branch
- Required checks must pass before merge
- PR must become `MERGED` within timeout
- Main CI must be green after merge
- Worktree removal must succeed
- Local branch deletion only after confirmed `MERGED`
- Refuses to run on `main` or `master`
- Refuses to remove the main repository worktree

## Files Changed

| File | Action |
|---|---|
| `scripts/dev/erp-pr-worktree-finalize` | Created — worktree-safe PR finalization script |
| `docs/ai-agents/agent-command-runbook.md` | Updated — added Worktree PR Finalization section |
| `docs/ai-agents/orchestrator-task-queue.md` | Updated — added F148B entry |
| `docs/audits/F148B_SAFE_WORKTREE_PR_FINALIZATION.md` | Created — this audit note |

## Validation

- `bash scripts/dev/erp-agent-scope-guard agent-tools` — PASS
- `bash scripts/dev/erp-pr-worktree-finalize --help` — shows usage
- `bash scripts/dev/erp-pr-worktree-finalize` (no args) — exits 2 with usage
- `git diff --check` — PASS
- PR CI green — verified
