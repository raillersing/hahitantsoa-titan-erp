from enum import StrEnum

from apps.inventory.scope import InventoryItemKind, normalize_inventory_item_kind


class HahitantsoaDiscoveryConcept(StrEnum):
    EVENT = "event"
    VENUE = "venue"
    LOCAL = "local"
    ROOM = "room"
    HALL = "hall"
    MATERIAL = "material"
    ARTICLE = "article"
    FURNITURE = "furniture"
    SERVICE = "service"


HAHITANTSOA_SHARED_INVENTORY_CONCEPTS = frozenset(
    {
        HahitantsoaDiscoveryConcept.MATERIAL,
        HahitantsoaDiscoveryConcept.ARTICLE,
    }
)
HAHITANTSOA_ONLY_DISCOVERY_CONCEPTS = frozenset(
    {
        HahitantsoaDiscoveryConcept.EVENT,
        HahitantsoaDiscoveryConcept.VENUE,
        HahitantsoaDiscoveryConcept.LOCAL,
        HahitantsoaDiscoveryConcept.ROOM,
        HahitantsoaDiscoveryConcept.HALL,
        HahitantsoaDiscoveryConcept.FURNITURE,
        HahitantsoaDiscoveryConcept.SERVICE,
    }
)
HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS = (
    HAHITANTSOA_SHARED_INVENTORY_CONCEPTS | HAHITANTSOA_ONLY_DISCOVERY_CONCEPTS
)
HAHITANTSOA_SHARED_INVENTORY_ITEM_KINDS = frozenset(
    {InventoryItemKind.MATERIAL, InventoryItemKind.ARTICLE}
)


class HahitantsoaScopeError(ValueError):
    pass


def normalize_hahitantsoa_discovery_concept(
    value: HahitantsoaDiscoveryConcept | str,
) -> HahitantsoaDiscoveryConcept | None:
    if isinstance(value, HahitantsoaDiscoveryConcept):
        return value

    try:
        return HahitantsoaDiscoveryConcept(value)
    except ValueError:
        return None


def is_hahitantsoa_read_only_discovery_concept(
    value: HahitantsoaDiscoveryConcept | str,
) -> bool:
    return (
        normalize_hahitantsoa_discovery_concept(value) in HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS
    )


def assert_hahitantsoa_read_only_discovery_concept(
    value: HahitantsoaDiscoveryConcept | str,
) -> HahitantsoaDiscoveryConcept:
    concept = normalize_hahitantsoa_discovery_concept(value)

    if concept in HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS:
        return concept

    raise HahitantsoaScopeError("Concept is not allowed for Hahitantsoa read-only discovery.")


def normalize_hahitantsoa_shared_inventory_item_kind(
    value: InventoryItemKind | str,
) -> InventoryItemKind | None:
    return normalize_inventory_item_kind(value)


def is_hahitantsoa_shared_inventory_item_kind(value: InventoryItemKind | str) -> bool:
    return normalize_hahitantsoa_shared_inventory_item_kind(value) in (
        HAHITANTSOA_SHARED_INVENTORY_ITEM_KINDS
    )


def assert_hahitantsoa_shared_inventory_item_kind(
    value: InventoryItemKind | str,
) -> InventoryItemKind:
    item_kind = normalize_hahitantsoa_shared_inventory_item_kind(value)

    if item_kind in HAHITANTSOA_SHARED_INVENTORY_ITEM_KINDS:
        return item_kind

    raise HahitantsoaScopeError(
        "Inventory item kind is not allowed for Hahitantsoa shared inventory planning."
    )
