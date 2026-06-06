from dataclasses import dataclass

from apps.hahitantsoa.scope import (
    HahitantsoaDiscoveryConcept,
    assert_hahitantsoa_read_only_discovery_concept,
)


@dataclass(frozen=True, init=False)
class HahitantsoaDiscoveryItem:
    concept: HahitantsoaDiscoveryConcept
    label: str

    def __init__(
        self,
        *,
        concept: HahitantsoaDiscoveryConcept | str,
        label: str,
    ) -> None:
        normalized_concept = assert_hahitantsoa_read_only_discovery_concept(concept)
        if not isinstance(label, str):
            raise TypeError("Discovery item label must be a string.")

        normalized_label = label.strip()
        if not normalized_label:
            raise ValueError("Discovery item label is required.")

        object.__setattr__(self, "concept", normalized_concept)
        object.__setattr__(self, "label", normalized_label)
