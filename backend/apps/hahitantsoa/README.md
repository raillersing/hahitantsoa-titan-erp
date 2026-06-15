# Hahitantsoa Domain Package

`apps.hahitantsoa` started as a pure-Python read-only discovery domain core and now also hosts a
bounded Django event-draft foundation for approved Hahitantsoa planning writes.

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

F74 adds `HahitantsoaDiscoveryItem`, a minimal immutable pure-Python value object.

F75 adds the internal pure-Python selector `list_hahitantsoa_discovery_items`.

F77 implements the authenticated read-only endpoint:

- `GET /api/v1/hahitantsoa/discovery-items/`

F83 implements the authenticated shared availability endpoint:

- `GET /api/v1/hahitantsoa/shared-availability/`

That facade stays strictly read-only and exposes only shared `material` and `article` inventory
previews. It creates no reservation, hold, allocation or inventory block.

F84 activates `apps.hahitantsoa` as a Django app and adds the first bounded planning write
surface:

- `HahitantsoaEventDraft`;
- `HahitantsoaEventDraftLine`;
- `GET/POST /api/v1/hahitantsoa/event-drafts/`;
- `GET/PUT/PATCH /api/v1/hahitantsoa/event-drafts/<uuid>/`.

F84 remains intentionally narrow:

- status stays draft-only;
- no confirmation workflow;
- no contract, invoice, payment or pricing workflow;
- no inventory block or allocation write;
- no `material_pack` in Hahitantsoa event draft lines;
- no dedicated venue/room/service models yet;
- venue/location/service details stay descriptive text only.

Shared inventory lines remain limited to active Titan inventory items of kind `material` or
`article`. This preserves the shared-inventory boundary without turning Hahitantsoa-only concepts
into Titan inventory kinds.
