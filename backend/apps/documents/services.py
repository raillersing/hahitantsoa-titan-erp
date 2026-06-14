from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.documents.commercial import (
    CommercialDocumentContext,
    build_reservation_draft_commercial_document_context,
)
from apps.documents.models import DocumentInstance
from apps.reservations.models import ReservationDraft

TITAN_PROFORMA_TEMPLATE_KEY = "titan.proforma.v1"


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
    actor_id = getattr(actor, "pk", None)

    return DocumentInstance.objects.create(
        **commercial_document_context_to_document_instance_kwargs(
            reservation_draft=reservation_draft,
            context=context,
            actor_id=actor_id,
            notes=notes,
        )
    )
