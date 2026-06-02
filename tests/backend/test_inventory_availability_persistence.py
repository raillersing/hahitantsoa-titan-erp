from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)

ALLOWED_ITEM_KINDS = {"material", "article", "material_pack"}
DISALLOWED_TITAN_VALUES = {"venue", "local", "room", "service", "event_service"}


def _create_inventory_item(name: str = "Camera", kind: str = "material") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _availability_times():
    start_at = timezone.now()
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


@pytest.mark.django_db
def test_inventory_availability_valid_period_is_persistable() -> None:
    item = _create_inventory_item()
    start_at, end_at = _availability_times()

    availability = InventoryAvailability(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at,
        end_at=end_at,
        notes="Unavailable for maintenance.",
    )
    availability.full_clean()
    availability.save()

    persisted_availability = InventoryAvailability.objects.get(pk=availability.pk)

    assert persisted_availability.inventory_item == item
    assert persisted_availability.status == InventoryAvailabilityStatus.BLOCKED
    assert persisted_availability.start_at == start_at
    assert persisted_availability.end_at == end_at
    assert persisted_availability.notes == "Unavailable for maintenance."
    assert persisted_availability.created_at is not None
    assert persisted_availability.updated_at is not None


@pytest.mark.django_db
def test_inventory_availability_accepts_end_after_start() -> None:
    item = _create_inventory_item()
    start_at, end_at = _availability_times()

    availability = InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=start_at,
        end_at=end_at,
    )

    assert availability.end_at > availability.start_at


@pytest.mark.django_db(transaction=True)
def test_inventory_availability_database_constraint_rejects_equal_period_bounds() -> None:
    item = _create_inventory_item()
    start_at = timezone.now()

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            InventoryAvailability.objects.create(
                inventory_item=item,
                status=InventoryAvailabilityStatus.BLOCKED,
                start_at=start_at,
                end_at=start_at,
            )

    assert InventoryAvailability.objects.filter(inventory_item=item).exists() is False


@pytest.mark.django_db(transaction=True)
def test_inventory_availability_database_constraint_rejects_end_before_start() -> None:
    item = _create_inventory_item()
    start_at = timezone.now()
    end_at = start_at - timedelta(hours=1)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            InventoryAvailability.objects.create(
                inventory_item=item,
                status=InventoryAvailabilityStatus.RESERVED,
                start_at=start_at,
                end_at=end_at,
            )

    assert InventoryAvailability.objects.filter(inventory_item=item).exists() is False


@pytest.mark.django_db(transaction=True)
def test_inventory_availability_database_constraint_rejects_disallowed_status() -> None:
    item = _create_inventory_item()
    start_at, end_at = _availability_times()

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            InventoryAvailability.objects.create(
                inventory_item=item,
                status="venue",
                start_at=start_at,
                end_at=end_at,
            )

    assert InventoryAvailability.objects.filter(status="venue").exists() is False


@pytest.mark.django_db
def test_inventory_item_delete_cascades_to_availability_periods() -> None:
    item = _create_inventory_item()
    start_at, end_at = _availability_times()
    availability = InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at,
        end_at=end_at,
    )

    item.delete()

    assert InventoryAvailability.objects.filter(pk=availability.pk).exists() is False


@pytest.mark.django_db
def test_inventory_availability_periods_remain_attached_to_allowed_titan_kinds() -> None:
    start_at, end_at = _availability_times()
    for kind in ALLOWED_ITEM_KINDS:
        item = _create_inventory_item(name=f"{kind} item", kind=kind)
        InventoryAvailability.objects.create(
            inventory_item=item,
            status=InventoryAvailabilityStatus.BLOCKED,
            start_at=start_at,
            end_at=end_at,
        )

    persisted_kinds = set(
        InventoryAvailability.objects.values_list("inventory_item__kind", flat=True)
    )

    assert persisted_kinds == ALLOWED_ITEM_KINDS
    assert persisted_kinds.isdisjoint(DISALLOWED_TITAN_VALUES)
