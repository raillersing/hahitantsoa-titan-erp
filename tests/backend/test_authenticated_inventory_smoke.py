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


@pytest.mark.django_db
def test_authenticated_inventory_api_smoke_with_seeded_demo_data(client, monkeypatch) -> None:
    username = "smoke.dev"
    password = "LocalSmokePassword123!"
    monkeypatch.setenv("DJANGO_DEV_USERNAME", username)
    monkeypatch.setenv("DJANGO_DEV_PASSWORD", password)
    monkeypatch.setenv("DJANGO_DEV_EMAIL", "smoke.dev@example.test")

    with override_settings(DEBUG=True):
        dev_user_output = _call_command("seed_dev_user")
        demo_inventory_output = _call_command("seed_demo_inventory")

    assert "Development user created." in dev_user_output
    assert "Demo inventory seed completed:" in demo_inventory_output
    assert password not in dev_user_output
    assert password not in demo_inventory_output

    assert client.login(username=username, password=password) is True

    response = client.get("/api/v1/inventory/items/")

    assert response.status_code == 200

    items = _extract_inventory_items(response.json())
    item_kinds = {item["kind"] for item in items}
    item_names = {item["name"] for item in items}

    assert item_kinds == ALLOWED_KINDS
    assert item_kinds.isdisjoint(DISALLOWED_KINDS)
    assert EXPECTED_DEMO_NAMES.issubset(item_names)
