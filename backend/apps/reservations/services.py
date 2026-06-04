from datetime import datetime

from apps.inventory.models import InventoryItem
from apps.reservations.preview import (
    ReservationItemPreview,
    preview_reservation_item_request,
)


def preview_reservation_item_service(
    *,
    inventory_item: InventoryItem,
    inventory_item_kind: str,
    start_at: datetime,
    end_at: datetime,
) -> ReservationItemPreview:
    return preview_reservation_item_request(
        inventory_item=inventory_item,
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
    )
