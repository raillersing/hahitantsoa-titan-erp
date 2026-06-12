# F121A - Backend foundation multi-agent inspection and implementation plan

## 1. Scope

F121A is inspection and planning only.

F121A creates one documentation artifact and does not change backend code, frontend code, migrations, models, serializers, services, views, URLs, permissions, audit runtime behavior, or tests.

## Historical status note

F121A is preserved as the planning baseline for the F121 backend mini-epic.

The repository has since moved beyond this planning state through the
implementation and validation of F121E-F121J. As a result, the "current
repository findings", "recommended next immediate slice", and mini-epic
sequence in this document are historical planning statements, not the current
authoritative repository status.

For the refreshed post-F121J backend status and finalization roadmap, use
`docs/audits/F121K_F121_LIFECYCLE_AND_BACKEND_ROADMAP_REFRESH.md`.

## 2. Non-goals

F121A does not:

- implement reservation confirmation;
- add a confirmed reservation state;
- add signed-contract or deposit/payment models;
- add explicit permission code;
- add audit persistence;
- add tests;
- change Hahitantsoa behavior;
- broaden Titan beyond pure rental of `material`, `article`, and `material_pack`.

## 3. Current repository findings

### Confirmed current state

Repository inspection confirms:

- `DEC-005` and `DEC-006` are accepted and define the confirmation and sensitive-write guardrails;
- `ReservationDraft` and `ReservationDraftLine` exist and persist draft-only reservation data;
- `ReservationDraftStatus` currently contains only `draft`;
- reservation draft API surfaces exist and are authenticated with `IsAuthenticated`;
- reservation availability, previews, summaries, and selectors already exist as read-only or draft-safe backend surfaces;
- `InventoryAvailability` conflict logic exists and ignores soft-deleted rows through `is_deleted=False` filtering;
- `AuditableModel` currently provides nullable `created_by` and `updated_by` baseline fields only;
- no active audit subsystem exists in `apps.audit`;
- no custom permission system exists in `apps.identity`;
- no confirmation endpoint, confirmation service, confirmed state, signed-contract prerequisite, deposit prerequisite, or transaction-safe confirmation flow exists.

### Structural implication

The repository is ready for a backend-first mini-epic, but it is not ready for a single large confirmation PR.

The next safe move is to split the missing backend foundation into controlled slices that harden authorization, attribution, audit behavior, and regression coverage before any real confirmation service is attempted.

## 4. Multi-agent findings

### Agent A - Domain and architecture

- `ADR-004`, `DEC-005`, and `DEC-006` are consistent: confirmation must remain blocked until contract, deposit, explicit authorization, attribution, audit, transaction safety, and durable inventory blocking all exist together.
- `ADR-009` is consistent with the current backend and with the need for stricter sensitive-write backend enforcement.
- Titan/Hahitantsoa separation remains intact in current code because reservations are still Titan-scoped draft/planning flows and Hahitantsoa does not gain write behavior.
- The safest backend sequence is:
  - authorization primitive first;
  - transaction-safe audit foundation second;
  - explicit attribution foundation third;
  - security regression tests fourth;
  - prerequisite modeling for contract/deposit fifth;
  - only then a first narrow transactional confirmation service.

### Agent B - Security and permissions

- Current reservation APIs use `IsAuthenticated` in `backend/apps/reservations/views.py`, which is acceptable for current read-only and draft flows but explicitly insufficient for sensitive writes.
- The smallest explicit sensitive-action authorization primitive for this repository is a backend-only permission helper or permission class dedicated to reservation-sensitive writes, not a broad RBAC system.
- The first proof that `IsAuthenticated` alone is insufficient should be a narrow backend test layer that distinguishes:
  - authenticated but unauthorized actor;
  - authenticated and authorized actor;
  - unauthenticated actor.
- That proof should be introduced before a real confirmation endpoint exists, by testing the authorization primitive directly or through a minimal non-confirmation-sensitive backend seam.

### Agent C - Audit and transactions

- Current audit foundation is limited to nullable `created_by` and `updated_by` on `AuditableModel`; this is useful but not confirmation-specific and not transaction-safe audit persistence.
- The smallest transaction-safe audit design for this repository is not a full audit domain implementation. It is a minimal backend audit event contract and persistence pattern that can be triggered only after durable business success.
- Durable success audit must not survive rollback. The safest practical direction is a `transaction.on_commit()` pattern or an equivalent post-commit strategy for success events.
- Denied or failed sensitive attempts may use a separate persistence path only if they cannot be confused with a committed success state.
- No current file shows an existing audit event model or event bus, so F121C should stay narrow and avoid inventing a generic enterprise audit framework.

### Agent D - Tests and CI

- The repository already has good narrow test locations for reservations, availability, common models, and API auth behavior.
- The most natural test additions are:
  - `tests/backend/test_reservations_sensitive_permissions.py`
  - `tests/backend/test_reservations_audit_foundation.py`
  - `tests/backend/test_reservations_attribution_foundation.py`
  - `tests/backend/test_reservations_sensitive_write_security.py`
- Existing tests that can anchor new work include:
  - `tests/backend/test_common_abstract_models.py`
  - `tests/backend/test_reservation_draft_api.py`
  - `tests/backend/test_reservation_draft_model.py`
  - `tests/backend/test_inventory_availability_queries.py`
  - `tests/backend/test_reservations_services_public_contract.py`
  - `tests/backend/test_reservations_item_availability_detail_api.py`
- CI impact should remain small if each slice keeps tests backend-only and targeted.

## 5. Recommended mini-epic split

### F121B - Permission primitive

Objective:
Define and implement the smallest explicit backend authorization primitive for reservation-sensitive writes.

Allowed files or areas:
- `backend/apps/reservations/`
- possibly `backend/apps/identity/` if the primitive needs a minimal repository-local anchor
- backend tests for reservation-sensitive authorization
- narrow documentation updates only if needed

Forbidden scope:
- no confirmation service;
- no confirmed state;
- no broad RBAC;
- no audit persistence;
- no billing/contracts/payment implementation;
- no frontend changes.

Expected tests:
- authenticated unauthorized actor is denied;
- authenticated authorized actor is allowed by the primitive;
- unauthenticated actor is denied;
- `IsAuthenticated` alone is proven insufficient for the sensitive path.

Risks:
- over-designing a role system;
- coupling the permission primitive directly to future confirmation implementation details.

Done criteria:
- one explicit backend sensitive-action authorization primitive exists;
- tests prove `IsAuthenticated` alone is not enough;
- no confirmation runtime logic is added.

### F121C - Audit foundation

Objective:
Implement the smallest transaction-safe audit foundation for future sensitive reservation writes.

Allowed files or areas:
- `backend/apps/audit/`
- `backend/apps/common/` if a minimal shared audit helper or contract is justified
- targeted backend tests for audit behavior
- narrow documentation updates only if needed

Forbidden scope:
- no full audit platform;
- no broad cross-domain event framework;
- no confirmation service;
- no frontend or billing/logistics changes.

Expected tests:
- success audit is not persisted when the transaction rolls back;
- success audit is emitted only after commit or equivalent post-commit success boundary;
- denied/failed audit behavior is explicit and non-misleading.

Risks:
- building a generic audit subsystem that exceeds current needs;
- persisting misleading success audit before commit.

Done criteria:
- a minimal audit persistence pattern exists for future sensitive writes;
- rollback-safe audit semantics are proven by tests;
- no confirmation business logic is implemented.

### F121D - Attribution foundation

Objective:
Add explicit durable attribution support for future reservation-sensitive writes.

Allowed files or areas:
- `backend/apps/reservations/`
- possibly `backend/apps/common/` only if a shared helper is clearly justified
- targeted backend tests
- narrow docs updates only if needed

Forbidden scope:
- no confirmation service;
- no generic user-tracking refactor across unrelated domains;
- no broad audit redesign;
- no frontend changes.

Expected tests:
- attribution fields or equivalent representation are explicit and durable;
- attribution is distinct from generic `created_by` / `updated_by` semantics;
- attribution behavior is stable under valid backend write flow scaffolding.

Risks:
- conflating generic model authorship with sensitive-action attribution;
- modifying unrelated models to chase symmetry.

Done criteria:
- reservation-sensitive attribution foundation exists;
- tests prove explicit actor and timestamp semantics;
- the scope remains confined to the reservation-sensitive write path foundation.

### F121E - Sensitive-write security regression tests

Objective:
Lock the guardrails in place with backend-only regression coverage before confirmation exists.

Allowed files or areas:
- `tests/backend/`
- narrow docs updates only if needed

Forbidden scope:
- no runtime backend implementation beyond what previous slices already added;
- no frontend;
- no confirmation endpoint.

Expected tests:
- unauthorized sensitive write attempts are denied;
- audit success cannot outlive rollback;
- attribution contract remains explicit;
- Titan/Hahitantsoa boundary remains unchanged;
- no `InventoryAvailability` write side effect appears from draft-only flows.

Risks:
- writing speculative tests against APIs that do not exist yet;
- coupling regression tests too tightly to internal implementation details.

Done criteria:
- narrow backend-only regression tests protect the accepted guardrails;
- no new confirmation behavior is introduced just to satisfy tests.

### F122 - Signed-contract and deposit prerequisite foundation

Objective:
Define and implement the smallest real prerequisite foundation for signed-contract and received-deposit readiness.

Allowed files or areas:
- `backend/apps/reservations/`
- possibly a narrow supporting area if explicitly required by repository structure
- backend tests for prerequisite semantics
- narrow docs/decision updates

Forbidden scope:
- no invoice workflow;
- no payment platform;
- no logistics;
- no frontend commercial workflow;
- no broad contract generation.

Expected tests:
- confirmation prerequisite state can be represented without faking readiness;
- missing signed contract is detectable;
- missing deposit/payment is detectable;
- the prerequisite model does not mutate Titan scope.

Risks:
- drifting into billing or document generation;
- creating fake booleans that do not represent real domain evidence.

Done criteria:
- real prerequisite semantics exist in the backend;
- no full confirmation flow yet;
- tests prove the prerequisite foundation is real, not simulated.

### F123 - First narrow transactional confirmation service

Objective:
Implement the first real backend confirmation service using the accepted contract, permission, attribution, audit, and prerequisite foundations.

Allowed files or areas:
- `backend/apps/reservations/`
- `backend/apps/inventory/` only where durable inventory-blocking integration is strictly required
- targeted backend tests
- narrow documentation updates

Forbidden scope:
- no broad workflow expansion;
- no billing/logistics/customer completion;
- no frontend booking workflow;
- no Hahitantsoa write workflow.

Expected tests:
- allowed source state transitions from `draft` only;
- missing contract blocks confirmation;
- missing deposit blocks confirmation;
- unauthorized actor is denied;
- concurrent conflicting confirmations cannot both succeed;
- durable success audit follows commit only;
- durable inventory blocking is created consistently and respects `DEC-004`.

Risks:
- widening the slice into lifecycle completion;
- coupling confirmation to incomplete prerequisite or audit foundations.

Done criteria:
- one narrow confirmation service exists;
- it is atomic and conflict-safe;
- it satisfies `DEC-005` and `DEC-006`;
- targeted backend tests pass.

## 6. Recommended next immediate slice

The next immediate slice after F121A should be:

**F121B - Permission primitive**

Reason:

- it is the smallest missing backend foundation explicitly required by `DEC-006`;
- it directly addresses the current `IsAuthenticated` gap visible in reservation views;
- it provides a clean base for later attribution and audit work without forcing confirmation implementation.

## 7. Anti-out-of-scope guard

The F121 mini-epic must remain backend-first and narrow.

It must not:

- implement full reservation confirmation in one PR;
- mix confirmation, billing, contracts, invoices, logistics, returns, frontend, and Hahitantsoa writes into the same slice;
- broaden Titan beyond `material`, `article`, and `material_pack`;
- introduce fake contract or deposit readiness;
- reopen `DEC-004` soft-delete conflict semantics;
- build a broad RBAC system before the smallest sensitive-action primitive is proven useful.

## 8. Validation commands

F121A validation is documentation-only:

```sh
git diff --check
git status --short
git diff -- docs/audits/F121A_BACKEND_FOUNDATION_MULTI_AGENT_PLAN.md
```

No runtime tests are required for F121A because no application code changes are allowed.
