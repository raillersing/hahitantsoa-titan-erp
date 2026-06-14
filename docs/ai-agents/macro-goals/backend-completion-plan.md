# Backend Completion Plan

## Status

This is an initial non-definitive macro-goal planning document. It defines the method
for backend finalization and records the first known queue items. It does not claim that
all backend tasks are already known.

## Target macro-goal

- macro-goal: `MG-BACKEND-FINALIZATION`
- primary outcome: finish backend work through bounded, reviewable micro-tasks

## Planning method

1. Audit the backend baseline
   - confirm current `origin/main`
   - inspect the backend worktree branch and cleanliness
   - identify whether the current WIP can be rebased or must be repaired first
2. Inventory backend modules
   - list implemented modules and incomplete flows
   - separate reservation, documents, auth, finance, and support infrastructure areas
3. Identify incomplete flows
   - verify current API surface versus intended private reservation confirmation flow
   - record known gaps only when supported by code or audit evidence
4. Classify tasks
   - bug fix
   - feature continuation
   - contract alignment
   - tests and validation
   - docs and status updates
5. Create micro-goals
   - convert each verified backend slice into one queue entry
   - keep dependencies explicit
6. Execute known continuation
   - run `F138E` first to repair or rebase WIP branches safely
   - continue `F135B` reservation confirmation private API after the repair baseline is
     validated
7. Continue by priority
   - prioritize tasks that unblock frontend work or remove backend uncertainty first

## First known queue items

- `F138E`
  - purpose: repair or rebase WIP branches before new implementation
  - dependency: none
  - status: planned prerequisite
- `F135B`
  - purpose: reservation confirmation private API continuation
  - dependency: `F138E`
  - status: suspended until safe baseline is restored

## Stop conditions

- backend worktree is on the wrong branch
- repair would require destructive cleanup
- scope expands beyond the bounded private API slice without audit evidence
- CI or local validation failures point to unrelated domains
