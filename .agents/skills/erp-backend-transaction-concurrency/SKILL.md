---
name: erp-backend-transaction-concurrency
description: Atomicity, race-condition, rollback, and concurrent-write review for backend changes
---

## What I do

Review backend write paths for transaction safety, lock usage, and race-condition handling.

## Checklist

- [ ] Confirm writes that span multiple models use `transaction.atomic()`
- [ ] Check lock ordering and concurrent update risk
- [ ] Review rollback behavior for partial failures
- [ ] Confirm idempotency or replay safety where repeated requests are possible
- [ ] Stop on unsafe write ordering or unclear concurrent confirmation behavior

## When to use me

Load when a backend slice touches stock, reservations, payments, confirmations, or multi-step writes.

## Inputs to inspect

- service methods and write paths
- transaction boundaries
- select-for-update or equivalent locking
- tests for repeated or concurrent actions

## Commands / wrappers to run

- `scripts/dev/erp-backend-ci`
- focused concurrency pytest through `scripts/dev/erp-backend-fast`

## Hard stops

- a race condition is plausible but unreviewed
- write ordering can produce double-update or stale state
- rollback or lock behavior is unclear

## Expected output

- atomicity verdict
- concurrency risks
- any required lock or idempotency follow-up

## Source

- [Backend Agent Template](../../../docs/ai-agents/backend-agent-template.md)
- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
