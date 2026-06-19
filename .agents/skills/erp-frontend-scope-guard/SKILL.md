---
name: erp-frontend-scope-guard
description: Verify that frontend changes stay within approved files, avoid backend drift, and respect the Hahitantsoa/Titan business boundary
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