# F126A - Document template backend foundation

## 1. Status

F126A is documentation and test-guard only.

It records the current commercial document template foundation before adding
any runtime rendering, persistence, PDF generation, invoice, receipt, contract,
payment, logistics, frontend, Hahitantsoa write behavior, broad RBAC, or
OpenClaw work.

## 2. Current backend foundation

The `documents` app already provides:

- a document template registry in `backend/apps/documents/registry.py`;
- authenticated read-only template registry API;
- authenticated read-only template detail API;
- authenticated read-only Titan proforma draft preview API;
- OpenAPI coverage for the existing documents read-only API surface.

The existing API surface remains read-only for documents.

## 3. Registry template groups

The registry currently declares Hahitantsoa, Titan, and shared document
templates.

Hahitantsoa templates include:

- `hahitantsoa.delivery_note.v1`;
- `hahitantsoa.contract_amendment.v1`;
- `hahitantsoa.contract.v1`;
- `hahitantsoa.invoice.v1`;
- `hahitantsoa.proforma.v1`;
- `hahitantsoa.house_rules.v1`;
- `hahitantsoa.liability_release.v1`.

Titan templates include:

- `titan.delivery_note.v1`;
- `titan.proforma.v1`;
- `titan.invoice.v1`;
- `titan.material_amendment.v1`;
- `titan.material_contract.v1`.

Shared templates include:

- `shared.payment_receipt.v1`;
- `shared.return_note.v1`;
- `shared.internal_release_note.v1`;
- `shared.supplier_purchase_order.v1`;
- `shared.breakage_repair_invoice.v1`.

## 4. Versioned source PDFs

The repository already versions source/reference PDFs under
`docs/references/source/` and `docs/references/source/templates/`.

Known source template PDFs include:

- `Template_AVENANT_Hahitantsoa_vierge_style_fidele_v1.pdf`;
- `Template_BL_Hahitantsoa_vierge_style_fidele_v1.pdf`;
- `Template_BL_Titan_vierge_style_fidele_v1.pdf`;
- `Template_FACTURE_Titan_vierge_style_fidele_v1.pdf`;
- `Template_Facture_Casse_Remise_Etat_style_fidele_v5.pdf`;
- `Template_PROFORMA_Titan_vierge_style_fidele_v1.pdf`.

## 5. Important template-path distinction

F126A distinguishes between:

1. versioned PDF source/reference templates;
2. registry declarations;
3. future runtime HTML templates.

The registry already contains `template_path` values such as
`backend/apps/documents/templates_documents/.../template.html`, but F126A does
not require those HTML files to exist yet.

Runtime HTML rendering is a future implementation concern. F126A only records
and guards the current foundation so future work does not confuse source PDFs
with runtime rendering templates.

## 6. Current safe interpretation

For F126A:

- validated source templates must have an existing `source_reference`;
- registry keys must be unique;
- registry required fields must be populated;
- missing runtime HTML `template_path` files remain acceptable while PDF runtime
  generation and HTML rendering are explicitly out of scope;
- generated draft templates remain placeholders until a later slice imports,
  creates, or validates their real sources.

## 7. Next implementation slice

The next implementation slice should be F126B:

- add a backend-only commercial document context/value object;
- build it from the existing template registry and `ReservationDraft`;
- keep it side-effect free;
- do not generate PDFs;
- do not create invoices, contracts, receipts, payments, reservations, or
  inventory blocks.

F126C may later refactor the existing Titan proforma preview to use that
context while preserving the existing API payload.

## 8. Explicit exclusions

F126A does not add:

- database model;
- migration;
- endpoint;
- serializer;
- view;
- URL or router;
- OpenAPI path;
- runtime HTML renderer;
- PDF runtime generation;
- invoice workflow;
- receipt workflow;
- signed contract workflow;
- payment provider integration;
- refund behavior;
- logistics, return, breakage, or loss workflow;
- reservation confirmation;
- inventory blocking;
- frontend behavior;
- Hahitantsoa write behavior;
- broad RBAC;
- OpenClaw.
