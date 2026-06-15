# Backend Completion Plan

## Status

This is a non-definitive macro-goal planning document. It defines the method for backend
finalization and records completed document-service slices through `F126C` and the Hahitantsoa shared-availability slice `F83`.

## Target macro-goal

- macro-goal: `MG-BACKEND-FINALIZATION`
- primary outcome: finish backend work through bounded, reviewable micro-tasks

## Current baseline

- `F138E` is complete and the backend worktree is repaired
- `F135B` is complete and merged on `main` at `9df9251`
- `F126B` and `F126C` are complete and merged
- `F83` is complete and merged on `main` at `e433ddb` as the minimal Hahitantsoa shared-availability read-only facade
- live task-start baseline is required before selecting the next backend slice

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
- `F126B`
  - purpose: add a backend-only commercial document context/value object
  - status: done
- `F126C`
  - purpose: complete the commercial document service chain and preserve preview payload
  - status: done
- `F83`
  - purpose: expose a backend-enforced Hahitantsoa shared-availability read-only facade limited to `material` and `article`
  - status: done

## Next implementation slice

- no further safe backend slice is selected in this plan revision
- any next Hahitantsoa backend slice now requires explicit approval or business clarification beyond the read-only shared-availability facade

## Stop conditions

- migration becomes necessary
- the task needs runtime PDF generation
- the task needs payment, inventory, or reservation writes
- the task needs frontend, script, or workflow changes
- the source of truth for the commercial context becomes ambiguous
- the next Hahitantsoa backend step is not explicitly approved as a bounded slice
