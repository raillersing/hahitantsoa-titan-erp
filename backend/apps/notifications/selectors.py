from django.db.models import Q

from apps.identity.authorization import (
    is_inventory_management_actor,
    is_support_management_actor,
)
from apps.notifications.models import BugReport, NotificationType, SystemNotification


def visible_notifications(*, actor):
    notifications = SystemNotification.objects.filter(
        Q(recipient__isnull=True) | Q(recipient=actor)
    )
    notifications = notifications.filter(
        Q(stock_alert__isnull=True) | Q(stock_alert__resolved_at__isnull=True)
    )
    if not is_inventory_management_actor(actor=actor):
        notifications = notifications.exclude(notification_type=NotificationType.STOCK)
    return notifications


def visible_bug_reports(*, actor: object | None):
    """Return bug reports visible to the actor.

    Per Decision D03:
    - Global view is open to owner_manager and technical administrators.
    - Regular users see only their own bug reports.
    - Unauthenticated actors see none.
    """
    queryset = BugReport.objects.select_related("reporter")
    if is_support_management_actor(actor=actor):
        return queryset
    if actor is None or not getattr(actor, "is_authenticated", False):
        return queryset.none()
    return queryset.filter(reporter=actor)
