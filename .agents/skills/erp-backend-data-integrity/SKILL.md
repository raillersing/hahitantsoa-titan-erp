---
name: erp-backend-data-integrity
description: Review Titan ERP persisted invariants across reservations, Hahitantsoa events, documents, payments, logistics, inventory, damage settlement, and closeout. Use when domain state or lifecycle rules change; do not load for read-only API presentation changes.
---

## What I do

Protect backend domain invariants and data consistency across models, services, and lifecycle transitions.

## Checklist

- [ ] Confirm reservation lifecycle invariants are preserved
- [ ] Confirm document/runtime/private artifact invariants are preserved
- [ ] Confirm soft-delete semantics remain intentional
- [ ] Confirm stock movement invariants still hold
- [ ] Confirm audit fields and actor attribution are set where relevant
- [ ] Stop on broken domain consistency or missing invariant coverage

## Reservation lifecycle invariants

- [ ] A generated or issued contract never sets the signed marker; signed truth has an explicit source, actor, timestamp, and audit event
- [ ] Confirmation sums durable confirmed/reconciled deposits and cannot be unlocked by a boolean frontend marker
- [ ] Assistant totals, persisted line prices, payment schedule, issued documents, invoices, and closeout snapshot reconcile exactly
- [ ] Titan return operations link to their Titan reservation and delivery scope
- [ ] Hahitantsoa return, damage/loss, stock, and closeout records remain directly attributable to the Hahitantsoa event draft
- [ ] Hahitantsoa `bare` is space-only: it rejects inventory lines and confirmation does not require one; `logistics` owns articles and packs
- [ ] Validating a return reconciles intact, damaged, and missing quantities without exceeding the delivered quantity
- [ ] Damage/loss validation and execution preserve caution applied, refund due, excess due, invoice, receipt, and cashbox consistency
- [ ] Closeout requires completed logistics, reconciled stock, validated settlements, and coherent finance, then blocks incompatible later writes

Use `erp-reservation-lifecycle-audit` when these invariants are part of a complete
operator journey.

## When to use me

Load when a backend change touches models, services, transitions, or any persisted state that has domain rules.

## Inputs to inspect

- model definitions and service methods under `reservations`, `hahitantsoa`,
  `documents`, `payments`, `logistics`, `inventory`, and `billing`
- lifecycle or state-transition code
- audit fields and ownership metadata
- tests for invariant preservation

## Commands / wrappers to run

- focused invariant pytest through `scripts/dev/erp-backend-fast`
- `scripts/dev/erp-backend-migration-guard` when schema risk is present
- `scripts/dev/erp-backend-ci` only after an explicit full-suite escalation under
  `docs/ai-agents/pr-quality-gates.md`

## Hard stops

- an invariant is unclear or broken
- soft-delete or audit semantics are ambiguous
- stock, reservation, or document consistency can drift

## Expected output

- invariant summary
- data-risk notes
- any required follow-up review

## Source

- [Backend Agent Template](../../../docs/ai-agents/backend-agent-template.md)
- [Agent Command Runbook](../../../docs/ai-agents/agent-command-runbook.md)
