from apps.hahitantsoa.discovery import HahitantsoaDiscoveryItem

_HAHITANTSOA_DISCOVERY_ITEMS = (
    HahitantsoaDiscoveryItem(concept="event", label="event"),
    HahitantsoaDiscoveryItem(concept="venue", label="venue"),
    HahitantsoaDiscoveryItem(concept="local", label="local"),
    HahitantsoaDiscoveryItem(concept="room", label="room"),
    HahitantsoaDiscoveryItem(concept="hall", label="hall"),
    HahitantsoaDiscoveryItem(concept="material", label="material"),
    HahitantsoaDiscoveryItem(concept="article", label="article"),
    HahitantsoaDiscoveryItem(concept="furniture", label="furniture"),
    HahitantsoaDiscoveryItem(concept="service", label="service"),
)


def list_hahitantsoa_discovery_items() -> tuple[HahitantsoaDiscoveryItem, ...]:
    return _HAHITANTSOA_DISCOVERY_ITEMS
