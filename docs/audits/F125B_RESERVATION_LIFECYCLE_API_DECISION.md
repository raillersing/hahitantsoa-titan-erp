# F125B - Reservation lifecycle API decision

## 1. Status

F125B is documentation-only.

It records the decision for reservation draft confirmation and confirmed
reservation cancellation API exposure after the F124 API boundary hardening and
F125A roadmap refresh.

F125B does not change backend runtime code, frontend code, tests, models,
migrations, serializers, views, URLs, routers, OpenAPI paths, or secrets
handling.

## 2. Current API surface

The current reservation API surface remains limited to approved authenticated
read and draft-only endpoints:

- `GET /api/v1/reservations/availability-summary/`
- `GET /api/v1/reservations/available-item-previews/`
- `GET /api/v1/reservations/items/<uuid:inventory_item_id>/availability-preview/`
- `GET /api/v1/reservations/drafts/`
- `POST /api/v1/reservations/drafts/`
- `GET /api/v1/reservations/drafts/<uuid:pk>/`
- `PUT /api/v1/reservations/drafts/<uuid:pk>/`
- `PATCH /api/v1/reservations/drafts/<uuid:pk>/`

The current reservation API does not expose:

- confirmation routes;
- cancellation routes;
- prerequisite marker routes;
- lifecycle write serializers;
- lifecycle write views;
- lifecycle write URLs;
- lifecycle write routers.

## 3. Internal lifecycle foundation

The backend already has internal lifecycle services for:

- contract-signed prerequisite marker persistence;
- required-deposit-received prerequisite marker persistence;
- confirmation preflight;
- transactional draft confirmation;
- transactional confirmed reservation cancellation;
- transaction-safe success audit scheduling;
- linked inventory block creation and release;
- stable reservation-local lifecycle exception codes.

These services are intentionally backend-internal for now.

## 4. Decision

Confirmation and cancellation must remain backend-internal for now.

F125B does not approve a public lifecycle write API.

A future lifecycle API may only be introduced in a separately approved,
narrow implementation slice after its external contract is explicitly specified
and tested.

## 5. Reasoning

Opening confirmation or cancellation as API endpoints would freeze an external
contract around sensitive operations that currently combine:

- authenticated actor attribution;
- staff-only sensitive lifecycle authorization;
- prerequisite markers;
- availability revalidation;
- transaction boundaries;
- inventory blocking and release;
- lifecycle metadata invariants;
- success audit scheduling;
- stable internal error codes.

Those concerns are already implemented internally, but the external API contract
must not be exposed before permission, data-scope, error mapping, audit behavior,
and OpenAPI expectations are intentionally designed.

The safest and fastest backend finalization path is to keep lifecycle writes
internal now and continue with the planned backend foundations:

1. F126 - commercial documents backend foundation;
2. F127 - payment/deposit backend foundation;
3. F128 - logistics and returns backend foundation;
4. F129 - backend completion audit for remaining ERP domains.

## 6. Future API shape, not implemented by F125B

A future approved slice may consider endpoint names such as:

- `POST /api/v1/reservations/drafts/<uuid:pk>/confirm/`
- `POST /api/v1/reservations/drafts/<uuid:pk>/cancel/`

These routes are examples only. They are not implemented by F125B.

A future implementation must decide whether prerequisite marker writes remain
internal or get their own controlled API surface. That decision must not be
silently bundled with confirmation/cancellation.

## 7. Future error mapping, not implemented by F125B

A future lifecycle API should map reservation-local lifecycle errors to explicit
HTTP responses.

Recommended future mapping:

| Internal code | Future HTTP status | Meaning |
| --- | ---: | --- |
| `soft_deleted_draft` | 404 | Draft is outside active reservation scope. |
| `draft_not_in_draft_state` | 409 | Confirmation requires an active draft state. |
| `draft_has_cancellation_metadata` | 409 | Draft carries cancellation metadata and cannot be confirmed or marked. |
| `draft_has_confirmation_metadata` | 409 | Draft carries confirmation metadata unexpectedly. |
| `draft_has_no_active_lines` | 409 | Confirmation requires at least one active draft line. |
| `confirmation_preflight_failed` | 409 | Confirmation blockers remain. |
| `draft_not_confirmed` | 409 | Cancellation requires confirmed state. |
| `draft_already_cancelled` | 409 | Reservation is already cancelled. |
| `incomplete_confirmation_metadata` | 409 | Confirmed state metadata is incomplete. |
| `partial_cancellation_metadata` | 409 | Cancellation metadata is partial or inconsistent. |

Authentication and authorization failures should remain API boundary failures,
not generic lifecycle state errors.

## 8. Required tests for a future lifecycle API

A future implementation slice must include tests proving:

- unauthenticated users cannot call lifecycle write endpoints;
- unauthorized actors cannot confirm or cancel;
- actors without persistent identifiers cannot confirm or cancel;
- soft-deleted drafts are not exposed;
- confirmation maps lifecycle state and prerequisite errors predictably;
- cancellation maps lifecycle state errors predictably;
- confirmation remains transactional;
- cancellation only releases linked confirmation blocks;
- failed operations do not persist success audit events;
- draft API payloads do not expose lifecycle write fields unexpectedly;
- no Hahitantsoa write behavior is introduced;
- no broad RBAC expansion is introduced;
- OpenAPI exposes only the approved lifecycle contract.

## 9. Explicit exclusions

F125B does not add:

- confirmation API endpoint;
- cancellation API endpoint;
- prerequisite marker API endpoint;
- lifecycle write serializer;
- lifecycle write view;
- lifecycle write URL or router;
- OpenAPI lifecycle write path;
- frontend behavior;
- payment provider integration;
- invoice or receipt workflow;
- PDF contract generation;
- refund behavior;
- completed or no_show lifecycle semantics;
- logistics, delivery, return, breakage, or loss workflow;
- Hahitantsoa write behavior;
- broad RBAC;
- OpenClaw.

## 10. Acceptance criteria

F125B is complete when:

- this decision is documented;
- the reservations README references the decision;
- existing API guard tests still pass;
- no runtime/API files are changed;
- no lifecycle route, serializer, view, URL, router, OpenAPI path, frontend
  behavior, payment provider integration, invoice, receipt, PDF, refund,
  logistics, completed/no_show, Hahitantsoa write, broad RBAC, or OpenClaw work
  is introduced.
