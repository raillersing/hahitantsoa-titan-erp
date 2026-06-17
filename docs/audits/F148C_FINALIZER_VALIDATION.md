# F148C — Validate and Harden Safe Worktree PR Finalization Wrapper

## Summary

Code review and hardening of `scripts/dev/erp-pr-worktree-finalize` (created in F148B)
before it is used for backend/frontend task finalization.

## Validated Issues Found

### 1. Pending CI Checks Treated as Success (Critical)

**Problem:** The `statusCheckRollup` fallback filter selected checks where
`.conclusion != null`, which excludes pending/in-progress checks (their `conclusion` is
`null`). If all checks were still running, `failed_count` was 0 and the script proceeded
to merge.

**Fix:** Added an explicit pending check count before the failed check count:
```jq
select(.status != "COMPLETED")
```
The script now rejects merge if any check has not completed. Both pending and failed
checks block finalization.

### 2. Orphaned Worktree After `git worktree remove` (High)

**Problem:** After `git worktree remove`, the worktree directory's `.git` metadata is
deleted. Final `git status --short` and `git worktree list` commands ran from the
orphaned directory, causing git errors.

**Fix:** Added `cd "$REPO_ROOT"` immediately after worktree removal. All subsequent git
commands run from the main repository root.

### 3. Root-Only Finalization Rule Contradiction (Medium)

**Problem:** The runbook's "Root-only finalization rule" stated that only the
main-root worktree may merge PRs, contradicting the new worktree finalization wrapper.

**Fix:** Updated the rule to add an exception for `scripts/dev/erp-pr-worktree-finalize`.
The rule now says "Do not run raw `gh pr merge` from any worktree" instead of banning
all worktree merging.

### 4. One-Task-One-Branch Enforcement Missing (Medium)

**Problem:** The script did not verify that the task branch is checked out in only one
worktree. A branch used across multiple worktrees would cause delete conflicts.

**Fix:** Added a branch-uniqueness check that counts the worktrees holding the branch
and stops if the count exceeds 1.

### 5. Execution Context Ambiguity (Medium)

**Problem:** The runbook example always provided `--worktree` and `--branch`, implying
the script could be called from anywhere. The script also lacked a check that it's not
running from root/main.

**Fix:** Added a hard stop that refuses to run from the root/main worktree. Updated the
runbook to show the simpler default invocation (no options needed) and to clarify that
the script must run from the task worktree.

## Files Changed

| File | Action |
|---|---|
| `scripts/dev/erp-pr-worktree-finalize` | Hardened — pending-check guard, branch-uniqueness check, root-worktree refusal, REPO_ROOT fallback after removal |
| `docs/ai-agents/agent-command-runbook.md` | Updated — clarified root-only rule, simplified worktree finalization example |
| `docs/ai-agents/orchestrator-task-queue.md` | Updated — F148A/B marked merged, F148C entry added |
| `docs/audits/F148C_FINALIZER_VALIDATION.md` | Created — this audit note |

## Validation

- `bash scripts/dev/erp-agent-scope-guard agent-tools` — PASS
- `bash scripts/dev/erp-pr-worktree-finalize --help` — shows updated usage
- `git diff --check` — PASS
- PR CI green — verified

## Review Hardening (F148C repair)

During review of the hardened script, two recurring validation mistakes were documented
and remediated in `docs/ai-agents/agent-command-runbook.md` under a new
**PR Script Validation Patterns** section:

1. **Piped `git show` breaks `BASH_SOURCE`**:
   `git show <ref>:script | bash -s -- --help` strips the script path, so any
   `BASH_SOURCE[0]`-based path resolution fails. The runbook now prescribes materialising
   to a temp file with `mktemp` before execution.

2. **Broad `--delete-branch` grep false positives**:
   Grepping the entire file for `--delete-branch` hits help-text lines like "without
   `--delete-branch`". The runbook now prescribes scoping the grep to `gh pr merge`
   invocations only: `grep -En 'gh pr merge' | grep -- '--delete-branch'`.

These patterns should be used by any agent validating script changes in future PRs.
