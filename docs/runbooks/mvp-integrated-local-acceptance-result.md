# Integrated Local MVP Acceptance Result

## Status

`PASS`

This result records the integrated local MVP acceptance executed during F86.

It validates the read-only Hahitantsoa/Titan MVP across backend non-DB checks, Docker/DB-backed
checks, public backend smoke checks, frontend tests/build and human browser observation.

Post-F102 note: this result is historical evidence for the F86 read-only acceptance scope. It does
not describe the complete current project state after F98-F102. The current project state also
includes read-only document template registry endpoints, read-only customer/contact APIs and a
limited authenticated `ReservationDraft` draft-only write path. The current scope is summarized in
`README.md` and `PLANS.md`.

Post-F93A note: this result is not the source of truth for current Hahitantsoa lifecycle or
confirmation decisions. Those come from Documents A/B and
`docs/audits/F92_HAHITANTSOA_LIFECYCLE_SOURCE_TRACE.md`.

This result does not claim production readiness, confirmed reservation workflows, payment, invoice,
contract generation, PDF runtime generation or complete commercial workflows.

## Version Under Review

- Date: 2026-06-09
- Branch: `test/mvp-integrated-local-acceptance-execution`
- Base merge commit: `341bc7d`
- Task: F86 integrated local MVP acceptance execution

## Executed Validations

The following areas were executed without reading or inspecting `.env`:

| Validation | Result | Evidence |
| --- | --- | --- |
| Repository base and branch checks | PASS | `logs/terminal/f86-create-integrated-acceptance-execution-branch-20260609-140145.log` |
| Ruff format check | PASS | `logs/terminal/f86-backend-nondb-validation-20260609-140226.log` |
| Ruff lint check | PASS | `logs/terminal/f86-backend-nondb-validation-20260609-140226.log` |
| Django check | PASS | `logs/terminal/f86-backend-nondb-validation-20260609-140226.log` |
| OpenAPI and Hahitantsoa discovery API tests | PASS - 12 tests | `logs/terminal/f86-backend-nondb-validation-20260609-140226.log` |
| PostgreSQL and Redis container health | PASS - both healthy | `logs/terminal/f86-docker-db-backed-validation-20260609-140304.log` |
| Docker backend Django check | PASS | `logs/terminal/f86-docker-db-backed-validation-20260609-140304.log` |
| Targeted Titan/reservations DB-backed API tests | PASS - 64 tests | `logs/terminal/f86-docker-db-backed-validation-20260609-140304.log` |
| Frontend tests | PASS - 20 tests | `logs/terminal/f86-frontend-validation-20260609-140418.log` |
| Frontend production build | PASS | `logs/terminal/f86-frontend-validation-20260609-140418.log` |
| Public `/healthz/` smoke check | PASS | `logs/terminal/f86-backend-http-smoke-validation-20260609-140448.log` |
| Public `/readyz/` smoke check | PASS | `logs/terminal/f86-backend-http-smoke-validation-20260609-140448.log` |
| Public `/api/schema/` smoke check | PASS | `logs/terminal/f86-backend-http-smoke-validation-20260609-140448.log` |
| Hahitantsoa backend route after Docker rebuild | PASS - unauthenticated request returns 403, OpenAPI includes route | `logs/terminal/f86-rebuild-backend-and-retest-hahitantsoa-api-20260609-141319.log` |
| Frontend port/backend port checks | PASS | `logs/terminal/f86-check-local-ports-before-browser-retry-20260609-141752.log` |
| Human browser observation - Titan surface | PASS | Human observation on 2026-06-09 |
| Human browser observation - Hahitantsoa surface | PASS | Human observation on 2026-06-09 |
| Documentation/result update scope | PASS | F86 result update only |

## Human Browser Acceptance

Human browser acceptance was performed on 2026-06-09.

Observed Titan surface:

- Titan inventory loaded successfully.
- Three inventory items were visible.
- Visible Titan kinds were `material_pack`, `article` and `material`.
- Availability remained read-only.
- No reservation, payment, invoice, contract or commercial write control was visible.

Observed Hahitantsoa surface:

- Hahitantsoa discovery loaded successfully.
- Nine discovery concepts were visible: `event`, `venue`, `local`, `room`, `hall`, `material`,
  `article`, `furniture` and `service`.
- The Hahitantsoa surface remained separate from Titan.
- Hahitantsoa displayed read-only discovery/planning information.
- The UI stated that the surface does not create reservations, contracts or commercial workflows.
- No reservation, payment, invoice, contract or commercial write control was visible.

## Notes

During initial browser acceptance, Hahitantsoa discovery returned unavailable because the running
Docker backend container used an older image that did not expose the Hahitantsoa URL route. The
repository code already contained the route. Rebuilding and recreating the backend container made
`GET /api/v1/hahitantsoa/discovery-items/` available.

After rebuild, an unauthenticated direct request returned `403 Forbidden`, which is expected because
the endpoint is authenticated. The OpenAPI schema also included
`/api/v1/hahitantsoa/discovery-items/`.

## Known Limitations

- Hahitantsoa remains read-only discovery/planning.
- Shared `material`/`article` availability remains contract-only and is not implemented.
- `material_pack` remains Titan-only.
- At the time of F86, no persistent Hahitantsoa reservation, write API or commercial workflow existed in the accepted read-only scope.
- This result does not claim production readiness.
- UI visual polish remains future work and is not part of this acceptance result.

## Final Result

`PASS`

The integrated local read-only MVP acceptance passed for the F86/F87 approved historical scope.

The current MVP demonstrates:

- Titan read-only inventory and availability consultation;
- Hahitantsoa separate read-only discovery surface;
- authenticated read-only backend APIs;
- OpenAPI visibility for confirmed read-only APIs;
- backend health/readiness smoke checks;
- DB-backed Titan/reservations tests;
- frontend tests and production build;
- no visible Hahitantsoa reservation, write or commercial workflow.
