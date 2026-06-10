from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftLine,
    ReservationDraftStatus,
)

pytestmark = pytest.mark.django_db


def _customer() -> Customer:
    return Customer.objects.create(display_name="Client Demo")


def _item(name: str = "Projecteur LED", kind: str = "article") -> InventoryItem:
    return InventoryItem.objects.create(name=name, kind=kind)


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=2)


def test_reservation_draft_can_be_persisted() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
        notes="Draft notes.",
    )

    draft.full_clean()
    draft.save()

    assert draft.status == ReservationDraftStatus.DRAFT
    assert draft.public_reference.startswith("RD-")
    assert draft.is_deleted is False


def test_reservation_draft_rejects_invalid_period() -> None:
    start_at, _ = _period()
    draft = ReservationDraft(customer=_customer(), start_at=start_at, end_at=start_at)

    with pytest.raises(ValidationError):
        draft.full_clean()


def test_reservation_draft_rejects_inactive_customer() -> None:
    start_at, end_at = _period()
    customer = Customer.objects.create(display_name="Inactive", is_active=False)
    draft = ReservationDraft(customer=customer, start_at=start_at, end_at=end_at)

    with pytest.raises(ValidationError):
        draft.full_clean()


def test_reservation_draft_line_can_be_persisted() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    line = ReservationDraftLine(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=2,
    )

    line.full_clean()
    line.save()

    assert line.quantity == 2


def test_reservation_draft_line_rejects_zero_quantity() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    line = ReservationDraftLine(
        reservation_draft=draft,
        inventory_item=_item(),
        quantity=0,
    )

    with pytest.raises(ValidationError):
        line.full_clean()


@pytest.mark.django_db(transaction=True)
def test_reservation_draft_line_rejects_duplicate_item_per_draft() -> None:
    start_at, end_at = _period()
    draft = ReservationDraft.objects.create(
        customer=_customer(),
        start_at=start_at,
        end_at=end_at,
    )
    item = _item()
    ReservationDraftLine.objects.create(
        reservation_draft=draft,
        inventory_item=item,
        quantity=1,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            ReservationDraftLine.objects.create(
                reservation_draft=draft,
                inventory_item=item,
                quantity=1,
            )
