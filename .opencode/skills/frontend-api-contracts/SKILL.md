---
name: frontend-api-contracts
description: Verify frontend API calls match confirmed backend contracts — path, method, payload, auth, error handling
---

## What I do

Prevent frontend agents from inventing endpoints, mis-matching payloads, or mishandling backend errors.

## Checklist

- [ ] HTTP method matches the backend endpoint (GET for reads, POST for writes)
- [ ] URL path matches the confirmed route — no invented segments
- [ ] Credentials mode is correct (`include` for session-auth endpoints)
- [ ] Request body matches the backend serializer fields and types
- [ ] Response is parsed with the correct expected shape
- [ ] Non-2xx responses are handled: 400 (validation), 401/403 (auth), 404 (not found), 500 (server error)
- [ ] Error responses surface meaningful messages to the user, not raw JSON
- [ ] No API call is made without loading/error state handling
- [ ] No polling or retry loop without explicit task approval
- [ ] No backend endpoint is called from the frontend without confirming it exists on `main`

## When to use me

Load during implementation (Agent FE-A) and during API contract review (Agent FE-E).