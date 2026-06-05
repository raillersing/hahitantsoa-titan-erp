from datetime import datetime, timedelta

import pytest
from django.apps import apps
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations.preview import ReservationItemPreviewStatus
from apps.reservations.services import (
    get_reservation_available_item_previews_service,
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
) -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _create_availability(
    *,
    inventory_item: InventoryItem,
    start_at: datetime,
    end_at: datetime,
    status: InventoryAvailabilityStatus,
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )


def _reservations_model_counts() -> dict[str, int]:
    return {
        model._meta.label: model.objects.count()
        for model in apps.get_models()
        if model._meta.app_label == "reservations"
    }


def test_available_items_options_service_rejects_naive_start_at() -> None:
    _, end_at = _valid_period_bounds()
    naive_start_at = datetime(2026, 1, 1, 10, 0, 0)

    with pytest.raises(ValueError) as error:
        get_reservation_available_items_options_service(
            start_at=naive_start_at,
            end_at=end_at,
        )

    assert str(error.value) == "Reservation period start_at must be timezone-aware."


def test_available_items_options_service_rejects_naive_end_at() -> None:
    start_at, _ = _valid_period_bounds()
    naive_end_at = datetime(2026, 1, 1, 12, 0, 0)

    with pytest.raises(ValueError) as error:
        get_reservation_available_items_options_service(
            start_at=start_at,
            end_at=naive_end_at,
        )

    assert str(error.value) == "Reservation period end_at must be timezone-aware."


def test_available_items_options_service_rejects_equal_period_bounds() -> None:
    start_at, _ = _valid_period_bounds()

    with pytest.raises(ValueError) as error:
        get_reservation_available_items_options_service(
            start_at=start_at,
            end_at=start_at,
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_available_items_options_service_rejects_end_at_before_start_at() -> None:
    start_at, _ = _valid_period_bounds()

    with pytest.raises(ValueError) as error:
        get_reservation_available_items_options_service(
            start_at=start_at,
            end_at=start_at - timedelta(minutes=1),
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_available_items_options_service_excludes_overlapping_conflicts(
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    available_item = _create_inventory_item(name="Available camera")
    unavailable_item = _create_inventory_item(name="Unavailable camera")
    _create_availability(
        inventory_item=unavailable_item,
        status=status,
        start_at=start_at + timedelta(minutes=15),
        end_at=end_at - timedelta(minutes=15),
    )

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (available_item,)
    assert unavailable_item not in options.items


def test_available_items_options_service_keeps_item_when_conflict_ends_at_start() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Camera available after previous period")
    _create_availability(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at,
    )

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (item,)
    assert options.count == 1


def test_available_items_options_service_keeps_item_when_conflict_starts_at_end() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Camera available before next period")
    _create_availability(
        inventory_item=item,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=end_at,
        end_at=end_at + timedelta(hours=1),
    )

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (item,)
    assert options.count == 1


def test_available_item_previews_service_respects_half_open_time_rules() -> None:
    start_at, end_at = _valid_period_bounds()
    ending_at_start = _create_inventory_item(name="Ending at start")
    starting_at_end = _create_inventory_item(name="Starting at end")
    overlapping = _create_inventory_item(name="Unavailable inside period")
    _create_availability(
        inventory_item=ending_at_start,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at,
    )
    _create_availability(
        inventory_item=starting_at_end,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=end_at,
        end_at=end_at + timedelta(hours=1),
    )
    _create_availability(
        inventory_item=overlapping,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at,
        end_at=end_at,
    )

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert tuple(preview.inventory_item for preview in previews) == (
        ending_at_start,
        starting_at_end,
    )
    assert all(preview.status == ReservationItemPreviewStatus.AVAILABLE for preview in previews)
    assert overlapping not in tuple(preview.inventory_item for preview in previews)


def test_available_reservation_services_do_not_create_availability_or_reservations() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available speaker")
    availability_count = InventoryAvailability.objects.count()
    reservation_counts = _reservations_model_counts()

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (item,)
    assert tuple(preview.inventory_item for preview in previews) == (item,)
    assert InventoryAvailability.objects.count() == availability_count
    assert _reservations_model_counts() == reservation_counts
