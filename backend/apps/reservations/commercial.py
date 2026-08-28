from decimal import Decimal

from apps.inventory.models import InventoryItem

from .models import ReservationDraft


def snapshot_inventory_rental_price(*, inventory_item: InventoryItem) -> Decimal:
    return Decimal(inventory_item.rental_price or "0")


def recalculate_reservation_draft_totals(*, reservation_draft: ReservationDraft) -> None:
    subtotal_amount = sum(
        (
            line.unit_rental_price * line.quantity
            for line in reservation_draft.lines.filter(is_deleted=False)
        ),
        Decimal("0"),
    )
    reservation_draft.subtotal_amount = subtotal_amount
    reservation_draft.total_amount = (
        subtotal_amount + reservation_draft.delivery_fee - reservation_draft.discount_amount
    )
    reservation_draft.full_clean()
    reservation_draft.save()
