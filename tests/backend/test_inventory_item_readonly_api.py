import uuid

import pytest

from apps.inventory.models import InventoryItem

INVENTORY_ITEM_FIELDS = {
    "id",
    "name",
    "kind",
    "description",
    "code",
    "section",
    "unit",
    "purchase_price",
    "rental_price",
    "breakage_price",
    "reported_inventory_quantity",
    "reported_damaged_quantity",
    "stock_summary",
    "image_url",
    "is_active",
    "created_at",
    "updated_at",
    "is_deleted",
    "deleted_at",
    "created_by",
    "updated_by",
}


@pytest.fixture
def authenticated_client(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="inventory-reader",
        password="test-password",
    )
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_inventory_item_list_returns_only_active_not_deleted_items(authenticated_client) -> None:
    visible_item = InventoryItem.objects.create(
        name="Camera",
        kind="material",
        description="4K camera",
    )
    InventoryItem.objects.create(name="Inactive item", kind="article", is_active=False)
    InventoryItem.objects.create(name="Deleted item", kind="material_pack", is_deleted=True)

    response = authenticated_client.get("/api/v1/inventory/items/")

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
def test_inventory_item_detail_returns_active_not_deleted_item(authenticated_client) -> None:
    item = InventoryItem.objects.create(name="Speaker", kind="article")

    response = authenticated_client.get(f"/api/v1/inventory/items/{item.pk}/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == str(item.id)
    assert payload["name"] == "Speaker"
    assert payload["kind"] == "article"
    assert set(payload) == INVENTORY_ITEM_FIELDS


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["get", "head"])
@pytest.mark.parametrize(
    "item_kwargs",
    [
        {"name": "Inactive item", "kind": "material", "is_active": False},
        {"name": "Deleted item", "kind": "article", "is_deleted": True},
    ],
)
def test_inventory_item_detail_returns_404_for_hidden_items(
    authenticated_client,
    item_kwargs: dict,
    method: str,
) -> None:
    item = InventoryItem.objects.create(**item_kwargs)

    response = getattr(authenticated_client, method)(f"/api/v1/inventory/items/{item.pk}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_inventory_item_detail_returns_404_for_unknown_uuid(authenticated_client) -> None:
    response = authenticated_client.get(f"/api/v1/inventory/items/{uuid.uuid4()}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_inventory_item_list_rejects_post(authenticated_client) -> None:
    response = authenticated_client.post(
        "/api/v1/inventory/items/",
        data={"name": "Camera", "kind": "material"},
    )

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_inventory_item_detail_rejects_write_methods(authenticated_client, method: str) -> None:
    item = InventoryItem.objects.create(name="Camera", kind="material")
    request_method = getattr(authenticated_client, method)

    response = request_method(
        f"/api/v1/inventory/items/{item.pk}/",
        data={"name": "Updated", "kind": "article"},
        content_type="application/json",
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_inventory_management_actor_can_create_update_and_soft_delete_item(
    client, django_user_model
) -> None:
    user = django_user_model.objects.create_user(
        username="inventory-admin", password="test-pass", is_staff=True
    )
    client.force_login(user)
    create_response = client.post(
        "/api/v1/inventory/items/",
        data={"name": "Admin camera", "kind": "material", "code": "CAM-001"},
        content_type="application/json",
    )
    assert create_response.status_code == 201
    item_id = create_response.json()["id"]
    update_response = client.patch(
        f"/api/v1/inventory/items/{item_id}/",
        data={"name": "Updated camera"},
        content_type="application/json",
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated camera"
    delete_response = client.delete(f"/api/v1/inventory/items/{item_id}/")
    assert delete_response.status_code == 204
    assert not InventoryItem.objects.get(pk=item_id).is_active


@pytest.mark.django_db
def test_inventory_item_list_filter_by_name(authenticated_client):
    matching = InventoryItem.objects.create(name="Projector XL", kind="material")
    InventoryItem.objects.create(name="Speaker", kind="article")

    response = authenticated_client.get("/api/v1/inventory/items/?name=Projector")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(matching.id)


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["get", "head"])
def test_inventory_reader_cannot_request_inactive_items(authenticated_client, method):
    response = getattr(authenticated_client, method)(
        "/api/v1/inventory/items/?include_inactive=true"
    )

    assert response.status_code == 403


@pytest.mark.django_db
def test_inventory_manager_can_find_reload_and_reactivate_inactive_item(client, django_user_model):
    user = django_user_model.objects.create_user(username="stock-manager", is_staff=True)
    client.force_login(user)
    inactive = InventoryItem.objects.create(
        name="Inactive camera", kind="material", is_active=False
    )
    active = InventoryItem.objects.create(name="Active camera", kind="article")
    deleted = InventoryItem.objects.create(name="Deleted camera", kind="material", is_deleted=True)

    default_response = client.get("/api/v1/inventory/items/")
    assert default_response.status_code == 200
    assert [item["id"] for item in default_response.json()] == [str(active.pk)]
    management_response = client.get("/api/v1/inventory/items/?include_inactive=true&name=camera")
    assert management_response.status_code == 200
    assert {item["id"] for item in management_response.json()} == {str(active.pk), str(inactive.pk)}
    detail_url = f"/api/v1/inventory/items/{inactive.pk}/"
    assert client.get(detail_url).status_code == 200
    assert client.head(detail_url).status_code == 200
    assert client.head("/api/v1/inventory/items/?include_inactive=true").status_code == 200
    response = client.patch(detail_url, data={"is_active": True}, content_type="application/json")
    assert response.status_code == 200
    inactive.refresh_from_db()
    assert inactive.is_active is True
    assert client.get(detail_url).json()["is_active"] is True
    deleted_url = f"/api/v1/inventory/items/{deleted.pk}/"
    assert client.get(deleted_url).status_code == 404
    assert (
        client.patch(
            deleted_url, data={"is_active": True}, content_type="application/json"
        ).status_code
        == 404
    )


@pytest.mark.django_db
def test_inventory_item_list_filter_by_kind(authenticated_client):
    matching = InventoryItem.objects.create(name="LED Panel", kind="material")
    InventoryItem.objects.create(name="Cable pack", kind="material_pack")

    response = authenticated_client.get("/api/v1/inventory/items/?kind=material")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(matching.id)


@pytest.mark.django_db
def test_inventory_item_list_filter_by_description(authenticated_client):
    matching = InventoryItem.objects.create(
        name="Camera A", kind="material", description="4K professional camera"
    )
    InventoryItem.objects.create(name="Camera B", kind="material", description="HD consumer camera")

    response = authenticated_client.get("/api/v1/inventory/items/?description=professional")
    assert response.status_code == 200
    results = response.json()
    assert len(results) == 1
    assert results[0]["id"] == str(matching.id)
