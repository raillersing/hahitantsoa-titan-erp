from dataclasses import dataclass
from datetime import datetime

from apps.inventory.models import InventoryItem
from apps.reservations.periods import ReservationPeriod, make_reservation_period
from apps.reservations.preview import (
    ReservationItemPreview,
    preview_reservation_item_request,
)
from apps.reservations.selectors import (
    get_available_reservation_inventory_items_for_period,
)


@dataclass(frozen=True)
class ReservationAvailableItemsOptions:
    period: ReservationPeriod
    items: tuple[InventoryItem, ...]
    count: int


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


def get_reservation_available_items_options_service(
    *,
    start_at: datetime,
    end_at: datetime,
) -> ReservationAvailableItemsOptions:
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    items = tuple(
        get_available_reservation_inventory_items_for_period(
            start_at=period.start_at,
            end_at=period.end_at,
        )
    )

    return ReservationAvailableItemsOptions(
        period=period,
        items=items,
        count=len(items),
    )
