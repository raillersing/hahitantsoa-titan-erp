from datetime import datetime, timedelta
from pathlib import Path

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.inventory.models import InventoryAvailability, InventoryAvailabilityStatus, InventoryItem
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db

HAHITANTSOA_SHARED_AVAILABILITY_URL = "/api/v1/hahitantsoa/shared-availability/"
EXPECTED_ITEM_FIELDS = {
    "inventory_item_id",
    "inventory_item_name",
    "inventory_item_description",
    "inventory_item_kind",
    "start_at",
    "end_at",
    "status",
}


class AuthenticatedUser:
    is_authenticated = True


@pytest.fixture
def authenticated_client():
    client = APIClient()
    client.force_authenticate(user=AuthenticatedUser())
    return client


def _valid_period_bounds() -> tuple[datetime, datetime]:
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=2)
    return start_at, end_at


def _query_params(start_at: datetime, end_at: datetime) -> dict[str, str]:
    return {
        "start_at": start_at.isoformat().replace("+00:00", "Z"),
        "end_at": end_at.isoformat().replace("+00:00", "Z"),
    }


def _create_inventory_item(*, name: str, kind: str, description: str = "") -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind=kind,
        description=description,
        is_active=True,
        is_deleted=False,
    )


def _create_availability(*, inventory_item: InventoryItem, start_at: datetime, end_at: datetime):
    return InventoryAvailability.objects.create(
        inventory_item=inventory_item,
        status=InventoryAvailabilityStatus.BLOCKED,
        start_at=start_at,
        end_at=end_at,
    )


def _reservations_model_counts() -> tuple[int, int]:
    return (ReservationDraft.objects.count(), ReservationDraftLine.objects.count())


def test_hahitantsoa_shared_availability_rejects_unauthenticated_user(client) -> None:
    start_at, end_at = _valid_period_bounds()

    response = client.get(HAHITANTSOA_SHARED_AVAILABILITY_URL, data=_query_params(start_at, end_at))

    assert response.status_code in {401, 403}


def test_authenticated_user_can_read_hahitantsoa_shared_availability(authenticated_client) -> None:
    start_at, end_at = _valid_period_bounds()
    material = _create_inventory_item(name="Alpha material", kind="material", description="A")
    article = _create_inventory_item(name="Beta article", kind="article", description="B")
    _create_inventory_item(name="Gamma pack", kind="material_pack", description="C")

    response = authenticated_client.get(
        HAHITANTSOA_SHARED_AVAILABILITY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"items", "count"}
    assert payload["count"] == len(payload["items"]) == 2
    assert [item["inventory_item_id"] for item in payload["items"]] == [
        str(material.pk),
        str(article.pk),
    ]
    assert [item["inventory_item_kind"] for item in payload["items"]] == ["material", "article"]
    assert [item["inventory_item_name"] for item in payload["items"]] == [
        material.name,
        article.name,
    ]
    assert [item["inventory_item_description"] for item in payload["items"]] == ["A", "B"]
    for item in payload["items"]:
        assert set(item) == EXPECTED_ITEM_FIELDS
        assert item["status"] == "available"


def test_hahitantsoa_shared_availability_excludes_material_pack_and_unavailable_items(
    authenticated_client,
) -> None:
    start_at, end_at = _valid_period_bounds()
    available_article = _create_inventory_item(name="Available article", kind="article")
    unavailable_material = _create_inventory_item(name="Unavailable material", kind="material")
    _create_inventory_item(name="Pack item", kind="material_pack")
    _create_availability(inventory_item=unavailable_material, start_at=start_at, end_at=end_at)

    response = authenticated_client.get(
        HAHITANTSOA_SHARED_AVAILABILITY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    payload = response.json()
    assert [item["inventory_item_id"] for item in payload["items"]] == [str(available_article.pk)]
    assert all(item["inventory_item_kind"] in {"material", "article"} for item in payload["items"])


@pytest.mark.parametrize(
    ("query_params", "expected_field"),
    [
        ({"end_at": "2026-01-01T12:00:00Z"}, "start_at"),
        ({"start_at": "2026-01-01T10:00:00Z"}, "end_at"),
        ({"start_at": "not-a-date", "end_at": "2026-01-01T12:00:00Z"}, "start_at"),
        ({"start_at": "2026-01-01T10:00:00", "end_at": "2026-01-01T12:00:00Z"}, "start_at"),
    ],
)
def test_hahitantsoa_shared_availability_returns_400_for_invalid_period_params(
    authenticated_client,
    query_params: dict[str, str],
    expected_field: str,
) -> None:
    response = authenticated_client.get(HAHITANTSOA_SHARED_AVAILABILITY_URL, data=query_params)

    assert response.status_code == 400
    assert expected_field in response.json()


@pytest.mark.parametrize("offset", [timedelta(), -timedelta(seconds=1)])
def test_hahitantsoa_shared_availability_returns_400_when_end_at_is_not_after_start_at(
    authenticated_client,
    offset: timedelta,
) -> None:
    start_at, _ = _valid_period_bounds()

    response = authenticated_client.get(
        HAHITANTSOA_SHARED_AVAILABILITY_URL,
        data=_query_params(start_at, start_at + offset),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Reservation period end_at must be after start_at."}


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_hahitantsoa_shared_availability_rejects_write_methods(
    authenticated_client,
    method: str,
) -> None:
    start_at, end_at = _valid_period_bounds()
    request_method = getattr(authenticated_client, method)

    response = request_method(
        HAHITANTSOA_SHARED_AVAILABILITY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 405


def test_hahitantsoa_shared_availability_endpoint_does_not_write_business_data(
    authenticated_client,
) -> None:
    start_at, end_at = _valid_period_bounds()
    _create_inventory_item(name="Available material", kind="material")
    availability_count = InventoryAvailability.objects.count()
    reservation_counts = _reservations_model_counts()

    response = authenticated_client.get(
        HAHITANTSOA_SHARED_AVAILABILITY_URL,
        data=_query_params(start_at, end_at),
    )

    assert response.status_code == 200
    assert InventoryAvailability.objects.count() == availability_count
    assert _reservations_model_counts() == reservation_counts


def test_hahitantsoa_shared_availability_allows_expanded_backend_package_layout() -> None:
    hahitantsoa_path = Path("backend/apps/hahitantsoa")

    assert hahitantsoa_path.exists()
    assert (hahitantsoa_path / "services.py").exists()
    assert (hahitantsoa_path / "models.py").exists()
    assert (hahitantsoa_path / "permissions.py").exists()
    assert (hahitantsoa_path / "migrations").exists()
