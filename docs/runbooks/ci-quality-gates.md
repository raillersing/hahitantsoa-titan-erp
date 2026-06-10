# CI quality gates

## Status

F91 added the repository GitHub Actions quality gates.

The CI workflow is defined in:

- `.github/workflows/ci.yml`

The workflow is active for:

- pull requests targeting `main`;
- pushes to `main`.

## Purpose

The CI quality gates provide an independent validation layer before a pull request is merged.

They do not replace human review, Agent B review, or post-merge validation. They make the existing workflow safer by checking backend and frontend quality automatically on GitHub.

## Jobs

### Backend quality

The `Backend quality` job runs on GitHub-hosted Ubuntu.

It provides these services for tests:

- PostgreSQL;
- Redis.

PostgreSQL is required because backend tests use the Django PostgreSQL database configuration.

Redis is required because `/readyz/` checks both database readiness and Redis readiness.

The backend job runs these gates:

- install backend dependencies with development extras;
- check backend formatting with Ruff;
- lint backend and tests with Ruff;
- run the backend pytest suite.

Expected commands:

- `python -m pip install -e ".[dev]"`
- `python -m ruff format --check backend tests`
- `python -m ruff check backend tests`
- `python -m pytest`

### Frontend quality

The `Frontend quality` job runs on GitHub-hosted Ubuntu.

It uses Node.js and the frontend lockfile.

The frontend job runs these gates:

- install dependencies with `npm ci`;
- run Vitest;
- run the production build.

Expected commands from `frontend/`:

- `npm ci`
- `npm test`
- `npm run build`

## Merge rule

A pull request must not be merged when any required CI job is failing.

Minimum expected status before merge:

- `Backend quality`: pass
- `Frontend quality`: pass

If one job is pending, wait for the result before merge.

If one job fails, inspect the failing job log, identify the smallest safe correction, push a fix to the same branch, and re-check the PR.

Automatic merge remains forbidden.

## Branch protection status

As of F95, the repository CI exists and runs successfully, but GitHub branch protection is not active on `main`.

The F95 inspection confirmed:

- `main` is not protected;
- required status checks are not configured in GitHub branch protection;
- GitHub branch protection and repository rulesets were not available for this private repository in the current plan state.

Operational consequence:

- GitHub may not automatically block a manual merge when CI is failing.
- The human supervisor and Agent B must treat `Backend quality` and `Frontend quality` as mandatory manual gates before merge.
- A pull request must not be merged unless both checks are explicitly verified as `pass`, or an exception is documented and approved by the human supervisor.

If the repository is later upgraded to a plan that supports private branch protection, or if the repository becomes public, configure `main` protection with these required checks:

- `Backend quality`
- `Frontend quality`

Until then, the manual merge checklist is mandatory.

## Human and Agent B responsibilities

Before merge, the human supervisor and Agent B must confirm:

- the PR targets `main`;
- the PR scope matches the approved task;
- the diff is understandable and limited;
- no secret, token, cookie, password or API key is exposed;
- no `.env` file is read, printed, sourced, modified or committed;
- CI jobs are passing or any missing check is explicitly justified;
- application code changes have appropriate tests;
- documentation updates are included when the change affects workflow, usage or behavior.

## When Backend quality fails

Use the failed job log as the source of truth.

Common failure categories:

- dependency installation failure;
- PostgreSQL service issue;
- Redis service issue;
- Ruff formatting failure;
- Ruff lint failure;
- pytest failure;
- settings mismatch between CI environment variables and Django settings.

Recommended response:

1. Read the failed GitHub Actions log.
2. Identify whether the failure is infrastructure, configuration, lint, formatting or test behavior.
3. Avoid changing application code unless the failure proves a real application bug.
4. Prefer a narrow CI or test correction when the task is CI-only.
5. Re-run relevant local checks.
6. Push a fix to the same PR branch.
7. Confirm the GitHub check is green before merge.

## When Frontend quality fails

Use the failed job log as the source of truth.

Common failure categories:

- lockfile or dependency issue;
- TypeScript error;
- Vitest failure;
- Vite build failure.

Recommended response:

1. Read the failed GitHub Actions log.
2. Reproduce locally in `frontend/` when possible.
3. Run `npm test`.
4. Run `npm run build`.
5. Apply the smallest safe correction.
6. Push a fix to the same PR branch.
7. Confirm the GitHub check is green before merge.

## Local validation

For fast local non-DB validation, use the helper added in F93:

- `scripts/dev/erp-quality-check`

Equivalent manual commands are:

- `.venv/bin/python -m ruff format --check backend tests`
- `.venv/bin/python -m ruff check backend tests`
- `npm test` from `frontend/`
- `npm run build` from `frontend/`

Useful helper modes:

- `scripts/dev/erp-quality-check local`
- `scripts/dev/erp-quality-check backend-static`
- `scripts/dev/erp-quality-check frontend`
- `scripts/dev/erp-quality-check help`

For DB-backed backend validation, use the documented Docker Compose workflow when PostgreSQL and Redis are required.

Do not run DB-backed checks against an unconfirmed database.

## Secret safety

The CI workflow must not reference local secrets.

Forbidden in the workflow unless explicitly reviewed and approved for a future deployment task:

- `.env`;
- `secrets.*`;
- `GITHUB_TOKEN` direct usage;
- private credentials;
- production credentials;
- personal tokens.

Service credentials used for CI-only PostgreSQL are synthetic, local to the ephemeral GitHub Actions job, and must not be reused as real credentials.

## Relationship with Codex workflow

Codex may use CI results as independent validation evidence.

Codex Implementer may create branches, commits, pushes and pull requests only when the approved task specification explicitly allows it.

Codex must not merge pull requests.

Codex Reviewer must treat failing CI as a blocking issue unless there is an explicit human-approved exception.

Human merge control remains mandatory.
