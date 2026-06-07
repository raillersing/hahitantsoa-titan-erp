# Hahitantsoa/Titan Shared Availability Read-only Contract

## 1. Status

F82 defines a documentation and contract boundary only.

F82 adds no implementation, endpoint, runtime behavior, persistence, reservation or commercial
workflow. Every future implementation option in this document requires separate explicit
approval.

## 2. Problem

Hahitantsoa must eventually support complete-event planning while respecting the availability of
inventory resources shared with Titan. The shared concepts are `material` and `article`.

The current Hahitantsoa slice provides read-only discovery only. It has no item persistence,
reservation, allocation or availability behavior. A future planning surface needs a safe way to
understand whether shared materials or articles appear available for a requested period without
creating a reservation, holding an item, mutating inventory or starting a commercial workflow.

## 3. Business Boundary

Titan remains limited to:

- `material`;
- `article`;
- `material_pack`.

Hahitantsoa is a distinct complete-event scope. The only concepts shared between Hahitantsoa and
Titan are:

- `material`;
- `article`.

`material_pack` remains Titan-only. Hahitantsoa-only concepts such as `event`, `venue`, `local`,
`room`, `hall`, `furniture` and `service` must never become Titan inventory or availability
options.

## 4. Ownership Model

The `inventory` domain owns the real `InventoryItem` records and their availability rules.
Existing Titan inventory and reservations availability surfaces expose that authoritative state
as authenticated read-only information.

Hahitantsoa may consume read-only planning information for shared `material` and `article` items.
It does not own or create:

- inventory stock, quantity or unit state;
- pricing;
- customers, payments, invoices or contracts;
- reservations, holds or allocations;
- availability periods;
- item or planning persistence.

Any future cross-scope allocation or confirmation behavior requires a separately approved,
transactional design. It is not part of this contract.

## 5. Approved Read-only Data Concept

A future approved Hahitantsoa planning read may expose only:

- an existing inventory item identity already exposed by the authenticated inventory API;
- the existing item display name and description;
- the item kind, restricted to `material` or `article`;
- a read-only availability status or preview used only as a planning signal;
- a requested period using the existing timezone-aware `start_at` and `end_at` convention;
- the existing half-open period rule `[start_at, end_at)`.

An availability result is informational. It does not reserve, hold, allocate or confirm an item
and must not be presented as a guarantee of future availability.

This contract does not approve:

- booking, hold, allocation or reservation behavior;
- quote, pricing, invoice, payment or contract generation;
- stock mutation or quantity/unit workflows;
- Hahitantsoa persistence;
- write behavior of any kind.

## 6. Future Endpoint Options, Not Implemented By F82

All options below are unimplemented and require explicit approval.

### Option A - Reuse Existing Read-only Titan Availability APIs

A future Hahitantsoa frontend could reuse existing authenticated read-only inventory and
availability APIs. This is the smallest integration, but it risks exposing the Titan-only
`material_pack` concept to Hahitantsoa unless the backend contract enforces the shared-kind
boundary.

Frontend filtering alone is not a sufficient business boundary. Option A must not be approved
without a backend-enforced guarantee that Hahitantsoa receives only `material` and `article`.

### Option B - Minimal Hahitantsoa Read-only Facade

A future Hahitantsoa read-only facade could delegate to existing inventory selectors and
availability services while filtering the result to exactly `material` and `article`.

The facade would own no data and perform no writes. It would expose only the minimal planning
contract defined in this document. This is the safest future implementation option because it
enforces the cross-scope boundary on the backend.

### Option C - No New Backend Endpoint For The MVP

The integrated MVP may stop at separate Titan availability and Hahitantsoa discovery surfaces.
Shared availability would remain a documented future capability until a minimal backend-enforced
contract is explicitly approved.

### Recommendation

For the controlled MVP, keep F82 contract-only. If shared availability must be demonstrated in a
future implementation, prefer Option B as a small authenticated read-only facade that delegates
to existing inventory availability logic and enforces `material`/`article` filtering on the
backend.

Do not introduce Hahitantsoa availability persistence. Do not reuse the current Titan APIs from a
Hahitantsoa surface unless the backend guarantees that `material_pack` is excluded.

## 7. Forbidden Endpoints And Behaviors

The following are not approved:

- Hahitantsoa availability `POST`, `PUT`, `PATCH` or `DELETE`;
- Hahitantsoa reservation endpoints or persistent reservations;
- booking, hold or allocation endpoints;
- pricing, payment, invoice, customer or contract endpoints;
- contract or template generation;
- stock, quantity or unit workflows;
- Titan endpoints that accept `local`, `venue`, `room`, `hall`, `service`, ancillary service or
  event service;
- any configuration or permission that expands the Titan scope;
- any response that presents `material_pack` as a shared Hahitantsoa concept.

## 8. Testing Expectations For Future Implementation

If a future implementation is explicitly approved, tests must verify:

- authentication is required;
- the surface is read-only and rejects `POST`, `PUT`, `PATCH` and `DELETE`;
- no Hahitantsoa database write or persistence occurs;
- only `material` and `article` availability can be read by Hahitantsoa;
- `material_pack` remains Titan-only and is absent from the Hahitantsoa contract;
- Hahitantsoa-only categories never become Titan options;
- the implementation delegates to existing inventory availability rules without duplicating
  overlap logic;
- half-open periods `[start_at, end_at)` remain consistent;
- OpenAPI documents the strict read-only contract;
- frontend Titan/Hahitantsoa separation remains visible;
- integrated local acceptance and limitations are updated.

## 9. MVP Recommendation

Finish the MVP with the smallest backend-enforced read-only boundary.

F82 approves only the contract. A future F83 may remain acceptance/runbook-only or may implement a
minimal read-only facade only after explicit approval. No future task should add Hahitantsoa
availability persistence merely to demonstrate shared planning.

## 10. Out Of Scope

- contract templates or commercial contracts;
- customer management;
- invoice, payment or pricing workflows;
- persistent reservation, hold or allocation;
- Hahitantsoa write APIs or persistence;
- stock, quantity or unit workflows;
- production-readiness claims;
- any expansion of Titan beyond `material`, `article` and `material_pack`.
