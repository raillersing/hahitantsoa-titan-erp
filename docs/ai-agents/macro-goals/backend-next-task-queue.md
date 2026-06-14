# Backend Next Task Queue

This queue is the next executable planning surface for `MG-BACKEND-FINALIZATION` after
`F135B` merged on `main` at `9df9251`.

## Queue

```text
Task ID: F135B
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/f135b-reservation-confirmation-private-api
Scope allowed: backend/apps/reservations/** and focused backend confirmation tests
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, migrations, unrelated reservation workflow expansion
Inputs: F135A service foundation, reservation confirmation API WIP, backend validation surface
Expected output: private reservation confirmation API merged on main
Validation commands: backend quality standard, no migrations, focused backend confirmation tests
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: migration needed, scope drifts beyond private confirmation API, frontend dependency discovered, secret-like path appears
Dependencies: F138E
Status: done
PR URL: https://github.com/raillersing/hahitantsoa-titan-erp/pull/171
Main CI result: success on 9df9251
Next task: F126B
```

```text
Task ID: F126B
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/f126b-commercial-document-context
Scope allowed: backend-only documents slice needed to build a commercial document context/value object from the existing registry and ReservationDraft
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, migrations, PDF generation, payment provider integration, inventory writes, invoice workflow, contract workflow, receipt workflow
Inputs: F126A, docs/ai-agents/orchestrator-state.md, docs/ai-agents/orchestrator-delegation-protocol.md, docs/ai-agents/macro-goals/backend-completion-plan.md
Expected output: backend-only commercial document context/value object built from the existing registry and ReservationDraft
Validation commands: backend quality standard, no migrations, focused backend tests for the new context/value object
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: migration needed, contract ambiguity, side effects introduced, scope drifts into PDF, payment, inventory, frontend, or scripts
Dependencies: F135B
Status: ready
PR URL: pending
Main CI result: pending
Next task: F126C
```

```text
Task ID: F126C
Parent macro-goal: MG-BACKEND-FINALIZATION
Agent type: backend
Autonomy level: Level 1
Worktree: /home/raillersing/projects/hahitantsoa-titan-erp-backend
Branch: feat/f126c-proforma-preview-context-refactor
Scope allowed: Titan proforma preview refactor to use the F126B context while preserving the existing API payload
Scope forbidden: frontend/**, scripts/**, .github/**, compose*, Docker files, .env, migrations, PDF generation, payment provider integration, inventory writes, invoice workflow, contract workflow, receipt workflow
Inputs: F126B output, F126A, current Titan proforma preview behavior
Expected output: existing Titan proforma preview backed by the F126B commercial document context without payload drift
Validation commands: backend quality standard, no migrations, focused backend preview tests
Review required: yes
Merge policy: human merge only after PR green
Stop conditions: F126B incomplete, API payload drift appears, side effects introduced, scope broadens into runtime generation or unrelated document flows
Dependencies: F126B
Status: draft
PR URL: pending
Main CI result: pending
Next task: none
```

## Backend agent prompt for F126B

```text
You are Codex Backend Agent.

Authorized worktree only:
/home/raillersing/projects/hahitantsoa-titan-erp-backend

Branch:
feat/f126b-commercial-document-context

Mission:
Execute micro-task F126B from MG-BACKEND-FINALIZATION.

Read first:
- docs/ai-agents/agent-command-runbook.md
- docs/ai-agents/macro-goals/backend-completion-plan.md
- docs/ai-agents/orchestrator-delegation-protocol.md
- docs/audits/F126A_DOCUMENT_TEMPLATE_BACKEND_FOUNDATION.md

Use:
- scripts/dev/erp-worktree-preflight backend
- scripts/dev/erp-agent-scope-guard backend
- scripts/dev/erp-backend-compose-ci

Goal contract:
- build a backend-only commercial document context/value object from the existing document registry and ReservationDraft
- keep the slice side-effect free
- do not generate PDFs
- do not create invoices, contracts, receipts, payments, reservations, or inventory blocks

Stop if:
- a migration is required
- the context source of truth becomes ambiguous
- the task needs PDF generation, payment integration, inventory writes, frontend edits, or scripts changes
- the scope broadens beyond one bounded backend documents slice

Final report:
- branch
- commit
- files changed
- validations executed
- findings or blockers
- PR URL if opened
```
