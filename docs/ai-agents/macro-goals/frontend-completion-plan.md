# Frontend Completion Plan

## Status

This is an initial non-definitive macro-goal planning document. It defines the method
for frontend finalization and records the first known queue items. It does not assume
that all frontend tasks are fully known before the backend contract is verified.

## Target macro-goal

- macro-goal: `MG-FRONTEND-FINALIZATION`
- primary outcome: finish frontend work through bounded UI and integration micro-tasks

## Planning method

1. Repair baseline first
   - `F138E` is complete
   - verify the frontend worktree is resynced from current `origin/main`
2. Audit frontend modules and entry points
   - inventory module shell, documents, reservation flows, and pending integration areas
3. Verify backend dependency readiness
   - confirm which frontend tasks depend on backend API completion
   - stop if endpoint assumptions are not yet validated
4. Create queue entries
   - one UI or integration slice per micro-task
   - keep shared docs and queue ownership with the orchestrator
5. Execute next known task
   - `F137C` is the next frontend task after backend API availability
6. Continue by queue
   - progress through module shell, document, and reservation flows in dependency order

## First known queue items

- `F138E`
  - purpose: repair WIP, resync the frontend worktree, and re-establish a safe branch
    baseline
  - dependency: none
  - status: done
- `F137C`
  - purpose: next approved frontend implementation after `F137B`
  - dependency: frontend readiness planning and confirmed current API contract
  - status: pending current readiness queue; see open PR `#175`

## Stop conditions

- frontend worktree stays detached or diverged after attempted repair
- backend API contract is unavailable or unstable
- required changes would broaden into backend, scripts, or shared index ownership
- `frontend/dist/` becomes part of the mutable diff
