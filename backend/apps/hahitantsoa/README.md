# Hahitantsoa Domain Package

`apps.hahitantsoa` contains a pure-Python read-only discovery domain core and a minimal DRF
read-only API surface. It is not an activated Django application and has no model, migration,
admin, database access or frontend.

F73 adds read-only discovery scope guards for the first Hahitantsoa slice. The accepted
high-level concepts are:

- `event`;
- `venue`;
- `local`;
- `room`;
- `hall`;
- `material`;
- `article`;
- `furniture`;
- `service`.

Only `material` and `article` are shared with Titan. Hahitantsoa-only concepts must never leak
into Titan, which remains limited to `material`, `article` and `material_pack`.

These guards do not authorize persistence, reservation, allocation, selector, catalogue, API,
frontend, pricing, payment, invoice, customer or commercial workflow behavior.

F74 adds `HahitantsoaDiscoveryItem`, a minimal immutable pure-Python value object with:

- a `concept` normalized and validated through the F73 scope guard;
- a non-empty trimmed `label` used only for display.

This value object is not a catalogue, selector, model, API or workflow. It contains no
persistence identifier, metadata, status, lifecycle, availability, pricing, stock, quantity,
unit, reservation or commercial fields.

F75 adds the internal pure-Python selector `list_hahitantsoa_discovery_items`. It returns an
immutable tuple containing these validated high-level discovery categories in deterministic
order:

- `event`;
- `venue`;
- `local`;
- `room`;
- `hall`;
- `material`;
- `article`;
- `furniture`;
- `service`.

The selector is a static read-only discovery-category catalogue only. It is not real inventory,
availability data, an API payload contract, a production or commercial catalogue, or a
reservation workflow. It uses no Django model, database, QuerySet, filter or framework API.

F76 documents the future authenticated read-only discovery API contract in
[`docs/architecture/hahitantsoa-readonly-discovery-api-contract.md`](../../../docs/architecture/hahitantsoa-readonly-discovery-api-contract.md).
F76 did not implement that endpoint. At the end of F76, Hahitantsoa remained an unregistered
pure-Python package with no serializer, view, URL, API, model, migration, admin, frontend or
database behavior.

F77 implements the authenticated read-only endpoint:

- `GET /api/v1/hahitantsoa/discovery-items/`

The endpoint delegates exclusively to `list_hahitantsoa_discovery_items()`, returns only
`concept` and `label` for each item, and rejects write methods. Hahitantsoa remains unregistered
as a Django app and F77 adds no model, migration, admin, database access, QuerySet, frontend,
availability, reservation or commercial workflow.
