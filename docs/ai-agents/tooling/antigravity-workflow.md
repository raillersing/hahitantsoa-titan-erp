# Antigravity Workflow Bridge

## Purpose

This bridge defines the approved repository workflow for Antigravity sessions.

## Default Profile

- profile: `antigravity-review-docs`
- default mode: review/docs-only
- mutation: forbidden unless the task explicitly promotes Antigravity inside approved docs-only scope

## Rules

- No backend mutation.
- No frontend mutation.
- No `/tmp` scripts.
- No `chmod`.
- No improvised `wsl -d` or similar bridge commands.
- Deliverables belong in chat and/or approved repo docs only.
- Codex skills may be read as reference runbooks only.

## Baseline Behavior

- If the assigned profile is plan-only, propose `bash scripts/dev/erp-agent-task-start` and wait.
- If Antigravity is explicitly promoted into an executable docs-only mode, run the same baseline first through `scripts/dev/erp-logged-run`.
- Live baseline wins over stale docs.
