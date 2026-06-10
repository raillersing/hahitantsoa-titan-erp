from datetime import timedelta
from io import StringIO
from pathlib import Path

import pytest
from django.apps import apps
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from apps.inventory.management.commands.seed_demo_availability import (
    DEMO_AVAILABILITY_ENTRIES,
    next_hour,
)
from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)
from apps.inventory.scope import TITAN_ALLOWED_ITEM_KINDS

pytestmark = pytest.mark.django_db

EXPECTED_NOTES = {entry["notes"] for entry in DEMO_AVAILABILITY_ENTRIES}
EXPECTED_STATUSES = {
    InventoryAvailabilityStatus.BLOCKED,
    InventoryAvailabilityStatus.RESERVED,
}
DISALLOWED_KINDS = {"venue", "local", "room", "service", "event_service"}


def _call_seed_demo_inventory() -> str:
    output = StringIO()
    call_command("seed_demo_inventory", stdout=output)
    return output.getvalue()


def _call_seed_demo_availability() -> str:
    output = StringIO()
    call_command("seed_demo_availability", stdout=output)
    return output.getvalue()


def _seed_demo_inventory() -> None:
    with override_settings(DEBUG=True):
        _call_seed_demo_inventory()


def test_seed_demo_availability_refuses_when_debug_is_false() -> None:
    with override_settings(DEBUG=False):
        output = _call_seed_demo_availability()

    assert InventoryAvailability.objects.count() == 0
    assert "Refusing to seed demo availability when DEBUG is False." in output


def test_seed_demo_availability_skips_missing_demo_inventory() -> None:
    with override_settings(DEBUG=True):
        output = _call_seed_demo_availability()

    assert InventoryItem.objects.count() == 0
    assert InventoryAvailability.objects.count() == 0
    assert "0 created, 0 updated, 2 skipped" in output


def test_seed_demo_availability_creates_expected_rows() -> None:
    _seed_demo_inventory()

    with override_settings(DEBUG=True):
        output = _call_seed_demo_availability()

    availabilities = InventoryAvailability.objects.order_by("inventory_item__name")
    assert availabilities.count() == 2
    assert set(availabilities.values_list("notes", flat=True)) == EXPECTED_NOTES
    assert set(availabilities.values_list("status", flat=True)) == EXPECTED_STATUSES
    assert set(availabilities.values_list("inventory_item__name", flat=True)) == {
        "Projecteur LED",
        "Sonorisation standard",
    }
    assert (
        InventoryAvailability.objects.filter(
            inventory_item__name="Pack sonorisation + eclairage"
        ).exists()
        is False
    )
    assert "2 created, 0 updated, 0 skipped" in output


def test_seed_demo_availability_uses_valid_aware_hour_period() -> None:
    _seed_demo_inventory()

    with override_settings(DEBUG=True):
        _call_seed_demo_availability()

    for availability in InventoryAvailability.objects.all():
        assert timezone.is_aware(availability.start_at)
        assert timezone.is_aware(availability.end_at)
        assert availability.start_at.minute == 0
        assert availability.start_at.second == 0
        assert availability.start_at.microsecond == 0
        assert availability.end_at == availability.start_at + timedelta(hours=2)


def test_seed_demo_availability_uses_the_next_hour_even_on_an_hour_boundary() -> None:
    current_hour = timezone.now().replace(minute=0, second=0, microsecond=0)

    assert next_hour(current_hour) == current_hour + timedelta(hours=1)


def test_seed_demo_availability_is_idempotent_and_updates_owned_rows() -> None:
    _seed_demo_inventory()

    with override_settings(DEBUG=True):
        first_output = _call_seed_demo_availability()

    first_rows = {
        availability.notes: availability.pk for availability in InventoryAvailability.objects.all()
    }

    with override_settings(DEBUG=True):
        second_output = _call_seed_demo_availability()

    second_rows = {
        availability.notes: availability.pk for availability in InventoryAvailability.objects.all()
    }

    assert first_rows == second_rows
    assert InventoryAvailability.objects.count() == 2
    assert "2 created, 0 updated, 0 skipped" in first_output
    assert "0 created, 2 updated, 0 skipped" in second_output


def test_seed_demo_availability_reactivates_an_owned_soft_deleted_row() -> None:
    _seed_demo_inventory()
    item = InventoryItem.objects.get(name="Sonorisation standard")
    availability = InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=timezone.now() + timedelta(days=1),
        end_at=timezone.now() + timedelta(days=1, hours=1),
        notes="F65 demo availability: blocked",
        is_deleted=True,
        deleted_at=timezone.now(),
    )

    with override_settings(DEBUG=True):
        output = _call_seed_demo_availability()

    availability.refresh_from_db()
    assert availability.status == InventoryAvailabilityStatus.BLOCKED
    assert availability.is_deleted is False
    assert availability.deleted_at is None
    assert "1 created, 1 updated, 0 skipped" in output


def test_seed_demo_availability_does_not_change_unrelated_rows() -> None:
    _seed_demo_inventory()
    item = InventoryItem.objects.get(name="Pack sonorisation + eclairage")
    unrelated = InventoryAvailability.objects.create(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=timezone.now() + timedelta(days=1),
        end_at=timezone.now() + timedelta(days=1, hours=1),
        notes="Unrelated availability",
    )
    original_values = (unrelated.status, unrelated.start_at, unrelated.end_at, unrelated.notes)

    with override_settings(DEBUG=True):
        _call_seed_demo_availability()

    unrelated.refresh_from_db()
    assert (unrelated.status, unrelated.start_at, unrelated.end_at, unrelated.notes) == (
        original_values
    )
    assert InventoryAvailability.objects.count() == 3


def test_seed_demo_availability_uses_only_titan_items_and_allowed_statuses() -> None:
    _seed_demo_inventory()

    with override_settings(DEBUG=True):
        _call_seed_demo_availability()

    for availability in InventoryAvailability.objects.select_related("inventory_item"):
        assert availability.inventory_item.kind in {kind.value for kind in TITAN_ALLOWED_ITEM_KINDS}
        assert availability.inventory_item.kind not in DISALLOWED_KINDS
        assert availability.status in EXPECTED_STATUSES


def test_seed_demo_availability_does_not_create_reservations_domain_data_or_files() -> None:
    _seed_demo_inventory()
    reservations_app = apps.get_app_config("reservations")
    reservations_path = Path(reservations_app.path)
    reservations_models = list(reservations_app.get_models())
    reservation_counts = {model._meta.label: model.objects.count() for model in reservations_models}

    with override_settings(DEBUG=True):
        _call_seed_demo_availability()

    assert list(reservations_app.get_models()) == reservations_models
    assert reservation_counts == {
        model._meta.label: model.objects.count() for model in reservations_models
    }
    assert list(reservations_path.glob("**/*.pdf")) == []


def test_seed_demo_availability_output_does_not_expose_secrets(monkeypatch) -> None:
    _seed_demo_inventory()
    secret_values = {
        "DJANGO_DEV_PASSWORD": "demo-password-secret",
        "DEMO_TOKEN": "demo-token-secret",
        "DJANGO_DEV_USERNAME": "demo-user-secret",
    }
    for name, value in secret_values.items():
        monkeypatch.setenv(name, value)

    with override_settings(DEBUG=True):
        output = _call_seed_demo_availability()

    assert "Demo availability seed completed:" in output
    for secret in secret_values.values():
        assert secret not in output
