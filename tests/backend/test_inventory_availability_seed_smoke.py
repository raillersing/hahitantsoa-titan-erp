from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from apps.inventory.availability import (
    get_inventory_availability_conflicts,
    is_inventory_item_available,
)
from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.inventory.scope import InventoryItemKind

pytestmark = pytest.mark.django_db

ALLOWED_KINDS = {
    InventoryItemKind.MATERIAL.value,
    InventoryItemKind.ARTICLE.value,
    InventoryItemKind.MATERIAL_PACK.value,
}
DISALLOWED_KINDS = {"venue", "local", "room", "service", "event_service"}
EXPECTED_DEMO_NAMES = {
    "Sonorisation standard",
    "Projecteur LED",
    "Pack sonorisation + eclairage",
}


def _call_seed_demo_inventory() -> str:
    output = StringIO()
    call_command("seed_demo_inventory", stdout=output)
    return output.getvalue()


def _seed_demo_inventory_items() -> list[InventoryItem]:
    with override_settings(DEBUG=True):
        output = _call_seed_demo_inventory()

    assert "Demo inventory seed completed:" in output
    return list(InventoryItem.objects.order_by("name"))


def _request_period():
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_seeded_demo_inventory_items_work_with_availability_helpers(
    status: InventoryAvailabilityStatus,
) -> None:
    items = _seed_demo_inventory_items()

    assert {item.name for item in items} == EXPECTED_DEMO_NAMES
    assert {item.kind for item in items} == ALLOWED_KINDS
    assert {item.kind for item in items}.isdisjoint(DISALLOWED_KINDS)

    requested_item = InventoryItem.objects.get(name="Sonorisation standard")
    other_item = InventoryItem.objects.get(name="Projecteur LED")
    start_at, end_at = _request_period()

    assert (
        is_inventory_item_available(
            inventory_item=requested_item,
            start_at=start_at,
            end_at=end_at,
        )
        is True
    )

    InventoryAvailability.objects.create(
        inventory_item=other_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )

    assert (
        is_inventory_item_available(
            inventory_item=requested_item,
            start_at=start_at,
            end_at=end_at,
        )
        is True
    )
    assert (
        list(
            get_inventory_availability_conflicts(
                inventory_item=requested_item,
                start_at=start_at,
                end_at=end_at,
            )
        )
        == []
    )

    blocking_period = InventoryAvailability.objects.create(
        inventory_item=requested_item,
        status=status,
        start_at=start_at + timedelta(minutes=15),
        end_at=end_at - timedelta(minutes=15),
    )

    conflicts = get_inventory_availability_conflicts(
        inventory_item=requested_item,
        start_at=start_at,
        end_at=end_at,
    )

    assert list(conflicts) == [blocking_period]
    assert (
        is_inventory_item_available(
            inventory_item=requested_item,
            start_at=start_at,
            end_at=end_at,
        )
        is False
    )


def test_seeded_demo_inventory_availability_helpers_use_half_open_intervals() -> None:
    _seed_demo_inventory_items()
    item = InventoryItem.objects.get(name="Pack sonorisation + eclairage")
    start_at, end_at = _request_period()

    InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at,
    )
    InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.RESERVED,
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
    assert (
        list(
            get_inventory_availability_conflicts(
                inventory_item=item,
                start_at=start_at,
                end_at=end_at,
            )
        )
        == []
    )

    overlapping_period = InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=end_at - timedelta(minutes=30),
        end_at=end_at + timedelta(minutes=30),
    )

    assert list(
        get_inventory_availability_conflicts(
            inventory_item=item,
            start_at=start_at,
            end_at=end_at,
        )
    ) == [overlapping_period]
