# Backend Task Queue Dry Run

## Purpose

This is a dry-run queue for `MG-BACKEND-FINALIZATION`.

It is a planning artifact only. It does not authorize backend mutation by itself.
Unknown follow-up work stays in `draft` until a backend audit confirms a bounded scope.

## Queue

```text
Task ID: F138E
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/f135b-reservation-confirmation-private-api
Scope allowed: backend worktree baseline repair only, branch repair or rebase evidence, approved backend audits
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, secrets, unrelated backend feature expansion
Inputs: docs/ai-agents/macro-goal-orchestrator.md, docs/ai-agents/macro-goal-contract.md, docs/ai-agents/task-queue-schema.md, docs/ai-agents/orchestrator-delegation-protocol.md, docs/ai-agents/autonomous-agent-policy.md, docs/ai-agents/pursue-goal-contract.md, docs/ai-agents/parallel-agent-policy.md, docs/ai-agents/macro-goals/backend-completion-plan.md, docs/ai-agents/orchestrator-state.md
Expected output: safe backend WIP baseline with branch status, divergence, repair outcome, and no forbidden scope drift
Validation commands: scripts/dev/erp-worktree-preflight backend; scripts/dev/erp-agent-scope-guard backend; bash scripts/dev/erp-backend-compose-ci config --quiet
Review required: yes
Merge policy: no merge during repair-only task; human decision required before any follow-up PR
Stop conditions: dirty repair requires destructive cleanup; wrong backend branch; secret-like path appears; repair broadens into feature work; repeated failed repair cycles
Dependencies: none
Status: ready
PR URL: none
Main CI result: pending
Next task: F135B
```

```text
Task ID: F135B
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/f135b-reservation-confirmation-private-api
Scope allowed: backend/**, tests/backend/**, approved backend audits for the private reservation confirmation API only
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, secrets, unrelated reservation workflow expansion
Inputs: repaired backend baseline from F138E, docs/ai-agents/macro-goals/backend-completion-plan.md, docs/ai-agents/orchestrator-state.md, docs/ai-agents/pursue-goal-contract.md
Expected output: bounded continuation of the reservation confirmation private API with focused validation evidence
Validation commands: bash scripts/dev/erp-backend-compose-ci config --quiet; bash scripts/dev/erp-backend-compose-ci run --rm backend python -m ruff check backend tests
Review required: yes
Merge policy: human merge only after review_required, PR green, and mergeable state
Stop conditions: F138E not complete; frontend dependency discovered; scope expands beyond private API slice; backend contract ambiguity; secret-like path appears
Dependencies: F138E
Status: review_required
PR URL: pending
Main CI result: pending
Next task: MT-BE-AUDIT-001
```

```text
Task ID: MT-BE-AUDIT-001
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 0
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: audit/f139-backend-inventory
Scope allowed: backend inventory notes and approved backend audits only
Scope forbidden: backend feature edits, frontend/**, scripts/**, .github/**, compose*, Docker files, .env, secrets
Inputs: current backend mainline, repaired WIP evidence, docs/ai-agents/macro-goals/backend-completion-plan.md
Expected output: verified inventory of incomplete backend modules and bounded next slices
Validation commands: scripts/dev/erp-worktree-preflight backend; scripts/dev/erp-agent-scope-guard backend
Review required: no
Merge policy: docs-only or audit-only outcome; no backend PR from this dry-run definition
Stop conditions: audit would require code edits; missing baseline; secret-like path appears; ownership conflict with active backend task
Dependencies: F135B
Status: draft
PR URL: none
Main CI result: pending
Next task: MT-BE-RESERVATION-002
```

```text
Task ID: MT-BE-RESERVATION-002
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/backend-reservation-follow-up
Scope allowed: one verified reservation backend slice only after audit
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, secrets, unrelated business domains
Inputs: MT-BE-AUDIT-001 findings, merged F135B evidence, current orchestrator state
Expected output: next bounded backend reservation slice if audit confirms one
Validation commands: bash scripts/dev/erp-backend-compose-ci config --quiet; bash scripts/dev/erp-backend-compose-ci run --rm backend python -m ruff check backend tests
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: audit does not confirm the slice; reservation scope crosses business boundaries; secret-like path appears
Dependencies: MT-BE-AUDIT-001
Status: draft
PR URL: none
Main CI result: pending
Next task: MT-BE-DOCUMENT-001
```

```text
Task ID: MT-BE-DOCUMENT-001
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/backend-document-follow-up
Scope allowed: one verified document-related backend slice only after audit
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, secrets, public artifact exposure
Inputs: MT-BE-AUDIT-001 findings, current document-related audits, current orchestrator state
Expected output: candidate bounded backend document slice if audit confirms one
Validation commands: bash scripts/dev/erp-backend-compose-ci config --quiet; bash scripts/dev/erp-backend-compose-ci run --rm backend python -m ruff check backend tests
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: audit does not confirm the slice; document privacy rules are unclear; secret-like path appears
Dependencies: MT-BE-AUDIT-001
Status: draft
PR URL: none
Main CI result: pending
Next task: MT-BE-SUPPORT-001
```

```text
Task ID: MT-BE-SUPPORT-001
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/backend-support-follow-up
Scope allowed: one verified support or contract-alignment slice only after audit
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, secrets, migrations without explicit approval
Inputs: MT-BE-AUDIT-001 findings, merged backend queue history, current orchestrator state
Expected output: candidate support slice only if audit confirms a bounded need
Validation commands: bash scripts/dev/erp-backend-compose-ci config --quiet; bash scripts/dev/erp-backend-compose-ci run --rm backend python -m ruff check backend tests
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: audit does not confirm the slice; contract ambiguity remains; secret-like path appears
Dependencies: MT-BE-AUDIT-001
Status: draft
PR URL: none
Main CI result: pending
Next task: none
```

## Readiness summary

- Ready now: `F138E`
- Ready after repair baseline: `F135B`
- Candidate but not yet verified by audit: `MT-BE-AUDIT-001`,
  `MT-BE-RESERVATION-002`, `MT-BE-DOCUMENT-001`, `MT-BE-SUPPORT-001`

The candidate tasks above intentionally remain `draft` because `task-queue-schema.md`
does not authorize a separate `candidate` status.
