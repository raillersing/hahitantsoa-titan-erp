# F129 Document Instance Backend Foundation

## Status

- Backend-only foundation.
- Persists commercial document instance metadata without runtime rendering.
- No API or frontend behavior added.

## Evidence base

F129 builds on the post-F126BC repository state:

- `backend/apps/documents/commercial.py`
- `backend/apps/documents/registry.py`
- current `ReservationDraft` and `Customer` persisted models
- existing document template registry tests and proforma preview tests
- repository model and migration conventions already used in `audit`, `customers`, `inventory`, and
  `reservations`

## Implemented scope

F129 adds:

- a persisted `DocumentInstance` backend model;
- a document instance creation service from `ReservationDraft` + template registry context;
- simple selectors for reservation-linked document instance retrieval;
- focused backend tests for the model, service, and selectors.

F129 does not render HTML or PDF, does not create downloads, and does not expose a serializer, view,
router, URL, or OpenAPI path.

## Model boundary

`DocumentInstance` is the persisted metadata boundary for a prepared/generated commercial document.

It snapshots:

- reservation draft linkage;
- customer linkage and basic customer display snapshot;
- template key, version, label, scope, type, source metadata, and validation flags;
- document status;
- prepared actor/timestamp;
- optional future storage/checksum fields;
- optional void markers for future lifecycle control.

The model intentionally avoids:

- binary PDF storage in Git;
- payment or accounting data;
- reservation lifecycle mutation;
- external storage provider configuration.

Duplicate instances for the same reservation/template are currently allowed. F129 records the
instance foundation only; duplicate-prevention rules remain a later business decision.

## Service boundary

`create_document_instance_from_reservation_draft(...)` is backend-only.

It:

- calls `build_reservation_draft_commercial_document_context(...)`;
- snapshots template metadata already defined by F126BC/registry;
- snapshots reservation/customer references needed by the document instance foundation;
- creates exactly one `DocumentInstance`;
- remains transaction-safe through `transaction.atomic()`.

It does not:

- render a PDF or HTML output;
- create a payment or receipt;
- confirm/cancel a reservation;
- block inventory;
- mutate `ReservationDraft` business state.

## Storage boundary

F129 stores metadata only.

`storage_path` and `content_checksum` exist as nullable future-facing fields, but F129 leaves them
empty. No file generation, file write, external storage, or download behavior is implemented.

## Status lifecycle

Current statuses:

- `prepared`
- `generated`
- `issued`
- `voided`

F129 only creates instances in `prepared`.

`voided` markers are modeled for future lifecycle work, with DB consistency requiring:

- non-voided instances keep `voided_at` / `voided_by` empty;
- voided instances persist both `voided_at` and `voided_by`.

## Security / private document considerations

Commercial document instances may later point to private generated outputs. F129 therefore keeps the
backend foundation separate from any public file URL or download behavior.

Future document access work must remain permission-controlled, auditable, and explicit about private
storage boundaries.

## Why PDF/HTML runtime is excluded

Runtime rendering is a separate backend concern. F126BC introduced the commercial context required
before rendering; F129 introduces persisted document instances. Combining rendering here would widen
the PR into template execution, file generation, storage, and access concerns.

## Why API is excluded

Document instance persistence must stabilize before serializer/view/router/OpenAPI exposure.

An API now would force premature decisions about:

- authorization;
- private file access;
- download semantics;
- lifecycle mutation;
- frontend coupling.

## Why payment / receipt / invoice runtime is excluded

Payments, receipts, invoices, refunds, and cashbox behavior are distinct business boundaries. F129
only establishes persisted document instance metadata and intentionally stops before any commercial
execution flow.

## Migration / test summary

F129 adds the initial documents app model migration for `DocumentInstance`.

Focused tests cover:

- model creation/defaults;
- void marker DB consistency;
- template metadata snapshot from registry/F126BC context;
- reservation/customer linkage;
- service side-effect control;
- unknown template behavior;
- selectors filtering active vs voided instances;
- explicit confirmation that no rendered file path/checksum is produced by F129.

## Next recommended task after F129

Recommended next step:

- `F130 - first runtime commercial document generation service for one Titan document, still backend-only`

Alternative safe step if access policy must be decided first:

- a document private access/API boundary decision before any endpoint exposure.
