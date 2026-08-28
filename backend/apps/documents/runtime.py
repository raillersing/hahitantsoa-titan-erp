from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.template import Context, Template
from django.template.loader import render_to_string

from apps.documents.commercial import (
    CommercialDocumentCustomerContactPointContext,
    build_reservation_draft_commercial_document_context,
)
from apps.documents.excess_receivable import build_excess_receivable_invoice_context
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.payment_receipts import build_payment_receipt_context
from apps.documents.registry import get_active_database_template_version
from apps.documents.rendering import resolve_document_template_path


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


def _reservation_document_context(*, document_instance: DocumentInstance):
    context = build_reservation_draft_commercial_document_context(
        reservation_draft=document_instance.reservation_draft,
        template_key=document_instance.template_key,
    )
    contact_points = tuple(
        CommercialDocumentCustomerContactPointContext(
            kind=contact_point.get("kind", ""),
            value=contact_point.get("value", ""),
            label=contact_point.get("label", ""),
        )
        for contact_point in document_instance.customer_contact_points_snapshot
        if contact_point.get("kind") in {"email", "phone"} and contact_point.get("value")
    )
    if not contact_points:
        contact_points = tuple(
            CommercialDocumentCustomerContactPointContext(kind=kind, value=value, label="")
            for kind, value in (
                ("phone", document_instance.customer_phone),
                ("email", document_instance.customer_email),
            )
            if value
        )
    customer = replace(
        context.reservation_draft.customer,
        display_name=document_instance.customer_display_name,
        party_type=document_instance.customer_party_type,
        email=document_instance.customer_email,
        phone=document_instance.customer_phone,
        contact_points=contact_points,
        address=document_instance.customer_address,
        civilite=document_instance.customer_civilite,
        birth_date=document_instance.customer_birth_date,
        birth_place=document_instance.customer_birth_place,
        id_type=document_instance.customer_id_type,
        id_number=document_instance.customer_id_number,
        id_issue_date=document_instance.customer_id_issue_date,
        id_issue_place=document_instance.customer_id_issue_place,
        id_duplicata_date=document_instance.customer_id_duplicata_date,
        id_duplicata_place=document_instance.customer_id_duplicata_place,
        nif=document_instance.customer_nif,
        stat=document_instance.customer_stat,
        rcs=document_instance.customer_rcs,
        representative_name=document_instance.customer_representative_name,
        representative_role=document_instance.customer_representative_role,
    )
    return replace(
        context,
        reservation_draft=replace(context.reservation_draft, customer=customer),
    )


def _build_hahitantsoa_contract_runtime_context(
    *, document_instance: DocumentInstance
) -> dict[str, object]:
    event_draft = (
        document_instance.hahitantsoa_event_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item", "event_draft__customer")
        .order_by("created_at", "id")
    )
    linked_event_draft = document_instance.hahitantsoa_event_draft
    return {
        "template": {
            "label": document_instance.template_label,
            "key": document_instance.template_key,
        },
        "event_draft": {
            "customer_id": document_instance.customer_id,
            "public_reference": linked_event_draft.public_reference,
            "party_type": document_instance.customer_party_type,
            "event_name": linked_event_draft.event_name,
            "event_type": linked_event_draft.event_type,
            "venue_name": linked_event_draft.venue_name,
            "location_details": linked_event_draft.location_details,
            "service_notes": linked_event_draft.service_notes,
            "start_at": linked_event_draft.start_at,
            "end_at": linked_event_draft.end_at,
            "notes": linked_event_draft.notes,
            "customer_display_name": linked_event_draft.customer.display_name,
            "customer_email": document_instance.customer_email,
            "customer_phone": document_instance.customer_phone,
            "customer_address": document_instance.customer_address,
            "customer_civilite": document_instance.customer_civilite,
            "customer_birth_date": document_instance.customer_birth_date,
            "customer_birth_place": document_instance.customer_birth_place,
            "customer_id_type": document_instance.customer_id_type,
            "customer_id_number": document_instance.customer_id_number,
            "customer_id_issue_date": document_instance.customer_id_issue_date,
            "customer_id_issue_place": document_instance.customer_id_issue_place,
            "customer_id_duplicata_date": document_instance.customer_id_duplicata_date,
            "customer_id_duplicata_place": document_instance.customer_id_duplicata_place,
            "customer_nif": document_instance.customer_nif,
            "customer_stat": document_instance.customer_stat,
            "customer_rcs": document_instance.customer_rcs,
            "customer_representative_name": document_instance.customer_representative_name,
            "customer_representative_role": document_instance.customer_representative_role,
            "rental_type": linked_event_draft.rental_type,
            "rental_type_display": linked_event_draft.get_rental_type_display(),
            "guest_count": linked_event_draft.guest_count,
            "required_deposit_amount": linked_event_draft.required_deposit_amount,
            "space_rental_amount": linked_event_draft.space_rental_amount,
            "proforma_reference": linked_event_draft.public_reference,
            "lines": tuple(
                {
                    "inventory_item_name": line.inventory_item.name,
                    "inventory_item_kind": line.inventory_item.kind,
                    "quantity": line.quantity,
                    "notes": line.notes,
                    "breakage_price": (
                        f"{line.inventory_item.breakage_price:,.2f}".replace(",", " ").replace(
                            ".", ","
                        )
                        if getattr(line.inventory_item, "breakage_price", None)
                        else None
                    ),
                }
                for line in event_draft
            ),
        },
    }


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
    if document_instance.template_key == "hahitantsoa.house_rules.v1":
        raise DocumentRuntimeGenerationError(
            "The Hahitantsoa house rules are not generated as a document template.",
            code="house_rules_document_generation_disabled",
        )
    if document_instance.status != DocumentInstanceStatus.PREPARED:
        raise DocumentRuntimeGenerationError(
            f"Cannot generate document from status: {document_instance.status}",
            code="invalid_document_status_for_generation",
        )

    if document_instance.template_key in {
        "titan.payment_receipt.v1",
        "shared.payment_receipt.v1",
        "hahitantsoa.payment_receipt.v1",
    }:
        from apps.payments.models import Payment

        payment = (
            Payment.objects.select_related(
                "reservation_draft",
                "reservation_draft__customer",
                "hahitantsoa_event_draft",
                "hahitantsoa_event_draft__customer",
            )
            .filter(receipt_document=document_instance)
            .first()
        )
        if payment is None:
            raise DocumentRuntimeGenerationError(
                "Payment receipt document is not linked to a payment source.",
                code=PAYMENT_RECEIPT_PAYMENT_NOT_FOUND,
            )
        context = build_payment_receipt_context(
            payment=payment, template_key=document_instance.template_key
        )
        template_path = (
            "documents/hahitantsoa_payment_receipt.html"
            if document_instance.template_key == "hahitantsoa.payment_receipt.v1"
            else "documents/titan_payment_receipt.html"
            if document_instance.template_key == "titan.payment_receipt.v1"
            else "documents/shared_payment_receipt.html"
        )
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
        context = build_payment_receipt_context(
            payment=payment, template_key="shared.payment_refund_receipt.v1"
        )
        template_path = "documents/shared_payment_refund_receipt.html"

    elif document_instance.template_key in {
        "hahitantsoa.proforma.v1",
    }:
        if document_instance.hahitantsoa_event_draft is None:
            raise DocumentRuntimeGenerationError(
                "Hahitantsoa document is not linked to an event draft source.",
                code="hahitantsoa_event_draft_not_found",
            )
        context = _build_hahitantsoa_contract_runtime_context(document_instance=document_instance)
        template_path = "documents/hahitantsoa_proforma.html"
    elif document_instance.template_key in {
        "hahitantsoa.contract.v1",
        "hahitantsoa.contract_amendment.v1",
        "hahitantsoa.invoice.v1",
    }:
        if document_instance.hahitantsoa_event_draft is None:
            raise DocumentRuntimeGenerationError(
                "Hahitantsoa document is not linked to an event draft source.",
                code="hahitantsoa_event_draft_not_found",
            )
        context = _build_hahitantsoa_contract_runtime_context(document_instance=document_instance)
        template_path = {
            "hahitantsoa.contract.v1": "documents/hahitantsoa_contract.html",
            "hahitantsoa.contract_amendment.v1": "documents/hahitantsoa_contract_amendment.html",
            "hahitantsoa.invoice.v1": "documents/hahitantsoa_invoice.html",
        }[document_instance.template_key]
    elif document_instance.template_key == "hahitantsoa.liability_release.v1":
        if document_instance.hahitantsoa_event_draft is None:
            raise DocumentRuntimeGenerationError(
                "Hahitantsoa discharge document is not linked to an event draft source.",
                code="hahitantsoa_event_draft_not_found",
            )
        context = _build_hahitantsoa_contract_runtime_context(document_instance=document_instance)
        template_path = "documents/hahitantsoa_liability_release.html"
    elif document_instance.template_key == "hahitantsoa.delivery_note.v1":
        if document_instance.hahitantsoa_event_draft is None:
            raise DocumentRuntimeGenerationError(
                "Hahitantsoa delivery note is not linked to an event draft source.",
                code="hahitantsoa_event_draft_not_found",
            )
        context = _build_hahitantsoa_contract_runtime_context(document_instance=document_instance)
        template_path = "documents/hahitantsoa_delivery_note.html"
    elif document_instance.template_key == "hahitantsoa.preparation_sheet.v1":
        if document_instance.hahitantsoa_event_draft is None:
            raise DocumentRuntimeGenerationError(
                "Hahitantsoa checklist is not linked to an event draft source.",
                code="hahitantsoa_event_draft_not_found",
            )
        context = _build_hahitantsoa_contract_runtime_context(document_instance=document_instance)
        template_path = "documents/hahitantsoa_preparation_sheet.html"
    elif document_instance.template_key == "titan.breakage_repair_invoice.v1":
        if document_instance.reservation_draft is not None:
            context = _reservation_document_context(document_instance=document_instance)
        else:
            from apps.inventory.models import InventoryDamageLossExcessReceivable

            excess_receivable = (
                InventoryDamageLossExcessReceivable.objects.select_related(
                    "settlement_execution__settlement__return_operation__reservation_draft__customer"
                )
                .filter(settlement_execution__settlement__document_instance=document_instance)
                .first()
            )
            if excess_receivable is not None:
                context = build_excess_receivable_invoice_context(
                    excess_receivable=excess_receivable
                )
            else:
                context = _reservation_document_context(document_instance=document_instance)
        template_path = "documents/titan_breakage_repair_invoice.html"
    elif document_instance.template_key == "hahitantsoa.breakage_repair_invoice.v1":
        if document_instance.hahitantsoa_event_draft is not None:
            context = _build_hahitantsoa_contract_runtime_context(
                document_instance=document_instance
            )
        else:
            context = _reservation_document_context(document_instance=document_instance)
        template_path = "documents/hahitantsoa_breakage_repair_invoice.html"
    else:
        context = _reservation_document_context(document_instance=document_instance)
        template_path = context.template.template_path

    canonical_template_path = resolve_document_template_path(document_instance.template_key)
    if canonical_template_path is not None:
        template_path = canonical_template_path

    bank = {
        "name": document_instance.bank_name,
        "branch": document_instance.bank_branch,
        "account_holder": document_instance.bank_account_holder,
        "account_number": document_instance.bank_account_number,
        "rib": document_instance.bank_rib,
        "iban": document_instance.bank_iban,
        "swift_bic": document_instance.bank_swift_bic,
    }
    render_context = {
        "context": context,
        "bank": bank,
        "document": {"date": document_instance.document_date},
    }
    database_version = get_active_database_template_version(document_instance.template_key)
    if database_version is not None:
        html_content = Template(
            f"<style>{database_version.css}</style>"
            f"{database_version.header_html}{database_version.body_html}"
            f"{database_version.footer_html}"
        ).render(Context(render_context))
    else:
        html_content = render_to_string(template_path, render_context)

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
