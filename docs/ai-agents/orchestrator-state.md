# Orchestrator State

## State Semantics

This file is an operational snapshot. Update it after merge plus green `main` CI.

Agents must still run the integrated task-start baseline. Live baseline wins over this
snapshot when they disagree, and the mismatch must be reported.

## Version

- ledger: `orchestrator-state`
- version: `MG-BACKEND-v1`
- last-updated-main-head: `e433ddbec9d45596650faf5294437fbfeff4fe32`

## Current Main HEAD

- `origin/main`: `e433ddbec9d45596650faf5294437fbfeff4fe32`
- title: `feat(hahitantsoa): add shared availability readonly facade (#183)`

## Current Workflow Activation

- agent profile assignment: required before delegation
- executable task-start baseline: `bash scripts/dev/erp-agent-task-start`
- static/live precedence: live baseline wins
- primary bounded mutating agent: Codex
- Antigravity: review/docs-only unless promoted
- OpenCode Web WSL: experimental review/docs-governance
- OpenCode Desktop Windows: plan-only

## Active Backend Task

- no active backend implementation task recorded
- `F126B`, `F126C`, and `F83` are complete and merged
- no next Hahitantsoa backend slice is selected safely without further clarification or approval

## Active Frontend Task

- task: frontend readiness planning
- PR: `#175`
- state: open
- note: this governance task must not merge or modify PR `#175`

## Active Docs And Tools Tasks

- no active docs/tools governance task recorded in this snapshot

## Blocked Tasks

- next Hahitantsoa backend expansion beyond `F83` remains blocked pending explicit task approval or business clarification

## Open PRs

- `#175` docs(frontend): add frontend readiness plan and task queue

## Last Green Main CI

- run: [27533193483](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/27533193483)
- head SHA: `e433ddbec9d45596650faf5294437fbfeff4fe32`
- conclusion: success

## Completed Milestones

- `F126B`: commercial document context service, merged
- `F126C`: commercial document service completion, merged
- `F140C`: canonical agent prompt procedure, merged through `#176`
- `F140E`: environment-specific command modes, merged through `#177`
- `F140F`: agent workflow edge-case hardening, merged through `#178`
- `F140G`: multi-agent compatibility and integrated task-start baseline, merged through
  `#179`
- `F140I`: repo-scoped Codex skills, merged through `#181`
- `F140J`: cross-agent workflow parity layer, merged through `#182`
- `F83`: Hahitantsoa shared availability read-only facade, merged through `#183`

## Ledger Update Rule

Update this snapshot when:

- `origin/main` advances and `main` CI is green
- active backend, frontend, docs, or tools task changes
- open PR inventory changes
- a task becomes blocked or unblocked
