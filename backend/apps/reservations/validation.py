from dataclasses import dataclass
from datetime import datetime

from apps.reservations.periods import ReservationPeriod, make_reservation_period
from apps.reservations.scope import assert_reservable_inventory_item_kind


@dataclass(frozen=True)
class ReservationItemValidation:
    inventory_item_kind: str
    period: ReservationPeriod


def validate_reservation_item_request(
    inventory_item_kind: str,
    start_at: datetime,
    end_at: datetime,
) -> ReservationItemValidation:
    assert_reservable_inventory_item_kind(inventory_item_kind)
    period = make_reservation_period(start_at=start_at, end_at=end_at)

    return ReservationItemValidation(
        inventory_item_kind=inventory_item_kind,
        period=period,
    )
