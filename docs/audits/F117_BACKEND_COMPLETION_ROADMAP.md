# F117 Backend Completion Roadmap

## 1. Status

- F117 is a documentation-only inspection and roadmap task.
- F117 does not change application code, runtime behavior, database schema, dependencies, or tests.
- F117 is written after F116 and assumes `DEC-004` is accepted and implemented.

## Historical status note

This document is kept as a historical roadmap snapshot written before the
F121E-F121J reservation lifecycle foundation was implemented.

Its "current backend state" and "next slice" statements are no longer the
authoritative description of the repository after F121J.

For the post-F121J backend status and recommended sequence, use
`docs/audits/F121K_F121_LIFECYCLE_AND_BACKEND_ROADMAP_REFRESH.md`.

## 2. Current backend state after F116

### Confirmed foundations already in place

- Titan inventory remains read-only at the API level unless a task explicitly authorizes writes.
- Read-only availability helpers and selectors exist for Titan inventory and reservations planning.
- Reservations currently support read-only planning surfaces and draft creation/update flows.
- Hahitantsoa read-only discovery surfaces exist and remain separated from Titan business scope.
- `DEC-004` resolves the soft-delete ambiguity: soft-deleted `InventoryAvailability` rows do not participate in active conflicts.

### What F116 closed

F116 closes the active-conflict ambiguity around soft-deleted `InventoryAvailability` rows. That issue should not be reopened in the next slice unless a regression is found.

### What is still missing on the backend

The repository does not yet provide the backend completion required for the full ERP scope. The remaining gaps are structural, not cosmetic:

- reservation confirmation domain rules are not yet formalized as an implementation-ready contract;
- contract signed-state enforcement is not implemented;
- deposit/payment preconditions for confirmation are not implemented;
- transactional confirmation and cross-scope allocation locking are not implemented;
- audit trail for sensitive reservation confirmation actions is not implemented;
- backend permission/data-scoping hardening remains incomplete;
- logistics, billing, payment receipts, breakage/loss, and stock/consumables domains remain largely unimplemented.

## 3. Backend domains still required for the full ERP

The complete ERP requires more than the current MVP read-only and draft foundations.

### Core reservation lifecycle

- reservation confirmation rules;
- reservation state transitions after confirmation;
- shared inventory locking/allocation semantics;
- modification after signature via controlled amendment flow.

### Access control and audit

- backend roles/permissions beyond basic authenticated access;
- ownership and data scoping rules;
- created-by / updated-by consistency where required;
- audit events for sensitive operations.

### Contract and payment prerequisites

- signed contract prerequisites for confirmation;
- deposit receipt prerequisites for confirmation;
- payment method validation and receipt generation;
- deadline enforcement around J-30 / J-10 rules when that slice opens.

### Logistics and returns

- internal preparation and delivery document workflow;
- return classification: intact / broken / missing;
- breakage/loss financial consequences.

### Inventory depth

- pack behavior beyond read-only discovery;
- stock/consumables thresholds and supplier workflow;
- durable allocation semantics for confirmed reservations.

## 4. Dependency order between backend domains

The next backend slices should be sequenced to reduce rework and preserve domain integrity.

### Dependency order

1. Reservation confirmation decision/contract.
2. Permission, actor attribution, and audit expectations for sensitive reservation actions.
3. Narrow implementation of transactional confirmation prerequisites and locking behavior.
4. Billing/payment and contract execution details required by confirmation.
5. Logistics, returns, and post-confirmation operational flows.
6. Broader ERP completion domains such as stock thresholds, procurement, and cashier workflows.

### Why this order

- Confirmation is the central domain hinge between current planning/draft behavior and real ERP commitments.
- Confirmation cannot be implemented cleanly before its preconditions, audit expectations, and transactional boundaries are fixed.
- Billing, logistics, and downstream workflows depend on a stable confirmed-reservation contract.

## 5. Recommended sequence for F118, F119, and F120

### F118 - Reservation confirmation domain decision/contract

Recommended next slice.

Scope:

- documentation/contract first;
- no runtime change unless a separate approval explicitly authorizes implementation;
- define confirmation preconditions, actor rules, invariants, transactional requirements, and forbidden shortcuts.

Why F118 should come next:

- `ADR-004` already states the business rule at a high level;
- the codebase has draft and availability foundations but no implementation-ready confirmation contract;
- implementing confirmation before tightening the contract would create avoidable rework.

### F119 - Backend permissions, attribution, and audit guard for reservation-sensitive flows

Recommended immediately after F118.

Scope:

- define or tighten backend-only authorization expectations for reservation-sensitive actions;
- define audit requirements for confirmation-related operations;
- define actor attribution expectations and data-scoping guardrails.

Why F119 follows F118:

- confirmation rules need named actors and auditable outcomes;
- sensitive actions should not move forward under generic `IsAuthenticated` alone.

### F120 - First narrow backend implementation slice for transactional reservation confirmation

Recommended only after F118 and F119 are accepted.

Scope:

- minimal backend implementation of the approved confirmation contract;
- use services/selectors with `transaction.atomic()` and row locking where needed;
- no broad reservation workflow expansion beyond the approved confirmation slice.

Why F120 should stay narrow:

- it should prove the confirmation spine, not solve billing, logistics, amendments, and returns in one PR;
- it keeps the first write-domain slice reviewable and testable.

## 6. Anti-out-of-scope guard for the next implementation slice

The next implementation slice must remain tightly bounded.

### Explicitly allowed direction

- backend-first completion toward reservation confirmation integrity;
- services, selectors, tests, and documentation strictly required by the approved slice;
- transactional and audit-safe enforcement of already-approved business rules.

### Explicitly out of scope for the next slice unless separately approved

- frontend expansion unrelated to the confirmation contract;
- Hahitantsoa write behavior;
- customer workflow completion;
- invoice generation;
- payment workflow completion beyond the minimum approved confirmation prerequisite scope;
- contract template generation;
- full logistics workflow;
- procurement / supplier implementation;
- stock quantity/unit redesign;
- broad RBAC program across unrelated domains;
- unrelated refactors.

### Titan / Hahitantsoa guard

- Titan remains limited to `material`, `article`, and `material_pack`.
- Titan must never admit `venue`, `local`, `room`, `hall`, `service`, or event-service variants.
- Hahitantsoa remains distinct from Titan.
- Shared material availability does not authorize Hahitantsoa reservation persistence or commercial workflow.

## 7. Codex model and reasoning recommendations per slice

### F118

- Model/reasoning recommendation: GPT-5.4, high reasoning.
- Reason: confirmation invariants, transactional boundaries, and out-of-scope guards are structurally sensitive.

### F119

- Model/reasoning recommendation: GPT-5.4, high reasoning.
- Reason: permissions, audit, and data scoping are cross-cutting and easy to under-specify.

### F120

- Model/reasoning recommendation: GPT-5.4, high reasoning for implementation and review.
- Reason: first transactional write-domain slice with locking, revalidation, and side-effect boundaries.

## 8. Validation expectations per slice

### F118

- documentation diff review;
- invariant cross-check against `ADR-004`, `ADR-005`, `ADR-009`, `DEC-001`, `DEC-002`, and `DEC-004`;
- explicit anti-scope review.

### F119

- targeted documentation and test-plan review;
- permission/audit guard review against existing backend surfaces;
- no unrelated runtime churn.

### F120

- Ruff format/check;
- Django check;
- targeted backend tests for confirmation preconditions and conflict behavior;
- transactional tests covering concurrent or simulated conflicting confirmation attempts;
- regression checks proving soft-deleted availability rows still do not participate in active conflicts;
- explicit no-out-of-scope file review before PR.

## 9. Risks and blockers

### Primary risks

- implementing confirmation before its contract is fully fixed;
- allowing generic authenticated access to evolve into sensitive write behavior without role/audit hardening;
- mixing Titan and Hahitantsoa concerns inside the same reservation implementation slice;
- broadening the next slice into billing, logistics, or customer workflow.

### Known blockers to avoid

- missing approval on exact confirmation states and error contract;
- missing agreement on actor/permission boundaries;
- missing decision on when audit events are emitted relative to transaction commit.

## 10. Explicit separation between Hahitantsoa and Titan business rules

### Titan

- pure rental only;
- allowed kinds: `material`, `article`, `material_pack`;
- no `local`, `venue`, `room`, `hall`, `service`, or event-service behavior;
- reservation confirmation must preserve shared inventory integrity.

### Hahitantsoa

- broader event-planning scope remains separate from Titan;
- may consume approved read-only discovery or planning information;
- does not gain reservation persistence, commercial workflow, or Titan scope expansion through F117.

### Shared rule

- shared material/article availability is a backend integrity concern;
- it must not collapse the boundary between Hahitantsoa and Titan.

## 11. Recommended next slice

The next most logical backend slice is:

**F118 - Reservation confirmation domain decision/contract**

This is the smallest high-value backend-first step after F116 because it converts existing ADR-level business rules into an implementation-ready contract without prematurely expanding runtime behavior.

## 12. Statement of non-code change

F117 changes no application code.
F117 introduces only this roadmap document and does not alter backend, frontend, runtime configuration, database schema, dependencies, or tests.
