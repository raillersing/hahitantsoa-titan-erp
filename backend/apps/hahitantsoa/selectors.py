from datetime import datetime

from django.db.models import QuerySet

from apps.hahitantsoa.discovery import HahitantsoaDiscoveryItem
from apps.inventory.models import InventoryItem
from apps.reservations.selectors import get_available_reservation_inventory_items_for_period

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

HAHITANTSOA_SHARED_AVAILABILITY_ITEM_KINDS = (
    "material",
    "article",
)


def list_hahitantsoa_discovery_items() -> tuple[HahitantsoaDiscoveryItem, ...]:
    return _HAHITANTSOA_DISCOVERY_ITEMS


def _get_available_hahitantsoa_shared_inventory_items_for_period(
    *,
    start_at: datetime,
    end_at: datetime,
) -> QuerySet[InventoryItem]:
    return get_available_reservation_inventory_items_for_period(
        start_at=start_at,
        end_at=end_at,
    ).filter(kind__in=HAHITANTSOA_SHARED_AVAILABILITY_ITEM_KINDS)
