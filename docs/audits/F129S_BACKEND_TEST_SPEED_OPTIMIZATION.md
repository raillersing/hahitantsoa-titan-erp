# F129S Backend Test Speed Optimization

## Status

Implemented for review.

## Context

F129 introduced a larger backend foundation and exposed a productivity issue: local Docker builds could reinstall Python dependencies after source or test changes.

F129S improves backend validation speed while keeping the backend quality gate unchanged.

## Implemented changes

- Enabled GitHub Actions pip cache for the backend job.
- Added `scripts/ci/backend-quality` as the single backend quality command.
- Updated CI to call `scripts/ci/backend-quality`.
- Reordered `backend/Dockerfile` so dependency installation happens before copying full backend, tests, and scripts sources.
- Added a BuildKit pip cache mount.
- Added a `backend-test` Compose service under the `test` profile.
- `backend-test` runs the same quality script as CI.

## Canonical quality command

The canonical backend quality command is:

    scripts/ci/backend-quality

It runs:

    python -m ruff format --check backend tests
    python -m ruff check backend tests
    python backend/manage.py makemigrations --check --dry-run
    python -m pytest

## Risk controls

### CI/local divergence

Controlled by using one script: `scripts/ci/backend-quality`.

The same script is called by GitHub Actions and by `backend-test`.

### Dependency cache staleness

Controlled by tying Docker dependency installation and GitHub pip cache to `pyproject.toml`.

### Mounted worktree differences

`backend-test` uses the mounted worktree for fast local feedback. Ignored Python cache files may exist locally, but the canonical quality gate checks backend/test behavior and CI remains the source of truth before merge.

## Explicit exclusions

- no backend business logic changes;
- no model or migration changes;
- no API changes;
- no frontend feature changes;
- no `.env` or secret changes;
- no OpenClaw.

## Validation evidence

F129S local validation confirmed:

- backend-test profile is visible only with the `test` profile;
- targeted backend-test smoke passed;
- backend-test default command ran the full backend quality gate;
- full backend test suite passed with 734 tests.
