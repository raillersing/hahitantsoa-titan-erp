import pytest

from apps.inventory.models import InventoryItem


def _force_login(client, django_user_model):
    user = django_user_model.objects.create_user(
        username="inventory-auth-reader",
        password="test-password",
    )
    client.force_login(user)
    return client


@pytest.mark.django_db
def test_inventory_item_list_rejects_unauthenticated_user(client) -> None:
    InventoryItem.objects.create(name="Camera", kind="material")

    response = client.get("/api/v1/inventory/items/")

    assert response.status_code in {401, 403}


@pytest.mark.django_db
def test_inventory_item_detail_rejects_unauthenticated_user(client) -> None:
    item = InventoryItem.objects.create(name="Camera", kind="material")

    response = client.get(f"/api/v1/inventory/items/{item.pk}/")

    assert response.status_code in {401, 403}


@pytest.mark.django_db
def test_authenticated_user_can_read_inventory_item_list(client, django_user_model) -> None:
    authenticated_client = _force_login(client, django_user_model)
    item = InventoryItem.objects.create(name="Camera", kind="material")

    response = authenticated_client.get("/api/v1/inventory/items/")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["id"] == str(item.id)


@pytest.mark.django_db
def test_authenticated_user_can_read_inventory_item_detail(client, django_user_model) -> None:
    authenticated_client = _force_login(client, django_user_model)
    item = InventoryItem.objects.create(name="Camera", kind="material")

    response = authenticated_client.get(f"/api/v1/inventory/items/{item.pk}/")

    assert response.status_code == 200
    assert response.json()["id"] == str(item.id)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "path",
    [
        "/healthz/",
        "/readyz/",
        "/api/schema/?format=json",
        "/api/docs/swagger/",
        "/api/docs/redoc/",
    ],
)
def test_public_foundation_endpoints_remain_public(client, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 200
