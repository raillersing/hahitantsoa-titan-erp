from django.db.models import Count, Max, Prefetch, Q

from .models import Customer, CustomerContactPoint


def active_customers():
    dossier_counts = {}
    for field, filters in (
        ("current_dossier_count", {"status": "confirmed", "closeout_record__isnull": True}),
        ("closed_dossier_count", {"closeout_record__status": "closed"}),
        ("draft_dossier_count", {"status": "draft"}),
        ("cancelled_dossier_count", {"status": "cancelled"}),
    ):
        # ponytail: distinct counts reuse both existing customer relations without per-row queries.
        counts = []
        for relation in ("reservation_drafts", "hahitantsoa_event_drafts"):
            conditions = {f"{relation}__is_deleted": False}
            conditions.update({f"{relation}__{key}": value for key, value in filters.items()})
            counts.append(Count(relation, filter=Q(**conditions), distinct=True))
        dossier_counts[field] = counts[0] + counts[1]
    return (
        Customer.objects.filter(is_active=True, is_deleted=False)
        .annotate(
            **dossier_counts,
            reservation_count=Count(
                "reservation_drafts",
                filter=Q(reservation_drafts__is_deleted=False),
                distinct=True,
            ),
            event_count=Count(
                "hahitantsoa_event_drafts",
                filter=Q(hahitantsoa_event_drafts__is_deleted=False),
                distinct=True,
            ),
            document_count=Count("document_instances", distinct=True),
            last_reservation_at=Max(
                "reservation_drafts__updated_at",
            ),
            last_event_at=Max("hahitantsoa_event_drafts__updated_at"),
            last_document_at=Max("document_instances__updated_at"),
        )
        .prefetch_related(Prefetch("contact_points", queryset=CustomerContactPoint.objects.all()))
        .order_by("display_name")
    )
