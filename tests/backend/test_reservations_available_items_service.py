from datetime import datetime, timedelta
from typing import Any

import pytest
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations import services as reservation_services
from apps.reservations.services import (
    ReservationAvailableItemsOptions,
    get_reservation_available_items_options_service,
)

pytestmark = pytest.mark.django_db


def _valid_period_bounds() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


def _create_inventory_item(
    *,
    name: str,
    kind: str = "material",
    is_active: bool = True,
    is_deleted: bool = False,
) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        is_active=is_active,
        is_deleted=is_deleted,
        deleted_at=timezone.now() if is_deleted else None,
    )


def _create_availability(
    *,
    inventory_item: InventoryItem,
    start_at: datetime,
    end_at: datetime,
    status: InventoryAvailabilityStatus = InventoryAvailabilityStatus.BLOCKED,
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )


def test_available_items_options_service_returns_structured_options() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available camera")

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert isinstance(options, ReservationAvailableItemsOptions)
    assert options.period.start_at == start_at
    assert options.period.end_at == end_at
    assert options.items == (item,)
    assert options.count == 1


def test_available_items_options_service_returns_available_items_for_valid_period() -> None:
    start_at, end_at = _valid_period_bounds()
    first_item = _create_inventory_item(name="Available camera")
    second_item = _create_inventory_item(name="Available projector", kind="article")
    _create_inventory_item(name="Inactive speaker", is_active=False)
    _create_inventory_item(name="Deleted stand", is_deleted=True)

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (first_item, second_item)
    assert options.count == 2


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_available_items_options_service_excludes_blocked_or_reserved_conflicts(
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    available_item = _create_inventory_item(name="Available microphone")
    unavailable_item = _create_inventory_item(name="Unavailable microphone")
    _create_availability(
        inventory_item=unavailable_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (available_item,)
    assert options.count == 1


def test_available_items_options_service_respects_half_open_intervals() -> None:
    start_at, end_at = _valid_period_bounds()
    ending_at_start = _create_inventory_item(name="Ending at start")
    starting_at_end = _create_inventory_item(name="Starting at end")
    _create_availability(
        inventory_item=ending_at_start,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at,
    )
    _create_availability(
        inventory_item=starting_at_end,
        start_at=end_at,
        end_at=end_at + timedelta(hours=1),
    )

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (ending_at_start, starting_at_end)
    assert options.count == 2


def test_available_items_options_service_rejects_invalid_period() -> None:
    start_at = timezone.now()

    with pytest.raises(ValueError) as error:
        get_reservation_available_items_options_service(
            start_at=start_at,
            end_at=start_at,
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_available_items_options_service_does_not_create_availability_periods() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available lighting")
    availability_count = InventoryAvailability.objects.count()

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.count == 1
    assert InventoryAvailability.objects.count() == availability_count


def test_available_items_options_service_delegates_to_reservations_selector(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_at, end_at = _valid_period_bounds()
    first_item = InventoryItem(name="Unsaved camera", kind="material")
    second_item = InventoryItem(name="Unsaved projector", kind="article")
    calls: list[dict[str, Any]] = []

    def fake_get_available_reservation_inventory_items_for_period(
        **kwargs: Any,
    ) -> list[InventoryItem]:
        calls.append(kwargs)
        return [first_item, second_item]

    monkeypatch.setattr(
        reservation_services,
        "get_available_reservation_inventory_items_for_period",
        fake_get_available_reservation_inventory_items_for_period,
    )

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (first_item, second_item)
    assert isinstance(options.items, tuple)
    assert options.count == 2
    assert calls == [
        {
            "start_at": start_at,
            "end_at": end_at,
        }
    ]
