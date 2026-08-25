from __future__ import annotations

DOCUMENT_TEMPLATE_PATHS: dict[str, str] = {
    "hahitantsoa.proforma.v1": "documents/hahitantsoa_proforma.html",
    "hahitantsoa.contract.v1": "documents/hahitantsoa_contract.html",
    "hahitantsoa.contract_amendment.v1": "documents/hahitantsoa_contract_amendment.html",
    "hahitantsoa.invoice.v1": "documents/hahitantsoa_invoice.html",
    "hahitantsoa.liability_release.v1": "documents/hahitantsoa_liability_release.html",
    "hahitantsoa.delivery_note.v1": "documents/hahitantsoa_delivery_note.html",
    "hahitantsoa.preparation_sheet.v1": "documents/hahitantsoa_preparation_sheet.html",
    "titan.proforma.v1": "documents/titan_proforma.html",
    "titan.material_contract.v1": "documents/titan_material_contract.html",
    "titan.material_amendment.v1": "documents/titan_material_amendment.html",
    "titan.invoice.v1": "documents/titan_invoice.html",
    "titan.delivery_note.v1": "documents/titan_delivery_note.html",
    "titan.payment_receipt.v1": "documents/titan_payment_receipt.html",
    "hahitantsoa.payment_receipt.v1": "documents/hahitantsoa_payment_receipt.html",
    "shared.payment_refund_receipt.v1": "documents/shared_payment_refund_receipt.html",
    "shared.return_note.v1": "documents/shared_return_note.html",
    "shared.preparation_sheet.v1": "documents/preparation_sheet.html",
    "shared.internal_release_note.v1": "documents/shared_internal_release_note.html",
    "shared.supplier_purchase_order.v1": "documents/shared_supplier_purchase_order.html",
    "shared.breakage_repair_invoice.v1": "documents/shared_breakage_repair_invoice.html",
}


def resolve_document_template_path(template_key: str) -> str | None:
    """Return the canonical Django template path for a registered document key."""

    return DOCUMENT_TEMPLATE_PATHS.get(template_key)
