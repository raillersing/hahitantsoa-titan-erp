# F138D Orchestrator Task Queue And Runbook

## Status

Implemented in the agent-docs worktree.

## Why These Documents Were Added

The project already had authoritative workflow documents, but future agent prompts were still
at risk of becoming too long because they had to restate:

- how to start a task safely;
- how to resume after a connection cut;
- how to separate backend and frontend worktrees;
- which task is currently active or next in queue;
- which commands are standard versus forbidden.

F138D adds official reusable documents so this operational knowledge can be referenced rather
than retyped in each new prompt.

## Documents Added

### `docs/ai-agents/agent-command-runbook.md`

Provides ready-to-use command blocks for:

- task start;
- backend validation;
- frontend validation;
- PR and CI follow-up;
- resume after interruption;
- post-merge cleanup;
- forbidden commands.

It also repeats the project rule that important terminal work must go through
`scripts/dev/erp-logged-run`.

### `docs/ai-agents/orchestrator-task-queue.md`

Provides the operational queue state for orchestrators:

- current state;
- active backend task F135B;
- next frontend task F137C;
- follow-up frontend tasks F137D and F137E;
- later repair track F138E;
- expected scope, stop conditions, validation, and worktree separation.

### This Audit

Explains why the runbook and queue exist and how they fit into the multi-agent workflow.

## How These Docs Reduce Prompt Size

Instead of embedding large command templates and queue reminders into every task, future prompts
can now reference:

- the command runbook for standard command blocks;
- the task queue for active and next task state;
- the existing agent templates for role selection and review expectations.

This reduces duplication and lowers the chance of prompt drift between tasks.

## How Agents Should Use Them

At task start:

1. Read `AGENTS.md`.
2. Read `docs/ai-agents/agent-command-runbook.md`.
3. Read `docs/ai-agents/orchestrator-task-queue.md`.
4. Confirm the assigned branch, worktree, scope, and validation plan.

During implementation:

- use the runbook command patterns instead of ad hoc shell usage;
- use the queue to verify whether the task is active, next, or blocked;
- stop if the real worktree or diff no longer matches the queue assumptions.

During resume after interruption:

- re-run the baseline and profile-specific preflight sequence from the runbook;
- verify the queue still matches the intended task before continuing.

## Relationship With F138B And F138C

The new docs can reference the wrappers introduced by F138B/F138C even if that PR lands
separately.

These commands become standard required wrappers only after merge of F138B/F138C:

- `scripts/dev/erp-backend-compose-ci`
- `scripts/dev/erp-agent-scope-guard`
- `scripts/dev/erp-worktree-preflight`

Until then, the runbook treats them as target-state commands rather than guaranteed current
repository capabilities.

## Remaining Limits

- The queue remains a documented operational view, not an automatic scheduler.
- Exact scope still has to be stated in each task prompt.
- Human merge control remains mandatory.
- CI diagnosis still requires task-specific judgment when failures appear.
- If the active backend or frontend priorities change, this queue must be updated in a later
  small docs PR.
