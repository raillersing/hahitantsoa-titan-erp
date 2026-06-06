import pytest

from apps.hahitantsoa.scope import (
    HAHITANTSOA_ONLY_DISCOVERY_CONCEPTS,
    HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS,
    HAHITANTSOA_SHARED_INVENTORY_CONCEPTS,
    HahitantsoaDiscoveryConcept,
    HahitantsoaScopeError,
    assert_hahitantsoa_read_only_discovery_concept,
    is_hahitantsoa_read_only_discovery_concept,
    normalize_hahitantsoa_discovery_concept,
)
from apps.inventory.scope import TITAN_ALLOWED_ITEM_KINDS, is_titan_allowed_item_kind

EXPECTED_HAHITANTSOA_DISCOVERY_VALUES = {
    "event",
    "venue",
    "local",
    "room",
    "hall",
    "material",
    "article",
    "furniture",
    "service",
}
REJECTED_HAHITANTSOA_DISCOVERY_VALUES = {
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


def test_hahitantsoa_discovery_concept_contains_exact_first_slice_values() -> None:
    assert {concept.value for concept in HahitantsoaDiscoveryConcept} == (
        EXPECTED_HAHITANTSOA_DISCOVERY_VALUES
    )


def test_hahitantsoa_shared_inventory_concepts_are_material_and_article() -> None:
    assert HAHITANTSOA_SHARED_INVENTORY_CONCEPTS == {
        HahitantsoaDiscoveryConcept.MATERIAL,
        HahitantsoaDiscoveryConcept.ARTICLE,
    }


def test_hahitantsoa_only_discovery_concepts_are_exact() -> None:
    assert HAHITANTSOA_ONLY_DISCOVERY_CONCEPTS == {
        HahitantsoaDiscoveryConcept.EVENT,
        HahitantsoaDiscoveryConcept.VENUE,
        HahitantsoaDiscoveryConcept.LOCAL,
        HahitantsoaDiscoveryConcept.ROOM,
        HahitantsoaDiscoveryConcept.HALL,
        HahitantsoaDiscoveryConcept.FURNITURE,
        HahitantsoaDiscoveryConcept.SERVICE,
    }


def test_hahitantsoa_read_only_discovery_concepts_are_exact() -> None:
    assert {
        concept.value for concept in HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS
    } == EXPECTED_HAHITANTSOA_DISCOVERY_VALUES


@pytest.mark.parametrize("concept", list(HahitantsoaDiscoveryConcept))
def test_normalize_hahitantsoa_discovery_concept_accepts_enum_and_string(
    concept: HahitantsoaDiscoveryConcept,
) -> None:
    assert normalize_hahitantsoa_discovery_concept(concept) is concept
    assert normalize_hahitantsoa_discovery_concept(concept.value) is concept


@pytest.mark.parametrize("value", sorted(REJECTED_HAHITANTSOA_DISCOVERY_VALUES))
def test_normalize_hahitantsoa_discovery_concept_rejects_unconfirmed_values(
    value: str,
) -> None:
    assert normalize_hahitantsoa_discovery_concept(value) is None


@pytest.mark.parametrize("concept", list(HahitantsoaDiscoveryConcept))
def test_hahitantsoa_read_only_discovery_guard_accepts_confirmed_concepts(
    concept: HahitantsoaDiscoveryConcept,
) -> None:
    assert is_hahitantsoa_read_only_discovery_concept(concept.value) is True
    assert assert_hahitantsoa_read_only_discovery_concept(concept.value) is concept


@pytest.mark.parametrize("value", sorted(REJECTED_HAHITANTSOA_DISCOVERY_VALUES))
def test_hahitantsoa_read_only_discovery_guard_rejects_unconfirmed_values(
    value: str,
) -> None:
    assert is_hahitantsoa_read_only_discovery_concept(value) is False

    with pytest.raises(HahitantsoaScopeError) as error:
        assert_hahitantsoa_read_only_discovery_concept(value)

    assert str(error.value) == ("Concept is not allowed for Hahitantsoa read-only discovery.")
    if value:
        assert value not in str(error.value)


def test_hahitantsoa_only_concepts_are_rejected_by_titan_scope() -> None:
    assert all(
        not is_titan_allowed_item_kind(concept.value)
        for concept in HAHITANTSOA_ONLY_DISCOVERY_CONCEPTS
    )


def test_hahitantsoa_and_titan_shared_concepts_are_exact() -> None:
    titan_values = {concept.value for concept in TITAN_ALLOWED_ITEM_KINDS}

    assert (
        {concept.value for concept in HAHITANTSOA_READ_ONLY_DISCOVERY_CONCEPTS} & titan_values
    ) == {"material", "article"}


def test_material_pack_remains_titan_only_for_first_hahitantsoa_slice() -> None:
    assert is_titan_allowed_item_kind("material_pack") is True
    assert is_hahitantsoa_read_only_discovery_concept("material_pack") is False
