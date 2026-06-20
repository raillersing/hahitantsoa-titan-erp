from __future__ import annotations

from apps.audit.models import AuditEvent


def audit_events_queryset():
    return AuditEvent.objects.select_related("actor").order_by("-created_at", "-id")


def filter_audit_events(
    *,
    action: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    actor_id: str | None = None,
    created_after: str | None = None,
    created_before: str | None = None,
):
    qs = audit_events_queryset()
    if action:
        qs = qs.filter(action=action)
    if target_type:
        qs = qs.filter(target_type=target_type)
    if target_id:
        qs = qs.filter(target_id=target_id)
    if actor_id:
        qs = qs.filter(actor_id=actor_id)
    if created_after:
        qs = qs.filter(created_at__gte=created_after)
    if created_before:
        qs = qs.filter(created_at__lte=created_before)
    return qs
