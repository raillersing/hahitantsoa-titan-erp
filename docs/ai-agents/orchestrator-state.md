# Orchestrator State

## State Semantics

This file is an operational snapshot. Update it after merge plus green `main` CI.

Agents must still run the integrated task-start baseline. Live baseline wins over this
snapshot when they disagree, and the mismatch must be reported.

## Version

- ledger: `orchestrator-state`
- version: `F140H-v1`
- last-updated-main-head: `4078985c0034d46ad05b6c10b746a6090f051f1a`

## Current Main HEAD

- `origin/main`: `4078985c0034d46ad05b6c10b746a6090f051f1a`
- title: `docs(ai-agents): add multi-agent compatibility layer (#179)`

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
- `F126B` and `F126C` are complete and merged

## Active Frontend Task

- task: frontend readiness planning
- PR: `#175`
- state: open
- note: this governance task must not merge or modify PR `#175`

## Active Docs And Tools Tasks

- task: `F140H`
- state: in progress at this snapshot

## Blocked Tasks

- none explicitly blocked at this snapshot

## Open PRs

- `#175` docs(frontend): add frontend readiness plan and task queue

## Last Green Main CI

- run: [27513617651](https://github.com/raillersing/hahitantsoa-titan-erp/actions/runs/27513617651)
- head SHA: `4078985c0034d46ad05b6c10b746a6090f051f1a`
- conclusion: success

## Completed Milestones

- `F126B`: commercial document context service, merged
- `F126C`: commercial document service completion, merged
- `F140C`: canonical agent prompt procedure, merged through `#176`
- `F140E`: environment-specific command modes, merged through `#177`
- `F140F`: agent workflow edge-case hardening, merged through `#178`
- `F140G`: multi-agent compatibility and integrated task-start baseline, merged through
  `#179`

## Ledger Update Rule

Update this snapshot when:

- `origin/main` advances and `main` CI is green
- active backend, frontend, docs, or tools task changes
- open PR inventory changes
- a task becomes blocked or unblocked
