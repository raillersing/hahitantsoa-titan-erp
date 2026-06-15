from dataclasses import dataclass
from datetime import datetime

from apps.hahitantsoa.selectors import _get_available_hahitantsoa_shared_inventory_items_for_period
from apps.inventory.models import InventoryItem
from apps.reservations.periods import ReservationPeriod, make_reservation_period


@dataclass(frozen=True)
class HahitantsoaSharedAvailabilityItemPreview:
    inventory_item: InventoryItem
    period: ReservationPeriod
    status: str


def get_hahitantsoa_shared_availability_item_previews(
    *,
    start_at: datetime,
    end_at: datetime,
) -> tuple[HahitantsoaSharedAvailabilityItemPreview, ...]:
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    items = tuple(
        _get_available_hahitantsoa_shared_inventory_items_for_period(
            start_at=period.start_at,
            end_at=period.end_at,
        )
    )
    return tuple(
        HahitantsoaSharedAvailabilityItemPreview(
            inventory_item=item,
            period=period,
            status="available",
        )
        for item in items
    )
