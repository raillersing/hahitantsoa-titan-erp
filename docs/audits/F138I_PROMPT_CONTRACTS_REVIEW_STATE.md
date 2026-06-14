# F138I Prompt Contracts Review State

## Status

Implemented in the agent-prompts worktree.

## Objective

Provide a versioned contract layer for short prompts, a durable orchestrator state
ledger, a review-only agent template, and an explicit parallelism policy.

This covers:

- F138I: prompt contracts
- F138K: orchestrator state ledger
- F138L: review-only agent workflow
- F138M: conflict and parallelism policy

The amended slice also adds controlled-autonomy policy and a Pursue Goal contract so
future orchestrator prompts can stay short without becoming underspecified.

## Delivered Files

- `docs/ai-agents/prompt-contracts/backend-orchestrator.md`
- `docs/ai-agents/prompt-contracts/frontend-orchestrator.md`
- `docs/ai-agents/prompt-contracts/docs-agent.md`
- `docs/ai-agents/prompt-contracts/tools-agent.md`
- `docs/ai-agents/prompt-contracts/review-agent.md`
- `docs/ai-agents/orchestrator-state.md`
- `docs/ai-agents/review-agent-template.md`
- `docs/ai-agents/parallel-agent-policy.md`
- `docs/ai-agents/autonomous-agent-policy.md`
- `docs/ai-agents/pursue-goal-contract.md`
- this audit

## Why Prompt Contracts Were Needed

Prompts were already becoming shorter after F138D, but the project still lacked versioned
contracts that define:

- required inputs
- expected outputs
- final report format
- stop conditions
- review-only constraints

These contracts reduce ambiguity without forcing every future prompt to restate the same
operational structure.

## Why A State Ledger Was Needed

The queue defines ordering, but not the current operational snapshot. A separate ledger is
needed for:

- current `origin/main` HEAD
- active backend task
- active frontend task
- current docs and tools tasks
- blocked tasks
- open PRs
- last green `main` CI
- next allowed task

## Why Review-Only Workflow Was Needed

The project had reviewer roles, but the non-mutating contract was scattered. The
review-agent template makes it explicit that review-only means:

- inspect
- report
- do not edit
- do not push
- do not merge

unless a task explicitly changes that mode.

## Why A Parallelism Policy Was Needed

Multiple dedicated worktrees now exist, so it is not enough to say "parallel work is
allowed". The actual rule must be:

- parallel mutation is allowed only when mutable file globs do not overlap
- overlapping mutable scope requires serialization or review-only mode

## Validation Target

F138I/F138K/F138L/F138M is considered ready when:

- `git diff --check` passes
- anti-mojibake check passes
- no files change in `backend/`, `frontend/`, `scripts/`, `.github/`, dependencies,
  Compose, or `.env`
- README links exist if README was updated
