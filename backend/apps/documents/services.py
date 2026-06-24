from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.documents.commercial import (
    CommercialDocumentContext,
    CommercialDocumentContextError,
    build_reservation_draft_commercial_document_context,
)
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.documents.pdf import (
    DocumentPDFGenerationError,
    build_pdf_artifact_storage_path,
    calculate_pdf_checksum,
    get_pdf_generator,
)
from apps.documents.runtime import generate_document_instance_html
from apps.documents.selectors import get_document_instance_by_id
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft

TITAN_PROFORMA_TEMPLATE_KEY = "titan.proforma.v1"
HAHITANTSOA_CONTRACT_TEMPLATE_KEY = "hahitantsoa.contract.v1"
SUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEYS = (
    "titan.proforma.v1",
    "titan.delivery_note.v1",
    "titan.material_contract.v1",
    "titan.material_amendment.v1",
    "titan.invoice.v1",
    "shared.return_note.v1",
)
SUPPORTED_HAHITANTSOA_EVENT_DRAFT_DOCUMENT_TEMPLATE_KEYS = (HAHITANTSOA_CONTRACT_TEMPLATE_KEY,)
UNSUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEY = (
    "unsupported_reservation_draft_document_template_key"
)


def get_supported_reservation_draft_document_template_keys() -> tuple[str, ...]:
    return SUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEYS


def validate_supported_reservation_draft_document_template_key(template_key: str) -> None:
    if template_key in SUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEYS:
        return

    raise CommercialDocumentContextError(
        f"Unsupported reservation draft document template key: {template_key}",
        code=UNSUPPORTED_RESERVATION_DRAFT_DOCUMENT_TEMPLATE_KEY,
    )


def validate_supported_hahitantsoa_event_draft_document_template_key(template_key: str) -> None:
    if template_key in SUPPORTED_HAHITANTSOA_EVENT_DRAFT_DOCUMENT_TEMPLATE_KEYS:
        return

    raise CommercialDocumentContextError(
        f"Unsupported Hahitantsoa event draft document template key: {template_key}",
        code="unsupported_hahitantsoa_event_draft_document_template_key",
    )


def active_reservation_drafts_for_commercial_document_context():
    return (
        ReservationDraft.objects.filter(is_deleted=False)
        .select_related("customer")
        .prefetch_related("lines__inventory_item")
        .order_by("-created_at", "public_reference")
    )


def get_reservation_draft_commercial_document_context_service(
    *,
    reservation_draft_id,
    template_key: str,
) -> CommercialDocumentContext:
    reservation_draft = (
        active_reservation_drafts_for_commercial_document_context()
        .filter(id=reservation_draft_id)
        .first()
    )
    if reservation_draft is None:
        raise ReservationDraft.DoesNotExist

    return build_reservation_draft_commercial_document_context(
        reservation_draft=reservation_draft,
        template_key=template_key,
    )


def commercial_document_context_to_titan_proforma_preview_payload(
    *,
    context: CommercialDocumentContext,
) -> dict[str, object]:
    return {
        "document_type": context.template.document_type,
        "business_scope": context.template.business_scope,
        "template_key": context.template.key,
        "template": {
            "key": context.template.key,
            "business_scope": context.template.business_scope,
            "document_type": context.template.document_type,
            "label": context.template.label,
            "version": context.template.version,
            "status": context.template.status,
            "source_kind": context.template.source_kind,
            "source_reference": context.template.source_reference,
            "template_path": context.template.template_path,
            "preview_path": context.template.preview_path,
            "validated_by_client": context.template.validated_by_client,
            "notes": context.template.notes,
        },
        "reservation_draft": {
            "id": context.reservation_draft.reservation_draft_id,
            "public_reference": context.reservation_draft.public_reference,
            "status": context.reservation_draft.status,
            "customer_id": context.reservation_draft.customer.customer_id,
            "customer_display_name": context.reservation_draft.customer.display_name,
            "start_at": context.reservation_draft.start_at,
            "end_at": context.reservation_draft.end_at,
            "notes": context.reservation_draft.notes,
            "lines": [
                {
                    "id": line.reservation_draft_line_id,
                    "inventory_item_id": line.inventory_item_id,
                    "inventory_item_name": line.inventory_item_name,
                    "inventory_item_kind": line.inventory_item_kind,
                    "quantity": line.quantity,
                    "notes": line.notes,
                }
                for line in context.reservation_draft.lines
            ],
            "created_at": context.reservation_draft.created_at,
            "updated_at": context.reservation_draft.updated_at,
        },
        "scope_flags": {
            "pdf_runtime_generated": context.runtime_scope_flags.pdf_runtime_generated,
            "reservation_confirmed": False,
            "inventory_blocked": context.runtime_scope_flags.inventory_blocked,
            "payment_created": context.runtime_scope_flags.payment_created,
            "invoice_created": context.runtime_scope_flags.invoice_created,
            "contract_created": context.runtime_scope_flags.contract_created,
        },
    }


def get_titan_proforma_draft_preview_payload_service(
    *,
    reservation_draft_id,
) -> dict[str, object]:
    context = get_reservation_draft_commercial_document_context_service(
        reservation_draft_id=reservation_draft_id,
        template_key=TITAN_PROFORMA_TEMPLATE_KEY,
    )
    return commercial_document_context_to_titan_proforma_preview_payload(context=context)


def commercial_document_context_to_document_instance_kwargs(
    *,
    reservation_draft: ReservationDraft,
    context: CommercialDocumentContext,
    actor_id: object | None,
    notes: str,
) -> dict[str, object]:
    return {
        "reservation_draft": reservation_draft,
        "customer": reservation_draft.customer,
        "template_key": context.template.key,
        "template_version": context.template.version,
        "template_label": context.template.label,
        "business_scope": context.template.business_scope,
        "document_type": context.template.document_type,
        "template_status": context.template.status,
        "template_source_kind": context.template.source_kind,
        "template_source_reference": context.template.source_reference,
        "template_path": context.template.template_path,
        "template_preview_path": context.template.preview_path,
        "template_validated_by_client": context.template.validated_by_client,
        "template_notes": context.template.notes,
        "reservation_public_reference": context.reservation_draft.public_reference,
        "reservation_status": context.reservation_draft.status,
        "customer_display_name": context.reservation_draft.customer.display_name,
        "customer_email": context.reservation_draft.customer.email,
        "customer_phone": context.reservation_draft.customer.phone,
        "customer_address": context.reservation_draft.customer.address,
        "status": "prepared",
        "prepared_at": timezone.now(),
        "prepared_by_id": actor_id,
        "notes": notes,
    }


def hahitantsoa_event_draft_document_instance_kwargs(
    *,
    event_draft: HahitantsoaEventDraft,
    template_key: str,
    actor_id: object | None,
    notes: str,
) -> dict[str, object]:
    from apps.documents.registry import get_document_template_definition

    template_definition = get_document_template_definition(template_key)
    if template_definition is None:
        raise CommercialDocumentContextError(
            f"Unknown commercial document template key: {template_key}",
            code="unknown_commercial_document_template_key",
        )

    return {
        "hahitantsoa_event_draft": event_draft,
        "customer": event_draft.customer,
        "template_key": template_definition.key,
        "template_version": template_definition.version,
        "template_label": template_definition.label,
        "business_scope": template_definition.business_scope,
        "document_type": template_definition.document_type,
        "template_status": template_definition.status,
        "template_source_kind": template_definition.source_kind,
        "template_source_reference": template_definition.source_reference,
        "template_path": template_definition.template_path,
        "template_preview_path": template_definition.preview_path,
        "template_validated_by_client": template_definition.validated_by_client,
        "template_notes": template_definition.notes,
        "reservation_public_reference": event_draft.public_reference,
        "reservation_status": event_draft.status,
        "customer_display_name": event_draft.customer.display_name,
        "customer_email": event_draft.customer.email,
        "customer_phone": event_draft.customer.phone,
        "customer_address": event_draft.customer.address,
        "status": "prepared",
        "prepared_at": timezone.now(),
        "prepared_by_id": actor_id,
        "notes": notes,
    }


@transaction.atomic
def create_document_instance_from_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
    template_key: str,
    actor: object | None = None,
    notes: str = "",
) -> DocumentInstance:
    context = build_reservation_draft_commercial_document_context(
        reservation_draft=reservation_draft,
        template_key=template_key,
    )
    validate_supported_reservation_draft_document_template_key(template_key)
    actor_id = getattr(actor, "pk", None)

    instance = DocumentInstance.objects.create(
        **commercial_document_context_to_document_instance_kwargs(
            reservation_draft=reservation_draft,
            context=context,
            actor_id=actor_id,
            notes=notes,
        )
    )
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_prepared",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "reservation_draft_id": str(reservation_draft.id),
            "template_key": template_key,
            "status": instance.status,
        },
    )
    return instance


def get_reservation_draft_document_instance_or_404(
    *,
    reservation_draft: ReservationDraft,
    document_instance_id,
) -> DocumentInstance:
    instance = get_document_instance_by_id(document_instance_id=document_instance_id)
    if instance is None or instance.reservation_draft_id != reservation_draft.id:
        raise DocumentInstance.DoesNotExist
    return instance


@transaction.atomic
def create_document_instance_from_hahitantsoa_event_draft(
    *,
    event_draft: HahitantsoaEventDraft,
    template_key: str,
    actor: object | None = None,
    notes: str = "",
) -> DocumentInstance:
    validate_supported_hahitantsoa_event_draft_document_template_key(template_key)
    actor_id = getattr(actor, "pk", None)
    instance = DocumentInstance.objects.create(
        **hahitantsoa_event_draft_document_instance_kwargs(
            event_draft=event_draft,
            template_key=template_key,
            actor_id=actor_id,
            notes=notes,
        )
    )
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_prepared",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "hahitantsoa_event_draft_id": str(event_draft.id),
            "template_key": template_key,
            "status": instance.status,
        },
    )
    return instance


def get_hahitantsoa_event_draft_document_instance_or_404(
    *,
    event_draft: HahitantsoaEventDraft,
    document_instance_id,
) -> DocumentInstance:
    instance = get_document_instance_by_id(document_instance_id=document_instance_id)
    if instance is None or instance.hahitantsoa_event_draft_id != event_draft.id:
        raise DocumentInstance.DoesNotExist
    return instance


@transaction.atomic
def generate_reservation_draft_document_instance_html(
    *,
    reservation_draft: ReservationDraft,
    document_instance_id,
    actor: object | None = None,
) -> DocumentInstance:
    instance = get_reservation_draft_document_instance_or_404(
        reservation_draft=reservation_draft,
        document_instance_id=document_instance_id,
    )
    result = generate_document_instance_html(document_instance=instance, actor=actor)
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_generated",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "reservation_draft_id": str(reservation_draft.id),
            "template_key": instance.template_key,
            "status": instance.status,
            "content_checksum": result.content_checksum,
        },
    )
    return result.document_instance


@transaction.atomic
def generate_hahitantsoa_event_draft_document_instance_html(
    *,
    event_draft: HahitantsoaEventDraft,
    document_instance_id,
    actor: object | None = None,
) -> DocumentInstance:
    instance = get_hahitantsoa_event_draft_document_instance_or_404(
        event_draft=event_draft,
        document_instance_id=document_instance_id,
    )
    result = generate_document_instance_html(document_instance=instance, actor=actor)
    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_generated",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "hahitantsoa_event_draft_id": str(event_draft.id),
            "template_key": instance.template_key,
            "status": instance.status,
            "content_checksum": result.content_checksum,
        },
    )
    return result.document_instance


@transaction.atomic
def generate_document_instance_pdf(
    *,
    document_instance: DocumentInstance,
    actor: object | None = None,
) -> DocumentInstance:
    """Generate a PDF artifact from an already-generated HTML document instance.

    Requires the document instance to be in ``GENERATED`` status and to have
    a stored HTML artifact. The resulting PDF is written to default storage
    and the instance is updated with PDF metadata.
    """
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage

    if document_instance.status != DocumentInstanceStatus.GENERATED:
        raise DocumentPDFGenerationError(
            f"Cannot generate PDF from document status: {document_instance.status}",
            code="invalid_document_status_for_pdf_generation",
        )

    if not document_instance.storage_path:
        raise DocumentPDFGenerationError(
            "Document instance has no stored HTML artifact.",
            code="document_html_artifact_missing",
        )

    # Read existing HTML content from storage
    if not default_storage.exists(document_instance.storage_path):
        raise DocumentPDFGenerationError(
            "Stored HTML artifact does not exist.",
            code="document_html_artifact_not_found",
        )

    html_content = default_storage.open(document_instance.storage_path).read().decode("utf-8")
    if not html_content or not html_content.strip():
        raise DocumentPDFGenerationError(
            "Stored HTML content is empty.",
            code="document_html_content_empty",
        )

    # Generate PDF via configured generator
    generator = get_pdf_generator()
    pdf_bytes = generator.generate_pdf(html_content)
    if not pdf_bytes:
        raise DocumentPDFGenerationError(
            "PDF generator returned empty content.",
            code="pdf_generator_empty_output",
        )

    checksum = calculate_pdf_checksum(pdf_bytes)
    pdf_path = build_pdf_artifact_storage_path(document_instance, checksum)

    # Validate path safety before saving
    if ".." in pdf_path or pdf_path.startswith("/"):
        raise DocumentPDFGenerationError(
            f"Unsafe PDF storage path resolved: {pdf_path}",
            code="unsafe_pdf_storage_path",
        )

    default_storage.save(pdf_path, ContentFile(pdf_bytes))

    document_instance.pdf_storage_path = pdf_path
    document_instance.pdf_generated_at = timezone.now()
    document_instance.pdf_content_checksum = checksum
    document_instance.save(
        update_fields=[
            "pdf_storage_path",
            "pdf_generated_at",
            "pdf_content_checksum",
            "updated_at",
        ]
    )

    record_audit_event_on_commit(
        actor=actor,
        action="document.instance_pdf_generated",
        target_type="document_instance",
        target_id=str(document_instance.id),
        metadata={
            "template_key": document_instance.template_key,
            "pdf_storage_path": pdf_path,
            "pdf_content_checksum": checksum,
        },
    )
    return document_instance
