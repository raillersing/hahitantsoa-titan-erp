from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations.preview import ReservationItemPreviewStatus
from apps.reservations.services import (
    get_reservation_available_items_options_service,
    preview_reservation_item_service,
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


def test_available_item_is_consistent_between_options_and_preview() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available camera")
    availability_count = InventoryAvailability.objects.count()

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert item in options.items
    assert options.count == 1
    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert preview.errors == ()
    assert preview.conflicts == ()
    assert InventoryAvailability.objects.count() == availability_count


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_unavailable_item_is_consistent_between_options_and_preview(
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Unavailable camera")
    conflict = _create_availability(
        inventory_item=item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )
    availability_count = InventoryAvailability.objects.count()

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert item not in options.items
    assert options.count == 0
    assert preview.status == ReservationItemPreviewStatus.UNAVAILABLE
    assert preview.conflicts == (conflict,)
    assert InventoryAvailability.objects.count() == availability_count


def test_forbidden_kind_stays_invalid_in_preview_without_valid_titan_data() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Allowed camera")
    availability_count = InventoryAvailability.objects.count()

    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind="venue",
        start_at=start_at,
        end_at=end_at,
    )

    assert preview.status == ReservationItemPreviewStatus.INVALID
    assert preview.period is None
    assert preview.conflicts == ()
    assert preview.errors == ("Inventory item kind 'venue' is not reservable in Titan.",)
    assert InventoryAvailability.objects.count() == availability_count


def test_invalid_period_is_rejected_by_available_options_service() -> None:
    start_at = timezone.now()

    with pytest.raises(ValueError) as error:
        get_reservation_available_items_options_service(
            start_at=start_at,
            end_at=start_at,
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_services_do_not_create_inventory_availability_or_persistent_reservation() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available speaker")
    availability_count = InventoryAvailability.objects.count()
    inventory_item_count = InventoryItem.objects.count()

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == (item,)
    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert InventoryAvailability.objects.count() == availability_count
    assert InventoryItem.objects.count() == inventory_item_count
