from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings

ALLOWED_KINDS = {"material", "article", "material_pack"}
DISALLOWED_KINDS = {"venue", "local", "room", "service", "event_service"}
EXPECTED_DEMO_NAMES = {
    "Sonorisation standard",
    "Projecteur LED",
    "Pack sonorisation + eclairage",
}
INVENTORY_LIST_URL = "/api/v1/inventory/items/"


def _call_command(command_name: str) -> str:
    output = StringIO()
    call_command(command_name, stdout=output)
    return output.getvalue()


def _extract_inventory_items(payload):
    if isinstance(payload, list):
        return payload

    if isinstance(payload, dict) and isinstance(payload.get("results"), list):
        return payload["results"]

    pytest.fail("Unexpected inventory API response format.")


def _find_demo_item(items):
    for item in items:
        if item.get("name") in EXPECTED_DEMO_NAMES:
            return item

    pytest.fail("No seeded demo inventory item was exposed by the API.")


@pytest.mark.django_db
def test_authenticated_inventory_detail_api_remains_read_only_with_seeded_demo_data(
    client,
    monkeypatch,
) -> None:
    username = "detail.smoke.dev"
    password = "LocalDetailSmokePassword123!"
    monkeypatch.setenv("DJANGO_DEV_USERNAME", username)
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", password)
    monkeypatch.setenv("DJANGO_DEV_EMAIL", "detail.smoke.dev@example.test")

    with override_settings(DEBUG=True):
        dev_user_output = _call_command("seed_dev_user")
        demo_inventory_output = _call_command("seed_demo_inventory")

    assert "Development user created." in dev_user_output
    assert "Demo inventory seed completed:" in demo_inventory_output
    assert password not in dev_user_output
    assert password not in demo_inventory_output

    assert client.login(username=username, password=password) is True

    list_response = client.get(INVENTORY_LIST_URL)

    assert list_response.status_code == 200

    items = _extract_inventory_items(list_response.json())
    assert items

    item_kinds = {item["kind"] for item in items}
    assert item_kinds <= ALLOWED_KINDS
    assert item_kinds.isdisjoint(DISALLOWED_KINDS)

    selected_item = _find_demo_item(items)
    detail_url = f"{INVENTORY_LIST_URL}{selected_item['id']}/"
    detail_response = client.get(detail_url)

    assert detail_response.status_code == 200

    detail_payload = detail_response.json()
    assert detail_payload["id"] == selected_item["id"]
    assert detail_payload["name"] == selected_item["name"]
    assert detail_payload["kind"] == selected_item["kind"]
    assert detail_payload["kind"] in ALLOWED_KINDS
    assert detail_payload["kind"] not in DISALLOWED_KINDS

    write_payload = {
        "name": selected_item["name"],
        "kind": selected_item["kind"],
        "description": selected_item.get("description", ""),
        "is_active": True,
    }

    post_response = client.post(INVENTORY_LIST_URL, data=write_payload)
    put_response = client.put(detail_url, data=write_payload, content_type="application/json")
    patch_response = client.patch(
        detail_url,
        data={"name": "Read-only update attempt"},
        content_type="application/json",
    )
    delete_response = client.delete(detail_url)

    assert post_response.status_code == 405
    assert put_response.status_code == 405
    assert patch_response.status_code == 405
    assert delete_response.status_code == 405
