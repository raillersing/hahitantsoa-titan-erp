---
name: erp-backend-api-contracts
description: "Review the backend side of an approved API contract: routes, serializers, response and error shapes, and pagination. Use for backend implementation or review; use erp-api-contracts only to resolve a cross-boundary decision."
---

## What I do

Keep backend API contracts stable and explicit for tests and frontend callers.

## Checklist

- [ ] Confirm endpoint path and method are intentional
- [ ] Confirm request and response shapes match the approved contract
- [ ] Confirm error shape is stable and predictable
- [ ] Confirm pagination, list, and detail semantics are unchanged unless approved
- [ ] Stop on silent API drift or unapproved frontend incompatibility

## When to use me

Load when a backend change touches serializers, routes, error handling, or anything the frontend depends on.

## Inputs to inspect

- route definitions
- serializer input/output
- API tests and response snapshots
- affected frontend expectations

## Commands / wrappers to run

- `scripts/dev/erp-backend-fast`
- `scripts/dev/erp-backend-ci`

## Hard stops

- contract is implied rather than documented
- response or error shape changes without approval
- frontend or test compatibility is at risk

## Expected output

- contract summary
- compatibility risks
- explicit follow-up if drift exists

## Source

- [Backend Agent Template](../../../docs/ai-agents/backend-agent-template.md)
- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
