from dataclasses import FrozenInstanceError, fields, is_dataclass
from inspect import getmembers, isfunction

import pytest

from apps.hahitantsoa import discovery
from apps.hahitantsoa.discovery import HahitantsoaDiscoveryItem
from apps.hahitantsoa.scope import HahitantsoaDiscoveryConcept, HahitantsoaScopeError
from apps.inventory.scope import is_titan_allowed_item_kind

REJECTED_DISCOVERY_CONCEPTS = {
    "material_pack",
    "event_service",
    "reservation",
    "booking",
    "contract",
    "invoice",
    "payment",
    "customer",
    "pricing",
    "stock",
    "quantity",
    "unit",
    "unknown",
    "",
}


def test_hahitantsoa_discovery_item_dataclass_contract_is_stable() -> None:
    item = HahitantsoaDiscoveryItem(concept="event", label="Corporate event")

    assert is_dataclass(HahitantsoaDiscoveryItem)
    assert HahitantsoaDiscoveryItem.__dataclass_params__.frozen is True
    assert tuple(field.name for field in fields(HahitantsoaDiscoveryItem)) == (
        "concept",
        "label",
    )

    with pytest.raises(FrozenInstanceError):
        item.label = "Changed label"  # type: ignore[misc]


@pytest.mark.parametrize("concept", list(HahitantsoaDiscoveryConcept))
def test_hahitantsoa_discovery_item_accepts_and_normalizes_confirmed_concepts(
    concept: HahitantsoaDiscoveryConcept,
) -> None:
    item_from_enum = HahitantsoaDiscoveryItem(concept=concept, label="Discovery item")
    item_from_string = HahitantsoaDiscoveryItem(concept=concept.value, label="Discovery item")

    assert item_from_enum.concept is concept
    assert item_from_string.concept is concept


@pytest.mark.parametrize("concept", sorted(REJECTED_DISCOVERY_CONCEPTS))
def test_hahitantsoa_discovery_item_rejects_unapproved_concepts(concept: str) -> None:
    with pytest.raises(HahitantsoaScopeError) as error:
        HahitantsoaDiscoveryItem(concept=concept, label="Discovery item")

    assert str(error.value) == "Concept is not allowed for Hahitantsoa read-only discovery."
    if concept:
        assert concept not in str(error.value)


def test_hahitantsoa_discovery_item_accepts_and_trims_display_label() -> None:
    item = HahitantsoaDiscoveryItem(concept="event", label="  Corporate event  ")

    assert item.label == "Corporate event"


@pytest.mark.parametrize("label", ["", " ", "\t\n"])
def test_hahitantsoa_discovery_item_rejects_empty_display_label(label: str) -> None:
    with pytest.raises(ValueError) as error:
        HahitantsoaDiscoveryItem(concept="event", label=label)

    assert str(error.value) == "Discovery item label is required."


def test_hahitantsoa_discovery_item_rejects_non_string_display_label() -> None:
    with pytest.raises(TypeError) as error:
        HahitantsoaDiscoveryItem(concept="event", label=None)  # type: ignore[arg-type]

    assert str(error.value) == "Discovery item label must be a string."


def test_hahitantsoa_discovery_item_does_not_expand_titan_scope() -> None:
    hahitantsoa_only_item = HahitantsoaDiscoveryItem(concept="venue", label="Main venue")

    assert is_titan_allowed_item_kind(hahitantsoa_only_item.concept.value) is False
    assert is_titan_allowed_item_kind("material_pack") is True

    with pytest.raises(HahitantsoaScopeError):
        HahitantsoaDiscoveryItem(concept="material_pack", label="Titan pack")


def test_hahitantsoa_discovery_module_exposes_no_selector_or_catalogue_api() -> None:
    public_module_functions = {
        name
        for name, member in getmembers(discovery, isfunction)
        if not name.startswith("_") and member.__module__ == discovery.__name__
    }

    assert public_module_functions == set()
    assert not hasattr(discovery, "CATALOGUE")
    assert not hasattr(discovery, "DEMO_ITEMS")
