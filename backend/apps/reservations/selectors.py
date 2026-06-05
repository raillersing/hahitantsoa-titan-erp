from datetime import datetime

from django.db.models import QuerySet

from apps.inventory.models import InventoryItem
from apps.inventory.selectors import get_available_inventory_items_for_period
from apps.reservations.periods import make_reservation_period


def get_available_reservation_inventory_items_for_period(
    *,
    start_at: datetime,
    end_at: datetime,
) -> QuerySet[InventoryItem]:
    period = make_reservation_period(start_at=start_at, end_at=end_at)

    return get_available_inventory_items_for_period(
        start_at=period.start_at,
        end_at=period.end_at,
    )
