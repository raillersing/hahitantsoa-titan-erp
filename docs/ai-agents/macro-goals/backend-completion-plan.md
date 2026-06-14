# Backend Completion Plan

## Status

This is a non-definitive macro-goal planning document. It defines the method for backend
finalization and records the current known queue after `F135B` merged on `main`.

## Target macro-goal

- macro-goal: `MG-BACKEND-FINALIZATION`
- primary outcome: finish backend work through bounded, reviewable micro-tasks

## Current baseline

- `F138E` is complete and the backend worktree is repaired
- `F135B` is complete and merged on `main` at `9df9251`
- the backend worktree is detached on `9df9251` and ready for a new dedicated task branch

## Planning method

1. Confirm the backend baseline on `origin/main`
2. Prefer slices already recommended by accepted backend audits
3. Keep each backend slice bounded to one branch and one narrow behavior change
4. Stop immediately when a slice would require migrations, cross-worktree edits, or
   broader commercial workflow expansion
5. Use review and `main` CI gates before advancing the macro-goal queue

## Completed queue items

- `F138E`
  - purpose: repair or rebase WIP branches before new implementation
  - status: done
- `F135B`
  - purpose: reservation confirmation private API continuation
  - status: done

## Next implementation slice

- `F126B`
  - source: explicitly recommended by `F126A`
  - purpose: add a backend-only commercial document context/value object
  - inputs: existing document template registry and `ReservationDraft`
  - constraints: side-effect free, no PDF generation, no invoices, contracts, receipts,
    payments, reservations, or inventory blocks
  - state: ready

## Immediate follow-up after F126B

- `F126C`
  - purpose: refactor Titan proforma preview to use the new context while preserving the
    existing API payload
  - state: draft until `F126B` is complete

## Stop conditions

- migration becomes necessary
- the task needs runtime PDF generation
- the task needs payment, inventory, or reservation writes
- the task needs frontend, script, or workflow changes
- the source of truth for the commercial context becomes ambiguous
