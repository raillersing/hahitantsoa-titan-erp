import pytest
from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import models

from apps.inventory.models import InventoryItem


def test_inventory_item_is_concrete_model() -> None:
    assert InventoryItem._meta.abstract is False


def test_inventory_app_registry_contains_inventory_item() -> None:
    assert InventoryItem in list(apps.get_app_config("inventory").get_models())


def test_inventory_item_fields() -> None:
    field_names = {field.name for field in InventoryItem._meta.get_fields()}

    assert {
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
    }.issubset(field_names)


def test_inventory_item_kind_choices_match_titan_allowed_values() -> None:
    kind = InventoryItem._meta.get_field("kind")

    assert isinstance(kind, models.CharField)
    assert [choice[0] for choice in kind.choices] == [
        "material",
        "article",
        "material_pack",
    ]


@pytest.mark.parametrize("kind", ["material", "article", "material_pack"])
def test_inventory_item_clean_accepts_allowed_kinds(kind: str) -> None:
    item = InventoryItem(name="Allowed item", kind=kind)

    item.clean()

    assert item.kind == kind


@pytest.mark.parametrize("kind", ["venue", "local", "room", "service", "event_service"])
def test_inventory_item_clean_rejects_disallowed_kinds_without_exposing_value(kind: str) -> None:
    item = InventoryItem(name="Rejected item", kind=kind)

    with pytest.raises(ValidationError) as error:
        item.clean()

    messages = error.value.message_dict["kind"]
    assert messages == ["Inventory item kind is not allowed for Titan."]
    assert kind not in str(error.value)


def test_inventory_item_str_returns_name() -> None:
    item = InventoryItem(name="Folding chair", kind="material")

    assert str(item) == "Folding chair"
