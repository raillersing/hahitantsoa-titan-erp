from django.db import models
from django.db.models import QuerySet

from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.reservations.models import ReservationDraft


def list_document_instances_for_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
) -> QuerySet[DocumentInstance]:
    return DocumentInstance.objects.filter(reservation_draft=reservation_draft).order_by(
        "created_at",
        "id",
    )


def list_active_document_instances_for_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
) -> QuerySet[DocumentInstance]:
    return list_document_instances_for_reservation_draft(
        reservation_draft=reservation_draft,
    ).exclude(status=DocumentInstanceStatus.VOIDED)


def list_document_instances_for_hahitantsoa_event_draft(
    *,
    hahitantsoa_event_draft: HahitantsoaEventDraft,
) -> QuerySet[DocumentInstance]:
    return DocumentInstance.objects.filter(
        hahitantsoa_event_draft=hahitantsoa_event_draft
    ).order_by("created_at", "id")


def list_active_document_instances_for_hahitantsoa_event_draft(
    *,
    hahitantsoa_event_draft: HahitantsoaEventDraft,
) -> QuerySet[DocumentInstance]:
    return list_document_instances_for_hahitantsoa_event_draft(
        hahitantsoa_event_draft=hahitantsoa_event_draft,
    ).exclude(status=DocumentInstanceStatus.VOIDED)


def list_all_document_instances(
    *,
    document_type: str | None = None,
    business_scope: str | None = None,
    status: str | None = None,
    customer_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    ordering: str = "-created_at",
) -> QuerySet[DocumentInstance]:
    """Return a globally filtered queryset of document instances for the hub."""
    qs = DocumentInstance.objects.all()

    if document_type:
        qs = qs.filter(document_type=document_type)
    if business_scope:
        qs = qs.filter(business_scope=business_scope)
    if status:
        qs = qs.filter(status=status)
    if customer_id:
        qs = qs.filter(customer_id=customer_id)
    if date_from:
        qs = qs.filter(created_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(created_at__date__lte=date_to)
    if search:
        qs = qs.filter(
            customer_display_name__icontains=search
            | models.Q(reservation_public_reference__icontains=search)
        )

    return qs.order_by(ordering, "id")


def get_document_instance_by_id(
    *,
    document_instance_id,
) -> DocumentInstance | None:
    return (
        DocumentInstance.objects.filter(id=document_instance_id)
        .select_related(
            "reservation_draft",
            "hahitantsoa_event_draft",
            "customer",
            "prepared_by",
            "voided_by",
        )
        .first()
    )


def list_generated_document_instances_for_reservation_draft(
    *,
    reservation_draft: ReservationDraft,
) -> QuerySet[DocumentInstance]:
    return list_document_instances_for_reservation_draft(
        reservation_draft=reservation_draft,
    ).filter(status=DocumentInstanceStatus.GENERATED)
