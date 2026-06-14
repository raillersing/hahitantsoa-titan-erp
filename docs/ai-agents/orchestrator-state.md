# Orchestrator State

## Version

- ledger: `orchestrator-state`
- version: `F138K-v1`
- last-updated-main-head: `f808b3951b96507ccb31013c9e1537c42a0d4f5d`

## Current Main HEAD

- `origin/main`: `f808b3951b96507ccb31013c9e1537c42a0d4f5d`
- title: `docs-agent-runbook-and-orchestrator-queue-f138d (#163)`

## Active Backend Task

- task: `F135B`
- state: active
- branch or worktree: `feat/f135b-reservation-confirmation-private-api` in backend worktree
- scope: private reservation confirmation API only

## Active Frontend Task

- task: `F137C`
- state: next-active frontend slice
- branch or worktree: frontend worktree currently detached and awaiting next task branch
- scope: approved frontend continuation after F137B

## Active Docs And Tools Tasks

- `F138F/F138N`
  - state: open PR
  - branch: `chore/f138f-worktree-lifecycle-and-recovery`
  - PR: [#164](https://github.com/raillersing/hahitantsoa-titan-erp/pull/164)
- `F138G/F138H`
  - state: open PR
  - branch: `chore/f138g-security-and-secret-hygiene`
  - PR: [#165](https://github.com/raillersing/hahitantsoa-titan-erp/pull/165)
- `F138I/F138K/F138L/F138M`
  - state: in progress in agent-prompts worktree
  - branch: `docs/f138i-prompt-contracts-review-agent-state`

## Blocked Tasks

- none explicitly blocked at this ledger revision

## Open PRs

- [#164](https://github.com/raillersing/hahitantsoa-titan-erp/pull/164) `chore/f138f-worktree-lifecycle-and-recovery`
- [#165](https://github.com/raillersing/hahitantsoa-titan-erp/pull/165) `chore/f138g-security-and-secret-hygiene`

## Last Green Main CI

- run: [27491764627](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/27491764627)
- head SHA: `f808b3951b96507ccb31013c9e1537c42a0d4f5d`
- conclusion: success

## Next Allowed Task

- next backend implementation remains `F135B`
- next frontend implementation remains `F137C`
- next docs or tools task after currently open F138 PRs depends on human approval and green PR CI

## Ledger Update Rule

Update this ledger when any of these changes occurs:

- `origin/main` advances
- active backend or frontend task changes
- active docs or tools task changes
- a task becomes blocked or unblocked
- open PR inventory changes
- latest green `main` CI changes
