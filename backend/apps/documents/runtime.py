from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.template.loader import render_to_string

from apps.documents.commercial import (
    CommercialDocumentCustomerContactPointContext,
    build_reservation_draft_commercial_document_context,
)
from apps.documents.excess_receivable import build_excess_receivable_invoice_context
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.payment_receipts import build_payment_receipt_context
from apps.documents.rendering import resolve_document_template_path


class DocumentRuntimeGenerationError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


PAYMENT_RECEIPT_PAYMENT_NOT_FOUND = "payment_receipt_payment_not_found"
HAHITANTSOA_EVENT_DRAFT_PREVIEW_TEMPLATE_KEYS = frozenset(
    {
        "hahitantsoa.proforma.v1",
        "hahitantsoa.contract.v1",
        "hahitantsoa.liability_release.v1",
    }
)
TITAN_RESERVATION_DRAFT_PREVIEW_TEMPLATE_KEYS = frozenset(
    {
        "titan.proforma.v1",
        "titan.material_contract.v1",
        "titan.delivery_note.v1",
        "titan.invoice.v1",
        "titan.breakage_repair_invoice.v1",
    }
)


_FRENCH_UNITS = (
    "zéro",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
)
_FRENCH_TENS = {
    20: "vingt",
    30: "trente",
    40: "quarante",
    50: "cinquante",
    60: "soixante",
}


def _french_number_words(value: int) -> str:
    """Render a non-negative integer in French for official document totals."""
    if value < 0:
        raise ValueError("French number words only supports non-negative values.")
    if value < 17:
        return _FRENCH_UNITS[value]
    if value < 20:
        return f"dix-{_FRENCH_UNITS[value - 10]}"
    if value < 70:
        tens, remainder = divmod(value, 10)
        prefix = _FRENCH_TENS[tens * 10]
        if remainder == 0:
            return prefix
        if remainder == 1:
            return f"{prefix} et un"
        return f"{prefix}-{_french_number_words(remainder)}"
    if value < 80:
        remainder = value - 60
        if remainder == 11:
            return "soixante et onze"
        return f"soixante-{_french_number_words(remainder)}"
    if value < 100:
        remainder = value - 80
        if remainder == 0:
            return "quatre-vingts"
        return f"quatre-vingt-{_french_number_words(remainder)}"
    if value < 1000:
        hundreds, remainder = divmod(value, 100)
        prefix = "cent" if hundreds == 1 else f"{_french_number_words(hundreds)} cent"
        if remainder == 0:
            return f"{prefix}s" if hundreds > 1 else prefix
        return f"{prefix} {_french_number_words(remainder)}"

    for scale, singular in ((1_000_000_000, "milliard"), (1_000_000, "million"), (1000, "mille")):
        if value >= scale:
            quantity, remainder = divmod(value, scale)
            if scale == 1000:
                quantity_words = _french_number_words(quantity)
                if quantity_words.endswith("cents"):
                    quantity_words = quantity_words[:-1]
                prefix = singular if quantity == 1 else f"{quantity_words} {singular}"
            else:
                suffix = singular if quantity == 1 else f"{singular}s"
                prefix = f"{_french_number_words(quantity)} {suffix}"
            return prefix if remainder == 0 else f"{prefix} {_french_number_words(remainder)}"
    raise ValueError("French number words supports values below one trillion.")


def format_ariary_amount_in_words(value: object) -> str:
    """Return the exact Ariary amount in French words without losing a fraction."""
    try:
        amount = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("Document total amount must be a valid decimal value.") from exc
    if amount < 0:
        raise ValueError("Document total amount cannot be negative.")

    whole_amount = int(amount)
    hundredths = int((amount - whole_amount) * 100)
    words = f"{_french_number_words(whole_amount)} Ariary"
    if hundredths:
        words = f"{words} et {_french_number_words(hundredths)} centièmes d'Ariary"
    return words[:1].upper() + words[1:]


def _format_ariary_amount(value: object) -> str:
    return f"{Decimal(str(value)):,.2f}".replace(",", " ").replace(".", ",")


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


def _document_contact_displays(*, document_instance: DocumentInstance) -> tuple[str, str]:
    """Return all snapshotted phones and emails for approved document rendering."""
    contact_points = tuple(
        contact_point
        for contact_point in document_instance.customer_contact_points_snapshot
        if contact_point.get("kind") in {"email", "phone"} and contact_point.get("value")
    )

    def values_for(kind: str, legacy_value: str) -> str:
        values = [
            str(contact_point["value"])
            for contact_point in contact_points
            if contact_point["kind"] == kind
        ]
        if legacy_value and legacy_value not in values:
            values.append(legacy_value)
        return " · ".join(values)

    return (
        values_for("phone", document_instance.customer_phone),
        values_for("email", document_instance.customer_email),
    )


def _build_hahitantsoa_contract_runtime_context(
    *, document_instance: DocumentInstance
) -> dict[str, object]:
    event_lines = (
        document_instance.hahitantsoa_event_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item", "event_draft__customer")
        .order_by("created_at", "id")
    )
    linked_event_draft = document_instance.hahitantsoa_event_draft
    lines = tuple(
        {
            "inventory_item_name": line.inventory_item.name,
            "inventory_item_kind": line.inventory_item.kind,
            "quantity": line.quantity,
            "notes": (
                line.notes
                if line.notes and line.notes.strip() != line.inventory_item.name.strip()
                else ""
            ),
            "unit_price": _format_ariary_amount(line.unit_rental_price),
            "total_price": _format_ariary_amount(line.unit_rental_price * line.quantity),
            "breakage_price": (
                _format_ariary_amount(line.inventory_item.breakage_price)
                if getattr(line.inventory_item, "breakage_price", None)
                else None
            ),
        }
        for line in event_lines
    )
    if linked_event_draft.rental_type == "bare" and not lines:
        lines = (
            {
                "inventory_item_name": "Location nue de l'espace",
                "inventory_item_kind": "venue",
                "quantity": 1,
                "notes": linked_event_draft.venue_name,
                "unit_price": _format_ariary_amount(linked_event_draft.space_rental_amount),
                "total_price": _format_ariary_amount(linked_event_draft.space_rental_amount),
                "breakage_price": None,
            },
        )
    customer_phone_contacts, customer_email_contacts = _document_contact_displays(
        document_instance=document_instance
    )
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
            "customer_display_name": document_instance.customer_display_name,
            "customer_email": document_instance.customer_email,
            "customer_phone": document_instance.customer_phone,
            "customer_phone_contacts": customer_phone_contacts,
            "customer_email_contacts": customer_email_contacts,
            "customer_contacts": " · ".join(
                value for value in (customer_phone_contacts, customer_email_contacts) if value
            ),
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
            "total_amount": linked_event_draft.total_amount,
            "sub_total": _format_ariary_amount(linked_event_draft.total_amount),
            "discount": "0,00",
            "total_amount_in_words": format_ariary_amount_in_words(linked_event_draft.total_amount),
            "proforma_reference": linked_event_draft.public_reference,
            "lines": lines,
        },
    }


def preview_hahitantsoa_event_draft_document_html(*, event_draft, template_key: str) -> str:
    """Render an official Hahitantsoa document with live draft data without persisting it."""
    if template_key not in HAHITANTSOA_EVENT_DRAFT_PREVIEW_TEMPLATE_KEYS:
        raise DocumentRuntimeGenerationError(
            "This Hahitantsoa document is not available for a draft preview.",
            code="hahitantsoa_document_preview_template_not_supported",
        )

    # Import lazily: services imports this runtime module for persisted generation.
    from apps.documents.services import hahitantsoa_event_draft_document_instance_kwargs

    preview_instance = DocumentInstance(
        **hahitantsoa_event_draft_document_instance_kwargs(
            event_draft=event_draft,
            template_key=template_key,
            actor_id=None,
            notes="",
        )
    )
    context = _build_hahitantsoa_contract_runtime_context(document_instance=preview_instance)
    template_path = resolve_document_template_path(template_key)
    if template_path is None:
        raise DocumentRuntimeGenerationError(
            "The approved Hahitantsoa document template could not be resolved.",
            code="hahitantsoa_document_preview_template_not_found",
        )

    html_content = render_to_string(
        template_path,
        {
            "context": context,
            "bank": {
                "name": preview_instance.bank_name,
                "branch": preview_instance.bank_branch,
                "account_holder": preview_instance.bank_account_holder,
                "account_number": preview_instance.bank_account_number,
                "rib": preview_instance.bank_rib,
                "iban": preview_instance.bank_iban,
                "swift_bic": preview_instance.bank_swift_bic,
            },
            "document": {
                "date": preview_instance.document_date,
                "reference": preview_instance.document_reference,
                "proforma_reference": event_draft.public_reference + "-PF",
            },
        },
    )
    if not html_content or not html_content.strip():
        raise DocumentRuntimeGenerationError(
            "Preview document HTML content is empty or invalid.",
            code="empty_hahitantsoa_document_preview_html",
        )
    return html_content


def preview_reservation_draft_document_html(*, reservation_draft, template_key: str) -> str:
    """Render an official Titan document with live draft data without persisting it."""
    if template_key not in TITAN_RESERVATION_DRAFT_PREVIEW_TEMPLATE_KEYS:
        raise DocumentRuntimeGenerationError(
            "This Titan document is not available for a draft preview.",
            code="titan_document_preview_template_not_supported",
        )

    from apps.documents.services import (
        build_reservation_draft_commercial_document_context,
        commercial_document_context_to_document_instance_kwargs,
    )

    context = build_reservation_draft_commercial_document_context(
        reservation_draft=reservation_draft,
        template_key=template_key,
    )
    preview_instance = DocumentInstance(
        **commercial_document_context_to_document_instance_kwargs(
            reservation_draft=reservation_draft,
            context=context,
            actor_id=None,
            notes="",
        )
    )
    preview_instance.reservation_draft = reservation_draft
    runtime_context = _reservation_document_context(document_instance=preview_instance)
    template_path = resolve_document_template_path(template_key)
    if template_path is None:
        template_path = context.template.template_path

    bank = {
        "name": preview_instance.bank_name,
        "branch": preview_instance.bank_branch,
        "account_holder": preview_instance.bank_account_holder,
        "account_number": preview_instance.bank_account_number,
        "rib": preview_instance.bank_rib,
        "iban": preview_instance.bank_iban,
        "swift_bic": preview_instance.bank_swift_bic,
    }
    render_context = {
        "context": runtime_context,
        "bank": bank,
        "document": {
            "date": preview_instance.document_date,
            "reference": preview_instance.document_reference or reservation_draft.public_reference,
            "proforma_reference": reservation_draft.public_reference + "-PF",
        },
    }
    html_content = render_to_string(template_path, render_context)
    if not html_content or not html_content.strip():
        raise DocumentRuntimeGenerationError(
            "Preview document HTML content is empty or invalid.",
            code="empty_titan_document_preview_html",
        )
    return html_content


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
    force: bool = False,
) -> DocumentGenerationResult:
    if document_instance.template_key == "hahitantsoa.house_rules.v1":
        raise DocumentRuntimeGenerationError(
            "The Hahitantsoa house rules are not generated as a document template.",
            code="house_rules_document_generation_disabled",
        )
    if not force and document_instance.status != DocumentInstanceStatus.PREPARED:
        raise DocumentRuntimeGenerationError(
            f"Cannot generate document from status: {document_instance.status}",
            code="invalid_document_status_for_generation",
        )

    if document_instance.template_key in {
        "titan.payment_receipt.v1",
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
        "document": {
            "date": document_instance.document_date,
            "reference": document_instance.document_reference,
            "proforma_reference": (
                document_instance.document_reference.rsplit("-", 1)[0] + "-PF"
                if document_instance.document_reference
                else document_instance.reservation_public_reference
            ),
        },
    }
    # ponytail: the registry owns the single approved renderer for each workflow document.
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

    if document_instance.status == DocumentInstanceStatus.PREPARED:
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
