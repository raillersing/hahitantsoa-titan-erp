"""Explicit stock-alert episode writes. Reads never reconcile notifications."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.identity.roles import ROLE_CAPABILITIES
from apps.inventory.models import InventoryItem, InventoryStockAlert
from apps.inventory.stock_selectors import inventory_stock_summaries
from apps.notifications.models import NotificationType, SystemNotification


def stock_alert_recipients():
    slugs = [
        slug
        for slug, capabilities in ROLE_CAPABILITIES.items()
        if "canManageInventory" in capabilities
    ]
    return (
        get_user_model()
        .objects.filter(is_active=True)
        .filter(
            Q(is_staff=True)
            | Q(is_superuser=True)
            | Q(
                role_assignments__is_active=True,
                role_assignments__role__is_active=True,
                role_assignments__role__slug__in=slugs,
            )
        )
        .distinct()
    )


@transaction.atomic
def reconcile_inventory_stock_alerts(*, item_ids=None):
    # All writers serialize per item, with the same deterministic row order.
    items = InventoryItem.objects.select_for_update().order_by("id")
    if item_ids is not None:
        items = items.filter(pk__in=item_ids)
    items = list(items)
    summaries = inventory_stock_summaries(items)
    recipient_ids = set(stock_alert_recipients().values_list("pk", flat=True))
    now = timezone.now()
    active_episodes = list(
        InventoryStockAlert.objects.filter(
            inventory_item_id__in=[item.pk for item in items],
            resolved_at__isnull=True,
        ).select_related("notification")
    )
    episodes = {
        (episode.inventory_item_id, episode.recipient_id): episode for episode in active_episodes
    }
    resolve_ids = []
    for episode in active_episodes:
        if episode.recipient_id not in recipient_ids or summaries[episode.inventory_item_id][
            "physical_status"
        ] not in {"out_of_stock", "low"}:
            resolve_ids.append(episode.pk)
    if resolve_ids:
        InventoryStockAlert.objects.filter(pk__in=resolve_ids).update(resolved_at=now)
    for item in items:
        summary = summaries[item.pk]
        if summary["physical_status"] not in {"out_of_stock", "low"}:
            continue
        severity = "error" if summary["physical_status"] == "out_of_stock" else "warning"
        title = "Stock épuisé" if severity == "error" else "Stock bas"
        for recipient_id in sorted(recipient_ids):
            episode = episodes.get((item.pk, recipient_id))
            values = {
                "title": f"{title} : {item.name}",
                "message": (
                    f"Stock sain présent : {summary['healthy_stock']}. "
                    f"Seuil configuré : {item.low_stock_threshold}."
                ),
                "severity": severity,
                "link": f"#inventory-item/{item.pk}",
            }
            if episode is None:
                notification = SystemNotification.objects.create(
                    recipient_id=recipient_id, notification_type=NotificationType.STOCK, **values
                )
                InventoryStockAlert.objects.create(
                    inventory_item=item, recipient_id=recipient_id, notification=notification
                )
            else:
                notification = episode.notification
                if all(getattr(notification, key) == value for key, value in values.items()):
                    continue
                changed = notification.severity != severity
                for key, value in values.items():
                    setattr(notification, key, value)
                if changed:
                    notification.is_read = False
                notification.save(update_fields=[*values, "is_read", "updated_at"])
    return summaries
