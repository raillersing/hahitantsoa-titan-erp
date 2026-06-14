# F138F Worktree Lifecycle And Recovery

## Status

Implemented for the agent-lifecycle worktree.

## Objective

Provide an explicit lifecycle foundation for agent worktrees and a documented recovery
layer for interrupted or partial operations.

This closes two gaps:

- F138F: no official validated registry or cleanup automation for the growing set of
  dedicated worktrees;
- F138N: no official recovery playbook for common interruption and partial-cleanup cases.

## Delivered Files

- `scripts/dev/erp-worktree-list-validated`
- `scripts/dev/erp-worktree-clean-after-merge`
- `docs/ai-agents/worktree-registry.md`
- `docs/ai-agents/recovery-playbooks.md`
- this audit

Minimal README links may be added when useful so the docs become part of the official
agent corpus.

## Why A Registry Was Needed

The project now uses multiple persistent worktrees:

- main-root
- backend
- frontend
- agent-tools
- agent-docs
- agent-lifecycle
- agent-security
- agent-prompts

Without an official registry, prompts have to restate path ownership, persistence, and
cleanup rules repeatedly. That increases prompt size and raises the chance of an agent
touching the wrong worktree.

## Why Lifecycle Automation Was Needed

Post-merge cleanup is one of the easiest places to make a destructive mistake.

The new cleanup helper is intentionally conservative:

- dry-run by default;
- requires a branch name;
- requires merge into `origin/main`;
- stops on dirty worktrees;
- stops on secret-like paths;
- stops if the branch is still active or still owned by an unsafe context.

This is deliberate friction. A false stop is safer than deleting an in-progress task.

## Why Recovery Playbooks Were Needed

The active workflow now relies on multiple branches, multiple worktrees, PR CI, and
post-merge main validation. Common interruption cases were predictable but undocumented:

- connection cut during a task;
- PR merged but branch deletion failed;
- branch still owned by another worktree;
- permission denied during worktree removal;
- backend WIP behind `origin/main`;
- secret-like file or `.env` stop conditions.

Documenting these cases reduces operator improvisation and keeps recovery aligned with
the same non-secret, non-destructive principles as normal task execution.

## Expected Usage

At baseline or resume:

- run `scripts/dev/erp-worktree-list-validated`
- read `docs/ai-agents/worktree-registry.md`
- read `docs/ai-agents/recovery-playbooks.md` when recovering from interruption

After merge and human approval for cleanup:

- run `scripts/dev/erp-worktree-clean-after-merge branch-name`
- inspect the dry-run output
- rerun with `--apply` only when the target is clean and confirmed

## Safety Invariants

- never read, source, print, copy, or create `.env`
- never bypass a secret-like stop
- never delete a dirty worktree
- never force-remove a branch that is still owned by another worktree
- never treat OpenClaw sandbox paths as active workflow authority

## Validation Target

F138F/F138N is considered ready when these checks pass:

- `bash -n scripts/dev/erp-worktree-list-validated`
- `bash -n scripts/dev/erp-worktree-clean-after-merge`
- `git diff --check`
- anti-mojibake check
- `scripts/dev/erp-worktree-list-validated`
- `scripts/dev/erp-worktree-clean-after-merge --help`
- no changes in `backend/`, `frontend/`, `.github/`, `.env`, dependencies, or Compose
