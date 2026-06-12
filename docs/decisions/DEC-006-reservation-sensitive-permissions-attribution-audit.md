# DEC-006 - Reservation-sensitive permissions, attribution, and audit guard

Status: Accepted
Scope: F119
Type: Documentation / guardrail decision only
Date: 2026-06-12

## Acceptance history

F119 initially proposed this decision because:

- the repository does not yet implement reservation confirmation;
- the repository does not yet implement an active reservation audit subsystem;
- the repository does not yet implement a custom reservation RBAC model;
- current reservation APIs rely primarily on `IsAuthenticated`, which is acceptable for current read-only and draft surfaces but explicitly insufficient for future sensitive writes.

F120 accepted this decision after technical inspection confirmed that these guardrails are required before any sensitive reservation write implementation.

## Accepted in F120

F120 inspection confirmed that `IsAuthenticated` alone is insufficient for future sensitive reservation writes.

Acceptance does not claim that permissions, attribution, or audit persistence already exist. It accepts the minimum backend authorization, durable attribution, transaction-safe audit, and anti-shortcut requirements defined below.

Historical clarification: F120 accepted this decision and documented the technical gate only. F120 did not implement permissions, attribution, audit persistence, or reservation confirmation; those remain deferred to later controlled backend slices.

## Scope

F119 is a guardrail decision only.

F119 does not:

- implement reservation confirmation;
- implement permissions code;
- implement audit persistence;
- add models, migrations, serializers, views, selectors, services, or tests;
- change runtime behavior.

F119 exists to narrow what future sensitive reservation write flows may and may not do.

## Context

### Current repository state

At the time of F119:

- reservation availability, preview, summary, selector, and draft surfaces already exist;
- reservation draft create/update is possible;
- no confirmed reservation state is implemented;
- no reservation confirmation service is implemented;
- no deposit/payment prerequisite enforcement is implemented;
- no signed-contract prerequisite enforcement is implemented;
- no active confirmation audit implementation exists;
- no row-locking confirmation flow exists.

The repository also shows:

- `ADR-004` accepted: confirmation requires signed contract, received deposit, and transactional availability revalidation;
- `ADR-009` accepted: Django sessions and backend permissions are the access-control basis;
- `DEC-005` accepted in F120: confirmation from current reservation flows must not rely on `IsAuthenticated` only and must carry durable attribution and auditable behavior;
- `backend/apps/common/models.py` defines shared `created_by` and `updated_by` fields in `AuditableModel`;
- `backend/apps/audit/README.md` confirms that no active audit system exists yet;
- `backend/apps/identity/README.md` confirms no custom permission system exists yet.

### Why F119 was needed before any confirmation implementation

F119 was needed before any first narrow confirmation write slice because, without it, a future implementation could easily drift into one or more invalid shortcuts:

- confirmation authorized by generic authenticated session only;
- success writes without durable actor attribution;
- misleading audit records after rollback;
- inconsistent treatment of denied or failed confirmation attempts;
- frontend-only enforcement of sensitive rules.

## Sensitive reservation actions

The following future reservation actions are sensitive and must be treated as backend-protected actions:

1. reservation confirmation;
2. any future transition that reverses, voids, cancels, or supersedes a confirmed reservation;
3. any future write that creates or releases durable inventory-blocking effects for a reservation;
4. any future sensitive write that changes reservation lifecycle state beyond draft/planning.

Where technically appropriate, denied and failed attempts against those actions are also sensitive events and should be auditable.

F119 focuses first on reservation confirmation because it is the next approved write-domain slice.

## Actor categories

### Approved practical actor model

F119 approves only a minimal practical actor model for future sensitive reservation writes:

- authenticated end user with no elevated reservation authority;
- authenticated staff/operator explicitly authorized for sensitive reservation actions;
- authenticated privileged reviewer/manager explicitly authorized for sensitive reservation actions.

### What F119 does not approve

F119 does not approve:

- anonymous confirmation;
- generic session-authenticated confirmation without explicit backend authorization;
- frontend-only gating as a substitute for backend authorization;
- a full RBAC implementation in this slice.

### Minimum rule

For any future sensitive reservation write, especially confirmation:

- `IsAuthenticated` alone is not sufficient;
- the backend must apply an explicit sensitive-action authorization rule;
- the authorization decision must be made server-side on the attempted action.

F119 intentionally leaves the exact permission primitive open:

- custom permission class;
- service-layer authorization check;
- future role mapping;
- equivalent explicit backend policy.

A future controlled implementation slice may choose one of those only after this guardrail decision is accepted and the selected permission primitive is explicitly reviewed.

## Permission guard

### Minimum backend expectation

A future confirmation attempt must succeed only when all of the following are true:

1. the actor is authenticated through the approved backend auth mechanism;
2. the actor is explicitly authorized for sensitive reservation confirmation;
3. the reservation is in an allowed source state per `DEC-005`;
4. all confirmation preconditions from `ADR-004` and `DEC-005` are satisfied.

### Unauthorized actors

If the actor is not authorized, the backend must reject the action with the `permission_denied` error category already defined by `DEC-005`.

The backend must not:

- silently downgrade the action;
- partially apply the action;
- rely on hidden frontend controls as the real gate;
- return success for an unauthorized confirmation attempt.

## Attribution

### Durable attribution requirement

Every successful sensitive reservation write must have durable attribution.

At minimum, the durable attribution meaning must capture:

- actor identity;
- timestamp of the successful write;
- action type;
- target reservation identity;
- resulting reservation state or reservation-sensitive result.

### Existing model fields are not enough by themselves

The repository already contains shared nullable `created_by` and `updated_by` fields through `AuditableModel`.

Those fields are useful baseline metadata, but F119 does not treat them as automatically sufficient for confirmation attribution.

Reason:

- they do not express confirmation-specific intent by themselves;
- they may describe generic record creation/update rather than sensitive state transition ownership;
- they do not replace explicit confirmation attribution fields or explicit audit events.

### Minimum future expectation

Future confirmation implementation should provide explicit confirmation attribution, preferably through confirmation-specific metadata such as:

- `confirmed_by`;
- `confirmed_at`.

If the final implementation uses another equivalent representation, it must still preserve the same meaning.

## Audit strategy

### Minimum audit expectation

Sensitive reservation actions must be auditable.

At minimum, future audit coverage must be able to record:

- actor identity;
- action type;
- target reservation identifier;
- attempted source state;
- resulting state, when success occurs;
- denial or failure category, when applicable;
- timestamp;
- enough context to explain why the action succeeded, failed, or was denied.

### Successful actions

Durable success audit must correspond to durable committed business state.

Therefore:

- a success audit must not survive if the business transaction rolls back;
- a committed confirmation should have a durable audit representation that corresponds to the committed confirmation outcome.

### Denied or failed actions

Denied or failed sensitive attempts should be auditable where technically safe and operationally useful.

This includes, when practical:

- unauthorized confirmation attempts;
- confirmation attempts blocked by invalid state;
- confirmation attempts blocked by active availability conflict;
- confirmation attempts blocked by missing signed contract or missing deposit.

### Transaction boundary expectation

F119 does not force one exact implementation pattern, but it sets these guardrails:

- no misleading durable success audit after rollback;
- durable success audit should correspond to committed business state;
- failed or denied audit may be persisted separately only when that persistence cannot misrepresent business success.

The final implementation may use:

- post-commit audit creation;
- transaction-aware audit scheduling;
- another equivalent strategy consistent with repository transaction rules.

## Relation to DEC-005

F119 does not replace `DEC-005`.

Instead:

- `DEC-005` defines confirmation-domain rules, preconditions, transactional invariants, and error categories;
- `DEC-006` narrows the permission, attribution, and audit guardrails for the same future sensitive write flow.

Both decisions must be treated together before F120 begins confirmation implementation.

## Future implementation handoff

F120 accepted `DEC-005` and `DEC-006` but did not implement a confirmation write slice. A future controlled implementation slice may proceed only after the missing prerequisites identified by F120 are designed and validated.

### A future implementation slice may implement

- explicit backend authorization for sensitive confirmation;
- confirmation-specific attribution fields or equivalent durable representation;
- transaction-aware audit behavior for confirmation success and, if approved, denial/failure paths;
- transactional confirmation logic consistent with `ADR-004` and `DEC-005`.

### A future implementation slice must not bypass

A future implementation slice must not bypass:

- explicit backend authorization beyond `IsAuthenticated`;
- signed-contract prerequisite;
- deposit prerequisite;
- durable attribution requirement;
- transaction-safe audit requirement;
- Titan/Hahitantsoa scope separation;
- backend-only enforcement principle.

## Anti-shortcut guard

The following shortcuts are explicitly forbidden:

- confirmation with `IsAuthenticated` only;
- confirmation without signed contract prerequisite;
- confirmation without deposit prerequisite;
- partial confirmation side effects after failure;
- frontend-only enforcement of confirmation authority;
- Hahitantsoa/Titan scope mixing in confirmation writes;
- treating generic `created_by` / `updated_by` alone as sufficient confirmation audit.

## Out of scope

F119 does not:

- implement confirmation service;
- add a confirmed reservation state;
- add migrations;
- add contracts implementation;
- add payments implementation;
- add invoices;
- add logistics or returns;
- add frontend changes;
- add broad RBAC;
- change runtime behavior.

## Evidence and repository observations

F119 was written after inspection of the following repository sources:

- `docs/decisions/DEC-005-reservation-confirmation-domain-contract.md`
- `docs/audits/F117_BACKEND_COMPLETION_ROADMAP.md`
- `docs/adr/ADR-004-reservation-confirmation.md`
- `docs/adr/ADR-009-django-sessions-and-backend-permissions.md`
- `backend/apps/reservations/**`
- `backend/apps/inventory/**`
- `backend/apps/common/models.py`
- `backend/apps/audit/README.md`
- `backend/apps/identity/README.md`

Observed repository state:

- reservation APIs currently rely primarily on `IsAuthenticated`;
- reservation draft persistence exists;
- no active audit subsystem exists;
- no custom sensitive reservation permission system exists;
- common `created_by` / `updated_by` metadata exists but is not confirmation-specific.

## No application code

F119 changes no application code.
F119 adds a documentation guardrail decision only.
