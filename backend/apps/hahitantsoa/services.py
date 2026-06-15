from dataclasses import dataclass
from datetime import datetime

from apps.hahitantsoa.models import HahitantsoaEventDraft
from apps.hahitantsoa.selectors import _get_available_hahitantsoa_shared_inventory_items_for_period
from apps.inventory.models import InventoryItem
from apps.reservations.periods import ReservationPeriod, make_reservation_period
from apps.reservations.preview import ReservationItemPreview, preview_reservation_item_request


@dataclass(frozen=True)
class HahitantsoaSharedAvailabilityItemPreview:
    inventory_item: InventoryItem
    period: ReservationPeriod
    status: str


@dataclass(frozen=True)
class HahitantsoaEventDraftAvailabilityLinePreview:
    event_draft_line_id: str
    quantity: int
    inventory_item_id: str
    inventory_item_name: str
    inventory_item_kind: str
    status: str
    conflict_count: int


@dataclass(frozen=True)
class HahitantsoaEventDraftAvailabilityPreview:
    event_draft_id: str
    public_reference: str
    start_at: datetime
    end_at: datetime
    line_count: int
    available_line_count: int
    unavailable_line_count: int
    lines: tuple[HahitantsoaEventDraftAvailabilityLinePreview, ...]


def get_hahitantsoa_shared_availability_item_previews(
    *,
    start_at: datetime,
    end_at: datetime,
) -> tuple[HahitantsoaSharedAvailabilityItemPreview, ...]:
    period = make_reservation_period(start_at=start_at, end_at=end_at)
    items = tuple(
        _get_available_hahitantsoa_shared_inventory_items_for_period(
            start_at=period.start_at,
            end_at=period.end_at,
        )
    )
    return tuple(
        HahitantsoaSharedAvailabilityItemPreview(
            inventory_item=item,
            period=period,
            status="available",
        )
        for item in items
    )


def _build_hahitantsoa_event_draft_line_preview(
    *,
    preview: ReservationItemPreview,
    line,
) -> HahitantsoaEventDraftAvailabilityLinePreview:
    return HahitantsoaEventDraftAvailabilityLinePreview(
        event_draft_line_id=str(line.id),
        quantity=line.quantity,
        inventory_item_id=str(line.inventory_item.id),
        inventory_item_name=line.inventory_item.name,
        inventory_item_kind=line.inventory_item.kind,
        status=preview.status.value,
        conflict_count=len(preview.conflicts),
    )


def get_hahitantsoa_event_draft_availability_preview(
    *,
    event_draft: HahitantsoaEventDraft,
) -> HahitantsoaEventDraftAvailabilityPreview:
    period = make_reservation_period(start_at=event_draft.start_at, end_at=event_draft.end_at)
    lines = tuple(
        event_draft.lines.filter(is_deleted=False)
        .select_related("inventory_item")
        .order_by("created_at", "id")
    )
    line_previews = tuple(
        _build_hahitantsoa_event_draft_line_preview(
            line=line,
            preview=preview_reservation_item_request(
                inventory_item=line.inventory_item,
                inventory_item_kind=line.inventory_item.kind,
                start_at=period.start_at,
                end_at=period.end_at,
            ),
        )
        for line in lines
    )
    available_line_count = sum(1 for line in line_previews if line.status == "available")
    unavailable_line_count = len(line_previews) - available_line_count

    return HahitantsoaEventDraftAvailabilityPreview(
        event_draft_id=str(event_draft.id),
        public_reference=event_draft.public_reference,
        start_at=period.start_at,
        end_at=period.end_at,
        line_count=len(line_previews),
        available_line_count=available_line_count,
        unavailable_line_count=unavailable_line_count,
        lines=line_previews,
    )
