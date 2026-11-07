from django.db.models import Q

from apps.identity.authorization import is_inventory_management_actor
from apps.notifications.models import NotificationType, SystemNotification


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
