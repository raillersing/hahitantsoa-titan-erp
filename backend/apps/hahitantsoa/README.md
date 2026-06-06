# Hahitantsoa Domain Package

`apps.hahitantsoa` is a structural pure-Python domain package. It is not an activated Django
application and has no model, migration, API, admin or frontend.

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
