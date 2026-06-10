# Integrated Local MVP Acceptance - Hahitantsoa/Titan ERP

## 1. Status

F83 defines the integrated local acceptance procedure for the read-only Hahitantsoa/Titan MVP.

F83 is documentation and acceptance only. It adds no application behavior, endpoint, test,
runtime change, persistence, reservation or commercial workflow.

Latest recorded result: `PASS` from F86 in
[`mvp-integrated-local-acceptance-result.md`](mvp-integrated-local-acceptance-result.md).

Post-F102 note: this runbook remains the historical integrated acceptance procedure for the F83/F86
read-only MVP scope. It does not by itself validate the complete current project state after F98-F102,
including document template registry endpoints, customer/contact APIs or `ReservationDraft`
draft-only creation.

## 2. Purpose

This runbook validates the historical local read-only MVP across backend quality checks,
health/readiness, confirmed APIs, OpenAPI, the Titan frontend surface, the Hahitantsoa discovery
surface and their business separation.

It does not validate production readiness, confirmed reservation workflows, payment, invoice,
contract generation, PDF runtime generation or complete commercial workflows.

## 3. Preconditions

- The repository is on the merged `main` revision being accepted.
- The working tree is clean before acceptance begins.
- The backend Docker image is rebuilt or recreated when recently added routes are missing from the
  running container or when `/api/schema/` does not match the local source tree.
- Docker is available.
- PostgreSQL and Redis can be made healthy when DB-backed checks are required.
- The backend virtual environment exists at `.venv/`.
- Frontend dependencies are installed.
- The human operator has prepared the required runtime environment outside agent workflows.
- Agents never read, display, source, inspect or modify `.env`.
- If required runtime configuration is missing, agents stop and ask the human operator to prepare
  it without exposing secret values.
- Every terminal validation uses `scripts/dev/erp-logged-run` with heredoc/stdin.

Use the wrapper only in this form:

```sh
scripts/dev/erp-logged-run task-name <<'EOF'
commands
EOF
```

Do not pass commands as wrapper arguments. Do not include commands that print secrets.

## 4. Business Guardrails Validated

- Titan exposes only `material`, `article` and `material_pack`.
- Hahitantsoa remains visibly distinct from Titan.
- The only shared Hahitantsoa/Titan concepts are `material` and `article`.
- `material_pack` remains Titan-only.
- Hahitantsoa discovery remains read-only planning information.
- No Hahitantsoa reservation, hold, allocation, persistence or write API exists.
- No contract or template generation, pricing, payment, invoice, customer, stock, quantity or
  unit workflow exists.
- Hahitantsoa-only `event`, `venue`, `local`, `room`, `hall`, `furniture` and `service` concepts
  never become Titan options.

## 5. Backend Validation

The following checks do not require business DB access:

```sh
scripts/dev/erp-logged-run mvp-integrated-backend-nondb <<'EOF'
set -euo pipefail

git branch --show-current
git status --short

.venv/bin/python -m ruff format --check .
.venv/bin/python -m ruff check .
.venv/bin/python backend/manage.py check
.venv/bin/pytest \
  tests/backend/test_openapi_schema.py \
  tests/backend/test_hahitantsoa_discovery_api.py \
  -q

git diff --check
git status --short
EOF
```

When a configured DB runtime is available, also run the focused Titan/reservations API checks
listed in the Docker section. Do not run DB-backed checks against an unconfirmed database.

## 6. Docker Validation

The commands below assume the human operator has already prepared the required runtime
environment. References made internally by Docker Compose to secret-bearing files do not grant an
agent permission to open, inspect, print, source or modify those files.

Run this block only when the human operator confirms that the environment is ready:

```sh
scripts/dev/erp-logged-run mvp-integrated-docker-validation <<'EOF'
set -euo pipefail

docker compose up -d db redis
docker compose ps
docker compose run --rm backend python backend/manage.py check
docker compose run --rm backend python -m pytest \
  tests/backend/test_inventory_item_readonly_api.py \
  tests/backend/test_reservations_availability_summary_api.py \
  tests/backend/test_reservations_available_item_previews_api.py \
  tests/backend/test_reservations_item_availability_detail_api.py \
  -q

git status --short
EOF
```

Acceptance requires PostgreSQL and Redis to report healthy before DB-backed tests are considered
valid. Starting or stopping shared local services remains an explicit operator decision.

## 7. Frontend Validation

Run the automated frontend checks:

```sh
scripts/dev/erp-logged-run mvp-integrated-frontend-validation <<'EOF'
set -euo pipefail

cd frontend
npm test
npm run build
cd ..

git status --short
EOF
```

Manual browser acceptance remains separate from automated frontend tests:

1. Start the configured backend and frontend development servers.
2. Open `http://127.0.0.1:5173/`.
3. Confirm the Titan surface displays inventory and read-only availability.
4. Confirm only `material`, `article` and `material_pack` appear as Titan kinds.
5. Switch to the Hahitantsoa surface.
6. Confirm Hahitantsoa discovery displays its confirmed concepts as discovery-only information.
7. Confirm `material_pack` is not presented as a shared Hahitantsoa concept.
8. Confirm loading and error states remain read-only.
9. Confirm no reservation, payment, invoice, contract or other write/commercial control exists.

Record browser acceptance only when a human operator actually performed these observations.

## 8. API Manual Smoke Checks

Public smoke checks, when the backend is running:

- `GET http://127.0.0.1:8000/healthz/`;
- `GET http://127.0.0.1:8000/readyz/`;
- `GET http://127.0.0.1:8000/api/schema/`.

The following APIs require the existing authenticated Django session and should be checked through
an authenticated browser or another approved session-aware client:

- `GET /api/v1/inventory/items/`;
- `GET /api/v1/reservations/availability-summary/?start_at=<aware>&end_at=<aware>`;
- `GET /api/v1/reservations/available-item-previews/?start_at=<aware>&end_at=<aware>`;
- `GET /api/v1/hahitantsoa/discovery-items/`.

Do not place credentials, session cookies, tokens or secret values in commands or acceptance
logs.

## 9. Acceptance Checklist

- [ ] Repository revision and working tree were checked.
- [ ] Ruff format and lint checks passed.
- [ ] Django check passed.
- [ ] OpenAPI and Hahitantsoa API contract tests passed.
- [ ] PostgreSQL and Redis were healthy for DB-backed tests.
- [ ] Targeted Titan/reservations DB-backed API tests passed.
- [ ] Public health, readiness and schema smoke checks passed.
- [ ] Frontend tests passed.
- [ ] Frontend build passed.
- [ ] Titan surface was manually observed.
- [ ] Hahitantsoa surface was manually observed.
- [ ] Hahitantsoa concepts were presented as discovery-only information.
- [ ] `material_pack` was not presented as a shared Hahitantsoa concept.
- [ ] No Hahitantsoa write, reservation or commercial control was visible.
- [ ] No secret-bearing file or value was printed or inspected.
- [ ] Final Git status was clean or contained only expected documentation changes.

## 10. Result Recording

Record each execution in
[`mvp-integrated-local-acceptance-result.md`](mvp-integrated-local-acceptance-result.md).

The result must include:

- date and time;
- Git branch and HEAD;
- validations executed and their log references;
- `PASS`, `PARTIAL` or `FAIL`;
- known limitations;
- whether human browser acceptance was actually performed.

Use `PASS` only when every required automated, Docker/API and manual browser check passes. Use
`PARTIAL` when a required area, especially authenticated browser acceptance or DB-backed checks,
was not executed. Use `FAIL` when an executed required check fails.
