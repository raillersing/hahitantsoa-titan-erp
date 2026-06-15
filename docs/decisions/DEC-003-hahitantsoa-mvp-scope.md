# DEC-003 - Hahitantsoa MVP scope clarification

## Status

Accepted for MVP planning.
Historical-only for the earliest read-only Hahitantsoa slice after later extraction of
Documents A/B.

## Context

The Hahitantsoa/Titan MVP must eventually cover both business scopes.

Titan progressed first with authenticated, read-only inventory and availability surfaces.
Hahitantsoa has no dedicated implemented feature yet.

At the time of this decision, the repository contained broader source documents in
`docs/references/source/`, but their detailed contents had not yet been extracted. This
decision therefore used the latest validated repository decisions, ADRs and business rules
without inventing unverified details from those source documents.

After later extraction work, the higher-level business specification Documents A and B are
the primary business source of truth for Hahitantsoa lifecycle and confirmation rules. See:

- `docs/references/source/Document_A_CDC_Technique_Evenementiel_v3.4.pdf`
- `docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf`
- `docs/audits/F92_HAHITANTSOA_LIFECYCLE_SOURCE_TRACE.md`

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

- exact backend field modeling for the full Hahitantsoa event lifecycle;
- exact persisted status enum names to encode the business lifecycle in repository code;
- whether venue or service management is required in the first implemented UI;
- whether a read-only Hahitantsoa catalog is sufficient for the first MVP demo;
- exact fields for an event, venue, service or event package;
- payment-provider operational details not already validated elsewhere.

The earlier ambiguity in this section must not be interpreted as overriding later validated
Documents A/B. Those documents now confirm at least the following business rules:

- a proforma is an estimate and does not confirm a reservation;
- a reservation becomes confirmed only after signed contract, deposit received, and
  availability rechecked;
- confirmed shared materials become unavailable across Hahitantsoa and Titan;
- post-contract modification requires an amendment workflow rather than direct contract edit.

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

- The first Hahitantsoa implementation step started read-only.
- Each implementation step must remain small, testable and reviewable.
- Cross-scope availability may first be demonstrated through the existing shared
  `InventoryAvailability` rules.
- Persistence, transactional allocation and write workflows require explicit approval from the
  validated business sources before implementation.

This document should no longer be used by itself to claim that Hahitantsoa lifecycle and
confirmation remain wholly undefined. For current implementation planning, use Documents A/B
first, then aligned repository decisions and business rules.

## Acceptance Criteria For The First Hahitantsoa MVP Slice

- Hahitantsoa is visible separately from Titan.
- No Titan-forbidden category leaks into Titan.
- The shared-material availability rule is documented and testable.
- No write or commercial workflow is introduced.
