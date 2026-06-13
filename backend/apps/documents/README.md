# Documents

F98 scaffolds the document template registry only.

This app exposes a read-only registry of known document template definitions for
Hahitantsoa, Titan and shared operational documents.

F98 does not implement PDF generation, customer document creation, billing,
payments, contracts, reservations or any write workflow.

The source PDF files remain in `docs/references/source/`.
Runtime/generated customer PDFs must not be stored in Git.

F102 updates the source references to Documents A/B v3.4, registers the
validated source template for breakage and repair invoice documents, and adds a
document template inventory report at `docs/references/document_templates_inventory.md`.

F102 still does not implement runtime PDF generation or customer document
creation.


## F126A document template backend foundation

F126A records the current document template backend foundation.

The repository already has a document template registry and versioned PDF source
templates. F126A explicitly distinguishes those source PDFs from future runtime
HTML templates declared by `template_path` values in the registry.

Missing runtime HTML template files remain acceptable at this stage because
runtime rendering and PDF generation are still out of scope. Future document
runtime work must first introduce a backend commercial document context and
then wire rendering in a separate approved slice.

F126A also keeps payment, invoice, receipt, signed contract, reservation
confirmation, inventory blocking, frontend behavior, Hahitantsoa write behavior,
broad RBAC, and OpenClaw out of scope.

## F129 document instance backend foundation

F129 adds the first persisted backend boundary for commercial document
instances.

This foundation stores metadata snapshots linked to a `ReservationDraft`,
customer, and template definition from the existing registry/F126BC commercial
context. It allows the backend to represent a prepared/generated commercial
document instance without rendering HTML/PDF and without exposing an API.

F129 remains strictly backend-only and excludes:

- PDF/HTML runtime rendering;
- download endpoints or document file serving;
- serializers, views, routers, URLs, or OpenAPI paths;
- payment, receipt, invoice runtime, refund, or cashbox execution;
- reservation lifecycle APIs;
- frontend behavior;
- broad RBAC or external storage integration.

## F131 document runtime generation backend phase 1

F131 introduces the first backend-only runtime generation increment.

It transitions a `prepared` `DocumentInstance` to `generated`, rendering deterministic HTML from the commercial context and storing the SHA-256 checksum in `content_checksum`.

F131 intentionally avoids external dependencies like WeasyPrint, and defers PDF rendering, external storage, API exposure, and broader RBAC concerns.
