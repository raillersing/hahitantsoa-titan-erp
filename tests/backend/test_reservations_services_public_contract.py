from dataclasses import FrozenInstanceError, fields, is_dataclass
from datetime import datetime, timedelta
from inspect import Parameter, signature
from pathlib import Path

import pytest
from django.apps import apps
from django.utils import timezone

from apps.inventory.models import InventoryAvailability, InventoryItem
from apps.reservations.preview import ReservationItemPreview
from apps.reservations.scope import RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS
from apps.reservations.services import (
    ReservationAvailabilitySummary,
    ReservationAvailableItemsOptions,
    get_reservation_availability_summary_service,
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


def _reservations_model_counts() -> dict[str, int]:
    return {
        model._meta.label: model.objects.count()
        for model in apps.get_models()
        if model._meta.app_label == "reservations"
    }


def _assert_keyword_only_signature(function: object, expected_names: tuple[str, ...]) -> None:
    parameters = signature(function).parameters

    assert tuple(parameters) == expected_names
    assert all(parameter.kind is Parameter.KEYWORD_ONLY for parameter in parameters.values())


def test_reservations_public_services_keep_keyword_only_signatures() -> None:
    _assert_keyword_only_signature(
        preview_reservation_item_service,
        ("inventory_item", "inventory_item_kind", "start_at", "end_at"),
    )
    _assert_keyword_only_signature(
        get_reservation_available_items_options_service,
        ("start_at", "end_at"),
    )
    _assert_keyword_only_signature(
        get_reservation_available_item_previews_service,
        ("start_at", "end_at"),
    )
    _assert_keyword_only_signature(
        get_reservation_availability_summary_service,
        ("start_at", "end_at"),
    )


def test_reservations_public_services_reject_positional_calls() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available camera")

    with pytest.raises(TypeError):
        preview_reservation_item_service(item, item.kind, start_at, end_at)  # type: ignore[misc]

    with pytest.raises(TypeError):
        get_reservation_available_items_options_service(start_at, end_at)  # type: ignore[misc]

    with pytest.raises(TypeError):
        get_reservation_available_item_previews_service(start_at, end_at)  # type: ignore[misc]

    with pytest.raises(TypeError):
        get_reservation_availability_summary_service(start_at, end_at)  # type: ignore[misc]


def test_reservations_public_services_return_contract_types() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available camera")

    preview = preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )
    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )
    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert isinstance(preview, ReservationItemPreview)
    assert isinstance(options, ReservationAvailableItemsOptions)
    assert isinstance(previews, tuple)
    assert all(isinstance(item_preview, ReservationItemPreview) for item_preview in previews)
    assert isinstance(summary, ReservationAvailabilitySummary)


def test_reservation_available_items_options_dataclass_contract_is_stable() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available camera")
    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert is_dataclass(ReservationAvailableItemsOptions)
    assert ReservationAvailableItemsOptions.__dataclass_params__.frozen is True
    assert tuple(field.name for field in fields(ReservationAvailableItemsOptions)) == (
        "period",
        "items",
        "count",
    )
    assert options.items == (item,)

    with pytest.raises(FrozenInstanceError):
        options.count = 2  # type: ignore[misc]


def test_reservation_availability_summary_dataclass_contract_is_stable() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available camera")
    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert is_dataclass(ReservationAvailabilitySummary)
    assert ReservationAvailabilitySummary.__dataclass_params__.frozen is True
    assert tuple(field.name for field in fields(ReservationAvailabilitySummary)) == (
        "period",
        "available_item_count",
        "available_preview_count",
        "available_item_kinds",
    )
    assert summary.available_item_count == 1

    with pytest.raises(FrozenInstanceError):
        summary.available_item_count = 2  # type: ignore[misc]


def test_reservations_public_services_are_read_only() -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name="Available camera")
    availability_count = InventoryAvailability.objects.count()
    reservations_model_counts = _reservations_model_counts()

    preview_reservation_item_service(
        inventory_item=item,
        inventory_item_kind=item.kind,
        start_at=start_at,
        end_at=end_at,
    )
    get_reservation_available_items_options_service(start_at=start_at, end_at=end_at)
    get_reservation_available_item_previews_service(start_at=start_at, end_at=end_at)
    get_reservation_availability_summary_service(start_at=start_at, end_at=end_at)

    assert InventoryAvailability.objects.count() == availability_count
    assert _reservations_model_counts() == reservations_model_counts


def test_reservations_public_services_return_only_allowed_titan_kinds() -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Alpha material", kind="material")
    _create_inventory_item(name="Beta article", kind="article")
    _create_inventory_item(name="Gamma pack", kind="material_pack")

    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    previews = get_reservation_available_item_previews_service(
        start_at=start_at,
        end_at=end_at,
    )
    summary = get_reservation_availability_summary_service(
        start_at=start_at,
        end_at=end_at,
    )

    assert {item.kind for item in options.items} == RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS
    assert {
        preview.inventory_item_kind for preview in previews
    } == RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS
    assert set(summary.available_item_kinds) == RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS


def test_reservations_domain_does_not_expose_api_files_or_business_migrations() -> None:
    reservations_app_path = Path("backend/apps/reservations")
    forbidden_api_files = (
        "models.py",
        "admin.py",
    )
    allowed_read_only_api_files = (
        "serializers.py",
        "views.py",
        "urls.py",
    )

    assert all(
        not (reservations_app_path / file_name).exists() for file_name in forbidden_api_files
    )
    assert all(
        (reservations_app_path / file_name).exists() for file_name in allowed_read_only_api_files
    )
    assert not (reservations_app_path / "migrations").exists()
