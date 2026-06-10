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

