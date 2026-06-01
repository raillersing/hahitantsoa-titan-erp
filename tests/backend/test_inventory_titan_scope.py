import pytest

from apps.inventory.scope import (
    TITAN_ALLOWED_ITEM_KINDS,
    InventoryItemKind,
    assert_titan_allowed_item_kind,
    is_titan_allowed_item_kind,
    normalize_inventory_item_kind,
)


def test_inventory_item_kind_contains_only_titan_allowed_values() -> None:
    assert {item_kind.value for item_kind in InventoryItemKind} == {
        "material",
        "article",
        "material_pack",
    }


def test_titan_allowed_item_kinds_contains_exact_allowed_values() -> None:
    assert TITAN_ALLOWED_ITEM_KINDS == {
        InventoryItemKind.MATERIAL,
        InventoryItemKind.ARTICLE,
        InventoryItemKind.MATERIAL_PACK,
    }


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (InventoryItemKind.MATERIAL, InventoryItemKind.MATERIAL),
        ("material", InventoryItemKind.MATERIAL),
        ("article", InventoryItemKind.ARTICLE),
        ("material_pack", InventoryItemKind.MATERIAL_PACK),
    ],
)
def test_normalize_inventory_item_kind_accepts_allowed_values(
    value: InventoryItemKind | str,
    expected: InventoryItemKind,
) -> None:
    assert normalize_inventory_item_kind(value) == expected


@pytest.mark.parametrize(
    "value",
    [
        "venue",
        "local",
        "room",
        "service",
        "event_service",
        "",
    ],
)
def test_normalize_inventory_item_kind_returns_none_for_disallowed_values(value: str) -> None:
    assert normalize_inventory_item_kind(value) is None


@pytest.mark.parametrize(
    "value",
    [
        InventoryItemKind.MATERIAL,
        InventoryItemKind.ARTICLE,
        InventoryItemKind.MATERIAL_PACK,
        "material",
        "article",
        "material_pack",
    ],
)
def test_is_titan_allowed_item_kind_returns_true_for_allowed_values(
    value: InventoryItemKind | str,
) -> None:
    assert is_titan_allowed_item_kind(value) is True


@pytest.mark.parametrize(
    "value",
    [
        "venue",
        "local",
        "room",
        "service",
        "event_service",
        "",
    ],
)
def test_is_titan_allowed_item_kind_returns_false_for_disallowed_values(value: str) -> None:
    assert is_titan_allowed_item_kind(value) is False


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (InventoryItemKind.MATERIAL, InventoryItemKind.MATERIAL),
        ("material", InventoryItemKind.MATERIAL),
        ("article", InventoryItemKind.ARTICLE),
        ("material_pack", InventoryItemKind.MATERIAL_PACK),
    ],
)
def test_assert_titan_allowed_item_kind_returns_enum_for_allowed_values(
    value: InventoryItemKind | str,
    expected: InventoryItemKind,
) -> None:
    assert assert_titan_allowed_item_kind(value) == expected


def test_assert_titan_allowed_item_kind_rejects_venue_without_exposing_value() -> None:
    with pytest.raises(ValueError) as error:
        assert_titan_allowed_item_kind("venue")

    assert str(error.value) == "Inventory item kind is not allowed for Titan."
    assert "venue" not in str(error.value)
