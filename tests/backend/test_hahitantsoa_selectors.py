from dataclasses import FrozenInstanceError, fields
from inspect import getmembers, isfunction, signature

import pytest

from apps.hahitantsoa import selectors
from apps.hahitantsoa.discovery import HahitantsoaDiscoveryItem
from apps.hahitantsoa.scope import (
    HAHITANTSOA_ONLY_DISCOVERY_CONCEPTS,
    HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS,
    HAHITANTSOA_SHARED_INVENTORY_CONCEPTS,
    HahitantsoaDiscoveryConcept,
)
from apps.hahitantsoa.selectors import list_hahitantsoa_discovery_items
from apps.inventory.scope import is_titan_allowed_item_kind

EXPECTED_DISCOVERY_CONCEPTS = (
    HahitantsoaDiscoveryConcept.EVENT,
    HahitantsoaDiscoveryConcept.VENUE,
    HahitantsoaDiscoveryConcept.LOCAL,
    HahitantsoaDiscoveryConcept.ROOM,
    HahitantsoaDiscoveryConcept.HALL,
    HahitantsoaDiscoveryConcept.MATERIAL,
    HahitantsoaDiscoveryConcept.ARTICLE,
    HahitantsoaDiscoveryConcept.FURNITURE,
    HahitantsoaDiscoveryConcept.SERVICE,
)
FORBIDDEN_DISCOVERY_FIELDS = {
    "availability",
    "booking",
    "reservation",
    "pricing",
    "stock",
    "quantity",
    "unit",
    "payment",
    "invoice",
    "customer",
    "commercial",
}


def test_list_hahitantsoa_discovery_items_returns_immutable_item_tuple() -> None:
    items = list_hahitantsoa_discovery_items()

    assert isinstance(items, tuple)
    assert all(isinstance(item, HahitantsoaDiscoveryItem) for item in items)

    with pytest.raises(FrozenInstanceError):
        items[0].label = "changed"  # type: ignore[misc]


def test_selector_returns_exact_categories_and_labels_in_deterministic_order() -> None:
    items = list_hahitantsoa_discovery_items()

    assert tuple(item.concept for item in items) == EXPECTED_DISCOVERY_CONCEPTS
    assert tuple(item.label for item in items) == tuple(
        concept.value for concept in EXPECTED_DISCOVERY_CONCEPTS
    )
    assert {item.concept for item in items} == HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS


def test_selector_returns_stable_read_only_content() -> None:
    first_result = list_hahitantsoa_discovery_items()
    second_result = list_hahitantsoa_discovery_items()

    assert first_result == second_result
    assert first_result is second_result


def test_selector_preserves_titan_separation() -> None:
    selected_concepts = {item.concept for item in list_hahitantsoa_discovery_items()}
    selected_titan_concepts = {
        concept for concept in selected_concepts if is_titan_allowed_item_kind(concept.value)
    }

    assert HAHITANTSOA_SHARED_INVENTORY_CONCEPTS == {
        HahitantsoaDiscoveryConcept.MATERIAL,
        HahitantsoaDiscoveryConcept.ARTICLE,
    }
    assert selected_titan_concepts == HAHITANTSOA_SHARED_INVENTORY_CONCEPTS
    assert all(
        not is_titan_allowed_item_kind(concept.value)
        for concept in HAHITANTSOA_ONLY_DISCOVERY_CONCEPTS
    )
    assert "material_pack" not in {concept.value for concept in selected_concepts}
    assert is_titan_allowed_item_kind("material_pack") is True


def test_selector_public_contract_has_no_parameters_or_write_api() -> None:
    public_module_functions = {
        name
        for name, member in getmembers(selectors, isfunction)
        if not name.startswith("_") and member.__module__ == selectors.__name__
    }

    assert tuple(signature(list_hahitantsoa_discovery_items).parameters) == ()
    assert public_module_functions == {"list_hahitantsoa_discovery_items"}


def test_selected_items_expose_only_read_only_discovery_fields() -> None:
    item_fields = {field.name for field in fields(HahitantsoaDiscoveryItem)}

    assert item_fields == {"concept", "label"}
    assert item_fields.isdisjoint(FORBIDDEN_DISCOVERY_FIELDS)
