# DEC-004 - Inventory availability soft-delete semantics

Status: Accepted  
Scope: F115B  
Type: Documentation / architecture decision only  
Date: 2026-06-11

## Context

`InventoryAvailability` represents a period during which an `InventoryItem` is unavailable for a future Titan availability check.

The model inherits the common soft-delete fields, including `is_deleted` and `deleted_at`.

F114 identified an ambiguity: `InventoryAvailability.is_deleted` exists, but the active conflict semantics were not explicitly decided. This ambiguity must be resolved before F116 changes backend behavior.

F115B is intentionally documentation-only. It does not change backend code, frontend code, tests, migrations, APIs, serializers, views, permissions, seed commands or runtime behavior.

## Decision

A soft-deleted `InventoryAvailability` row must not participate in active availability conflicts.

Active conflict checks must consider only rows where:

- `is_deleted = False`;
- `status` is an active blocking availability status;
- the row overlaps the requested period according to the existing half-open interval rule `[start_at, end_at)`.

Therefore, an `InventoryAvailability` row with `is_deleted = True` is retained for traceability but ignored by active availability checks.

## Selected semantics

### Active blocking rows

An availability row is active and blocking only when:

- it is attached to the checked `InventoryItem`;
- it is not soft-deleted;
- its status is one of the active blocking statuses;
- its period overlaps the requested period.

The currently active blocking statuses remain:

- `blocked`;
- `reserved`.

### Soft-deleted rows

A soft-deleted availability row means:

- the row is no longer active for operational availability;
- the row is kept as historical/audit data;
- the row must not make an item unavailable;
- the row must not appear as an active conflict in reservation previews, availability summaries or available-item selectors.

Soft-delete is not a business reservation status.

### Cancelled or released business meaning

Soft-delete must not be used as a long-term substitute for a precise business lifecycle.

If the ERP later needs to distinguish cancelled, released, expired, superseded or manually voided periods, that must be handled by a future explicit business status or by the future reservation/allocation domain.

F115B does not add those statuses.

## Rejected alternatives

### Alternative A - Soft-deleted rows remain blocking

Rejected.

Reason: a soft-deleted row would keep an item unavailable even though the row has been logically removed. This makes deletion operationally misleading and risks invisible false conflicts.

### Alternative B - Soft-delete alone becomes a business cancellation model

Rejected.

Reason: `is_deleted` is a technical lifecycle flag. It does not explain whether a row was cancelled, released, expired, superseded, merged or voided. Business lifecycle must be represented explicitly when needed.

### Alternative C - Keep behavior undefined until reservation confirmation

Rejected.

Reason: availability is already consumed by read-only Titan surfaces and future confirmation must rely on clear conflict semantics. Leaving the rule undefined would increase the risk of inconsistent selectors, previews and summaries.

## Consequences for F116

F116 must apply this decision in backend code and tests.

Expected implementation direction:

- centralize active conflict semantics in inventory availability helpers;
- ensure `get_inventory_availability_conflicts` ignores `is_deleted=True`;
- ensure selector-based availability and helper-based previews are consistent;
- add tests proving active `blocked` and `reserved` rows still block;
- add tests proving soft-deleted `blocked` and `reserved` rows do not block;
- preserve half-open interval behavior;
- preserve Titan kind boundaries;
- avoid frontend changes unless backend contract changes require documentation.

## Anti-scope guard

F115B must not:

- change backend behavior;
- change frontend behavior;
- add migrations;
- add models;
- add statuses;
- add APIs;
- change tests;
- create reservation confirmation;
- create allocation logic;
- create stock, quantity or capacity logic;
- implement Hahitantsoa/Titan shared availability.

## Acceptance criteria

F115B is complete when:

- this decision document exists;
- the selected semantics are explicit;
- rejected alternatives are documented;
- F116 has clear implementation expectations;
- the PR contains documentation/architecture changes only.
