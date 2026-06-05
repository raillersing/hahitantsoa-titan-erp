from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.inventory.models import InventoryItem
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


def test_available_items_options_service_orders_items_by_name_then_id() -> None:
    start_at, end_at = _valid_period_bounds()
    first_same_name = _create_inventory_item(name="Camera")
    _create_inventory_item(name="Projector")
    second_same_name = _create_inventory_item(name="Camera")
    _create_inventory_item(name="Amplifier")

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    expected_items = tuple(
        InventoryItem.objects.filter(
            id__in=[
                first_same_name.id,
                second_same_name.id,
            ]
        ).order_by("name", "id")
    )
    expected_items = (
        InventoryItem.objects.get(name="Amplifier"),
        *expected_items,
        InventoryItem.objects.get(name="Projector"),
    )

    assert options.items == expected_items
    assert options.count == len(expected_items)


def test_available_item_previews_service_preserves_options_order() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Zulu stand")
    _create_inventory_item(name="Alpha camera")
    _create_inventory_item(name="Middle light")

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert tuple(item.name for item in options.items) == (
        "Alpha camera",
        "Middle light",
        "Zulu stand",
    )
    assert tuple(preview.inventory_item for preview in previews) == options.items


def test_available_reservation_services_keep_stable_order_from_different_creation_order() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Gamma article", kind="article")
    _create_inventory_item(name="Alpha material", kind="material")
    _create_inventory_item(name="Beta pack", kind="material_pack")

    first_options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    second_options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert tuple(item.name for item in first_options.items) == (
        "Alpha material",
        "Beta pack",
        "Gamma article",
    )
    assert second_options.items == first_options.items
    assert tuple(preview.inventory_item for preview in previews) == first_options.items


def test_available_items_options_service_uses_id_as_tie_breaker_for_same_name() -> None:
    start_at, end_at = _valid_period_bounds()
    items = (
        _create_inventory_item(name="Shared name"),
        _create_inventory_item(name="Shared name"),
        _create_inventory_item(name="Shared name"),
    )
    expected_items = tuple(sorted(items, key=lambda item: item.id))

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert options.items == expected_items
