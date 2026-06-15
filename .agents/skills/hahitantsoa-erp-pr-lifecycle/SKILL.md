---
name: hahitantsoa-erp-pr-lifecycle
description: Execute the standard Titan ERP PR lifecycle for Codex after an approved bounded change is ready. Use when a task explicitly authorizes branch creation, commit, push, PR, CI wait, squash merge, main CI verification, and cleanup. Do not use before scope validation or for plan-only review tasks.
---

# Hahitantsoa ERP PR Lifecycle

Use this skill only after implementation and local validation are complete.

## Workflow

1. Reconfirm the diff is limited to the approved files.
2. Commit only the allowed tracked files.
3. Push the branch and open the PR with the task-approved title and scope statement.
4. Check PR file scope before trusting CI.
5. Wait for both required PR checks to complete successfully.
6. Treat PR creation/waiting and PR finalization as separate phases.
7. Squash merge only from `/home/raillersing/projects/hahitantsoa-titan-erp` on branch
   `main`, using `scripts/dev/erp-pr-finalize-from-root` or an equivalent logged root
   command, and only when the task explicitly allows it, the PR is mergeable, and PR
   scope stays valid.
8. Sync `main`, identify the new `main` CI run, and wait for success.
9. Remove the local task worktree and branch only after `main` CI is green.

## References

- Read [references/pr-checklist.md](references/pr-checklist.md) for the short sequence.
- Use [docs/ai-agents/agent-command-runbook.md](../../../../docs/ai-agents/agent-command-runbook.md) for canonical command patterns.
- Use [docs/ai-agents/pr-quality-gates.md](../../../../docs/ai-agents/pr-quality-gates.md) for merge and CI gates.
