# F120 - Reservation confirmation technical cadrage

## 1. Scope

F120 is a documentation-only technical inspection and cadrage slice.

F120:

- accepts `DEC-005` and `DEC-006` after inspection;
- records the current backend readiness for future reservation confirmation;
- identifies the blocking gaps that prevent safe confirmation implementation;
- recommends the smallest safe next backend slice.

F120 does not change application code or runtime behavior.

## Historical status note

F120 is preserved as a historical technical cadrage document written before the
F121E-F121J backend reservation lifecycle work was delivered.

Its readiness and blocking-gap sections remain useful as historical inspection
evidence, but they no longer describe the exact repository state after F121J.

For the refreshed post-F121J status and next-step sequence, use
`docs/audits/F121K_F121_LIFECYCLE_AND_BACKEND_ROADMAP_REFRESH.md`.

Historical note: earlier F117/F118/F119 handoff language left open the possibility that F120 could become the first narrow confirmation implementation slice. F120 inspection narrowed the outcome: F120 accepts the guard decisions and records why implementation remains blocked rather than creating an unsafe partial confirmation path.

## 2. Inspection findings

The current repository confirms:

- `ReservationDraft` and `ReservationDraftLine` exist;
- the only current reservation draft status is `draft`;
- reservation draft create/update surfaces exist;
- current reservation APIs rely on `IsAuthenticated`;
- availability conflict logic exists;
- active availability conflict logic ignores soft-deleted `InventoryAvailability` rows according to `DEC-004`;
- no persistent confirmed reservation state exists;
- no reservation confirmation endpoint or service exists;
- no explicit sensitive-action permission implementation exists;
- no active audit subsystem exists;
- no real signed-contract prerequisite model exists;
- no real deposit/payment prerequisite model exists;
- no implemented row-locking confirmation flow exists.

The inspection supports accepting `DEC-005` and `DEC-006` as mandatory guards. It does not support starting full confirmation implementation.

## 3. Current backend readiness

### Ready foundations

The backend already provides useful foundations:

- persistent reservation drafts and lines;
- validated reservation periods and reservable Titan kinds;
- availability selectors, previews, summaries, and conflict checks;
- accepted soft-delete conflict semantics through `DEC-004`;
- accepted confirmation-domain and sensitive-write guard decisions through `DEC-005` and `DEC-006`.

### Not ready for full confirmation

The backend does not yet provide the prerequisites needed to implement a valid confirmed reservation:

- persistent confirmed state;
- signed-contract evidence;
- received-deposit/payment evidence;
- explicit sensitive-action authorization;
- durable confirmation-specific attribution;
- transaction-safe audit persistence;
- transactional confirmation service with appropriate locking;
- durable confirmation-to-inventory blocking relationship.

## 4. Blocking gaps for full confirmation

Full reservation confirmation remains blocked until controlled slices implement and validate:

1. a persistent confirmed reservation state and its allowed transition from `draft`;
2. a real signed-contract prerequisite representation;
3. a real received-deposit/payment prerequisite representation;
4. explicit backend authorization beyond `IsAuthenticated`;
5. durable confirmation attribution, including actor and timestamp;
6. transaction-safe audit behavior;
7. atomic availability revalidation and locking that prevents conflicting confirmations;
8. durable inventory-blocking effects consistent with `DEC-004`.

These are business and integrity requirements, not optional implementation details.

## 5. Why F120 must not implement confirmation

Implementing a confirmation endpoint or service in F120 would require either:

- bypassing signed-contract and deposit prerequisites;
- inventing fake prerequisite readiness;
- authorizing sensitive writes with `IsAuthenticated` only;
- confirming without durable attribution or audit;
- adding incomplete state and inventory side effects.

Each option would contradict accepted repository rules.

Therefore F120 must not create:

- a confirmation endpoint;
- a confirmation service;
- a fake confirmed status;
- fake signed-contract or deposit flags;
- partial confirmation side effects.

## 6. Smallest safe next implementation candidate

The preferred next slice is:

**F121 - Permission and audit foundation for sensitive reservation writes**

This backend-first slice should remain narrow and establish only the minimum reusable foundation required by accepted `DEC-006`, such as:

- one explicit backend permission contract for sensitive reservation actions;
- durable actor attribution expectations;
- a minimal transaction-safe audit foundation;
- targeted tests proving `IsAuthenticated` alone cannot authorize a sensitive write.

F121 must not implement reservation confirmation itself.

An alternative next slice is acceptable only if product direction is ready:

**F121 - Reservation confirmation prerequisites model decision/implementation**

That alternative must define and implement real signed-contract and received-deposit prerequisite representations without faking readiness or broadening into full billing/contracts workflows.

The permission/audit foundation remains the preferred next step because it is required regardless of how contract and deposit prerequisites are represented.

## 7. Anti-out-of-scope guard for F121 and future implementation

Future narrow slices must not:

- implement full confirmation before all accepted prerequisites exist;
- authorize sensitive writes with `IsAuthenticated` only;
- fake signed-contract or deposit readiness;
- add partial confirmation side effects;
- add frontend-only enforcement;
- mix Hahitantsoa and Titan write behavior;
- broaden into complete billing, contracts, invoices, logistics, or returns;
- introduce unrelated frontend changes;
- reopen `DEC-004` without a direct contradiction.

Titan remains limited to:

- `material`;
- `article`;
- `material_pack`.

Hahitantsoa remains separate and gains no write reservation workflow through F120.

## 8. Validation commands

F120 requires documentation-only validation:

```sh
git diff --check
git diff -- docs/decisions/DEC-005-reservation-confirmation-domain-contract.md docs/decisions/DEC-006-reservation-sensitive-permissions-attribution-audit.md docs/audits/F120_RESERVATION_CONFIRMATION_TECHNICAL_CADRAGE.md
git status --short
```

No runtime tests are required because F120 changes no application code.

## 9. F120 conclusion

F120 accepts `DEC-005` and `DEC-006` as required gates for future sensitive reservation writes.

Full confirmation implementation must not start until signed contract, deposit/payment, explicit authorization, durable attribution, transaction-safe audit, persistent confirmed state, transactional conflict protection, and durable inventory blocking have been implemented through controlled slices.

F120 changes documentation only.
