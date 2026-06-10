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

AVAILABILITY_SUMMARY_URL = "/api/v1/reservations/availability-summary/"
AVAILABILITY_SUMMARY_FIELDS = {
    "start_at",
    "end_at",
    "available_item_count",
    "available_preview_count",
    "available_item_kinds",
}

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="reservation-summary-reader",
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


def test_availability_summary_rejects_unauthenticated_user(client) -> None:
    start_at, end_at = _valid_period_bounds()

    response = client.get(AVAILABILITY_SUMMARY_URL, data=_query_params(start_at, end_at))

    assert response.status_code in {401, 403}


def test_authenticated_user_can_read_availability_summary(authenticated_client) -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Alpha material", kind="material")
    _create_inventory_item(name="Beta article", kind="article")
    _create_inventory_item(name="Gamma pack", kind="material_pack")

    response = authenticated_client.get(
        AVAILABILITY_SUMMARY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == AVAILABILITY_SUMMARY_FIELDS
    _assert_response_datetime_matches(payload["start_at"], start_at)
    _assert_response_datetime_matches(payload["end_at"], end_at)
    assert payload["available_item_count"] == 3
    assert payload["available_preview_count"] == 3
    assert payload["available_item_kinds"] == [
        "material",
        "article",
        "material_pack",
    ]


@pytest.mark.parametrize(
    "status",
    [
        InventoryAvailabilityStatus.BLOCKED,
        InventoryAvailabilityStatus.RESERVED,
    ],
)
def test_availability_summary_excludes_unavailable_items(
    authenticated_client,
    status: InventoryAvailabilityStatus,
) -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available article", kind="article")
    unavailable_item = _create_inventory_item(name="Unavailable material", kind="material")
    _create_availability(
        inventory_item=unavailable_item,
        status=status,
        start_at=start_at,
        end_at=end_at,
    )

    response = authenticated_client.get(
        AVAILABILITY_SUMMARY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["available_item_count"] == 1
    assert payload["available_preview_count"] == 1
    assert payload["available_item_kinds"] == ["article"]


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
def test_availability_summary_returns_400_for_invalid_period_params(
    authenticated_client,
    query_params: dict[str, str],
    expected_field: str,
) -> None:
    response = authenticated_client.get(AVAILABILITY_SUMMARY_URL, data=query_params)

    assert response.status_code == 400
    assert expected_field in response.json()


def test_availability_summary_returns_400_when_end_at_is_not_after_start_at(
    authenticated_client,
) -> None:
    start_at, _ = _valid_period_bounds()

    response = authenticated_client.get(
        AVAILABILITY_SUMMARY_URL,
        data=_query_params(start_at, start_at),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Reservation period end_at must be after start_at."}


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_availability_summary_rejects_write_methods(
    authenticated_client,
    method: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    request_method = getattr(authenticated_client, method)

    response = request_method(
        AVAILABILITY_SUMMARY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 405


def test_availability_summary_endpoint_does_not_write_business_data(
    authenticated_client,
) -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available material", kind="material")
    availability_count = InventoryAvailability.objects.count()
    reservation_counts = _reservations_model_counts()

    response = authenticated_client.get(
        AVAILABILITY_SUMMARY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    assert InventoryAvailability.objects.count() == availability_count
    assert _reservations_model_counts() == reservation_counts


def test_reservations_api_surface_allows_draft_model_files() -> None:
    reservations_app_config = apps.get_app_config("reservations")
    reservations_app_path = Path(reservations_app_config.path)

    forbidden_file_names = {"admin.py"}
    existing_file_names = {path.name for path in reservations_app_path.iterdir() if path.is_file()}

    assert forbidden_file_names.isdisjoint(existing_file_names)
    assert "models.py" in existing_file_names
    assert (reservations_app_path / "migrations").exists()


def test_reservations_app_contains_draft_models() -> None:
    from apps.reservations.models import ReservationDraft, ReservationDraftLine

    app_config = apps.get_app_config("reservations")

    assert set(app_config.get_models()) == {ReservationDraft, ReservationDraftLine}
