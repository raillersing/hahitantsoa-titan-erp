import uuid
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
from apps.reservations.scope import RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS

ITEM_AVAILABILITY_PREVIEW_FIELDS = {
    "inventory_item_id",
    "inventory_item_name",
    "inventory_item_kind",
    "start_at",
    "end_at",
    "status",
    "conflict_count",
}
HIDDEN_CONFLICT_FIELDS = {
    "conflicts",
    "notes",
    "availability_validation",
    "errors",
    "inventory_unit_count",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
}

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="item-availability-reader",
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


def _item_url(inventory_item_id: uuid.UUID) -> str:
    return f"/api/v1/reservations/items/{inventory_item_id}/availability-preview/"


def _create_inventory_item(
    *,
    name: str = "Projecteur LED",
    kind: str = "article",
    is_active: bool = True,
    is_deleted: bool = False,
) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        is_active=is_active,
        is_deleted=is_deleted,
    )


def _create_availability(
    *,
    inventory_item: InventoryItem,
    status: InventoryAvailabilityStatus,
    start_at: datetime,
    end_at: datetime,
    notes: str = "Internal note",
) -> InventoryAvailability:
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
        notes=notes,
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


def test_authenticated_user_can_read_available_item_preview(authenticated_client) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item()

    response = authenticated_client.get(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == ITEM_AVAILABILITY_PREVIEW_FIELDS
    assert payload["inventory_item_id"] == str(item.id)
    assert payload["inventory_item_name"] == item.name
    assert payload["inventory_item_kind"] == item.kind
    assert payload["status"] == "available"
    assert payload["conflict_count"] == 0
    _assert_response_datetime_matches(payload["start_at"], start_at)
    _assert_response_datetime_matches(payload["end_at"], end_at)


@pytest.mark.parametrize(
    "availability_status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_authenticated_user_can_read_unavailable_item_preview(
    authenticated_client,
    availability_status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item()
    conflict = _create_availability(
        inventory_item=item,
        status=availability_status,
        start_at=start_at,
        end_at=end_at,
    )

    response = authenticated_client.get(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "unavailable"
    assert payload["conflict_count"] == 1
    assert str(conflict.id) not in response.content.decode()
    assert conflict.notes not in response.content.decode()
    assert HIDDEN_CONFLICT_FIELDS.isdisjoint(payload)


def test_item_availability_preview_respects_half_open_period_boundaries(
    authenticated_client,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item()
    _create_availability(
        inventory_item=item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at - timedelta(hours=1),
        end_at=start_at,
    )
    _create_availability(
        inventory_item=item,
        status=InventoryAvailabilityStatus.RESERVED,
        start_at=end_at,
        end_at=end_at + timedelta(hours=1),
    )

    response = authenticated_client.get(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "available"
    assert response.json()["conflict_count"] == 0


@pytest.mark.parametrize(
    "item_kwargs",
    [
        {"is_active": False},
        {"is_deleted": True},
    ],
)
def test_item_availability_preview_returns_404_for_hidden_item(
    authenticated_client,
    item_kwargs: dict,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(**item_kwargs)

    response = authenticated_client.get(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 404


def test_item_availability_preview_returns_404_for_unknown_item(authenticated_client) -> None:
    start_at, end_at = _valid_period_bounds()

    response = authenticated_client.get(
        _item_url(uuid.uuid4()),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 404


def test_item_availability_preview_rejects_unauthenticated_user(client) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item()

    response = client.get(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code in {401, 403}


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
def test_item_availability_preview_returns_400_for_invalid_period_params(
    authenticated_client,
    query_params: dict[str, str],
    expected_field: str,
) -> None:
    item = _create_inventory_item()

    response = authenticated_client.get(_item_url(item.id), data=query_params)

    assert response.status_code == 400
    assert expected_field in response.json()


@pytest.mark.parametrize("end_offset", [timedelta(), -timedelta(seconds=1)])
def test_item_availability_preview_returns_400_for_invalid_period_order(
    authenticated_client,
    end_offset: timedelta,
) -> None:
    start_at, _ = _valid_period_bounds()
    item = _create_inventory_item()

    response = authenticated_client.get(
        _item_url(item.id),
        data=_query_params(start_at, start_at + end_offset),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Reservation period end_at must be after start_at."}


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_item_availability_preview_rejects_write_methods(
    authenticated_client,
    method: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item()
    request_method = getattr(authenticated_client, method)

    response = request_method(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 405


def test_item_availability_preview_does_not_write_business_data(authenticated_client) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item()
    availability_count = InventoryAvailability.objects.count()
    reservations_model_counts = _reservations_model_counts()

    response = authenticated_client.get(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    assert InventoryAvailability.objects.count() == availability_count
    assert _reservations_model_counts() == reservations_model_counts


@pytest.mark.parametrize("kind", sorted(RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS))
def test_item_availability_preview_accepts_only_existing_titan_kinds(
    authenticated_client,
    kind: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    item = _create_inventory_item(name=f"Available {kind}", kind=kind)

    response = authenticated_client.get(
        _item_url(item.id),
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    assert response.json()["inventory_item_kind"] == kind
    assert response.json()["inventory_item_kind"] in RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS


def test_item_availability_preview_api_does_not_create_forbidden_files() -> None:
    reservations_app_path = Path("backend/apps/reservations")

    assert not (reservations_app_path / "models.py").exists()
    assert not (reservations_app_path / "admin.py").exists()
    assert not (reservations_app_path / "migrations").exists()
