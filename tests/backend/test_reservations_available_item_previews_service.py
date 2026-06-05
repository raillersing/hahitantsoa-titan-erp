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
from apps.reservations.periods import make_reservation_period
from apps.reservations.preview import ReservationItemPreviewStatus
from apps.reservations.services import (
    ReservationAvailableItemsOptions,
    get_reservation_available_item_previews_service,
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
    status: InventoryAvailabilityStatus = InventoryAvailabilityStatus.BLOCKED,
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )


def test_available_item_previews_service_returns_preview_tuple() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available camera")

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert isinstance(previews, tuple)
    assert len(previews) == 1
    assert previews[0].inventory_item == item
    assert previews[0].status == ReservationItemPreviewStatus.AVAILABLE


@pytest.mark.parametrize(
    "kind",
    [
        "material",
        "article",
        "material_pack",
    ],
)
def test_available_item_previews_service_returns_available_previews_for_allowed_kinds(
    kind: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name=f"Available {kind}", kind=kind)

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert tuple(preview.inventory_item for preview in previews) == (item,)
    assert tuple(preview.status for preview in previews) == (
        ReservationItemPreviewStatus.AVAILABLE,
    )


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_available_item_previews_service_excludes_blocked_or_reserved_items(
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

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert tuple(preview.inventory_item for preview in previews) == (available_item,)
    assert unavailable_item not in tuple(preview.inventory_item for preview in previews)
    assert tuple(preview.status for preview in previews) == (
        ReservationItemPreviewStatus.AVAILABLE,
    )


def test_available_item_previews_service_rejects_invalid_period_via_options_service() -> None:
    start_at = timezone.now()

    with pytest.raises(ValueError) as error:
        get_reservation_available_item_previews_service(
            start_at=start_at,
            end_at=start_at,
        )

    assert str(error.value) == "Reservation period end_at must be after start_at."


def test_available_item_previews_service_does_not_create_availability_or_reservation() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available lighting")
    availability_count = InventoryAvailability.objects.count()
    inventory_item_count = InventoryItem.objects.count()

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert tuple(preview.inventory_item for preview in previews) == (item,)
    assert InventoryAvailability.objects.count() == availability_count
    assert InventoryItem.objects.count() == inventory_item_count


def test_available_item_previews_service_delegates_to_options_and_preview_services(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_at, end_at = _valid_period_bounds()
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    first_item = InventoryItem(name="Unsaved camera", kind="material")
    second_item = InventoryItem(name="Unsaved projector", kind="article")
    options_calls: list[dict[str, Any]] = []
    preview_calls: list[dict[str, Any]] = []
    first_preview = object()
    second_preview = object()

    def fake_get_reservation_available_items_options_service(
        **kwargs: Any,
    ) -> ReservationAvailableItemsOptions:
        options_calls.append(kwargs)
        return ReservationAvailableItemsOptions(
            period=period,
            items=(first_item, second_item),
            count=2,
        )

    def fake_preview_reservation_item_service(**kwargs: Any) -> object:
        preview_calls.append(kwargs)
        if kwargs["inventory_item"] == first_item:
            return first_preview
        return second_preview

    monkeypatch.setattr(
        reservation_services,
        "get_reservation_available_items_options_service",
        fake_get_reservation_available_items_options_service,
    )
    monkeypatch.setattr(
        reservation_services,
        "preview_reservation_item_service",
        fake_preview_reservation_item_service,
    )

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert previews == (first_preview, second_preview)
    assert options_calls == [
        {
            "start_at": start_at,
            "end_at": end_at,
        }
    ]
    assert preview_calls == [
        {
            "inventory_item": first_item,
            "inventory_item_kind": first_item.kind,
            "start_at": start_at,
            "end_at": end_at,
        },
        {
            "inventory_item": second_item,
            "inventory_item_kind": second_item.kind,
            "start_at": start_at,
            "end_at": end_at,
        },
    ]


def test_available_item_previews_service_delegates_to_private_options_builder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_at, end_at = _valid_period_bounds()
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    item = InventoryItem(name="Unsaved camera", kind="material")
    options = ReservationAvailableItemsOptions(period=period, items=(item,), count=1)
    calls: list[ReservationAvailableItemsOptions] = []
    expected_previews = (object(),)

    def fake_get_reservation_available_items_options_service(
        **kwargs: Any,
    ) -> ReservationAvailableItemsOptions:
        assert kwargs == {"start_at": start_at, "end_at": end_at}
        return options

    def fake_build_reservation_available_item_previews_from_options(
        **kwargs: ReservationAvailableItemsOptions,
    ) -> tuple[object, ...]:
        calls.append(kwargs["options"])
        return expected_previews

    monkeypatch.setattr(
        reservation_services,
        "get_reservation_available_items_options_service",
        fake_get_reservation_available_items_options_service,
    )
    monkeypatch.setattr(
        reservation_services,
        "_build_reservation_available_item_previews_from_options",
        fake_build_reservation_available_item_previews_from_options,
    )

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert previews == expected_previews
    assert calls == [options]
