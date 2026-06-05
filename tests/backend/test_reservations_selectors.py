from datetime import datetime, timedelta
from typing import Any

import pytest
from django.db.models import QuerySet
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations import selectors as reservation_selectors
from apps.reservations.selectors import (
    get_available_reservation_inventory_items_for_period,
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


def test_get_available_reservation_inventory_items_for_period_returns_queryset() -> None:
    start_at, end_at = _valid_period_bounds()

    available_items = get_available_reservation_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert isinstance(available_items, QuerySet)


def test_selector_returns_available_items_for_valid_period() -> None:
    start_at, end_at = _valid_period_bounds()
    available_item = _create_inventory_item(name="Available camera")
    _create_inventory_item(name="Inactive camera", is_active=False)
    _create_inventory_item(name="Deleted camera", is_deleted=True)

    available_items = get_available_reservation_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert list(available_items) == [available_item]


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_selector_excludes_items_with_blocked_or_reserved_conflicts(
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    available_item = _create_inventory_item(name="Available speaker")
    unavailable_item = _create_inventory_item(name="Unavailable speaker")
    _create_availability(
        inventory_item=unavailable_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )

    available_items = get_available_reservation_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert list(available_items) == [available_item]


def test_selector_respects_half_open_intervals_by_delegating_to_inventory_selector() -> None:
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

    available_items = get_available_reservation_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert list(available_items) == [ending_at_start, starting_at_end]


def test_selector_rejects_invalid_period_using_reservation_period_validation() -> None:
    start_at = timezone.now()

    with pytest.raises(ValueError) as error:
        get_available_reservation_inventory_items_for_period(
            start_at=start_at,
            end_at=start_at,
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_selector_rejects_naive_period_using_reservation_period_validation() -> None:
    naive_start_at = datetime(2026, 1, 1, 10, 0, 0)
    _, end_at = _valid_period_bounds()

    with pytest.raises(ValueError) as error:
        get_available_reservation_inventory_items_for_period(
            start_at=naive_start_at,
            end_at=end_at,
        )

    assert str(error.value) == "Reservation period start_at must be timezone-aware."


def test_selector_does_not_create_availability_periods_or_reservations() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available projector")
    availability_count = InventoryAvailability.objects.count()

    available_items = get_available_reservation_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert list(available_items)
    assert InventoryAvailability.objects.count() == availability_count


def test_selector_delegates_to_inventory_selector(monkeypatch: pytest.MonkeyPatch) -> None:
    start_at, end_at = _valid_period_bounds()
    sentinel_queryset = object()
    calls: list[dict[str, Any]] = []

    def fake_get_available_inventory_items_for_period(**kwargs: Any) -> object:
        calls.append(kwargs)
        return sentinel_queryset

    monkeypatch.setattr(
        reservation_selectors,
        "get_available_inventory_items_for_period",
        fake_get_available_inventory_items_for_period,
    )

    result = get_available_reservation_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert result is sentinel_queryset
    assert calls == [
        {
            "start_at": start_at,
            "end_at": end_at,
        }
    ]
