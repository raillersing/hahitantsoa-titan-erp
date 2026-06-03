from apps.inventory.models import InventoryItemKind

RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS = frozenset(
    {
        InventoryItemKind.MATERIAL.value,
        InventoryItemKind.ARTICLE.value,
        InventoryItemKind.MATERIAL_PACK.value,
    }
)
RESERVATION_DISALLOWED_INVENTORY_ITEM_KINDS = frozenset(
    {
        "venue",
        "local",
        "room",
        "service",
        "event_service",
    }
)


def is_reservable_inventory_item_kind(kind: str) -> bool:
    return kind in RESERVATION_ALLOWED_INVENTORY_ITEM_KINDS


def assert_reservable_inventory_item_kind(kind: str) -> None:
    if is_reservable_inventory_item_kind(kind):
        return

    raise ValueError(f"Inventory item kind '{kind}' is not reservable in Titan.")
