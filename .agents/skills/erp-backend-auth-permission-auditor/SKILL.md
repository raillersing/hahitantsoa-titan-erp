---
name: erp-backend-auth-permission-auditor
description: Django/DRF permission, object-level authorization, and sensitive-action review for backend PRs
---

## What I do

Check that backend auth and permission behavior is explicit, scoped, and safe.

## Checklist

- [ ] Confirm DRF permission classes are explicit for each endpoint
- [ ] Confirm object-level access is enforced where records are tenant- or user-scoped
- [ ] Review sensitive actions for reservation, document, and payment flows
- [ ] Confirm session-auth or role checks match the endpoint’s intended trust model
- [ ] Stop on ambiguous authorization or any hidden cross-tenant exposure

## When to use me

Load when a backend change touches reads, writes, permissions, filters, or sensitive state transitions.

## Inputs to inspect

- serializer and view permission classes
- queryset filters and object checks
- DRF action names and endpoints
- tests covering forbidden/allowed access

## Commands / wrappers to run

- `scripts/dev/erp-backend-ci`
- focused auth/permission pytest through `scripts/dev/erp-backend-fast`

## Hard stops

- permission behavior is implied instead of explicit
- object-level access is missing or inconsistent
- a sensitive action could confirm, refund, or expose data without a clear gate

## Expected output

- permission model summary
- sensitive-action risk notes
- any required follow-up review

## Source

- [Backend Agent Template](../../../docs/ai-agents/backend-agent-template.md)
- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
