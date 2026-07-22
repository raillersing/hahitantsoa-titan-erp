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

The smallest Hahitantsoa MVP scope is read-only discovery and planning, with the
explicitly approved DD-1 exception below.

It must:

- present Hahitantsoa separately as the complete-event scope;
- list only validated offer and resource categories at a high level;
- allow local, venue, room and hall concepts only within Hahitantsoa, never Titan;
- include shared materials and articles as common inventory resources;
- communicate that confirmed or allocated shared materials must eventually become unavailable
  across both Hahitantsoa and Titan;
- remain read-only except for the bounded non-allocating commercial-request write
  explicitly authorized for DD-1.

### DD-1 - Authorized non-allocating commercial request

The product owner explicitly authorizes the DD-1 Hahitantsoa write recorded in
[PR #529](https://github.com/raillersing/hahitantsoa-titan-erp/pull/529): an authorized
employee may create and transition a commercial request for a customer or prospect.

This request is an **intention commerciale non allouante**. Its strictly limited scope is:

- one to three distinct desired dates, or a complete flexible period;
- an interest in a Hahitantsoa local, material, or service;
- a commercial owner and the explicit lifecycle `new → contacted → converted|lost|cancelled`.

The `converted` status is only an explicit commercial status. It must not automatically
create or convert any other business object.

This DD-1 authorization does **not** authorize a reservation, stock or availability check
or change, hold, allocation, proforma, contract, payment, confirmation, notification, or
automatic conversion. It does not authorize pricing or any frontend booking workflow.

### Titan/Hahitantsoa boundary preserved

The DD-1 request may use `local`, `material`, or `service` only for Hahitantsoa. Titan
continues to accept only `material`, `article`, and `material_pack`; no local, venue, room,
hall, ancillary service, or event service may leak into Titan. The request itself must not
alter shared-inventory availability or collapse the Titan/Hahitantsoa boundary.

## Confirmed For MVP

- Hahitantsoa is distinct from Titan.
- Hahitantsoa may represent complete events.
- Hahitantsoa may include venues, rooms, halls and locals when justified.
- Hahitantsoa may include materials, articles, furniture and services when justified.
- Shared materials must interact with Titan availability once they are confirmed or
  allocated through a separately authorized workflow.
- DD-1 may persist the bounded non-allocating Hahitantsoa commercial request described
  above; this is not a reservation or allocation workflow.

## Not Confirmed Yet

- exact backend field modeling for the full Hahitantsoa event lifecycle beyond DD-1;
- exact persisted status enum names for lifecycle states beyond the explicitly approved
  DD-1 request lifecycle;
- whether venue or service management is required in the first implemented UI;
- whether a read-only Hahitantsoa catalog is sufficient for the first MVP demo;
- exact fields for an event, venue, service or event package beyond DD-1;
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
- no contract, invoice, payment, customer/prospect master-data, or pricing workflow;
- no stock, quantity, unit, availability, hold, or allocation workflow;
- no write API other than the explicitly bounded DD-1 commercial-request creation and
  transition;
- no frontend booking workflow;
- no notification or automatic conversion;
- no production-ready claim.

## Titan Boundary Reminder

Titan remains exclusively pure rental of:

- `material`;
- `article`;
- `material_pack`.

Titan must never include local, venue, room, hall, ancillary service or event service concepts.
No configuration or permission may enable those categories for Titan.

## Consequences

- The first Hahitantsoa implementation step started read-only; DD-1 is the sole approved
  non-allocating commercial-request write exception.
- Each implementation step must remain small, testable and reviewable.
- Cross-scope availability may first be demonstrated through the existing shared
  `InventoryAvailability` rules, but DD-1 must not invoke or modify them.
- Persistence beyond DD-1, transactional allocation, and every reservation or other write
  workflow require separate explicit approval from the validated business sources.

This document should no longer be used by itself to claim that Hahitantsoa lifecycle and
confirmation remain wholly undefined. For current implementation planning, use Documents A/B
first, then aligned repository decisions and business rules.

## Acceptance Criteria For The First Hahitantsoa MVP Slice

- Hahitantsoa is visible separately from Titan.
- No Titan-forbidden category leaks into Titan.
- The shared-material availability rule is documented and testable.
- DD-1 writes are limited to the authorized customer/prospect commercial request, flexible
  dates or period, Hahitantsoa local/material/service interest, commercial owner, and
  explicit statuses.
- DD-1 creates no reservation, stock or availability effect, hold, allocation, proforma,
  contract, payment, notification, or automatic conversion.
- No wider write, commercial, or frontend booking workflow is introduced.
