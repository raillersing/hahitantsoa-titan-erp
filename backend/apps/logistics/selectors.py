from __future__ import annotations

from apps.logistics.models import LogisticsEvent


def active_logistics_events():
    return (
        LogisticsEvent.objects.exclude(
            status="cancelled",
        )
        .select_related("reservation_draft", "created_by", "updated_by")
        .prefetch_related("item_lines__inventory_item")
    )


def logistics_events_for_reservation_draft(*, reservation_draft_id: str):
    return (
        LogisticsEvent.objects.filter(
            reservation_draft_id=reservation_draft_id,
        )
        .select_related("reservation_draft", "created_by", "updated_by")
        .prefetch_related("item_lines__inventory_item")
    )


def get_logistics_event_item_lines(*, event_id: str):
    from apps.logistics.models import LogisticsEventItemLine

    return (
        LogisticsEventItemLine.objects.filter(
            logistics_event_id=event_id,
        )
        .select_related("inventory_item")
        .order_by("created_at", "id")
    )
