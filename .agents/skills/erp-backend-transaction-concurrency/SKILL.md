---
name: erp-backend-transaction-concurrency
description: Review Titan ERP atomicity, locking, rollback, and replay safety for reservation confirmation, payments, logistics passation, stock, returns, damage settlement, and closeout. Use when competing writers can affect these invariants; do not load for ordinary reads.
---

## What I do

Review backend write paths for transaction safety, lock usage, and race-condition handling.

## Checklist

- [ ] Confirm writes that span multiple models use `transaction.atomic()`
- [ ] Check lock ordering and concurrent update risk
- [ ] Review rollback behavior for partial failures
- [ ] Confirm idempotency or replay safety where repeated requests are possible
- [ ] Stop on unsafe write ordering or unclear concurrent confirmation behavior

## Exact lifecycle lock review

- [ ] Confirmation locks the draft and availability rows, revalidates inside the transaction, and emits success effects with `transaction.on_commit()`
- [ ] Contract-signature and deposit truth cannot change between prerequisite validation and confirmation
- [ ] Payment confirmation and receipt/cash effects have a stable replay key and cannot be counted twice
- [ ] Passation locks the delivery/event scope and writes each outbound movement once
- [ ] Return validation locks the return, lines, delivery scope, prior returns, and affected stock before enforcing quantity ceilings
- [ ] Damage/loss execution locks settlement and financial effects and is replay-safe
- [ ] Closeout locks the reservation, recomputes blockers inside the transaction, stores one immutable snapshot, and rejects a different idempotency key
- [ ] Concurrency tests use two competing transactions where database behavior matters; sequential duplicate calls alone prove only idempotency

## When to use me

Load when a backend slice touches stock, reservations, payments, confirmations,
returns, settlements, closeout, or multi-step writes. Pair with
`erp-reservation-lifecycle-audit` for end-to-end qualification.

## Inputs to inspect

- service methods and write paths
- transaction boundaries
- select-for-update or equivalent locking
- tests for repeated or concurrent actions

## Commands / wrappers to run

- focused concurrency pytest through `scripts/dev/erp-backend-fast`
- `scripts/dev/erp-backend-ci` only after an explicit full-suite escalation under
  `docs/ai-agents/pr-quality-gates.md`

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
