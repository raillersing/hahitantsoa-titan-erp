from datetime import timedelta

import pytest
from django.db.models import QuerySet
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.inventory.selectors import get_available_inventory_items_for_period

pytestmark = pytest.mark.django_db

ALLOWED_ITEM_KINDS = {"material", "article", "material_pack"}
DISALLOWED_TITAN_VALUES = {"venue", "local", "room", "service", "event_service"}


def _request_period():
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
    start_at,
    end_at,
    status: InventoryAvailabilityStatus = InventoryAvailabilityStatus.BLOCKED,
    is_deleted: bool = False,
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
        is_deleted=is_deleted,
        deleted_at=timezone.now() if is_deleted else None,
    )


def test_get_available_inventory_items_for_period_returns_queryset() -> None:
    start_at, end_at = _request_period()

    available_items = get_available_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert isinstance(available_items, QuerySet)


def test_selector_returns_active_not_deleted_items_without_conflicts() -> None:
    start_at, end_at = _request_period()
    available_item = _create_inventory_item(name="Projector")
    _create_inventory_item(name="Inactive projector", is_active=False)
    _create_inventory_item(name="Deleted projector", is_deleted=True)

    available_items = get_available_inventory_items_for_period(
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
def test_selector_excludes_items_with_overlapping_blocked_or_reserved_period(
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _request_period()
    available_item = _create_inventory_item(name="Available speaker")
    unavailable_item = _create_inventory_item(name="Unavailable speaker")
    _create_availability(
        inventory_item=unavailable_item,
        status=status,
        start_at=start_at + timedelta(minutes=15),
        end_at=end_at - timedelta(minutes=15),
    )

    available_items = get_available_inventory_items_for_period(
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
def test_selector_does_not_exclude_item_with_soft_deleted_blocked_or_reserved_period(
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _request_period()
    item = _create_inventory_item(name="Soft-deleted conflict item")
    _create_availability(
        inventory_item=item,
        status=status,
        start_at=start_at,
        end_at=end_at,
        is_deleted=True,
    )

    available_items = get_available_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert list(available_items) == [item]


def test_selector_uses_half_open_intervals_for_adjacent_periods() -> None:
    start_at, end_at = _request_period()
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

    available_items = get_available_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert list(available_items) == [ending_at_start, starting_at_end]


def test_selector_does_not_exclude_item_for_another_item_conflict() -> None:
    start_at, end_at = _request_period()
    requested_item = _create_inventory_item(name="Camera")
    other_item = _create_inventory_item(name="Other camera")
    _create_availability(
        inventory_item=other_item,
        start_at=start_at,
        end_at=end_at,
    )

    available_items = get_available_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    )

    assert list(available_items) == [requested_item]


def test_selector_returns_only_titan_allowed_kinds() -> None:
    start_at, end_at = _request_period()
    for kind in ALLOWED_ITEM_KINDS:
        _create_inventory_item(name=f"{kind} item", kind=kind)

    available_kinds = set(
        get_available_inventory_items_for_period(
            start_at=start_at,
            end_at=end_at,
        ).values_list("kind", flat=True)
    )

    assert available_kinds == ALLOWED_ITEM_KINDS
    assert available_kinds.isdisjoint(DISALLOWED_TITAN_VALUES)


def test_selector_rejects_invalid_period() -> None:
    start_at = timezone.now()

    with pytest.raises(ValueError) as error:
        get_available_inventory_items_for_period(
            start_at=start_at,
            end_at=start_at,
        )

    assert str(error.value) == "end_at must be greater than start_at"
