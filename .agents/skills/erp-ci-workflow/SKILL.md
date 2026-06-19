---
name: erp-ci-workflow
description: CI wait, merge, and post-merge validation procedure for Titan ERP PRs. Use after opening a PR and before and after merge.
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
- [ ] Use: `gh pr checks PR-NUMBER --watch --interval 15`
- [ ] Stop conditions: required check fails, CI cancelled/times out, merge conflict
- [ ] Do not merge until CI is green

## Merge

- [ ] Use only from the root worktree (`/home/raillersing/projects/hahitantsoa-titan-erp`)
- [ ] Use: `gh pr merge PR-NUMBER --squash --match-head-commit COMMIT_SHA --delete-branch`
- [ ] Do not use raw `gh pr merge` from a task worktree
- [ ] No external `jq` in finalization scripts — use native `gh --json --jq`
- [ ] Verify PR state becomes `MERGED`

## Post-Merge Main CI Validation

- [ ] Identify the workflow run for the exact post-merge HEAD SHA
- [ ] Use: `gh run list --branch main --event push --json databaseId,headSha --jq '.[] | select(.headSha == "<SHA>") | .databaseId'`
- [ ] Wait for the run to complete with `SUCCESS`: `gh run watch RUN_ID --interval 15`
- [ ] If main CI fails, report immediately and do not start the next task

## When to use me

Load after opening a PR and again after merge.

## References

- [docs/ai-agents/agent-command-runbook.md](../../../docs/ai-agents/agent-command-runbook.md) — CI Wait Policy and Post-Merge sections
- [docs/ai-agents/pr-quality-gates.md](../../../docs/ai-agents/pr-quality-gates.md) — merge and CI gates
