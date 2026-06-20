---
name: erp-backend-data-integrity
description: Model invariants, lifecycle consistency, audit fields, and domain integrity review for backend changes
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

## When to use me

Load when a backend change touches models, services, transitions, or any persisted state that has domain rules.

## Inputs to inspect

- model definitions and service methods
- lifecycle or state-transition code
- audit fields and ownership metadata
- tests for invariant preservation

## Commands / wrappers to run

- `scripts/dev/erp-backend-ci`
- focused invariant pytest through `scripts/dev/erp-backend-fast`

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
