import pytest
from rest_framework.test import APIClient

from apps.hahitantsoa.discovery import HahitantsoaDiscoveryItem

HAHITANTSOA_DISCOVERY_ITEMS_URL = "/api/v1/hahitantsoa/discovery-items/"
EXPECTED_CONCEPTS = [
    "event",
    "venue",
    "local",
    "room",
    "hall",
    "material",
    "article",
    "furniture",
    "service",
]
FORBIDDEN_ITEM_FIELDS = {
    "id",
    "uuid",
    "slug",
    "availability",
    "pricing",
    "stock",
    "quantity",
    "unit",
    "reservation",
    "customer",
    "payment",
    "invoice",
    "contract",
    "lifecycle",
    "status",
    "metadata",
}


@pytest.fixture
def authenticated_client():
    client = APIClient()
    client.force_authenticate(user=AuthenticatedUser())
    return client


class AuthenticatedUser:
    is_authenticated = True


def test_hahitantsoa_discovery_items_rejects_unauthenticated_user(client) -> None:
    response = client.get(HAHITANTSOA_DISCOVERY_ITEMS_URL)

    assert response.status_code in {401, 403}


def test_authenticated_user_can_read_hahitantsoa_discovery_items(authenticated_client) -> None:
    response = authenticated_client.get(HAHITANTSOA_DISCOVERY_ITEMS_URL)

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"items", "count"}
    assert payload["count"] == len(payload["items"]) == 9
    assert [item["concept"] for item in payload["items"]] == EXPECTED_CONCEPTS
    assert [item["label"] for item in payload["items"]] == EXPECTED_CONCEPTS

    for item in payload["items"]:
        assert set(item) == {"concept", "label"}
        assert set(item).isdisjoint(FORBIDDEN_ITEM_FIELDS)


@pytest.mark.parametrize("method", ["head", "options"])
def test_hahitantsoa_discovery_items_allows_read_only_metadata_methods(
    authenticated_client,
    method: str,
) -> None:
    response = getattr(authenticated_client, method)(HAHITANTSOA_DISCOVERY_ITEMS_URL)

    assert response.status_code == 200


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_hahitantsoa_discovery_items_rejects_write_methods(
    authenticated_client,
    method: str,
) -> None:
    request_method = getattr(authenticated_client, method)

    response = request_method(HAHITANTSOA_DISCOVERY_ITEMS_URL, data={})

    assert response.status_code == 405


def test_hahitantsoa_discovery_items_api_delegates_to_selector(
    authenticated_client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    selected_items = (
        HahitantsoaDiscoveryItem(concept="event", label="event"),
        HahitantsoaDiscoveryItem(concept="material", label="material"),
    )
    calls = 0

    def fake_list_hahitantsoa_discovery_items():
        nonlocal calls
        calls += 1
        return selected_items

    monkeypatch.setattr(
        "apps.hahitantsoa.views.list_hahitantsoa_discovery_items",
        fake_list_hahitantsoa_discovery_items,
    )

    response = authenticated_client.get(HAHITANTSOA_DISCOVERY_ITEMS_URL)

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {"concept": "event", "label": "event"},
            {"concept": "material", "label": "material"},
        ],
        "count": 2,
    }
    assert calls == 1
