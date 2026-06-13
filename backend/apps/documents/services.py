from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from apps.documents.commercial import build_reservation_draft_commercial_document_context
from apps.documents.models import DocumentInstance
from apps.reservations.models import ReservationDraft


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
        reservation_draft=reservation_draft,
        customer=reservation_draft.customer,
        template_key=context.template.key,
        template_version=context.template.version,
        template_label=context.template.label,
        business_scope=context.template.business_scope,
        document_type=context.template.document_type,
        template_status=context.template.status,
        template_source_kind=context.template.source_kind,
        template_source_reference=context.template.source_reference,
        template_path=context.template.template_path,
        template_preview_path=context.template.preview_path,
        template_validated_by_client=context.template.validated_by_client,
        template_notes=context.template.notes,
        reservation_public_reference=context.reservation_draft.public_reference,
        reservation_status=context.reservation_draft.status,
        customer_display_name=context.reservation_draft.customer.display_name,
        customer_email=context.reservation_draft.customer.email,
        customer_phone=context.reservation_draft.customer.phone,
        customer_address=context.reservation_draft.customer.address,
        status="prepared",
        prepared_at=timezone.now(),
        prepared_by_id=actor_id,
        notes=notes,
    )
