# Orchestrator State

## State Semantics

This file is an operational snapshot. Update it after merge plus green `main` CI.

Agents must still run the integrated task-start baseline. Live baseline wins over this
snapshot when they disagree, and the mismatch must be reported.

## Version

- ledger: `orchestrator-state`
- version: `MG-BACKEND-v1`
- last-updated-main-head: `1fc3d2ccae940a12ab66813f6b91d8eb2ed5fb3f`

## Current Main HEAD

- `origin/main`: `1fc3d2ccae940a12ab66813f6b91d8eb2ed5fb3f`
- title: `feat: add hahitantsoa event draft foundation (#185)`

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
- `F126B`, `F126C`, `F83`, and `F84` are complete and merged
- next Hahitantsoa backend slice must be selected from the approved post-F84 reservation-first queue

## Active Frontend Task

- task: frontend readiness planning
- PR: `#175`
- state: open
- note: this governance task must not merge or modify PR `#175`

## Active Docs And Tools Tasks

- no active docs/tools governance task recorded in this snapshot

## Blocked Tasks

- no backend task is blocked by approval at this snapshot
- next Hahitantsoa backend slice still requires bounded selection and validation before implementation

## Open PRs

- `#175` docs(frontend): add frontend readiness plan and task queue

## Last Green Main CI

- run: [27536222690](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/27536222690)
- head SHA: `1fc3d2ccae940a12ab66813f6b91d8eb2ed5fb3f`
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
- `F84`: Hahitantsoa event draft foundation, merged through `#185`

## Ledger Update Rule

Update this snapshot when:

- `origin/main` advances and `main` CI is green
- active backend, frontend, docs, or tools task changes
- open PR inventory changes
- a task becomes blocked or unblocked
