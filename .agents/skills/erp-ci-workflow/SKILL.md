---
name: erp-ci-workflow
description: Govern CI waiting, authorized merge coordination, and exact-SHA main validation for any Titan ERP PR. Use after PR creation; backend readiness belongs to erp-backend-pr-finalizer and cleanup belongs to erp-post-merge-cleanup.
---

# ERP CI Workflow

Use after opening a PR and after merge to validate CI.

## Phase: PR Creation

- [ ] Reconfirm the diff is limited to approved files
- [ ] Commit only allowed tracked files
- [ ] Check PR file scope before trusting CI — a scope violation in CI must stop the merge
- [ ] Open the PR only when authorized, with task-approved title and scope statement
- [ ] Treat PR creation/waiting and PR finalization as separate phases

## Pre-Merge CI Wait

- [ ] Open the PR (only when authorized)
- [ ] Wait for all required CI checks to complete with `SUCCESS`
- [ ] Use: `gh pr checks PR-NUMBER --watch --interval 30`
- [ ] Stop conditions: required check fails, CI cancelled/times out, merge conflict
- [ ] Do not merge until CI is green

## Merge

- [ ] Stop until the human explicitly authorizes merge and cleanup
- [ ] Reconfirm that the reviewed PR head SHA has not changed immediately before finalization
- [ ] Confirm that `scripts/dev/erp-pr-finalize-from-root` enforces that exact head SHA in its merge operation; hard stop and request an `agent-tools` correction if it does not
- [ ] Finalize only through that protected wrapper from root `main`
- [ ] Never run a raw merge command and never request remote branch deletion while its worktree is active
- [ ] No external `jq` in finalization scripts — use native `gh --json --jq`
- [ ] Verify PR state becomes `MERGED`

## Post-Merge Main CI Validation

- [ ] Identify the workflow run for the exact post-merge HEAD SHA
- [ ] Use: `gh run list --branch main --event push --json databaseId,headSha --jq '.[] | select(.headSha == "<SHA>") | .databaseId'`
- [ ] Wait for the run to complete with `SUCCESS`: `gh run watch RUN_ID --interval 30`
- [ ] If main CI fails, report immediately and do not start the next task

## Hard Stops

- The reviewed PR head SHA changed
- The root finalizer does not lock the merge to the reviewed head SHA
- Human merge or cleanup authorization is missing
- PR or exact-SHA `main` CI is not green

## When to use me

Load after opening a PR and again after merge.

## References

- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — CI Wait Policy and Post-Merge sections
- [docs/ai-agents/pr-quality-gates.md](../../../docs/ai-agents/pr-quality-gates.md) — merge and CI gates
