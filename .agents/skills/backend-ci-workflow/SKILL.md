---
name: backend-ci-workflow
description: CI wait, merge, and post-merge validation procedure for Titan ERP backend PRs. Use after opening a PR and before and after merge.
---

# Backend CI Workflow

Use after opening a PR and after merge to validate CI.

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
