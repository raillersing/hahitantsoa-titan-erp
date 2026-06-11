# DEC-002 - Inventory availability domain rules

## Status

VALIDATED

## Context

Titan must support future availability checks for materials, articles and material packs before the reservation/rental module is implemented.

F29 added `InventoryAvailability` as the minimal inventory domain groundwork for periods during which an `InventoryItem` is unavailable or reserved for future use.

F30 added internal backend helpers to validate availability periods, find conflicts and answer whether an item is available for a requested period.

F31 validated that local demo inventory data created by `seed_demo_inventory` can be used with `InventoryAvailability` and the availability helpers.

At this stage, the inventory API remains read-only. No reservation write flow is implemented yet.

## Decision

Inventory availability is represented by `InventoryAvailability`.

An availability period is always attached to one `InventoryItem`.

The statuses that make an item unavailable are:

- `blocked`
- `reserved`

An availability period is valid only when:

- `end_at > start_at`

Availability overlap logic uses half-open intervals:

- `[start_at, end_at)`

An existing period conflicts with a requested period when both conditions are true:

- `existing.start_at < requested_end_at`
- `existing.end_at > requested_start_at`

Periods attached to another `InventoryItem` do not block the requested item.

The current internal backend helpers are:

- `validate_availability_period`
- `get_inventory_availability_conflicts`
- `is_inventory_item_available`

## Titan business scope

Titan remains limited to:

- `material`
- `article`
- `material_pack`

Titan excludes:

- `venue`
- `local`
- `room`
- `service`
- `event_service`

No local, room, venue, auxiliary service or event service may be introduced as a valid Titan inventory or availability input.

## Consequences

Future reservations must use the existing availability rules before validation.

The future reservation/rental module must check conflicts before confirming or allocating an `InventoryItem`.

Reservation writes are not implemented yet.

The inventory API remains read-only.

The current availability helpers are internal backend helpers. They are not public API endpoints.

## Out of scope

This decision does not create or define:

- a complete reservation module
- a contract module
- an invoice module
- a payment module
- a client module
- a complete calendar or planning module
- an API endpoint
- a serializer
- a frontend
- an advanced PostgreSQL anti-overlap constraint
- partial quantity or multi-unit availability handling
- complex timezone handling beyond the current Django usage

## Validation already covered

Existing tests cover:

- the `InventoryAvailability` model shape and metadata
- persistence of valid availability periods
- database rejection of `end_at <= start_at`
- allowed availability statuses
- availability query helpers
- overlap behavior with `[start_at, end_at)` intervals
- demo inventory seed data with availability helpers
- inventory API read-only smoke tests

No additional test is introduced by this decision document.

## Future work

Future work may include:

- the reservation/rental module
- availability checks before reservation confirmation
- business reservation statuses to be defined later
- future API endpoints, if explicitly approved
- a future calendar or agenda view
- stronger database-level anti-overlap protection if needed
- partial quantity or multi-unit availability if the future inventory model requires it

## F115B soft-delete clarification

F115B clarifies the soft-delete semantics for `InventoryAvailability`.

See [DEC-004 - Inventory availability soft-delete semantics](DEC-004-inventory-availability-soft-delete-semantics.md).

The accepted target rule is that soft-deleted availability rows are retained for traceability but must not participate in active availability conflicts.
