from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings

from apps.inventory.models import InventoryItem
from apps.inventory.scope import InventoryItemKind

DEBUG_FALSE_MESSAGE = "Refusing to seed demo inventory when DEBUG is False."
ALLOWED_KINDS = {
    InventoryItemKind.MATERIAL.value,
    InventoryItemKind.ARTICLE.value,
    InventoryItemKind.MATERIAL_PACK.value,
}
DISALLOWED_KINDS = {"venue", "local", "room", "service", "event_service"}
DISALLOWED_DEMO_TERMS = DISALLOWED_KINDS | {"salle", "lieu"}


def _call_seed_demo_inventory() -> str:
    output = StringIO()
    call_command("seed_demo_inventory", stdout=output)
    return output.getvalue()


@pytest.mark.django_db
def test_seed_demo_inventory_refuses_when_debug_is_false() -> None:
    with override_settings(DEBUG=False):
        output = _call_seed_demo_inventory()

    assert InventoryItem.objects.count() == 0
    assert DEBUG_FALSE_MESSAGE in output


@pytest.mark.django_db
def test_seed_demo_inventory_creates_demo_items_when_debug_is_true() -> None:
    with override_settings(DEBUG=True):
        output = _call_seed_demo_inventory()

    assert InventoryItem.objects.count() == 3
    assert "Demo inventory seed completed:" in output
    assert "created" in output
    assert "updated" in output


@pytest.mark.django_db
def test_seed_demo_inventory_creates_each_titan_allowed_kind() -> None:
    with override_settings(DEBUG=True):
        _call_seed_demo_inventory()

    assert set(InventoryItem.objects.values_list("kind", flat=True)) == ALLOWED_KINDS


@pytest.mark.django_db
def test_seed_demo_inventory_never_creates_disallowed_kinds() -> None:
    with override_settings(DEBUG=True):
        _call_seed_demo_inventory()

    for kind in DISALLOWED_KINDS:
        assert InventoryItem.objects.filter(kind=kind).exists() is False


@pytest.mark.django_db
def test_seed_demo_inventory_demo_text_avoids_disallowed_titan_terms() -> None:
    with override_settings(DEBUG=True):
        _call_seed_demo_inventory()

    for item in InventoryItem.objects.all():
        demo_text = f"{item.name} {item.description}".lower()
        for disallowed_term in DISALLOWED_DEMO_TERMS:
            assert disallowed_term not in demo_text


def test_seed_demo_inventory_uses_current_titan_scope_only() -> None:
    assert {item_kind.value for item_kind in InventoryItemKind} == ALLOWED_KINDS


@pytest.mark.django_db
def test_seed_demo_inventory_is_idempotent_without_duplicates() -> None:
    with override_settings(DEBUG=True):
        first_output = _call_seed_demo_inventory()
        second_output = _call_seed_demo_inventory()

    assert InventoryItem.objects.count() == 3
    assert InventoryItem.objects.values("name").distinct().count() == 3
    assert "3 created, 0 updated" in first_output
    assert "0 created, 3 updated" in second_output


@pytest.mark.django_db
def test_seed_demo_inventory_updates_existing_demo_items() -> None:
    InventoryItem.objects.create(
        name="Projecteur LED",
        kind=InventoryItemKind.MATERIAL.value,
        description="Outdated demo description",
        is_active=False,
        is_deleted=True,
    )

    with override_settings(DEBUG=True):
        output = _call_seed_demo_inventory()

    item = InventoryItem.objects.get(name="Projecteur LED")
    assert item.kind == InventoryItemKind.ARTICLE.value
    assert item.description == "Projecteur compact pour demonstration du catalogue articles."
    assert item.is_active is True
    assert item.is_deleted is False
    assert item.deleted_at is None
    assert "2 created, 1 updated" in output
