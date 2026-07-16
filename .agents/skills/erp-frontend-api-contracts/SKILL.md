---
name: erp-frontend-api-contracts
description: "Review the frontend consumption of an already approved backend API: path, method, payload, session/CSRF behavior, errors, and UI states. Use for frontend implementation or review; use erp-api-contracts only to resolve a cross-boundary decision."
---

## What I do

Prevent frontend agents from inventing endpoints, mis-matching payloads, or mishandling backend errors.

## Checklist

- [ ] HTTP method matches the confirmed backend endpoint (`GET`, `POST`, `PUT`, `PATCH`, or `DELETE` as documented)
- [ ] URL path matches the confirmed route — no invented segments
- [ ] Credentials mode is correct (`include` for session-auth endpoints)
- [ ] Session bootstrap obtains CSRF state from the confirmed backend endpoint before a protected write
- [ ] `POST`, `PUT`, `PATCH`, and `DELETE` send session credentials and the confirmed CSRF header (`X-CSRFToken` for the standard Django session contract unless the backend contract explicitly differs)
- [ ] Request body matches the backend serializer fields and types
- [ ] Response is parsed with the correct expected shape
- [ ] Non-2xx responses are handled: 400 (validation), 401/403 according to the confirmed authentication contract, confirmed CSRF failures, 404 (not found), 409 when defined, and 500 (server error)
- [ ] Do not infer authentication state from 401 versus 403 when the confirmed backend endpoint permits either response
- [ ] Error responses surface meaningful messages to the user, not raw JSON
- [ ] No API call is made without loading/error state handling
- [ ] No polling or retry loop without explicit task approval
- [ ] No backend endpoint is called from the frontend without confirming it exists on `main`
- [ ] API failure never falls back silently to mock business data or reports a simulated success

## When to use me

Load during implementation (Agent FE-A) and during API contract review (Agent FE-E).

## Source

- [Frontend Agent Template — Agent FE-E](../../../docs/ai-agents/frontend-agent-template.md#agent-fe-e---api-contract-integration-reviewer)
- [PR Quality Gates — Frontend gates](../../../docs/ai-agents/pr-quality-gates.md#frontend-gates)
- [Agent Command Runbook — Standard Frontend Commands](../../../docs/ai-agents/agent-command-runbook.md#standard-frontend-commands)
