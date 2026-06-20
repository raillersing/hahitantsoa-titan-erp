---
name: erp-backend-pr-finalizer
description: Backend PR finalization steps for focused tests, CI, merge, exact-SHA main CI, and cleanup
---

## What I do

Standardize the backend PR finish line after implementation is complete.

## Checklist

- [ ] Run focused tests with `scripts/dev/erp-backend-fast`
- [ ] Run `scripts/dev/erp-backend-migration-guard`
- [ ] Run `scripts/dev/erp-backend-ci`
- [ ] Run `scripts/dev/erp-agent-scope-guard backend`
- [ ] Wait for PR checks with `gh pr checks PR-NUMBER --watch --interval 30`
- [ ] Merge with `gh pr merge PR-NUMBER --squash --match-head-commit COMMIT_SHA`
- [ ] Verify exact-SHA `main` CI after merge
- [ ] Clean the task worktree and branch only after main CI succeeds

## When to use me

Load when the backend implementation is ready for PR, merge, and post-merge validation.

## Inputs to inspect

- branch name and head SHA
- PR state and CI status
- mergeability
- post-merge main run for the exact SHA

## Commands / wrappers to run

- `scripts/dev/erp-backend-fast`
- `scripts/dev/erp-backend-migration-guard`
- `scripts/dev/erp-backend-ci`
- `scripts/dev/erp-agent-scope-guard backend`

## Hard stops

- PR checks are failing or still pending
- head SHA changed after verification
- main CI does not match the exact merged SHA
- cleanup would happen before main CI succeeds

## Expected output

- PR number and URL
- validation summary
- merge and exact-SHA main-CI status
- cleanup status

## Source

- [Backend Orchestrator Prompt Contract](../../../docs/ai-agents/prompt-contracts/backend-orchestrator.md)
- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
