# MVP Read-only Local Acceptance Summary

## Status

`PASS`

The Hahitantsoa/Titan read-only MVP has passed integrated local acceptance for the currently
approved scope.

This summary complements:

- `docs/runbooks/mvp-integrated-local-acceptance.md`;
- `docs/runbooks/mvp-integrated-local-acceptance-result.md`;
- `docs/mvp/mvp-gap-audit.md`.

## Acceptance Record

- Task: F86 integrated local MVP acceptance execution
- Result: `PASS`
- Merge: PR #83
- Scope: local/dev read-only MVP acceptance
- Evidence: `docs/runbooks/mvp-integrated-local-acceptance-result.md`

## Validated Capabilities

The accepted local MVP demonstrates:

- Titan read-only inventory consultation;
- Titan read-only availability consultation;
- Hahitantsoa separate read-only discovery surface;
- authenticated read-only backend APIs;
- OpenAPI visibility for confirmed read-only APIs;
- backend `/healthz/` and `/readyz/` smoke checks;
- PostgreSQL and Redis local readiness;
- DB-backed Titan/reservations API tests;
- frontend tests and production build;
- human browser observation for both Titan and Hahitantsoa surfaces.

## Business Guardrails Confirmed

### Titan

Titan remains limited to equipment/article rental concepts.

Visible Titan kinds during acceptance:

- `material_pack`;
- `article`;
- `material`.

Titan still excludes:

- venue rental;
- room/local/hall rental;
- event services;
- payment, invoice, contract and commercial workflow.

### Hahitantsoa

Hahitantsoa remains a read-only discovery/planning surface.

Visible Hahitantsoa discovery concepts during acceptance:

- `event`;
- `venue`;
- `local`;
- `room`;
- `hall`;
- `material`;
- `article`;
- `furniture`;
- `service`.

Hahitantsoa still excludes:

- reservation creation;
- write API;
- persistent reservation;
- payment;
- invoice;
- contract;
- commercial workflow.

## Known Limitations

This MVP acceptance does not claim:

- production readiness;
- deployment readiness;
- polished final UI;
- persistent Hahitantsoa reservation;
- shared `material`/`article` availability implementation;
- Titan reservation workflow;
- pricing, payment, invoice or contract workflow.

Shared `material` and `article` availability remains contract-only.

`material_pack` remains Titan-only.

## Operational Note

During F86, the first Hahitantsoa browser observation failed because the running Docker backend used
an older image that did not expose the Hahitantsoa URL route. The repository code was correct.
Rebuilding and recreating the backend container fixed the local runtime.

Future integrated acceptance runs should rebuild or recreate the backend Docker container when the
running API routes or OpenAPI schema do not match the local source tree.

## Recommended Next Decision

The next product decision should choose one path:

1. implement the approved shared `material`/`article` availability contract;
2. start the smallest Titan reservation workflow;
3. improve UI/UX polish without changing business behavior.

Recommendation: choose the next implementation only after explicitly confirming whether the MVP
read-only phase is considered closed for stakeholder/demo purposes.
