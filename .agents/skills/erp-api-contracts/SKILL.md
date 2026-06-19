---
name: erp-api-contracts
description: API contract design, review, and cross-boundary change protocol — both backend and frontend sides
---

## What I do

Ensure backend-frontend API contracts are explicitly confirmed before implementation, and that cross-boundary changes follow the approved protocol.

## Backend Side Checklist

- [ ] Endpoint path and HTTP method are approved before implementation
- [ ] Request/response shapes are documented or have serializer tests
- [ ] Error responses use consistent format (e.g., `{"detail": "...", "code": "..."}`)
- [ ] Authorization/permission class is confirmed per endpoint
- [ ] No invented endpoints or workflows outside approved scope

## Frontend Side Checklist

- [ ] HTTP method matches the backend endpoint (GET for reads, POST for writes)
- [ ] URL path matches the confirmed route — no invented segments
- [ ] Credentials mode is correct (`include` for session-auth endpoints)
- [ ] Request body matches the backend serializer fields and types
- [ ] Response is parsed with the correct expected shape
- [ ] Non-2xx responses are handled: 400 (validation), 401/403 (auth), 404 (not found), 500 (server error)
- [ ] No API call is made without loading/error state handling
- [ ] No polling or retry loop without explicit task approval
- [ ] No backend endpoint is called from the frontend without confirming it exists on main

## Cross-Boundary Protocol

- Frontend agents may mutate backend only when the task explicitly authorizes the minimum required cross-boundary change for a confirmed API contract mismatch
- Backend agents must not assume frontend consumption patterns — document the expected response shape
- API contract mismatches found during review must be escalated before proceeding

## When to use me

Load when designing, implementing, or reviewing a backend-frontend API contract. Use during Agent FE-E (API Contract Integration Reviewer) review.

## Source

- [Frontend Agent Template — Agent FE-E](../frontend-agent-template.md#agent-fe-e---api-contract-integration-reviewer)
- [PR Quality Gates — Frontend gates](../pr-quality-gates.md#frontend-gates)
- [AGENTS.md — Business boundaries](../../AGENTS.md#business-boundaries)
