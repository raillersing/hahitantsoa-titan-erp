# Task Queue Schema

## Purpose

Every micro-task in the orchestrator queue must use the same required fields and status
vocabulary.

## Required fields

Each micro-task record must contain:

- Task ID
- Parent macro-goal
- Agent type
- Agent profile
- Autonomy level
- Execution mode
- Task-start baseline
- Baseline log
- Static/live state mismatch
- Human gate required
- Worktree
- Branch
- Scope allowed
- Scope forbidden
- Inputs
- Expected output
- Validation commands
- Review required
- Merge policy
- Stop conditions
- Dependencies
- Status
- PR URL
- Main CI result
- Next task

## Authorized statuses

Only these values are allowed for `Status`:

- `draft`
- `ready`
- `assigned`
- `in_progress`
- `pr_open`
- `pr_green`
- `review_required`
- `reviewed`
- `merge_ready`
- `merged`
- `main_green`
- `done`
- `blocked`
- `cancelled`

## Required record format

Use a compact Markdown block per micro-task:

```text
Task ID: MT-EXAMPLE-001
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Agent profile: codex-native-wsl-mutating
Autonomy level: Level 1
Execution mode: native WSL/bash
Task-start baseline: bash scripts/dev/erp-agent-task-start
Baseline log: logs/terminal/task-start-YYYYMMDD-HHMMSS.log
Static/live state mismatch: none
Human gate required: merge
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/example-branch
Scope allowed: backend/**, tests/backend/**
Scope forbidden: frontend/**, docs/**, .github/**, .env
Inputs: backend completion plan, orchestrator state, current diff
Expected output: bounded backend PR
Validation commands: scripts/dev/erp-backend-compose-ci config --quiet
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: scope drift, secrets, conflicting ownership
Dependencies: F138E
Status: ready
PR URL: pending
Main CI result: pending
Next task: MT-EXAMPLE-002
```

## Queue hygiene rules

- one mutable micro-task per branch
- one mutable micro-task per worktree at a time
- shared index files stay under orchestrator ownership unless explicitly reassigned
- micro-task descriptions should be operational, not aspirational
- unknown work should stay in `draft` until the audit converts it to a bounded task

## Validation expectations

- required fields must be present exactly once per micro-task record
- the assigned agent profile must exist in `docs/ai-agents/agent-profiles.md`
- executable tasks must record a task-start baseline and baseline log
- plan-only tasks must record that the baseline was proposed and is awaiting a human gate
- `Status` must use one authorized value
- `Review required` and `Merge policy` must reflect the current autonomy policy
- `Next task` should name the next known dependent micro-task or `none`
