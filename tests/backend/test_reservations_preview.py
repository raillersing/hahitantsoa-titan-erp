from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations.availability import INVENTORY_ITEM_UNAVAILABLE_ERROR
from apps.reservations.preview import (
    ReservationItemPreview,
    ReservationItemPreviewStatus,
    preview_reservation_item_request,
)

pytestmark = pytest.mark.django_db


def _valid_period_bounds() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


def _create_inventory_item(
    *,
    name: str = "Camera",
    kind: str = "material",
) -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


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


@pytest.mark.parametrize(
    "inventory_item_kind",
    [
        "material",
        "article",
        "material_pack",
    ],
)
def test_preview_reservation_item_request_returns_available_preview(
    inventory_item_kind: str,
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item(kind=inventory_item_kind)
    start_at, end_at = _valid_period_bounds()

    with django_assert_num_queries(1):
        preview = preview_reservation_item_request(
            inventory_item=item,
            inventory_item_kind=inventory_item_kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert isinstance(preview, ReservationItemPreview)
    assert preview.inventory_item == item
    assert preview.inventory_item_kind == inventory_item_kind
    assert preview.start_at == start_at
    assert preview.end_at == end_at
    assert preview.period is not None
    assert preview.period.start_at == start_at
    assert preview.period.end_at == end_at
    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert preview.errors == ()
    assert preview.conflicts == ()
    assert preview.inventory_unit_count is None
    assert preview.availability_validation.valid is True
    assert preview.availability_validation.available is True


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_preview_reservation_item_request_returns_unavailable_preview(
    status: InventoryAvailabilityStatus,
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    conflict = _create_availability(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
        status=status,
    )

    with django_assert_num_queries(1):
        preview = preview_reservation_item_request(
            inventory_item=item,
            inventory_item_kind=item.kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert preview.status == ReservationItemPreviewStatus.UNAVAILABLE
    assert preview.errors == (INVENTORY_ITEM_UNAVAILABLE_ERROR,)
    assert preview.conflicts == (conflict,)
    assert preview.inventory_unit_count is None
    assert preview.period is not None
    assert preview.availability_validation.valid is True
    assert preview.availability_validation.available is False


@pytest.mark.parametrize(
    "inventory_item_kind",
    [
        "venue",
        "local",
        "room",
        "service",
        "event_service",
        "unknown",
        "",
    ],
)
def test_preview_reservation_item_request_returns_invalid_preview_for_non_reservable_kind(
    inventory_item_kind: str,
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()

    with django_assert_num_queries(0):
        preview = preview_reservation_item_request(
            inventory_item=item,
            inventory_item_kind=inventory_item_kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert preview.status == ReservationItemPreviewStatus.INVALID
    assert preview.period is None
    assert preview.conflicts == ()
    assert preview.inventory_unit_count is None
    assert preview.availability_validation.valid is False
    assert preview.availability_validation.available is False
    assert preview.errors == (
        f"Inventory item kind '{inventory_item_kind}' is not reservable in Titan.",
    )


@pytest.mark.parametrize(
    ("start_at", "end_at", "expected_error"),
    [
        (
            datetime(2026, 1, 1, 10, 0, 0),
            timezone.now().replace(microsecond=0) + timedelta(hours=2),
            "Reservation period start_at must be timezone-aware.",
        ),
        (
            timezone.now().replace(microsecond=0),
            datetime(2026, 1, 1, 12, 0, 0),
            "Reservation period end_at must be timezone-aware.",
        ),
    ],
)
def test_preview_reservation_item_request_returns_invalid_preview_for_naive_bounds(
    start_at: datetime,
    end_at: datetime,
    expected_error: str,
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item()

    with django_assert_num_queries(0):
        preview = preview_reservation_item_request(
            inventory_item=item,
            inventory_item_kind=item.kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert preview.status == ReservationItemPreviewStatus.INVALID
    assert preview.period is None
    assert preview.conflicts == ()
    assert preview.errors == (expected_error,)


@pytest.mark.parametrize("delta", [timedelta(), -timedelta(minutes=1)])
def test_preview_reservation_item_request_returns_invalid_preview_for_invalid_period(
    delta: timedelta,
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item()
    start_at, _ = _valid_period_bounds()
    end_at = start_at + delta

    with django_assert_num_queries(0):
        preview = preview_reservation_item_request(
            inventory_item=item,
            inventory_item_kind=item.kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert preview.status == ReservationItemPreviewStatus.INVALID
    assert preview.period is None
    assert preview.conflicts == ()
    assert preview.errors == ("Reservation period end_at must be after start_at.",)


def test_preview_reservation_item_request_uses_half_open_periods() -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    _create_availability(
        inventory_item=item,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at,
    )
    _create_availability(
        inventory_item=item,
        start_at=end_at,
        end_at=end_at + timedelta(hours=1),
    )

    preview = preview_reservation_item_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert preview.errors == ()
    assert preview.conflicts == ()


def test_preview_reservation_item_request_ignores_other_item_conflicts() -> None:
    item = _create_inventory_item(name="Camera")
    other_item = _create_inventory_item(name="Speaker")
    start_at, end_at = _valid_period_bounds()
    _create_availability(
        inventory_item=other_item,
        start_at=start_at,
        end_at=end_at,
    )

    preview = preview_reservation_item_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert preview.errors == ()
    assert preview.conflicts == ()


def test_preview_reservation_item_request_does_not_create_availability_periods() -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    before_count = InventoryAvailability.objects.count()

    preview = preview_reservation_item_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert InventoryAvailability.objects.count() == before_count


def test_reservation_item_preview_is_immutable() -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    preview = preview_reservation_item_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    with pytest.raises(FrozenInstanceError):
        preview.status = ReservationItemPreviewStatus.INVALID
