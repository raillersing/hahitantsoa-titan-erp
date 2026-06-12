# F121B1 - Permission primitive inspection

## 1. Scope

F121B1 is inspection and documentation only.

F121B1 changes no application code, no tests, and no runtime behavior.

The inspection was organized in multi-agent style:

- Agent A inspected security and authorization.
- Agent B inspected domain and architecture boundaries.
- Agent C inspected tests and regression coverage.
- Agent D inspected documentation as an audit surface.

Those agent roles inspected and reported only. No subagent or reviewer modified repository files. Only the main agent produced this document.

## 2. Current authorization facts

### Current DRF permissions used by reservation APIs

The reservation API currently uses `IsAuthenticated` in:

- `backend/apps/reservations/views.py` - `ReservationAvailabilitySummaryAPIView`
- `backend/apps/reservations/views.py` - `ReservationAvailableItemPreviewsAPIView`
- `backend/apps/reservations/views.py` - `ReservationItemAvailabilityPreviewAPIView`
- `backend/apps/reservations/views.py` - `ReservationDraftListCreateAPIView`
- `backend/apps/reservations/views.py` - `ReservationDraftRetrieveAPIView`

Current behavior by surface:

- read-only availability preview and summary APIs use `IsAuthenticated`;
- draft create, list, detail, and update APIs also use `IsAuthenticated`.

### Current files and functions where auth/permission facts appear

Direct reservation permission declarations currently appear in:

- `backend/apps/reservations/views.py`

Current reservation view helper relevant to validation but not authorization:

- `backend/apps/reservations/views.py` - `validated_period_or_error_response`

Current reservation queryset helper relevant to visibility but not authorization:

- `backend/apps/reservations/views.py` - `active_reservation_drafts`

### Existing custom permission, helper, or policy

No repository-local custom reservation permission helper, permission class, authorization policy module, or reusable identity permission primitive is currently present in:

- `backend/apps/reservations/`
- `backend/apps/identity/`
- `backend/apps/common/`
- `backend/apps/audit/`

Inspection found no existing use of:

- DRF `BasePermission`;
- custom `has_permission`;
- custom `has_object_permission`;
- reservation-local authorization helper for sensitive writes.

### Current user, staff, group, and role model

Current repository evidence shows:

- Django auth is the current authentication base, consistent with `ADR-009`;
- `backend/apps/identity/README.md` explicitly says the domain does not create custom permissions yet;
- no repository-local role model exists in `backend/apps/identity/`;
- no repository-local group-to-role mapping exists in inspected code;
- no reservation-specific authorization model exists;
- `backend/apps/common/management/commands/seed_dev_user.py` and its tests show a seeded dev user with `is_staff=False` and `is_superuser=False`.

From the current repository, the only confirmed actor attributes are the standard Django user/session model and standard Django booleans such as `is_staff` and `is_superuser`. There is no accepted repository-local permission model beyond that.

### F121B2 actor vocabulary decision

To avoid carrying vague documentation terms into code, F121B2 should use one precise temporary backend concept:

- `reservation-sensitive staff actor`

For F121B2 only, this means:

- the actor is authenticated;
- the actor is active when that attribute is available;
- the actor has `is_staff=True`;
- normal authenticated users are not reservation-sensitive staff actors;
- `operator`, `manager`, `reviewer`, and `authorized user` must not appear as code-level roles unless a later slice introduces a real repository-local role model.

This is a minimal backend safety primitive, not a final business-role model. It intentionally avoids broad RBAC and does not create a local actor-category table. Future slices may replace or wrap this temporary staff gate if the project introduces explicit operator/manager roles.

## 3. Sensitive-write gap

### Current acceptable use

The current use of `IsAuthenticated` is acceptable for the repository's present surfaces because those surfaces are limited to:

- read-only reservation availability endpoints;
- draft-safe reservation create/update flows;
- no confirmation write path;
- no durable inventory blocking from reservations;
- no active audit subsystem.

### Future unacceptable use

The same `IsAuthenticated` gate becomes insufficient for future sensitive writes because `DEC-005` and `DEC-006` already require:

- explicit backend authorization beyond generic authentication;
- durable attribution;
- transaction-safe audit behavior;
- no frontend-only enforcement;
- no partial success behavior for sensitive writes.

Therefore the gap is not that current read-only or draft-safe behavior is necessarily unsafe today. The gap is that the current authorization shape cannot be reused as-is for future confirmation or any other reservation-sensitive write.

## 4. Multi-agent findings

### Agent A - Security and authorization

- Reservation APIs currently declare `permission_classes = [IsAuthenticated]` only in `backend/apps/reservations/views.py`.
- No custom permission class or helper exists today in `backend/apps/reservations/`, `backend/apps/identity/`, `backend/apps/common/`, or `backend/apps/audit/`.
- No inspected repository file provides a custom actor category model, custom role table, or group-backed reservation authorization policy.
- The smallest missing backend foundation is an explicit sensitive-action authorization primitive that is separate from ordinary authenticated access.

### Agent B - Domain and architecture

- `DEC-005`, `DEC-006`, `ADR-004`, `ADR-009`, `F120`, and `F121A` are aligned on one point: reservation confirmation must not start from current draft/read-only foundations without an explicit sensitive-write authorization layer.
- Titan/Hahitantsoa separation is preserved in current code because reservations remain Titan-oriented and no Hahitantsoa write workflow exists.
- The permission primitive must not become a disguised confirmation implementation, a broad RBAC rollout, or an early Hahitantsoa/Titan shared write abstraction.
- The primitive should stay local to reservation-sensitive writes first, then only generalize later if the codebase actually needs it.

### Agent C - Tests and regression coverage

Current backend tests cover:

- unauthenticated access denial for current reservation read-only APIs and draft APIs;
- reservation draft persistence and API behavior;
- read-only availability behavior and conflict rules;
- common abstract model fields such as `created_by` and `updated_by`.

Current backend tests do not cover:

- authenticated but unauthorized actor denied from a future sensitive write primitive;
- authorized actor explicitly allowed by a reservation-sensitive authorization primitive;
- object- or action-level reservation authorization semantics;
- transaction-safe audit semantics for reservation-sensitive writes.

Best narrow test seam before confirmation exists:

- a repository-local reservation authorization helper or policy function that can be tested directly without inventing a future endpoint.

Main testing risk:

- writing speculative tests against a future confirmation endpoint would couple F121B to behavior that the repository does not implement yet.

### Agent D - Documentation audit and bug discovery

- Current decisions are directionally consistent, but they still use intentionally broad words such as `authorized actor`, `staff/operator`, `reviewer/manager`, and `sensitive write` without mapping them to a concrete repository-local permission primitive.
- `F117` still describes F120 as a potential first narrow confirmation implementation slice, while `F120` later documents that implementation is still blocked. That is now a historical sequencing artifact, not a live contradiction, but it can mislead future planning if read in isolation.
- Current repository docs accept `IsAuthenticated` for read-only and draft-safe surfaces, but no document yet specifies whether reservation draft writes are intentionally open to any authenticated actor or simply tolerated as an interim foundation. That is a likely future policy gap.
- The repository exposes `created_by` and `updated_by` through `AuditableModel`, but inspected reservation draft serializers and views do not establish any visible attribution-setting behavior. This is not proof of a bug in current scope, but it is a likely implementation gap once sensitive writes begin.

## 5. Candidate permission primitive designs

### Option 1 - reservations-local helper or policy function

Allowed file area:

- `backend/apps/reservations/`

Likely shape:

- a new module such as `backend/apps/reservations/authorization.py`
- one or more keyword-only helper functions that answer whether a backend actor may perform a reservation-sensitive action

Advantages:

- smallest surface area;
- decoupled from DRF and reusable by future service-layer confirmation code;
- easy to unit test before a confirmation endpoint exists;
- matches the repo's existing local-helper pattern (`scope.py`, `periods.py`, `validation.py`, `availability.py`).

Risks:

- could drift into ad hoc policy sprawl if too many actions are added without structure;
- may need a later DRF wrapper for endpoint-level integration.

Testability:

- very good;
- direct unit tests can cover unauthenticated, authenticated-unauthorized, and explicitly authorized actors without speculative API work.

Fit for this repo now:

- strong fit.

### Option 2 - reservations-local DRF permission class

Allowed file area:

- `backend/apps/reservations/`

Likely shape:

- a new module such as `backend/apps/reservations/permissions.py`
- one or more custom DRF permission classes

Advantages:

- integrates naturally with future write API views;
- expresses permission intent in the same layer where current `permission_classes` are already declared.

Risks:

- premature coupling to DRF before a confirmation endpoint exists;
- weaker fit if future confirmation logic is service-first or command-style;
- may encourage writing a placeholder endpoint just to exercise the permission class.

Testability:

- reasonable, but best when tied to a concrete API surface;
- less clean than a plain helper for pre-endpoint inspection work.

Fit for this repo now:

- partial fit, but not the smallest safe first move.

### Option 3 - identity-level reusable permission primitive

Allowed file area:

- `backend/apps/identity/`
- possibly a narrow integration point in `backend/apps/reservations/`

Likely shape:

- a reusable permission helper or policy abstraction meant to serve multiple apps later

Advantages:

- future reuse across domains;
- can centralize backend authorization vocabulary if the ERP grows a broader permission model.

Risks:

- strongest risk of premature broad RBAC;
- `backend/apps/identity/` currently contains no custom permission implementation pattern;
- high chance of solving a wider problem than the repo currently needs.

Testability:

- possible, but harder to keep narrow and repository-specific.

Fit for this repo now:

- weak fit for the immediate slice.

## 6. Recommended F121B2 implementation choice

Recommended choice:

- `reservations`-local helper or policy function

Why:

- it is the smallest safe primitive;
- it matches the repository's existing local-helper style;
- it can be tested directly before any confirmation endpoint exists;
- it avoids committing the project to broad RBAC or DRF-specific design too early;
- it gives F121C/F121D/F121E a stable seam without pulling confirmation logic forward.

Expected files to change in F121B2:

- `backend/apps/reservations/authorization.py` or an equivalently named local policy module
- `backend/apps/reservations/README.md`

Expected tests to add in F121B3:

- `tests/backend/test_reservations_authorization.py`

Expected test cases for F121B3:

- unauthenticated actor is denied by the primitive;
- inactive actor is denied by the primitive when `is_active` is available;
- authenticated non-staff actor is denied;
- authenticated staff actor is allowed as the temporary reservation-sensitive staff actor;
- the primitive is backend-only and does not rely on frontend state;
- the primitive does not expand Titan scope or imply confirmation behavior;
- the primitive does not create or imply `operator`, `manager`, or broad RBAC roles.

F121B2 must not implement:

- reservation confirmation;
- DRF write endpoint changes;
- audit persistence;
- attribution fields;
- signed-contract or deposit prerequisite models;
- broad RBAC;
- Hahitantsoa write workflow changes.

## 7. Potential bugs, inconsistencies, and corrections discovered from documentation review

- `docs/audits/F117_BACKEND_COMPLETION_ROADMAP.md` still describes F120 as a possible first narrow confirmation implementation slice. `docs/audits/F120_RESERVATION_CONFIRMATION_TECHNICAL_CADRAGE.md` later narrows that path and blocks implementation. This is not a direct contradiction now, but it is a sequencing ambiguity that can mislead a reader who starts from F117 only.
- `docs/decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md` uses vocabulary such as `authenticated staff/operator`, `privileged reviewer/manager`, and `explicitly authorized backend actor category`, but the repository currently has no local actor-category model that makes those words concrete.
- `docs/decisions/DEC-005-reservation-confirmation-domain-contract.md` and `docs/decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md` correctly reject `IsAuthenticated` for future sensitive writes, but current reservation draft write APIs still use `IsAuthenticated`. That is acceptable for the current scope, but the docs do not yet say whether draft writes are intentionally open to any authenticated user or simply tolerated as an interim implementation. This is a likely missing policy decision.
- `backend/apps/common/models.py` provides `created_by` and `updated_by`, while current reservation draft surfaces do not visibly establish attribution behavior. This suggests a likely future code issue or missing test area, but the current inspection is not enough to prove a runtime bug.
- Likely missing tests:
  - authenticated-but-unauthorized actor tests for a reservation-sensitive primitive;
  - explicit authorized actor tests for the same primitive;
  - regression tests proving the primitive remains independent from future confirmation endpoints.
- Correction before coding:
  - tighten vocabulary in future docs and implementation prompts by replacing broad words like `authorized user` or `operator` with `reservation-sensitive staff actor` for F121B2;
  - document that this is a temporary `is_staff`-based backend gate, not a final business-role model;
  - forbid F121B2 from creating `operator`, `manager`, or broad RBAC concepts.

## 8. Anti-scope-creep guard

F121B must not:

- implement confirmation;
- add audit persistence;
- add attribution fields;
- add contract/deposit prerequisite models;
- introduce broad RBAC;
- change frontend;
- change Hahitantsoa workflows.

## 9. Validation commands

```sh
git diff --check
git status --short
git diff -- docs/audits/F121B1_PERMISSION_PRIMITIVE_INSPECTION.md
```
