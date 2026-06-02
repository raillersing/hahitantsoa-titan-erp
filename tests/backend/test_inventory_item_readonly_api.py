import uuid

import pytest

from apps.inventory.models import InventoryItem

INVENTORY_ITEM_FIELDS = {
    "id",
    "name",
    "kind",
    "description",
    "is_active",
    "created_at",
    "updated_at",
    "is_deleted",
    "deleted_at",
    "created_by",
    "updated_by",
}


@pytest.mark.django_db
def test_inventory_item_list_returns_only_active_not_deleted_items(client) -> None:
    visible_item = InventoryItem.objects.create(
        name="Camera",
        kind="material",
        description="4K camera",
    )
    InventoryItem.objects.create(name="Inactive item", kind="article", is_active=False)
    InventoryItem.objects.create(name="Deleted item", kind="material_pack", is_deleted=True)

    response = client.get("/api/v1/inventory/items/")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(visible_item.id)
    assert payload[0]["name"] == "Camera"
    assert payload[0]["kind"] == "material"
    assert payload[0]["description"] == "4K camera"
    assert payload[0]["is_active"] is True
    assert payload[0]["is_deleted"] is False
    assert set(payload[0]) == INVENTORY_ITEM_FIELDS


@pytest.mark.django_db
def test_inventory_item_detail_returns_active_not_deleted_item(client) -> None:
    item = InventoryItem.objects.create(name="Speaker", kind="article")

    response = client.get(f"/api/v1/inventory/items/{item.pk}/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == str(item.id)
    assert payload["name"] == "Speaker"
    assert payload["kind"] == "article"
    assert set(payload) == INVENTORY_ITEM_FIELDS


@pytest.mark.django_db
@pytest.mark.parametrize(
    "item_kwargs",
    [
        {"name": "Inactive item", "kind": "material", "is_active": False},
        {"name": "Deleted item", "kind": "article", "is_deleted": True},
    ],
)
def test_inventory_item_detail_returns_404_for_hidden_items(client, item_kwargs: dict) -> None:
    item = InventoryItem.objects.create(**item_kwargs)

    response = client.get(f"/api/v1/inventory/items/{item.pk}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_inventory_item_detail_returns_404_for_unknown_uuid(client) -> None:
    response = client.get(f"/api/v1/inventory/items/{uuid.uuid4()}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_inventory_item_list_rejects_post(client) -> None:
    response = client.post(
        "/api/v1/inventory/items/",
        data={"name": "Camera", "kind": "material"},
    )

    assert response.status_code == 405


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_inventory_item_detail_rejects_write_methods(client, method: str) -> None:
    item = InventoryItem.objects.create(name="Camera", kind="material")
    request_method = getattr(client, method)

    response = request_method(
        f"/api/v1/inventory/items/{item.pk}/",
        data={"name": "Updated", "kind": "article"},
        content_type="application/json",
    )

    assert response.status_code == 405
