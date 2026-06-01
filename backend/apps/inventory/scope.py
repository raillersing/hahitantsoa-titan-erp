from enum import StrEnum


class InventoryItemKind(StrEnum):
    MATERIAL = "material"
    ARTICLE = "article"
    MATERIAL_PACK = "material_pack"


TITAN_ALLOWED_ITEM_KINDS = frozenset(InventoryItemKind)


def normalize_inventory_item_kind(value: InventoryItemKind | str) -> InventoryItemKind | None:
    if isinstance(value, InventoryItemKind):
        return value

    try:
        return InventoryItemKind(value)
    except ValueError:
        return None


def is_titan_allowed_item_kind(value: InventoryItemKind | str) -> bool:
    return normalize_inventory_item_kind(value) in TITAN_ALLOWED_ITEM_KINDS


def assert_titan_allowed_item_kind(value: InventoryItemKind | str) -> InventoryItemKind:
    item_kind = normalize_inventory_item_kind(value)

    if item_kind in TITAN_ALLOWED_ITEM_KINDS:
        return item_kind

    raise ValueError("Inventory item kind is not allowed for Titan.")
