# DEC-005 - Reservation confirmation domain contract

Status: Proposed
Scope: F118
Type: Documentation / domain decision only
Date: 2026-06-12

## Why Proposed

This decision is intentionally marked **Proposed**, not **Accepted**.

Reason:

- `ADR-004` already establishes the high-level reservation confirmation rule;
- the repository does not yet implement reservation confirmation;
- the current backend still exposes only draft/planning reservation behavior;
- permissions, audit, and durable confirmation side effects are not yet fully specified in accepted implementation detail.

F118 therefore defines the implementation-ready contract that must be reviewed and accepted before the first confirmation write slice.

## Context

### Current backend state after F117

After F117, the backend contains:

- read-only availability and preview helpers for Titan inventory and reservations planning;
- authenticated read-only reservation availability APIs;
- reservation draft persistence with `ReservationDraft` and `ReservationDraftLine`;
- draft create/update flows guarded only by current serializer/model logic and authenticated API access;
- no confirmed reservation state;
- no reservation confirmation service;
- no signed-contract enforcement;
- no deposit/payment enforcement;
- no active audit implementation for confirmation actions;
- no implemented row-locking confirmation flow.

Current reservation APIs still rely on `IsAuthenticated` for access control. That is sufficient for current read-only and draft surfaces, but it is not sufficient by itself for future sensitive confirmation writes.

### What ADR-004 already establishes

`ADR-004` already fixes the core business invariant:

- a reservation is confirmed only after signed contract, received deposit, and successful availability revalidation;
- reservation confirmation must be transactional.

This decision does not replace `ADR-004`. It refines it into a narrower backend contract for the future implementation slices.

### What remains ambiguous before implementation

Before any implementation, the repository still needs an explicit decision for:

- the exact source state allowed for confirmation;
- the expected target state after confirmation;
- minimum backend-side structured confirmation errors;
- minimum actor and attribution requirements;
- minimum confirmation-side audit expectations;
- the required durable inventory-blocking side effect for a confirmed reservation;
- the implementation boundary between F119 and F120.

## Scope boundaries

### Titan boundary

Titan remains pure rental only.

Titan is limited to:

- `material`;
- `article`;
- `material_pack`.

Titan must not gain:

- `local`;
- `venue`;
- `room`;
- `hall`;
- `service`;
- event-service or ancillary-service behavior.

### Hahitantsoa boundary

Hahitantsoa remains distinct from Titan.

F118 does not approve:

- Hahitantsoa reservation persistence;
- Hahitantsoa reservation confirmation;
- Hahitantsoa write API;
- Hahitantsoa commercial workflow.

### Shared inventory boundary

Shared inventory integrity remains a backend concern.

Confirmed Titan reservation behavior must preserve the shared-inventory rule from `ADR-005`, but this must not collapse the boundary between Titan and Hahitantsoa. Shared material/article integrity does not authorize Hahitantsoa write behavior.

## Reservation confirmation state model

### Allowed source state

The only approved source state for confirmation is a reservation in an allowed **draft/planning** state.

Current repository evidence supports only:

- `draft`.

Therefore:

- F120 may implement confirmation only from `draft`, unless a later accepted decision adds another explicit pre-confirmation state;
- any attempt to confirm from an already confirmed, cancelled, deleted, invalid, or otherwise non-approved state must fail.

### Resulting state

The confirmation target state is a future persistent **confirmed** reservation state.

F118 approves the requirement that such a state must exist before full confirmation is considered implemented, but F118 does not add that state to code.

### Blocked or terminal states

F118 does not approve a full reservation lifecycle matrix.

For the confirmation contract, the minimum rule is:

- confirmation is allowed only from approved draft/planning state;
- confirmation must be rejected from any terminal or blocked state;
- exact terminal-state names beyond `confirmed` remain a later domain decision.

### What confirmation must not change implicitly

Confirmation must not silently:

- broaden Titan scope;
- mutate Hahitantsoa scope;
- create billing completion;
- create logistics completion;
- create customer workflow completion;
- bypass required contract or payment prerequisites;
- change unrelated reservation data outside the approved confirmation contract.

## Confirmation preconditions

All preconditions below are required by contract unless explicitly marked deferred.

### Required now

Before confirmation succeeds:

1. the reservation must exist;
2. the reservation must be in an allowed draft/planning state;
3. the reservation must contain valid reservable lines/items;
4. the reservation period and line data must still be valid at confirmation time;
5. availability must be revalidated at confirmation time;
6. active conflicts must ignore soft-deleted `InventoryAvailability` rows according to `DEC-004`;
7. the confirmation attempt must run inside the future transactional confirmation flow.

### Contract/signature prerequisite

Per `ADR-004` and repository business invariants, a signed contract is a **required future confirmation precondition**.

F118 marks this as required by domain contract now, even though the repository does not yet implement the full contract workflow.

Implication:

- F120 must not implement a confirmation path that bypasses the signed-contract requirement;
- if contract state is still not implemented by F120, the implementation slice must remain partial or blocked rather than silently weakening the rule.

### Deposit/payment prerequisite

Per `ADR-004` and repository business invariants, a received deposit/acompte is a **required future confirmation precondition**.

F118 marks this as required by domain contract now, even though payment workflow is not yet implemented.

Implication:

- F120 must not implement a confirmation path that bypasses the deposit/payment requirement;
- if payment state is still not implemented by F120, the implementation slice must remain partial or blocked rather than silently weakening the rule.

### Explicitly deferred detail

F118 does **not** decide:

- exact contract model fields;
- exact signature proof representation;
- exact deposit object model;
- exact payment receipt implementation.

Those details are deferred to later accepted slices, but the confirmation gate itself is not optional.

## Actor and permission contract

### Minimum actor rule

Future confirmation may be performed only by an explicitly authorized backend actor category.

### Explicit rejection of generic auth-only confirmation

`IsAuthenticated` alone is **not sufficient** for a future confirmation write.

That remains true even if:

- the user owns the session;
- the API endpoint is authenticated;
- the reservation exists.

### Attribution expectations

The future implementation must provide durable confirmation attribution, including at minimum:

- who confirmed;
- when confirmation succeeded;
- which reservation was targeted;
- what the resulting confirmation state was.

Preferred future fields include:

- `confirmed_by`;
- `confirmed_at`.

F118 does not claim those fields already exist.

### Relation to F119

F119 is the slice that should refine:

- exact actor categories;
- exact permission checks;
- exact attribution storage fields;
- exact audit emission strategy.

## Transactional invariants

Confirmation must satisfy all of the following invariants:

1. confirmation must be atomic;
2. availability must be revalidated inside the transaction;
3. two conflicting confirmation attempts must not both succeed;
4. future implementation should use `transaction.atomic()` and appropriate locking such as `select_for_update()` or an equivalent strategy where needed;
5. no partial confirmation side effect may persist after failure;
6. no success-visible external side effect may be emitted before the database transaction is durably committed.

This contract is consistent with:

- `ADR-004`;
- `ADR-005`;
- `DEC-004`;
- repository invariant `INV-003`.

## Inventory side-effect contract

### Required invariant

A successful confirmed reservation must create a durable backend blocking effect that makes the confirmed reserved inventory unavailable to later active availability checks for the same period.

That blocking effect must:

- preserve the existing half-open interval rule;
- remain consistent with shared inventory integrity;
- remain consistent with `DEC-004`, meaning soft-deleted rows do not participate in active conflicts.

### What is not approved

Confirmation must not rely only on:

- transient in-memory state;
- frontend state;
- non-durable logical assumptions;
- an undocumented side channel.

### Implementation direction

F118 does not pretend code already exists.

The preferred future implementation direction is:

- create or maintain persistent blocking availability records for confirmed reservation lines, likely through `InventoryAvailability` or an explicitly equivalent persisted conflict mechanism;
- ensure read-only previews, summaries, and selectors observe the same active conflict semantics.

If a future implementation chooses a mechanism other than direct `InventoryAvailability` row creation, it must still satisfy the same blocking invariant and avoid divergent conflict semantics.

## Error contract

F118 defines the minimum backend error categories that future confirmation code must surface in a stable, machine-readable form.

Minimum categories:

- `invalid_state`
- `missing_required_data`
- `active_availability_conflict`
- `permission_denied`
- `missing_signed_contract`
- `missing_required_deposit`

### Expected meaning

#### `invalid_state`

The reservation exists but is not in an approved source state for confirmation.

#### `missing_required_data`

The reservation lacks required structural data such as valid lines, valid period, or another mandatory field required before confirmation logic can complete.

#### `active_availability_conflict`

At confirmation time, active blocking availability exists for one or more required items in the requested period. Soft-deleted blocking rows must remain ignored per `DEC-004`.

#### `permission_denied`

The actor is authenticated or present but not authorized to perform confirmation.

#### `missing_signed_contract`

The signed-contract prerequisite is not satisfied.

#### `missing_required_deposit`

The deposit/payment prerequisite is not satisfied.

### Transport note

F118 does not lock the exact API payload shape, but future backend code must expose these categories in a stable backend contract. User-facing frontend messaging remains out of scope for F118.

## Audit expectations

Confirmation-related actions are sensitive and must be auditable.

At minimum, future audit coverage must capture:

- actor identity;
- reservation identifier;
- action type;
- attempted source state;
- resulting state or failure result;
- timestamp;
- conflict or denial reason when applicable.

### Success and failure

Both successful confirmation and denied/failed confirmation attempts should be auditable when technically appropriate.

### Timing

F118 does not fix the exact audit persistence mechanism.

That detail is deferred to F119, but the contract already requires:

- a rolled-back confirmation must not leave a misleading success audit;
- durable success audit should correspond to a durably committed confirmation.

## Anti-out-of-scope guard

F118 is **decision/contract only**.

F118 must not:

- implement backend confirmation code;
- implement billing;
- implement logistics;
- implement customer workflow completion;
- implement Hahitantsoa write behavior;
- expand the frontend;
- generate runtime contracts, invoices, receipts, or other documents;
- implement broad RBAC;
- add tests, serializers, views, selectors, services, models, migrations, or API write behavior.

## F119 / F120 handoff

### F119 should do next

F119 should define and, if approved, narrow the backend guardrails for sensitive confirmation writes:

- exact actor categories and permission rules;
- attribution strategy;
- audit strategy;
- data-scoping expectations where relevant.

F119 should not broaden into full billing or logistics implementation.

### F120 may implement only after F118 and F119 are accepted

F120 may implement the first narrow confirmation slice only after F118 and F119 are accepted.

That implementation may include only:

- confirmation service logic;
- transactional revalidation of availability;
- row-locking or equivalent protection against double confirmation;
- durable blocking side effects consistent with `DEC-004`;
- targeted tests for the approved confirmation contract.

F120 must not silently weaken:

- signed-contract prerequisite;
- deposit/payment prerequisite;
- permission requirements;
- audit requirements;
- Titan/Hahitantsoa boundary.

## Validation expectations

F118 completion requires:

- documentation diff review;
- scope check proving only allowed documentation changed;
- explicit review that this decision references `ADR-004`, `ADR-005`, `ADR-009`, `DEC-001`, `DEC-002`, and `DEC-004` consistently;
- confirmation that no application code was touched.

No runtime tests are required for F118 unless documentation tooling explicitly requires them.

## No application code

F118 does not change application code.
F118 defines a reservation confirmation domain contract only.
