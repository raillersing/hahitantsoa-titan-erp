from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.inventory.models import InventoryItem

pytestmark = pytest.mark.django_db


def _period():
    start_at = timezone.now().replace(microsecond=0)
    return start_at, start_at + timedelta(hours=4)


def _customer(*, is_active: bool = True, is_deleted: bool = False) -> Customer:
    return Customer.objects.create(
        display_name="Hahitantsoa Customer",
        is_active=is_active,
        is_deleted=is_deleted,
    )


def _item(
    *, kind: str = "material", is_active: bool = True, is_deleted: bool = False
) -> InventoryItem:
    return InventoryItem.objects.create(
        name=f"Shared {kind}",
        kind=kind,
        is_active=is_active,
        is_deleted=is_deleted,
    )


def test_hahitantsoa_event_draft_can_be_persisted_with_shared_inventory_lines() -> None:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Wedding Planning",
        venue_name="Antananarivo Venue",
        location_details="Upper hall",
        service_notes="Lighting coordination",
        start_at=start_at,
        end_at=end_at,
        notes="Draft notes",
    )
    line = HahitantsoaEventDraftLine(
        event_draft=draft,
        inventory_item=_item(kind="article"),
        quantity=2,
        notes="Shared line",
    )

    line.full_clean()
    line.save()

    persisted = HahitantsoaEventDraft.objects.get(pk=draft.pk)
    assert persisted.status == "draft"
    assert persisted.public_reference.startswith("HED-")
    assert persisted.lines.count() == 1


def test_hahitantsoa_event_draft_rejects_inactive_customer() -> None:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft(
        customer=_customer(is_active=False),
        event_name="Inactive customer event",
        start_at=start_at,
        end_at=end_at,
    )

    with pytest.raises(ValidationError) as error:
        draft.full_clean()

    assert error.value.message_dict == {
        "customer": ["Hahitantsoa event draft customer must be active."]
    }


def test_hahitantsoa_event_draft_rejects_invalid_period() -> None:
    start_at, _ = _period()
    draft = HahitantsoaEventDraft(
        customer=_customer(),
        event_name="Invalid event",
        start_at=start_at,
        end_at=start_at,
    )

    with pytest.raises(ValidationError) as error:
        draft.full_clean()

    assert error.value.message_dict == {
        "end_at": ["Reservation period end_at must be after start_at."]
    }


def test_hahitantsoa_event_draft_line_rejects_material_pack() -> None:
    start_at, end_at = _period()
    draft = HahitantsoaEventDraft.objects.create(
        customer=_customer(),
        event_name="Pack forbidden event",
        start_at=start_at,
        end_at=end_at,
    )
    line = HahitantsoaEventDraftLine(
        event_draft=draft,
        inventory_item=_item(kind="material_pack"),
        quantity=1,
    )

    with pytest.raises(ValidationError) as error:
        line.full_clean()

    assert error.value.message_dict == {
        "inventory_item": [
            "Inventory item kind is not allowed for Hahitantsoa shared event drafts."
        ]
    }
