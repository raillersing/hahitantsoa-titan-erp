from __future__ import annotations

import hashlib
from dataclasses import dataclass

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.template.loader import render_to_string

from apps.documents.commercial import build_reservation_draft_commercial_document_context
from apps.documents.excess_receivable import build_excess_receivable_invoice_context
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.payment_receipts import build_payment_receipt_context
from apps.inventory.models import InventoryDamageLossExcessReceivable


class DocumentRuntimeGenerationError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


PAYMENT_RECEIPT_PAYMENT_NOT_FOUND = "payment_receipt_payment_not_found"


@dataclass(frozen=True)
class DocumentGenerationResult:
    document_instance: DocumentInstance
    html_content: str
    content_checksum: str


def calculate_document_html_checksum(html_content: str) -> str:
    return hashlib.sha256(html_content.encode("utf-8")).hexdigest()


def build_document_artifact_storage_path(document_instance, content_checksum: str) -> str:
    """Return a deterministic relative path for the HTML artifact.
    Includes the document instance PK and a prefix of the checksum.
    """
    safe_checksum = content_checksum[:12]
    return f"documents/{document_instance.id}/{safe_checksum}.html"


def store_document_html_artifact(
    document_instance, html_content: str, content_checksum: str
) -> str:
    """Save the HTML content to the default storage and return the relative path.
    Uses UTF-8 encoding.
    """
    path = build_document_artifact_storage_path(document_instance, content_checksum)
    default_storage.save(path, ContentFile(html_content.encode("utf-8")))
    return path


@transaction.atomic
def generate_document_instance_html(
    *,
    document_instance: DocumentInstance,
    actor: object | None = None,
) -> DocumentGenerationResult:
    if document_instance.status != DocumentInstanceStatus.PREPARED:
        raise DocumentRuntimeGenerationError(
            f"Cannot generate document from status: {document_instance.status}",
            code="invalid_document_status_for_generation",
        )

    if document_instance.template_key == "shared.payment_receipt.v1":
        from apps.payments.models import Payment

        payment = (
            Payment.objects.select_related("reservation_draft", "reservation_draft__customer")
            .filter(receipt_document=document_instance)
            .first()
        )
        if payment is None:
            raise DocumentRuntimeGenerationError(
                "Payment receipt document is not linked to a payment source.",
                code=PAYMENT_RECEIPT_PAYMENT_NOT_FOUND,
            )
        context = build_payment_receipt_context(payment=payment)
        template_path = "documents/shared_payment_receipt.html"
    elif document_instance.template_key == "shared.payment_refund_receipt.v1":
        from apps.payments.models import Payment

        payment = (
            Payment.objects.select_related(
                "refund_obligation__settlement_execution__settlement__return_operation__reservation_draft__customer"
            )
            .filter(receipt_document=document_instance)
            .first()
        )
        if payment is None:
            raise DocumentRuntimeGenerationError(
                "Payment refund receipt document is not linked to a payment source.",
                code="payment_refund_receipt_payment_not_found",
            )
        context = build_payment_receipt_context(payment=payment)
        template_path = "documents/shared_payment_refund_receipt.html"
    elif document_instance.template_key == "shared.damage_loss_excess_invoice.v1":
        # Fetch the excess receivable linked to this document instance
        excess_receivable = (
            InventoryDamageLossExcessReceivable.objects.select_related(
                "settlement_execution__settlement__return_operation__reservation_draft__customer"
            )
            .filter(settlement_execution__settlement__document_instance=document_instance)
            .first()
        )

        if excess_receivable is None:
            raise DocumentRuntimeGenerationError(
                "Excess receivable document is not linked to an excess receivable source.",
                code="EXCESS_RECEIVABLE_DOCUMENT_NOT_LINKED",
            )

        # Build context for excess receivable invoice
        context = build_excess_receivable_invoice_context(excess_receivable=excess_receivable)
        template_path = "documents/shared_damage_loss_excess_invoice.html"
    else:
        context = build_reservation_draft_commercial_document_context(
            reservation_draft=document_instance.reservation_draft,
            template_key=document_instance.template_key,
        )
        template_path = context.template.template_path

    if document_instance.template_key == "titan.proforma.v1":
        template_path = "documents/titan_proforma.html"
    elif document_instance.template_key == "titan.material_contract.v1":
        template_path = "documents/titan_material_contract.html"
    elif document_instance.template_key == "titan.delivery_note.v1":
        template_path = "documents/titan_delivery_note.html"
    elif document_instance.template_key == "shared.return_note.v1":
        template_path = "documents/shared_return_note.html"

    html_content = render_to_string(template_path, {"context": context})

    if not html_content or not html_content.strip():
        raise DocumentRuntimeGenerationError(
            "Generated document HTML content is empty or invalid.",
            code="empty_generated_html_content",
        )

    checksum = calculate_document_html_checksum(html_content)
    if not checksum or len(checksum) != 64:
        raise DocumentRuntimeGenerationError(
            "Calculated checksum is invalid.",
            code="invalid_calculated_checksum",
        )

    size_bytes = len(html_content.encode("utf-8"))
    if size_bytes <= 0:
        raise DocumentRuntimeGenerationError(
            "Generated content size must be positive.",
            code="invalid_generated_content_size",
        )

    storage_path = store_document_html_artifact(document_instance, html_content, checksum)
    if not storage_path or ".." in storage_path or storage_path.startswith("/"):
        raise DocumentRuntimeGenerationError(
            f"Unsafe or invalid storage path resolved: {storage_path}",
            code="unsafe_storage_path",
        )

    document_instance.status = DocumentInstanceStatus.GENERATED
    document_instance.content_checksum = checksum
    document_instance.generated_content_size_bytes = size_bytes
    document_instance.storage_path = storage_path
    document_instance.save(
        update_fields=[
            "status",
            "content_checksum",
            "generated_content_size_bytes",
            "storage_path",
            "updated_at",
        ]
    )

    return DocumentGenerationResult(
        document_instance=document_instance,
        html_content=html_content,
        content_checksum=checksum,
    )
