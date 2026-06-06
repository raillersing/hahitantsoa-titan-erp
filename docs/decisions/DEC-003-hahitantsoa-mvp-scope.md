# DEC-003 - Hahitantsoa MVP scope clarification

## Status

Accepted for MVP planning.

## Context

The Hahitantsoa/Titan MVP must eventually cover both business scopes.

Titan progressed first with authenticated, read-only inventory and availability surfaces.
Hahitantsoa has no dedicated implemented feature yet.

The repository contains broader source documents in `docs/references/source/`, but their
detailed contents were not extracted during F70. This decision therefore uses the latest
validated repository decisions, ADRs and business rules without inventing unverified details
from those source documents.

## Decision

The smallest Hahitantsoa MVP scope is read-only discovery and planning.

It must:

- present Hahitantsoa separately as the complete-event scope;
- list only validated offer and resource categories at a high level;
- allow local, venue, room and hall concepts only within Hahitantsoa, never Titan;
- include shared materials and articles as common inventory resources;
- communicate that confirmed or allocated shared materials must eventually become unavailable
  across both Hahitantsoa and Titan;
- remain read-only until persistence and write workflows are explicitly approved.

## Confirmed For MVP

- Hahitantsoa is distinct from Titan.
- Hahitantsoa may represent complete events.
- Hahitantsoa may include venues, rooms, halls and locals when justified.
- Hahitantsoa may include materials, articles, furniture and services when justified.
- Shared materials must interact with Titan availability.

## Not Confirmed Yet

- the exact Hahitantsoa event lifecycle;
- exact Hahitantsoa statuses;
- whether venue or service management is required in the first implemented UI;
- whether a read-only Hahitantsoa catalog is sufficient for the first MVP demo;
- exact fields for an event, venue, service or event package;
- any persistence or write workflow.

These points require explicit validation before implementation.

## Explicit Exclusions For Now

- no persistent Hahitantsoa reservation;
- no contract, invoice, payment, customer or pricing workflow;
- no stock, quantity or unit workflow;
- no write API;
- no frontend booking workflow;
- no production-ready claim.

## Titan Boundary Reminder

Titan remains exclusively pure rental of:

- `material`;
- `article`;
- `material_pack`.

Titan must never include local, venue, room, hall, ancillary service or event service concepts.
No configuration or permission may enable those categories for Titan.

## Consequences

- The next Hahitantsoa implementation must start read-only.
- Each implementation step must remain small, testable and reviewable.
- Cross-scope availability may first be demonstrated through the existing shared
  `InventoryAvailability` rules.
- Persistence, transactional allocation and write workflows require later explicit approval.

## Acceptance Criteria For The First Hahitantsoa MVP Slice

- Hahitantsoa is visible separately from Titan.
- No Titan-forbidden category leaks into Titan.
- The shared-material availability rule is documented and testable.
- No write or commercial workflow is introduced.
