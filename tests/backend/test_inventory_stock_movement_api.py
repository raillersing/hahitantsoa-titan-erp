from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db

STOCK_MOVEMENT_LIST_URL = "/api/v1/inventory/stock-movements/"


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="movement-reader",
        password="test-pass",
    )
    client.force_login(user)
    return client


def _inventory_item() -> InventoryItem:
    return InventoryItem.objects.create(
        name="API Movement Light",
        kind="material",
        description="Movement API item",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="API Movement Customer",
        email="api-movement@example.test",
        phone="+261340000666",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="API movement draft",
    )


def test_stock_movement_list_requires_authentication(client) -> None:
    response = client.get(STOCK_MOVEMENT_LIST_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_create_list_and_read_stock_movement(authenticated_client) -> None:
    inventory_item = _inventory_item()
    reservation_draft = _reservation_draft()

    create_response = authenticated_client.post(
        STOCK_MOVEMENT_LIST_URL,
        data={
            "inventory_item": str(inventory_item.id),
            "reservation_draft": str(reservation_draft.id),
            "movement_type": "outbound_delivery",
            "quantity": 2,
            "notes": "Delivered to client",
        },
        content_type="application/json",
    )

    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["movement_type"] == "outbound_delivery"
    assert payload["direction"] == "outbound"
    assert payload["quantity"] == 2

    list_response = authenticated_client.get(STOCK_MOVEMENT_LIST_URL)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    detail_response = authenticated_client.get(f"{STOCK_MOVEMENT_LIST_URL}{payload['id']}/")
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == payload["id"]


def test_stock_movement_create_rejects_other_without_explicit_direction(
    authenticated_client,
) -> None:
    response = authenticated_client.post(
        STOCK_MOVEMENT_LIST_URL,
        data={
            "inventory_item": str(_inventory_item().id),
            "movement_type": "other",
            "quantity": 1,
            "source_label": "Manual stock note",
            "notes": "Direction missing",
        },
        content_type="application/json",
    )

    assert response.status_code == 400


def test_stock_movement_create_rejects_standalone_without_source_and_notes(
    authenticated_client,
) -> None:
    response = authenticated_client.post(
        STOCK_MOVEMENT_LIST_URL,
        data={
            "inventory_item": str(_inventory_item().id),
            "movement_type": "other",
            "direction": "outbound",
            "quantity": 1,
            "source_label": "",
            "notes": "",
        },
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_inventory_stock_movement"


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_stock_movement_detail_rejects_write_methods(authenticated_client, method: str) -> None:
    create_response = authenticated_client.post(
        STOCK_MOVEMENT_LIST_URL,
        data={
            "inventory_item": str(_inventory_item().id),
            "movement_type": "other",
            "direction": "inbound",
            "quantity": 1,
            "source_label": "Manual correction",
            "notes": "Immutable ledger entry",
        },
        content_type="application/json",
    )
    movement_id = create_response.json()["id"]
    request_method = getattr(authenticated_client, method)

    response = request_method(
        f"{STOCK_MOVEMENT_LIST_URL}{movement_id}/",
        data={"notes": "Changed"},
        content_type="application/json",
    )

    assert response.status_code == 405
