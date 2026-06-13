# F131 Document Runtime Generation Backend Phase 1

## Status
- Implemented as a backend-only foundation.
- Transitions `DocumentInstance` from `prepared` to `generated`.
- Generates HTML output using Django templates.
- Computes deterministic SHA-256 checksums from UTF-8 HTML.
- Persists `content_checksum` but intentionally defers external `storage_path` configuration.

## Scope
F131 introduces the first document generation increment:
- A new `runtime.py` module exposing `generate_document_instance_html`.
- No new external PDF dependencies (wkhtmltopdf, WeasyPrint, etc.).
- No public APIs or serializer changes.
- Leaves `ReservationDraft` completely unmodified.

## Checksum strategy
The HTML rendering is designed to be deterministic (no unpersisted timestamps) so the SHA-256 checksum reflects exactly the context state at the moment of generation.

## Future Phases
- Add PDF rendering.
- Connect to S3 or a local persistent storage system.
- Implement API and access controls.
