from __future__ import annotations

from apps.logistics.models import LogisticsEvent


def active_logistics_events():
    return LogisticsEvent.objects.exclude(
        status="cancelled",
    ).select_related("reservation_draft", "created_by", "updated_by")


def logistics_events_for_reservation_draft(*, reservation_draft_id: str):
    return LogisticsEvent.objects.filter(
        reservation_draft_id=reservation_draft_id,
    ).select_related("reservation_draft", "created_by", "updated_by")
