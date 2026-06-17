# F149B — Worktree Finalizer Main-Sync Repair

## Bug

`scripts/dev/erp-pr-worktree-finalize` had a main-sync failure after PR merge.

**Root cause:** After merging the PR, the script changed to `$REPO_ROOT` (the task
worktree root) to sync `main`. The task worktree is still on the feature branch,
so `git branch --show-current` returned the feature branch name, not `main`.
This triggered the safety check "root worktree is not on main" and the script
exited with `ERROR`, leaving PR merged but worktree and branch uncleaned.

## Impact

From F149A observation: PR #270 (F148B) and PR #275 (F149A) both merged
successfully, but the post-merge cleanup steps (worktree removal, branch
deletion, remote branch cleanup) were skipped. Manual cleanup was required
after each merge.

This means:
- Stale worktrees accumulated until manually removed
- Local branches remained until manually deleted
- Remote branches required manual `git push origin --delete`
- The finalization script could not be trusted for unattended cleanup

## Fix

`MAIN_PATH` was already computed at the top of the script from
`git worktree list --porcelain` (the first entry is always the main repository
root). However, the post-merge code paths used `$REPO_ROOT` (the worktree root)
instead of `$MAIN_PATH`.

Two lines changed:

| Line | Before | After |
|------|--------|-------|
| Post-merge main sync | `cd "$REPO_ROOT"` | `cd "$MAIN_PATH"` |
| After worktree removal | `cd "$REPO_ROOT"` | `cd "$MAIN_PATH"` |

Additional safety added:
- Empty `$MAIN_PATH` check before attempting `cd`
- Missing directory check for `$MAIN_PATH`
- Error message updated from "root worktree" to "MAIN_PATH" for clarity
- Help text updated to document the main-sync logic
- Comment added explaining `MAIN_PATH` derivation

## Validation

Static validation proving the fix:

```
$ grep -n 'cd "\$MAIN_PATH"' scripts/dev/erp-pr-worktree-finalize
270:cd "$MAIN_PATH"
324:cd "$MAIN_PATH"

$ grep -n 'cd "\$REPO_ROOT"' scripts/dev/erp-pr-worktree-finalize
(no output — REPO_ROOT is no longer used for cd after merge)

$ grep -En 'gh pr merge' scripts/dev/erp-pr-worktree-finalize
 29:  - merging with gh pr merge --squash --match-head-commit and without --delete-branch
240:gh pr merge "$PR_NUMBER" --squash --match-head-commit "$PR_HEAD_SHA"

$ grep -En 'gh pr merge' scripts/dev/erp-pr-worktree-finalize | grep -- '--delete-branch'
(no output — no --delete-branch in any merge invocation)
```

Runtime validation:
- `bash scripts/dev/erp-pr-worktree-finalize --help` — shows updated usage
- `bash scripts/dev/erp-agent-scope-guard agent-tools` — PASS
- `git diff --check` — PASS
- `bash -n scripts/dev/erp-pr-worktree-finalize` — syntax PASS
- PR CI green before merge
- main CI green after merge

## Runbook Updates

- Worktree PR Finalization section updated: "main-sync bug fixed in F149B"
- Post-merge step 4 added: "switching to the main repository root (MAIN_PATH)"
- New "Finalizer Main-Sync Validation" section added with grep patterns

## Task Queue Updates

- F149B added as active task
- F149A marked as merged
