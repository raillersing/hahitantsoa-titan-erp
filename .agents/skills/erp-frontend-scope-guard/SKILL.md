---
name: erp-frontend-scope-guard
description: Diagnose frontend scope drift, forbidden backend edits, or Hahitantsoa/Titan boundary risk. Use when the scope guard fails or a cross-domain UI change is proposed; normal baseline checks belong to erp-task-start.
---

## What I do

Stop frontend agents from accidentally modifying backend code, adding unapproved business rules, or crossing the Hahitantsoa/Titan boundary.

## Checklist

- [ ] Only `frontend/` files are modified — no `backend/`, `tests/backend/`, `scripts/dev/`, or `.github/`
- [ ] No invented API endpoints, payloads, or query parameters
- [ ] No backend business rules duplicated in frontend logic
- [ ] Titan views expose only `material`, `article`, and `material_pack` — not `venue`, `room`, `service`, or event types
- [ ] No new npm dependencies without task approval
- [ ] No `.env` or secrets read or exposed
- [ ] No login/auth flow invented beyond what the backend provides
- [ ] No write operations that bypass backend authorization

## When to use me

Load at the start of any frontend task to confirm scope, and again before commit.
