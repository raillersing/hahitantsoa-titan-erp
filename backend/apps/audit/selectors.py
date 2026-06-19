from __future__ import annotations

from apps.audit.models import AuditEvent


def audit_events_queryset():
    return AuditEvent.objects.select_related("actor").order_by("-created_at", "-id")


def filter_audit_events(
    *,
    action: str | None = None,
    target_type: str | None = None,
    actor_id: str | None = None,
):
    qs = audit_events_queryset()
    if action:
        qs = qs.filter(action=action)
    if target_type:
        qs = qs.filter(target_type=target_type)
    if actor_id:
        qs = qs.filter(actor_id=actor_id)
    return qs
