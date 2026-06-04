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
from apps.reservations.availability import INVENTORY_ITEM_UNAVAILABLE_ERROR
from apps.reservations.preview import ReservationItemPreviewStatus
from apps.reservations.services import preview_reservation_item_service

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
def test_preview_reservation_item_service_returns_available_preview(
    inventory_item_kind: str,
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item(kind=inventory_item_kind)
    start_at, end_at = _valid_period_bounds()

    with django_assert_num_queries(1):
        preview = preview_reservation_item_service(
            inventory_item=item,
            inventory_item_kind=inventory_item_kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert preview.inventory_item == item
    assert preview.inventory_item_kind == inventory_item_kind
    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert preview.errors == ()
    assert preview.conflicts == ()
    assert preview.period is not None
    assert preview.period.start_at == start_at
    assert preview.period.end_at == end_at


def test_preview_reservation_item_service_returns_unavailable_preview(
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    conflict = _create_availability(
        inventory_item=item,
        start_at=start_at,
        end_at=end_at,
        status=InventoryAvailabilityStatus.RESERVED,
    )

    with django_assert_num_queries(1):
        preview = preview_reservation_item_service(
            inventory_item=item,
            inventory_item_kind=item.kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert preview.status == ReservationItemPreviewStatus.UNAVAILABLE
    assert preview.errors == (INVENTORY_ITEM_UNAVAILABLE_ERROR,)
    assert preview.conflicts == (conflict,)
    assert preview.period is not None


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
def test_preview_reservation_item_service_returns_invalid_preview_for_non_reservable_kind(
    inventory_item_kind: str,
    django_assert_num_queries,
) -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()

    with django_assert_num_queries(0):
        preview = preview_reservation_item_service(
            inventory_item=item,
            inventory_item_kind=inventory_item_kind,
            start_at=start_at,
            end_at=end_at,
        )

    assert preview.status == ReservationItemPreviewStatus.INVALID
    assert preview.period is None
    assert preview.conflicts == ()
    assert preview.errors == (
        f"Inventory item kind '{inventory_item_kind}' is not reservable in Titan.",
    )


def test_preview_reservation_item_service_uses_half_open_periods() -> None:
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

    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert preview.errors == ()
    assert preview.conflicts == ()


def test_preview_reservation_item_service_does_not_create_availability_periods() -> None:
    item = _create_inventory_item()
    start_at, end_at = _valid_period_bounds()
    before_count = InventoryAvailability.objects.count()

    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert InventoryAvailability.objects.count() == before_count


def test_preview_reservation_item_service_delegates_to_preview_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    item = InventoryItem(name="Unsaved camera", kind="material")
    start_at, end_at = _valid_period_bounds()
    sentinel_preview = object()
    calls: list[dict[str, Any]] = []

    def fake_preview_reservation_item_request(**kwargs: Any) -> object:
        calls.append(kwargs)
        return sentinel_preview

    monkeypatch.setattr(
        reservation_services,
        "preview_reservation_item_request",
        fake_preview_reservation_item_request,
    )

    result = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert result is sentinel_preview
    assert calls == [
        {
            "inventory_item": item,
            "inventory_item_kind": item.kind,
            "start_at": start_at,
            "end_at": end_at,
        }
    ]
