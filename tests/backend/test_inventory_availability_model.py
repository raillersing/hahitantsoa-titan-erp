from datetime import timedelta

from django.apps import apps
from django.db import models
from django.utils import timezone

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)

ALLOWED_AVAILABILITY_STATUSES = ["blocked", "reserved"]
DISALLOWED_TITAN_VALUES = {"venue", "local", "room", "service", "event_service"}


def test_inventory_availability_is_concrete_model() -> None:
    assert InventoryAvailability._meta.abstract is False


def test_inventory_app_registry_contains_inventory_availability() -> None:
    assert InventoryAvailability in list(apps.get_app_config("inventory").get_models())


def test_inventory_availability_fields() -> None:
    field_names = {field.name for field in InventoryAvailability._meta.get_fields()}

    assert {
        "id",
        "inventory_item",
        "status",
        "start_at",
        "end_at",
        "notes",
        "created_at",
        "updated_at",
        "is_deleted",
        "deleted_at",
        "created_by",
        "updated_by",
    }.issubset(field_names)


def test_inventory_availability_inventory_item_relation() -> None:
    inventory_item = InventoryAvailability._meta.get_field("inventory_item")

    assert isinstance(inventory_item, models.ForeignKey)
    assert inventory_item.remote_field.model is InventoryItem
    assert inventory_item.remote_field.on_delete == models.CASCADE
    assert inventory_item.remote_field.related_name == "availability_periods"


def test_inventory_availability_status_choices_match_allowed_values() -> None:
    status = InventoryAvailability._meta.get_field("status")

    assert isinstance(status, models.CharField)
    assert [choice[0] for choice in status.choices] == ALLOWED_AVAILABILITY_STATUSES
    assert {status.value for status in InventoryAvailabilityStatus} == {
        "blocked",
        "reserved",
    }


def test_inventory_availability_status_choices_exclude_titan_disallowed_values() -> None:
    status_values = {status.value for status in InventoryAvailabilityStatus}

    assert status_values.isdisjoint(DISALLOWED_TITAN_VALUES)


def test_inventory_availability_meta_options() -> None:
    assert InventoryAvailability._meta.ordering == ["start_at", "end_at"]
    assert InventoryAvailability._meta.verbose_name == "Inventory availability"
    assert InventoryAvailability._meta.verbose_name_plural == "Inventory availabilities"


def test_inventory_availability_str_is_readable_and_stable() -> None:
    start_at = timezone.now()
    end_at = start_at + timedelta(hours=2)
    item = InventoryItem(name="Camera", kind="material")
    availability = InventoryAvailability(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at,
        end_at=end_at,
    )

    assert str(availability) == f"Camera blocked from {start_at} to {end_at}"
