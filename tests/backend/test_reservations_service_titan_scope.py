from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.inventory.models import InventoryItem
from apps.reservations.preview import ReservationItemPreviewStatus
from apps.reservations.scope import (
    RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS,
    RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS,
)
from apps.reservations.services import (
    get_reservation_available_item_previews_service,
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


def test_available_items_options_service_never_returns_forbidden_kinds() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available material", kind="material")
    _create_inventory_item(name="Available article", kind="article")
    _create_inventory_item(name="Available pack", kind="material_pack")

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    returned_kinds = {item.kind for item in options.items}

    assert returned_kinds == RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS
    assert returned_kinds.isdisjoint(RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS)


@pytest.mark.parametrize(
    "inventory_item_kind",
    sorted(RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS),
)
def test_preview_service_returns_invalid_for_forbidden_kinds(
    inventory_item_kind: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Allowed camera")

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


@pytest.mark.parametrize(
    "inventory_item_kind",
    sorted(RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS),
)
def test_preview_service_remains_available_for_allowed_kinds(
    inventory_item_kind: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(
        name=f"Allowed {inventory_item_kind}",
        kind=inventory_item_kind,
    )

    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
    )

    assert preview.status == ReservationItemPreviewStatus.AVAILABLE
    assert preview.errors == ()
    assert preview.conflicts == ()


def test_batch_preview_service_never_returns_forbidden_kinds() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available material", kind="material")
    _create_inventory_item(name="Available article", kind="article")
    _create_inventory_item(name="Available pack", kind="material_pack")

    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )
    returned_kinds = {preview.inventory_item_kind for preview in previews}

    assert returned_kinds == RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS
    assert returned_kinds.isdisjoint(RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS)
    assert all(preview.status == ReservationItemPreviewStatus.AVAILABLE for preview in previews)
