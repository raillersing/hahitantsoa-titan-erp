import pytest

from apps.inventory.models import InventoryItem


@pytest.mark.django_db
def test_drf_session_login_page_remains_available_during_frontend_transition(client) -> None:
    response = client.get("/api-auth/login/")

    assert response.status_code == 200


@pytest.mark.django_db
def test_drf_session_logout_post_remains_available_during_frontend_transition(
    client,
    django_user_model,
) -> None:
    user = django_user_model.objects.create_user(
        username="session-reader",
        password="test-password",
    )
    assert client.login(username=user.username, password="test-password") is True

    response = client.post("/api-auth/logout/")

    assert response.status_code in {200, 302}
    assert "_auth_user_id" not in client.session


@pytest.mark.django_db
def test_inventory_api_requires_session_login(client, django_user_model) -> None:
    user = django_user_model.objects.create_user(
        username="inventory-session-reader",
        password="test-password",
    )
    item = InventoryItem.objects.create(name="Camera", kind="material")

    unauthenticated_response = client.get("/api/v1/inventory/items/")

    assert unauthenticated_response.status_code in {401, 403}
    assert client.login(username=user.username, password="test-password") is True

    authenticated_response = client.get("/api/v1/inventory/items/")

    assert authenticated_response.status_code == 200
    assert authenticated_response.json()[0]["id"] == str(item.id)

    client.logout()
    logged_out_response = client.get("/api/v1/inventory/items/")

    assert logged_out_response.status_code in {401, 403}


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
def test_public_foundation_endpoints_remain_public_without_session(client, path: str) -> None:
    response = client.get(path)

    assert response.status_code == 200
