# Frontend Next Task Queue

This queue defines the executable sequence of frontend-related micro-tasks for `MG-FRONTEND-FINALIZATION`.

## Queue

```text
Task ID: F138E
Parent macro-goal: MG-FRONTEND-FINALIZATION
Agent type: docs
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-frontend
Branch: docs/mg-frontend-readiness-antigravity
Scope allowed: docs/ai-agents/macro-goals/**, docs/audits/**
Scope forbidden: backend/**, frontend/**, scripts/**, .github/**, compose*, Docker files, .env
Inputs: current worktree layout, repository status
Expected output: clean, updated docs and task queue records
Validation commands: erp-orchestrator-state-check and erp-task-queue-validate
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: any modifications outside documentation scope, any attempt to read/write secrets or .env
Dependencies: none
Status: ready
PR URL: pending
Main CI result: pending
Next task: F137C
```

```text
Task ID: F137C
Parent macro-goal: MG-FRONTEND-FINALIZATION
Agent type: frontend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-frontend
Branch: feat/f137c-frontend-integration
Scope allowed: frontend/** and focused frontend tests
Scope forbidden: backend/**, scripts/**, .github/**, compose*, Docker files, .env, migrations
Inputs: F126C backend service endpoints, updated frontend shell components
Expected output: frontend integration and updated shell layout merged to main
Validation commands: frontend build and vitest check
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: any backend code modification, any .env or secret-like access, any undocumented endpoint assumptions
Dependencies: F138E, F126C (PR #174)
Status: blocked
PR URL: pending
Main CI result: pending
Next task: F137D
```
