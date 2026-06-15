# Antigravity orchestration capability model

## Purpose

This document defines the next safe capability layer required for Antigravity to operate as an ERP orchestration agent comparable to Codex, without granting arbitrary shell access or bypassing the approved Windows-to-WSL adapter boundary.

## Current validated baseline

Antigravity has already validated the following capabilities:

- `task-start` through the approved Windows PowerShell adapter.
- `finalize-pr` through the approved Windows PowerShell adapter.
- A docs-only autonomous mutation.
- PR finalization through the root-only helper.
- Main CI confirmation tied to the merge SHA.

## Non-negotiable constraints

- Do not read, source, print, copy, or modify `.env`.
- Do not touch secrets.
- Keep `docs/audits/F140D_OPENCODE_WSL_NATIVE_EVALUATION.md` untracked.
- Do not use raw `wsl.exe`, raw WSL bridges, or `bash -c` bridges outside the approved adapter.
- Do not expose an arbitrary command execution mode.
- All merge/finalization operations must still pass through `scripts/dev/erp-pr-finalize-from-root`.

## Required orchestration modes

### `repo-status`

Read-only mode that prints:

- root branch
- root git status
- recent commits
- worktree list
- open PRs
- F140D status

### `pr-create`

Creates a pull request from an already pushed branch.

Required inputs:

- base branch
- head branch
- title
- body
- allowlist or declared changed files

The mode must not modify repository files.

### `pr-checks`

Checks PR readiness.

Required outputs:

- PR number
- base/head branch
- state
- mergeable
- Backend quality
- Frontend quality
- pending/fail/pass classification

### `task-branch-start`

Creates an approved task branch or worktree.

Required protections:

- refuse `main` and `master`
- refuse unknown task prefixes
- print the worktree path
- print the branch name
- leave root `main` clean unless explicitly creating a root-only branch

### `task-report`

Produces a standardized final report.

Required fields:

- task name
- branch
- commit SHA
- files changed
- validation commands
- PR number and URL if available
- CI status if available
- `.env` / secrets touched: yes/no
- F140D status
- final classification

### `finalize-pr`

Existing mode. It must remain narrow and continue to call the root-only helper.

## Explicitly forbidden mode

### `run-command`

A generic command execution mode is forbidden.

Reason: it would turn the adapter into an unrestricted raw WSL bridge and bypass the governance that the adapter is designed to enforce.

## Acceptance path

1. F141A documents this capability model.
2. F141B adds read-only adapter modes first: `repo-status`, `pr-checks`.
3. F141C adds controlled PR creation: `pr-create`.
4. F141D adds task branch/worktree bootstrap: `task-branch-start`.
5. F141E runs a full autonomous Antigravity orchestration pilot:
   branch -> docs mutation -> commit -> push -> PR create -> CI check -> finalize -> report.
