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
