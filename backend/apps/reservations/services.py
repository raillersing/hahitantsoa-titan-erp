from dataclasses import dataclass
from datetime import datetime

from apps.inventory.models import InventoryItem
from apps.reservations.confirmation import ReservationDraftConfirmationPreflight
from apps.reservations.periods import ReservationPeriod, make_reservation_period
from apps.reservations.preview import (
    ReservationItemPreview,
    preview_reservation_item_request,
)
from apps.reservations.selectors import (
    get_available_reservation_inventory_items_for_period,
)


@dataclass(frozen=True)
class ReservationAvailableItemsOptions:
    period: ReservationPeriod
    items: tuple[InventoryItem, ...]
    count: int


@dataclass(frozen=True)
class ReservationAvailabilitySummary:
    period: ReservationPeriod
    available_item_count: int
    available_preview_count: int
    available_item_kinds: tuple[str, ...]


def preview_reservation_item_service(
    *,
    inventory_item: InventoryItem,
    inventory_item_kind: str,
    start_at: datetime,
    end_at: datetime,
) -> ReservationItemPreview:
    return preview_reservation_item_request(
        inventory_item=inventory_item,
        inventory_item_kind=inventory_item_kind,
        start_at=start_at,
        end_at=end_at,
    )


def get_reservation_available_items_options_service(
    *,
    start_at: datetime,
    end_at: datetime,
) -> ReservationAvailableItemsOptions:
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    items = tuple(
        get_available_reservation_inventory_items_for_period(
            start_at=period.start_at,
            end_at=period.end_at,
        )
    )

    return ReservationAvailableItemsOptions(
        period=period,
        items=items,
        count=len(items),
    )


def _build_reservation_available_item_previews_from_options(
    *,
    options: ReservationAvailableItemsOptions,
) -> tuple[ReservationItemPreview, ...]:
    return tuple(
        preview_reservation_item_service(
            inventory_item=item,
            inventory_item_kind=item.kind,
            start_at=options.period.start_at,
            end_at=options.period.end_at,
        )
        for item in options.items
    )


def get_reservation_available_item_previews_service(
    *,
    start_at: datetime,
    end_at: datetime,
) -> tuple[ReservationItemPreview, ...]:
    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )

    return _build_reservation_available_item_previews_from_options(options=options)


def get_reservation_availability_summary_service(
    *,
    start_at: datetime,
    end_at: datetime,
) -> ReservationAvailabilitySummary:
    options = get_reservation_available_items_options_service(
        start_at=start_at,
        end_at=end_at,
    )
    previews = _build_reservation_available_item_previews_from_options(options=options)

    return ReservationAvailabilitySummary(
        period=options.period,
        available_item_count=options.count,
        available_preview_count=len(previews),
        available_item_kinds=tuple(preview.inventory_item_kind for preview in previews),
    )


def get_reservation_draft_confirmation_preflight_service(
    *,
    reservation_draft_id,
    actor: object | None,
) -> ReservationDraftConfirmationPreflight:
    """Validate if a reservation draft can be confirmed.

    Checks:
    - Draft exists (raises Http404 or ValueError if not found)
    - Validates time period, lines, item availability, Titan-allowed kinds, etc.
    """
    from django.shortcuts import get_object_or_404

    from apps.reservations.confirmation import get_reservation_draft_confirmation_preflight
    from apps.reservations.models import ReservationDraft

    draft = get_object_or_404(ReservationDraft, pk=reservation_draft_id)
    return get_reservation_draft_confirmation_preflight(reservation_draft=draft, actor=actor)
