---
name: erp-backend-payment-idempotency
description: Payment, refund, receipt, and replay-safety review for backend payment slices
---

## What I do

Check payment-related backend changes for replay safety, attribution, and no-double-processing guarantees.

## Checklist

- [ ] Confirm provider status and reservation status transitions are consistent
- [ ] Confirm idempotency keys or equivalent replay protection where relevant
- [ ] Confirm audit attribution is stored for sensitive money movement
- [ ] Confirm no double confirmation, refund, or receipt generation can occur
- [ ] Stop on financial ambiguity or missing provider/state mapping

## When to use me

Load when a backend change touches payment, refund, receipt, settlement, or retry handling.

## Inputs to inspect

- payment service code
- provider state mapping
- audit fields and actor attribution
- replay or duplicate-request tests

## Commands / wrappers to run

- `scripts/dev/erp-backend-ci`
- focused payment pytest through `scripts/dev/erp-backend-fast`

## Hard stops

- payment state cannot be mapped cleanly
- duplicate processing is possible
- attribution is missing for a sensitive money event

## Expected output

- payment-state verdict
- idempotency notes
- any financial-risk follow-up

## Source

- [Backend Agent Template](../../../docs/ai-agents/backend-agent-template.md)
- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
