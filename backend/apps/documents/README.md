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
