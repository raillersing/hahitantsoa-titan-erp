from datetime import datetime, timedelta
from pathlib import Path

import pytest
from django.apps import apps
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.inventory.models import (
    InventoryAvailability,
    InventoryAvailabilityStatus,
    InventoryItem,
)

AVAILABLE_ITEM_PREVIEWS_URL = "/api/v1/reservations/available-item-previews/"
AVAILABLE_ITEM_PREVIEW_FIELDS = {
    "inventory_item_id",
    "inventory_item_name",
    "inventory_item_kind",
    "start_at",
    "end_at",
    "status",
}

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="available-preview-reader",
        password="test-password",
    )
    client.force_login(user)
    return client


def _valid_period_bounds() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


def _query_params(start_at: datetime, end_at: datetime) -> dict[str, str]:
    return {
        "start_at": start_at.isoformat(),
        "end_at": end_at.isoformat(),
    }


def _create_inventory_item(*, name: str, kind: str = "material") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _create_availability(
    *,
    inventory_item: InventoryItem,
    start_at: datetime,
    end_at: datetime,
    status: InventoryAvailabilityStatus,
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )


def _reservations_model_counts() -> dict[str, int]:
    return {
        model._meta.label: model.objects.count()
        for model in apps.get_models()
        if model._meta.app_label == "reservations"
    }


def _assert_response_datetime_matches(value: str, expected: datetime) -> None:
    parsed = parse_datetime(value)

    assert parsed is not None
    assert parsed == expected


def test_available_item_previews_rejects_unauthenticated_user(client) -> None:
    start_at, end_at = _valid_period_bounds()

    response = client.get(AVAILABLE_ITEM_PREVIEWS_URL, data=_query_params(start_at, end_at))

    assert response.status_code in {401, 403}


def test_authenticated_user_can_read_available_item_previews(authenticated_client) -> None:
    start_at, end_at = _valid_period_bounds()
    items = (
        _create_inventory_item(name="Alpha material", kind="material"),
        _create_inventory_item(name="Beta article", kind="article"),
        _create_inventory_item(name="Gamma pack", kind="material_pack"),
    )

    response = authenticated_client.get(
        AVAILABLE_ITEM_PREVIEWS_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 3
    assert [preview["inventory_item_id"] for preview in payload] == [str(item.pk) for item in items]
    assert [preview["inventory_item_name"] for preview in payload] == [item.name for item in items]
    assert [preview["inventory_item_kind"] for preview in payload] == [
        "material",
        "article",
        "material_pack",
    ]

    for preview in payload:
        assert set(preview) == AVAILABLE_ITEM_PREVIEW_FIELDS
        assert preview["status"] == "available"
        _assert_response_datetime_matches(preview["start_at"], start_at)
        _assert_response_datetime_matches(preview["end_at"], end_at)


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_available_item_previews_excludes_unavailable_items(
    authenticated_client,
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    available_item = _create_inventory_item(name="Available article", kind="article")
    unavailable_item = _create_inventory_item(name="Unavailable material", kind="material")
    _create_availability(
        inventory_item=unavailable_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )

    response = authenticated_client.get(
        AVAILABLE_ITEM_PREVIEWS_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert [preview["inventory_item_id"] for preview in payload] == [str(available_item.pk)]
    assert str(unavailable_item.pk) not in {preview["inventory_item_id"] for preview in payload}


@pytest.mark.parametrize(
    ("query_params", "expected_field"),
    [
        ({"end_at": "2026-01-01T12:00:00Z"}, "start_at"),
        ({"start_at": "2026-01-01T10:00:00Z"}, "end_at"),
        ({"start_at": "not-a-date", "end_at": "2026-01-01T12:00:00Z"}, "start_at"),
        (
            {
                "start_at": "2026-01-01T10:00:00",
                "end_at": "2026-01-01T12:00:00Z",
            },
            "start_at",
        ),
    ],
)
def test_available_item_previews_returns_400_for_invalid_period_params(
    authenticated_client,
    query_params: dict[str, str],
    expected_field: str,
) -> None:
    response = authenticated_client.get(AVAILABLE_ITEM_PREVIEWS_URL, data=query_params)

    assert response.status_code == 400
    assert expected_field in response.json()


@pytest.mark.parametrize("offset", [timedelta(), -timedelta(seconds=1)])
def test_available_item_previews_returns_400_when_end_at_is_not_after_start_at(
    authenticated_client,
    offset: timedelta,
) -> None:
    start_at, _ = _valid_period_bounds()

    response = authenticated_client.get(
        AVAILABLE_ITEM_PREVIEWS_URL,
        data=_query_params(start_at, start_at + offset),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Reservation period end_at must be after start_at."}


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_available_item_previews_rejects_write_methods(
    authenticated_client,
    method: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    request_method = getattr(authenticated_client, method)

    response = request_method(
        AVAILABLE_ITEM_PREVIEWS_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 405


def test_available_item_previews_endpoint_does_not_write_business_data(
    authenticated_client,
) -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available material")
    availability_count = InventoryAvailability.objects.count()
    reservation_counts = _reservations_model_counts()

    response = authenticated_client.get(
        AVAILABLE_ITEM_PREVIEWS_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    assert InventoryAvailability.objects.count() == availability_count
    assert _reservations_model_counts() == reservation_counts


def test_reservations_previews_api_does_not_create_forbidden_files() -> None:
    reservations_app_config = apps.get_app_config("reservations")
    reservations_app_path = Path(reservations_app_config.path)

    assert not (reservations_app_path / "models.py").exists()
    assert not (reservations_app_path / "admin.py").exists()
    assert not (reservations_app_path / "migrations").exists()
