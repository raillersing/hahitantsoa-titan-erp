# MVP Gap Audit - Hahitantsoa/Titan ERP

## Current Status

F86 integrated local read-only MVP acceptance result is `PASS`.
F87 closes the post-F86 documentation status for the accepted read-only local MVP.

This audit does not claim production readiness, Hahitantsoa write APIs, persistent Hahitantsoa
reservations, payment, invoice, contract or commercial workflows.

## 1. Status

F79 is an audit and documentation task only. It creates no application behavior.

F78 is completed, merged through PR #75 and post-merge validated.

The current goal is to finish a controlled, read-only Hahitantsoa/Titan MVP before any
persistence or write workflow is approved.

## 2. Executive summary

Titan has a functional local read-only MVP slice. It exposes authenticated inventory and
availability APIs, enforces the Titan kind boundary, provides local demo seeds, and has a React
screen for the inventory catalogue and period availability. The recorded local browser acceptance
result is `PASS`.

Hahitantsoa has a smaller read-only discovery slice. Its scope guards, immutable discovery value
object, static selector and authenticated discovery API are implemented and tested. Hahitantsoa
does not yet have a separate frontend surface, persistence, availability integration or planning
workflow.

The shortest useful route to an integrated MVP is:

1. expose the existing Hahitantsoa discovery API in a clearly separate frontend view;
2. harden API schema coverage for the confirmed read-only surfaces;
3. explicitly plan and approve the smallest read-only shared-material availability behavior;
4. run an integrated local acceptance covering both scopes.

Production readiness, write APIs and commercial workflows are not confirmed by F79 audit.

## 3. Business scope guardrails

### Titan

Titan is limited to:

- `material`;
- `article`;
- `material_pack`.

Titan excludes local, salle, lieu, venue, room, hall, event service, service annexe and service
evenementiel. No configuration or permission may enable these categories for Titan.

### Hahitantsoa

Hahitantsoa is distinct from Titan and represents the complete-event scope. The currently
approved slice is read-only discovery and planning only.

The shared Hahitantsoa/Titan concepts are exactly:

- `material`;
- `article`.

`material_pack` remains Titan-only for the current Hahitantsoa slice.

No persistent Hahitantsoa reservation, write API, pricing, stock, quantity, unit, customer,
payment, invoice, contract, availability or commercial workflow is approved.

Contract generation is explicitly deferred. The company already owns contract templates, which
will be addressed only when that topic is explicitly opened.

## 4. Titan current state

### Confirmed implementation

| Area | Confirmed state | Evidence |
| --- | --- | --- |
| Django apps | `inventory` and `reservations` are installed Django apps. | `backend/config/settings.py` |
| Inventory models | `InventoryItem` and `InventoryAvailability` exist. | `backend/apps/inventory/models.py` |
| Titan kinds | Inventory is constrained to `material`, `article`, `material_pack`. | `backend/apps/inventory/scope.py`, model constraint and tests |
| Availability | Half-open period conflict queries and available-item selectors exist. | `backend/apps/inventory/availability.py`, `selectors.py` |
| Reservations domain | Internal period, validation, preview, selector and service layers exist. | `backend/apps/reservations/` |
| Reservations persistence | No reservations model, migration or admin exists. | File structure and guard tests |
| APIs | Authenticated read-only inventory and reservations availability APIs exist. | URL/view files and API tests |
| Frontend | React displays Titan inventory and read-only period availability. | `frontend/src/App.tsx`, `AvailabilityPanel.tsx` |
| Local demo | Dev user, demo inventory and demo availability seeds exist. | Management commands and tests |
| Local acceptance | Recorded local browser acceptance result is `PASS`. | `docs/runbooks/mvp-local-demo-acceptance-result.md` |

### Ready for the current MVP

- authenticated read-only inventory catalogue;
- authenticated read-only inventory detail;
- read-only availability summary;
- read-only available-item previews;
- read-only item availability preview;
- Titan scope guards across domain, selectors, services, APIs and frontend types;
- local demo and smoke-validation documentation.

### Incomplete or limited

- The frontend does not consume the item-specific availability preview endpoint.
- Frontend authentication remains a manual backend session flow.
- OpenAPI regression tests explicitly prove inventory paths only.
- No persistent reservation or write workflow exists. This remains explicitly out of scope.
- Production deployment, production security review and operational monitoring are not confirmed
  by F79 audit.

## 5. Hahitantsoa current state

### Confirmed implementation

| Area | Confirmed state | Evidence |
| --- | --- | --- |
| Scope guards | Confirmed discovery concepts and Titan separation are enforced. | `backend/apps/hahitantsoa/scope.py` |
| Value object | Immutable `HahitantsoaDiscoveryItem` exists. | `backend/apps/hahitantsoa/discovery.py` |
| Selector | Static immutable ordered discovery catalogue exists. | `backend/apps/hahitantsoa/selectors.py` |
| API | Authenticated read-only discovery endpoint exists. | `backend/apps/hahitantsoa/views.py`, `urls.py` |
| API contract | Response exposes only `concept`, `label` and top-level `count`. | Serializer, view and API tests |
| DB behavior | The Hahitantsoa package has no model, migration, admin, DB access or QuerySet. | File structure and implementation |
| Tests | Scope, value object, selector and API tests exist. | `tests/backend/test_hahitantsoa_*.py` |

### Current limits and gaps

- Hahitantsoa is not registered as a Django app; its read-only URL surface is included directly.
- No frontend surface presents Hahitantsoa separately from Titan.
- No read-only Hahitantsoa planning screen exists.
- Shared-material availability behavior between Hahitantsoa and Titan is not implemented.
- Hahitantsoa API OpenAPI coverage is not explicitly asserted by the existing schema test.
- Persistence, reservation, allocation and commercial workflows remain unapproved and out of
  scope.

## 6. API map

Only routes confirmed from the repository are listed.

| Method | Path | Domain | Source | Access | Tests / status |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/healthz/` | Foundation | `backend/config/health.py` | Public liveness | `test_health_endpoint.py`; MVP ready |
| `GET` | `/readyz/` | Foundation | `backend/config/health.py` | Public readiness, PostgreSQL + Redis | `test_health_endpoint.py`; MVP ready |
| `GET` | `/api/schema/` | Foundation/OpenAPI | `backend/config/urls.py` | Public | `test_openapi_schema.py`; inventory coverage proven |
| `GET` | `/api/docs/swagger/` | Foundation/OpenAPI | `backend/config/urls.py` | Public | `test_openapi_schema.py`; local documentation |
| `GET` | `/api/docs/redoc/` | Foundation/OpenAPI | `backend/config/urls.py` | Public | `test_openapi_schema.py`; local documentation |
| `GET` | `/api-auth/login/` | Session auth | DRF URL include in `backend/config/urls.py` | Public login page | `test_drf_session_login.py`; local/session utility |
| `POST` | `/api-auth/login/` | Session auth | DRF URL include in `backend/config/urls.py` | Not confirmed by F79 audit | Login form behavior from Django auth view |
| `POST` | `/api-auth/logout/` | Session auth | DRF URL include in `backend/config/urls.py` | Not confirmed by F79 audit | Authenticated logout scenario covered by `test_drf_session_login.py` |
| `GET` | `/api/v1/inventory/items/` | Titan inventory | `backend/apps/inventory/urls.py` | Authenticated, read-only | Inventory API/auth tests; MVP ready |
| `GET` | `/api/v1/inventory/items/<uuid:pk>/` | Titan inventory | `backend/apps/inventory/urls.py` | Authenticated, read-only | Inventory API/auth tests; MVP ready |
| `GET` | `/api/v1/reservations/availability-summary/` | Titan availability | `backend/apps/reservations/urls.py` | Authenticated, read-only | Summary API tests; MVP ready |
| `GET` | `/api/v1/reservations/available-item-previews/` | Titan availability | `backend/apps/reservations/urls.py` | Authenticated, read-only | Preview API tests; MVP ready |
| `GET` | `/api/v1/reservations/items/<uuid:inventory_item_id>/availability-preview/` | Titan availability | `backend/apps/reservations/urls.py` | Authenticated, read-only | Item preview API tests; backend ready |
| `GET` | `/api/v1/hahitantsoa/discovery-items/` | Hahitantsoa discovery | `backend/apps/hahitantsoa/urls.py` | Authenticated, read-only | Hahitantsoa API tests; backend ready |

The domain APIs reject write methods. No Hahitantsoa write endpoint or reservations persistence
endpoint exists.

The Django admin route exists as a framework route in `backend/config/urls.py`; no project domain
admin implementation is confirmed by F79 audit.

## 7. Test map

| Group | Files or pattern | Purpose | DB use | MVP link |
| --- | --- | --- | --- | --- |
| Hahitantsoa guards | `test_hahitantsoa_scope.py` | Exact discovery concepts and Titan separation | No DB | Critical boundary |
| Hahitantsoa value/selector | `test_hahitantsoa_discovery.py`, `test_hahitantsoa_selectors.py` | Immutable discovery contract and deterministic catalogue | No DB | Critical discovery slice |
| Hahitantsoa API | `test_hahitantsoa_discovery_api.py` | Auth, strict payload, ordering and read-only methods | No DB through forced auth | Critical discovery API |
| Titan scope | `test_inventory_titan_scope.py`, `test_reservations_scope.py` | Allowed kinds and forbidden-category rejection | No DB | Critical boundary |
| Inventory model/persistence | `test_inventory_item_*`, `test_inventory_availability_*` | Model constraints, persistence and availability queries | Mixed; persistence/query tests use DB | Critical Titan backend |
| Inventory API | `test_inventory_item_*api*.py`, inventory smoke tests | Authenticated read-only list/detail and demo path | DB | Critical Titan API |
| Reservations domain/services | `test_reservations_*.py` | Periods, validation, previews, selectors, services, ordering and consistency | Mixed; most service/query tests use DB | Critical availability behavior |
| Reservations APIs | `test_reservations_*_api.py` | Auth, validation, strict read-only responses and no writes | DB | Critical Titan availability API |
| Health/readiness | `test_health_endpoint.py` | Liveness and PostgreSQL/Redis readiness behavior | Checks mocked where appropriate | Critical local ops |
| OpenAPI | `test_openapi_schema.py` | Schema and docs availability; inventory read-only paths | No business DB required | Quality guard, incomplete API coverage |
| Frontend | `frontend/src/*.test.tsx` | Inventory and availability rendering, API requests, errors and no write/login UI | No DB | Critical local demo |
| Seeds/session | `test_seed_*.py`, `test_drf_session_login.py` | Local demo data and session behavior | DB | Critical local demo |

Recent known validation evidence includes F77 API tests (`9 passed`), aggregated Hahitantsoa tests
(`99 passed`), Titan/reservations DB guards (`278 passed`) and a recorded local browser acceptance
result of `PASS`. F79 does not rerun application tests because it changes documentation only.

## 8. MVP gaps

### Required for MVP

| Category | Gap | Reason |
| --- | --- | --- |
| Frontend | No separate Hahitantsoa read-only discovery surface exists. | DEC-003 requires Hahitantsoa to be visible separately from Titan. |
| Frontend/navigation | The current screen is Titan-only and has no explicit scope navigation. | An integrated two-scope MVP needs a clear boundary. |
| OpenAPI/schema | Existing regression tests explicitly assert inventory paths only. | Confirmed read-only APIs should have stable documented contracts. |
| Domain/planning | Shared-material availability behavior for Hahitantsoa is not implemented. | DEC-003 identifies shared material interaction as required, but the smallest safe contract needs approval. |
| Acceptance | Integrated local acceptance now covers both Titan and Hahitantsoa read-only surfaces. | F86 recorded `PASS` in `docs/runbooks/mvp-integrated-local-acceptance-result.md`. |

### Nice-to-have after MVP

| Category | Gap | Reason |
| --- | --- | --- |
| Frontend | Titan item-specific availability preview is not consumed. | Backend endpoint exists; summary/previews already support the current demo. |
| UX | Frontend session login remains manual through DRF. | Acceptable for local MVP; a frontend auth workflow needs separate approval. |
| Documentation | Some historical backend README statements are stale. | Useful cleanup, but not required to prove behavior. |
| Local ops | Integrated Hahitantsoa/Titan acceptance runbook exists. | F83 added the runbook and F86 recorded the local integrated acceptance result as `PASS`. |

### Explicitly out of scope

- Hahitantsoa or Titan write APIs;
- persistent Hahitantsoa reservations;
- complete reservation workflow;
- contract generation or contract templates;
- invoice, payment, customer or pricing workflows;
- stock, quantity or unit workflows;
- production-readiness claims;
- unapproved Hahitantsoa persistence or availability behavior.

## 9. Recommended next tasks

### F80 - Hahitantsoa read-only frontend discovery surface

- **Objective:** add a small separate Hahitantsoa frontend view consuming the existing F77 API,
  with an explicit Hahitantsoa/Titan scope switch or navigation.
- **Scope:** frontend only plus directly relevant documentation/tests.
- **Probable files:** `frontend/src/`, frontend tests, `frontend/README.md`, status documentation.
- **Risk:** medium; the UI must never leak Hahitantsoa-only concepts into Titan.
- **MVP priority:** highest.
- **Reason:** closes the clearest DEC-003 acceptance gap using an existing stable API.

### F81 - Read-only API schema contract completion

- **Objective:** assert and document all confirmed inventory, reservations and Hahitantsoa
  read-only API paths and rejected write operations in OpenAPI.
- **Scope:** schema annotations/tests and documentation only; no new endpoint behavior.
- **Probable files:** API views/serializers only if schema annotations are required,
  `tests/backend/test_openapi_schema.py`, API documentation.
- **Risk:** low to medium; avoid changing runtime behavior while improving schema fidelity.
- **MVP priority:** high.
- **Reason:** removes uncertainty around the public read-only API contract.

### F82 - Shared-material availability read-only contract plan

- **Objective:** define the smallest approved read-only behavior showing how shared `material` and
  `article` availability relates across Hahitantsoa and Titan.
- **Scope:** documentation/contract first; implementation only in a separately approved task.
- **F82 status:** contract completed, merged and post-merge validated in
  `docs/architecture/hahitantsoa-titan-shared-availability-contract.md`; no implementation.
- **Probable future files:** focused implementation and tests only after approval.
- **Risk:** high; this crosses domain boundaries and must not introduce Hahitantsoa persistence or
  write behavior.
- **MVP priority:** high, but approval-gated.
- **Reason:** DEC-003 requires shared-material interaction, while current behavior is not
  implemented.

### F83 - Integrated local MVP acceptance

- **Objective:** validate Titan catalogue/availability and Hahitantsoa discovery together in the
  local browser flow.
- **Scope:** acceptance/runbook, targeted fixes only if separately approved.
- **F83 status:** runbook completed, merged and reviewed by Agent B; no application
  implementation.
- **F86 status:** integrated local read-only MVP acceptance executed and recorded as `PASS`
  in `docs/runbooks/mvp-integrated-local-acceptance-result.md`.
- **Probable files:** runbooks and status documentation.
- **Risk:** low if validation-only.
- **MVP priority:** final.
- **Reason:** provides objective completion evidence for the read-only integrated MVP.

## 10. Acceptance criteria for MVP

The controlled read-only MVP can be considered complete when:

- Titan displays only `material`, `article` and `material_pack`;
- Hahitantsoa is visibly separate from Titan;
- Hahitantsoa displays the confirmed read-only discovery categories;
- no Hahitantsoa-only concept appears as a Titan option;
- authenticated read-only inventory, availability and Hahitantsoa discovery APIs pass their
  contract tests;
- OpenAPI accurately includes every confirmed read-only MVP API;
- the approved shared-material availability behavior is documented and validated;
- frontend build and tests pass;
- backend targeted and full tests pass in the documented environment;
- integrated local browser acceptance passes and is recorded;
- runbooks explain local startup, validation and known limitations;
- no write API, persistent Hahitantsoa reservation, contract generation or commercial workflow is
  introduced;
- no production-readiness claim is made.

Items not confirmed by code or validation evidence remain: **Not confirmed by F79 audit.**
