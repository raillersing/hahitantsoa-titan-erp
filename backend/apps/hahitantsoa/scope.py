from enum import StrEnum


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
