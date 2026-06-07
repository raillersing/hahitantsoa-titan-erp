# Hahitantsoa Read-Only Discovery API Contract

## Status

Implemented by F77. F76 documented this contract without creating an API endpoint or changing
application behavior.

## Purpose

The future endpoint will expose the validated high-level Hahitantsoa discovery categories from
`list_hahitantsoa_discovery_items()`. These categories support read-only discovery and planning.
They are not production inventory, availability data, real venue or service entities, or a
commercial catalogue.

## Endpoint

```text
GET /api/v1/hahitantsoa/discovery-items/
```

The endpoint requires the existing Django session-authenticated DRF convention. F77 must use
`IsAuthenticated`, consistently with the existing authenticated read-only APIs.

### Allowed Methods

- `GET`;
- `HEAD`;
- `OPTIONS`.

### Rejected Methods

F77 must return HTTP `405 Method Not Allowed` for:

- `POST`;
- `PUT`;
- `PATCH`;
- `DELETE`.

## Successful Response

An authenticated `GET` returns HTTP `200 OK`.

The request accepts no required query parameters. The endpoint provides no filtering,
pagination or availability parameters.

```json
{
  "items": [
    {
      "concept": "event",
      "label": "event"
    },
    {
      "concept": "venue",
      "label": "venue"
    },
    {
      "concept": "local",
      "label": "local"
    },
    {
      "concept": "room",
      "label": "room"
    },
    {
      "concept": "hall",
      "label": "hall"
    },
    {
      "concept": "material",
      "label": "material"
    },
    {
      "concept": "article",
      "label": "article"
    },
    {
      "concept": "furniture",
      "label": "furniture"
    },
    {
      "concept": "service",
      "label": "service"
    }
  ],
  "count": 9
}
```

The top-level response exposes exactly:

- `items`;
- `count`.

Each item exposes exactly:

- `concept`;
- `label`.

`count` must equal `len(items)`.

## Deterministic Ordering

The endpoint preserves the exact F75 selector order:

1. `event`;
2. `venue`;
3. `local`;
4. `room`;
5. `hall`;
6. `material`;
7. `article`;
8. `furniture`;
9. `service`.

## Authentication And Errors

- authenticated `GET`: HTTP `200 OK`;
- unauthenticated `GET`: HTTP `401 Unauthorized` or `403 Forbidden`, consistently with the
  configured session-authenticated DRF behavior;
- rejected write methods: HTTP `405 Method Not Allowed`.

No business validation error response is required because the selector accepts no input.

## Explicit Exclusions

The contract exposes no:

- ID, UUID, slug or persistence identifier;
- database or model state;
- availability or reservation status;
- price, stock, quantity or unit;
- lifecycle, status or production-catalogue metadata;
- customer, payment, invoice or contract;
- real venue, service or inventory entity details;
- write affordance or commercial workflow.

The endpoint must never expand Titan. Titan remains limited to `material`, `article` and
`material_pack`; Hahitantsoa-only concepts remain confined to the Hahitantsoa surface.

## Planned F77 Implementation

F77 may create or modify:

- `backend/apps/hahitantsoa/serializers.py`;
- `backend/apps/hahitantsoa/views.py`;
- `backend/apps/hahitantsoa/urls.py`;
- `backend/config/urls.py`;
- `tests/backend/test_hahitantsoa_discovery_api.py`;
- directly relevant documentation.

F77 must delegate exclusively to `list_hahitantsoa_discovery_items()`, perform no database
access and add no model, migration, admin or frontend.

F77 should use a minimal read-only DRF `APIView` with:

```python
http_method_names = ["get", "head", "options"]
permission_classes = [IsAuthenticated]
```

This preserves the allowed `GET`, `HEAD` and `OPTIONS` methods and ensures that `POST`, `PUT`,
`PATCH` and `DELETE` return HTTP `405 Method Not Allowed`.

## Planned F77 Tests

F77 must verify:

- authenticated `GET` returns HTTP `200`;
- unauthenticated `GET` returns HTTP `401` or `403`;
- exact top-level and item fields;
- exact categories and deterministic order;
- `count == len(items) == 9`;
- `material_pack` is absent;
- `POST`, `PUT`, `PATCH` and `DELETE` return HTTP `405`;
- the API delegates to the F75 selector;
- the endpoint performs no database write;
- no Hahitantsoa model, migration or admin is introduced.

## F76 Non-Goals

F76 implements none of the planned F77 files or behaviors. It adds no serializer, view, URL,
endpoint, test, Django registration, model, migration, admin, frontend, database behavior,
QuerySet, write action, availability logic or commercial workflow.
