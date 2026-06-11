from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.reservations.availability import (
    INVENTORY_ITEM_UNAVAILABLE_ERROR,
    ReservationItemAvailabilityDetails,
    ReservationItemAvailabilityValidation,
    validate_reservation_item_availability_request,
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


@pytest.mark.parametrize(
    "inventory_item_kind",
    [
        "material",
        "article",
        "material_pack",
    ],
)
def test_validate_reservation_item_availability_request_accepts_available_allowed_kind(
    inventory_item_kind: str,
) -> None:
    item = _create_inventory_item(kind=inventory_item_kind)
    start_at, end_at = _valid_period_bounds()

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation.valid is True
    assert validation.available is True
    assert validation.errors == ()
    assert validation.inventory_unit_count is None
    assert isinstance(validation.details, ReservationItemAvailabilityDetails)
    assert validation.details.item_validation.inventory_item_kind == inventory_item_kind
    assert validation.details.item_validation.period.start_at == start_at
    assert validation.details.item_validation.period.end_at == end_at
    assert validation.details.conflicts == ()


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_validate_reservation_item_availability_request_reports_conflicts(
    status: InventoryAvailabilityStatus,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    conflict = _create_availability(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
        status=status,
    )

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation.valid is True
    assert validation.available is False
    assert validation.errors == (INVENTORY_ITEM_UNAVAILABLE_ERROR,)
    assert validation.inventory_unit_count is None
    assert validation.details is not None
    assert validation.details.conflicts == (conflict,)


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_validate_reservation_item_availability_request_ignores_soft_deleted_conflicts(
    status: InventoryAvailabilityStatus,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    _create_availability(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
        status=status,
        is_deleted=True,
    )

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation.valid is True
    assert validation.available is True
    assert validation.errors == ()
    assert validation.inventory_unit_count is None
    assert validation.details is not None
    assert validation.details.conflicts == ()


def test_validate_reservation_item_availability_request_uses_half_open_periods() -> None:
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

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation.valid is True
    assert validation.available is True
    assert validation.errors == ()
    assert validation.details is not None
    assert validation.details.conflicts == ()


def test_validate_reservation_item_availability_request_ignores_other_item_conflicts() -> None:
    item = _create_inventory_item(name="Camera")
    other_item = _create_inventory_item(name="Speaker")
    start_at, end_at = _valid_period_bounds()
    _create_availability(
        inventory_item=other_item,
        start_at=start_at,
        end_at=end_at,
    )

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation.valid is True
    assert validation.available is True
    assert validation.errors == ()
    assert validation.details is not None
    assert validation.details.conflicts == ()


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
def test_validate_reservation_item_availability_request_rejects_non_reservable_kinds(
    inventory_item_kind: str,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation == ReservationItemAvailabilityValidation(
        valid=False,
        available=False,
        errors=(f"Inventory item kind '{inventory_item_kind}' is not reservable in Titan.",),
        inventory_unit_count=None,
    )


def test_validate_reservation_item_availability_request_rejects_naive_start_at() -> None:
    item = _create_inventory_item()
    _, end_at = _valid_period_bounds()
    naive_start_at = datetime(2026, 1, 1, 10, 0, 0)

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=naive_start_at,
        end_at=end_at,
    )

    assert validation.valid is False
    assert validation.available is False
    assert validation.errors == ("Reservation period start_at must be timezone-aware.",)
    assert validation.inventory_unit_count is None
    assert validation.details is None


def test_validate_reservation_item_availability_request_rejects_naive_end_at() -> None:
    item = _create_inventory_item()
    start_at, _ = _valid_period_bounds()
    naive_end_at = datetime(2026, 1, 1, 12, 0, 0)

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=naive_end_at,
    )

    assert validation.valid is False
    assert validation.available is False
    assert validation.errors == ("Reservation period end_at must be timezone-aware.",)
    assert validation.inventory_unit_count is None
    assert validation.details is None


@pytest.mark.parametrize("delta", [timedelta(), -timedelta(minutes=1)])
def test_validate_reservation_item_availability_request_rejects_invalid_period_bounds(
    delta: timedelta,
) -> None:
    item = _create_inventory_item()
    start_at, _ = _valid_period_bounds()
    end_at = start_at + delta

    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert validation.valid is False
    assert validation.available is False
    assert validation.errors == ("Reservation period end_at must be after start_at.",)
    assert validation.inventory_unit_count is None
    assert validation.details is None


def test_validate_reservation_item_availability_request_does_not_query_conflicts_when_invalid(
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()

    with django_assert_num_queries(0):
        validation = validate_reservation_item_availability_request(
            inventory_item=item,
            inventory_item_kind="venue",
            start_at=start_at,
            end_at=end_at,
        )

    assert validation.valid is False
    assert validation.available is False
    assert validation.details is None


def test_validate_reservation_item_availability_request_does_not_create_reservation() -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()

    validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert InventoryAvailability.objects.count() == 0


def test_reservation_item_availability_result_is_immutable() -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    validation = validate_reservation_item_availability_request(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    with pytest.raises(FrozenInstanceError):
        validation.valid = False
