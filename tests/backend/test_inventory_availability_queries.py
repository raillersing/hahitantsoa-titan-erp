from datetime import timedelta

import pytest
from django.db.models import QuerySet
from django.utils import timezone

from apps.inventory.availability import (
    get_inventory_availability_conflicts,
    is_inventory_item_available,
    validate_availability_period,
)
from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)

pytestmark = pytest.mark.django_db

ALLOWED_ITEM_KINDS = {"material", "article", "material_pack"}
DISALLOWED_TITAN_VALUES = {"venue", "local", "room", "service", "event_service"}


def _request_period():
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


def _create_inventory_item(name: str = "Camera", kind: str = "material") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _create_availability(
    *,
    inventory_item: InventoryItem,
    start_at,
    end_at,
    status: InventoryAvailabilityStatus = InventoryAvailabilityStatus.BLOCKED,
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )


def test_get_inventory_availability_conflicts_returns_empty_queryset_without_periods() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()

    conflicts = get_inventory_availability_conflicts(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
    )

    assert isinstance(conflicts, QuerySet)
    assert list(conflicts) == []


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_overlapping_blocked_or_reserved_period_makes_item_unavailable(
    status: InventoryAvailabilityStatus,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    availability = _create_availability(
        inventory_item=item,
        status=status,
        start_at=start_at + timedelta(minutes=15),
        end_at=end_at - timedelta(minutes=15),
    )

    conflicts = get_inventory_availability_conflicts(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
    )

    assert list(conflicts) == [availability]
    assert (
        is_inventory_item_available(
            inventory_item=item,
            start_at=start_at,
            end_at=end_at,
        )
        is False
    )


def test_period_ending_exactly_at_request_start_does_not_conflict() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    _create_availability(
        inventory_item=item,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at,
    )

    assert (
        is_inventory_item_available(
            inventory_item=item,
            start_at=start_at,
            end_at=end_at,
        )
        is True
    )


def test_period_starting_exactly_at_request_end_does_not_conflict() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    _create_availability(
        inventory_item=item,
        start_at=end_at,
        end_at=end_at + timedelta(hours=1),
    )

    assert (
        is_inventory_item_available(
            inventory_item=item,
            start_at=start_at,
            end_at=end_at,
        )
        is True
    )


def test_period_overlapping_request_start_conflicts() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    availability = _create_availability(
        inventory_item=item,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at + timedelta(minutes=30),
    )

    conflicts = get_inventory_availability_conflicts(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
    )

    assert list(conflicts) == [availability]


def test_period_overlapping_request_end_conflicts() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    availability = _create_availability(
        inventory_item=item,
        start_at=end_at - timedelta(minutes=30),
        end_at=end_at + timedelta(hours=1),
    )

    conflicts = get_inventory_availability_conflicts(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
    )

    assert list(conflicts) == [availability]


def test_period_containing_requested_period_conflicts() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    availability = _create_availability(
        inventory_item=item,
        start_at=start_at - timedelta(hours=1),
        end_at=end_at + timedelta(hours=1),
    )

    conflicts = get_inventory_availability_conflicts(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
    )

    assert list(conflicts) == [availability]


def test_requested_period_containing_existing_period_conflicts() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    availability = _create_availability(
        inventory_item=item,
        start_at=start_at + timedelta(minutes=30),
        end_at=end_at - timedelta(minutes=30),
    )

    conflicts = get_inventory_availability_conflicts(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
    )

    assert list(conflicts) == [availability]


def test_other_inventory_item_period_does_not_conflict() -> None:
    requested_item = _create_inventory_item(name="Camera")
    other_item = _create_inventory_item(name="Speaker")
    start_at, end_at = _request_period()
    _create_availability(
        inventory_item=other_item,
        start_at=start_at,
        end_at=end_at,
    )

    conflicts = get_inventory_availability_conflicts(
        inventory_item=requested_item,
        start_at=start_at,
        end_at=end_at,
    )

    assert list(conflicts) == []
    assert (
        is_inventory_item_available(
            inventory_item=requested_item,
            start_at=start_at,
            end_at=end_at,
        )
        is True
    )


def test_is_inventory_item_available_returns_true_without_conflict() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()

    assert (
        is_inventory_item_available(
            inventory_item=item,
            start_at=start_at,
            end_at=end_at,
        )
        is True
    )


def test_is_inventory_item_available_returns_false_with_conflict() -> None:
    item = _create_inventory_item()
    start_at, end_at = _request_period()
    _create_availability(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
    )

    assert (
        is_inventory_item_available(
            inventory_item=item,
            start_at=start_at,
            end_at=end_at,
        )
        is False
    )


def test_validate_availability_period_rejects_equal_period_bounds() -> None:
    start_at = timezone.now()

    with pytest.raises(ValueError) as error:
        validate_availability_period(start_at=start_at, end_at=start_at)

    assert str(error.value) == "end_at must be greater than start_at"


def test_validate_availability_period_rejects_end_before_start() -> None:
    start_at = timezone.now()
    end_at = start_at - timedelta(minutes=1)

    with pytest.raises(ValueError) as error:
        validate_availability_period(start_at=start_at, end_at=end_at)

    assert str(error.value) == "end_at must be greater than start_at"


def test_availability_queries_use_only_allowed_titan_item_kinds() -> None:
    start_at, end_at = _request_period()
    for kind in ALLOWED_ITEM_KINDS:
        item = _create_inventory_item(name=f"{kind} item", kind=kind)
        _create_availability(
            inventory_item=item,
            start_at=start_at,
            end_at=end_at,
        )

    persisted_kinds = set(
        InventoryAvailability.objects.values_list("inventory_item__kind", flat=True)
    )

    assert persisted_kinds == ALLOWED_ITEM_KINDS
    assert persisted_kinds.isdisjoint(DISALLOWED_TITAN_VALUES)
