# F138 Agent-Ready Orchestration Foundation

## Status

Implemented for agent-tools scope.

## Problem

The repository already had local quality helpers and a Compose stack, but the backend
Compose workflow still depended on `.env` through `env_file: .env`.

That dependency is acceptable for a human-operated local runtime, but it blocks agent
orchestrators in three ways:

- `docker compose config` fails when `.env` is absent or intentionally unreadable;
- backend-local DB-backed validation cannot be scripted safely without inventing ad hoc
  shell exports;
- long prompts are forced to restate scope rules and worktree checks that should exist as
  versioned tooling.

F138B/F138C addresses that orchestration gap without touching backend or frontend code and
without reading, sourcing, printing, copying or creating `.env`.

## Delivered Foundation

### `compose.agent-ci.yaml`

Adds an agent-safe Compose definition with:

- no `env_file`;
- explicit non-secret CI/dev values only;
- PostgreSQL, Redis, and backend services;
- live repository mount on `backend` so `exec` and `run` see current checked-out code.

This file is intended for local agent validation only. It does not replace the existing
human local-development flow documented around `.env`.

### `scripts/dev/erp-backend-compose-ci`

Adds a stable wrapper around:

- `docker compose -f compose.agent-ci.yaml ...`

Supported usage includes:

- `config --quiet`
- `config --services`
- `up -d db redis backend`
- `exec -T backend ...`
- `run --rm backend ...`

The wrapper keeps the agent entrypoint explicit and avoids prompt-level repetition.

### `scripts/dev/erp-agent-scope-guard`

Adds a path-based scope guard for:

- `backend`
- `frontend`
- `agent-tools`

The guard inspects:

- current worktree changes;
- committed branch diff against `origin/main` when available.

It stops on forbidden paths such as:

- `.env` and `.env.*`;
- secret-looking certificate/key files;
- cross-scope application directories;
- generated frontend `dist`;
- out-of-scope files for agent-tools work.

The guard never opens secret files and reasons on path names only.

### `scripts/dev/erp-worktree-preflight`

Adds a reusable baseline check that prints:

- repository root;
- current branch or detached state;
- HEAD and short SHA;
- current `git status --short`.

It can stop on a dirty worktree with `--require-clean`, and it can chain a profile-specific
scope guard:

- `scripts/dev/erp-worktree-preflight backend`
- `scripts/dev/erp-worktree-preflight frontend`
- `scripts/dev/erp-worktree-preflight agent-tools`

## Why Wrappers Matter

Agent orchestration should not depend on copying long instructions into every task.

These wrappers move critical invariants into versioned project tooling:

- no implicit `.env` dependency for backend-local Compose validation;
- explicit scope enforcement before edits or validation;
- explicit worktree baseline printing before action;
- command usage that can be reused by humans, Codex, and future orchestrators.

## Expected Reuse After Merge

### F135B

F135B can resume backend private reservation-confirmation API work with:

1. `scripts/dev/erp-worktree-preflight backend`
2. `scripts/dev/erp-agent-scope-guard backend`
3. `scripts/dev/erp-backend-compose-ci up -d db redis backend`
4. `scripts/dev/erp-backend-compose-ci exec -T backend ...`
5. `scripts/dev/erp-backend-compose-ci run --rm backend ...`

This removes the need for an agent to ask for `.env` access before local backend checks.

### F137C

F137C can resume frontend work with:

1. `scripts/dev/erp-worktree-preflight frontend`
2. `scripts/dev/erp-agent-scope-guard frontend`
3. existing frontend validation commands

This ensures frontend agents fail fast if backend files, `.env`, or generated `frontend/dist`
artifacts appear in scope.

## Scope And Safety Notes

- No backend application file was modified.
- No frontend application file was modified.
- No GitHub workflow was modified.
- No dependency manifest was modified.
- No `.env` file was read, sourced, copied, displayed, created or modified.

## Validation Target

F138B/F138C is considered ready when these commands succeed from the repository root:

- `bash -n scripts/dev/erp-backend-compose-ci`
- `bash -n scripts/dev/erp-agent-scope-guard`
- `bash -n scripts/dev/erp-worktree-preflight`
- `git diff --check`
- anti-mojibake check on the new files
- `scripts/dev/erp-backend-compose-ci config --quiet`
- `scripts/dev/erp-backend-compose-ci config --services`
- `scripts/dev/erp-agent-scope-guard backend`
- `scripts/dev/erp-agent-scope-guard frontend`
- `scripts/dev/erp-worktree-preflight`

Backend static validation through the wrapper is optional but recommended when Docker is
available, for example:

- `scripts/dev/erp-backend-compose-ci run --rm backend python -m ruff check backend tests`
