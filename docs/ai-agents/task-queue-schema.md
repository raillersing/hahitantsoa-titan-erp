# Task Queue Schema

## Purpose

Every micro-task in the orchestrator queue must use the same required fields and status
vocabulary.

## Required fields

Each micro-task record must contain:

- Task ID
- Parent macro-goal
- Agent type
- Autonomy level
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
Autonomy level: Level 1
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
- `Status` must use one authorized value
- `Review required` and `Merge policy` must reflect the current autonomy policy
- `Next task` should name the next known dependent micro-task or `none`
