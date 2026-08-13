from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.inventory.models import InventoryItem, InventoryStockMovement, InventoryStockMovementType
from apps.inventory.services import InventoryStockMovementError, issue_delivery_note_stock
from apps.reservations.models import ReservationDraft, ReservationDraftLine

pytestmark = pytest.mark.django_db


def _actor(django_user_model):
    return django_user_model.objects.create_user(
        username="delivery-stock-actor", password="test", is_staff=True
    )


def _document(*, draft=None, event=None):
    owner = draft or event
    return DocumentInstance.objects.create(
        reservation_draft=draft,
        hahitantsoa_event_draft=event,
        customer=owner.customer,
        template_key=("titan.delivery_note.v1" if draft else "hahitantsoa.delivery_note.v1"),
        template_version="v1",
        template_label="Bon de livraison",
        business_scope=("titan" if draft else "hahitantsoa"),
        document_type="delivery_note",
        template_status="validated_source_template",
        template_source_kind="source_backed",
        template_source_reference="test",
        template_path="test.html",
        template_preview_path="test.pdf",
        reservation_public_reference=owner.public_reference,
        reservation_status=owner.status,
        customer_display_name=owner.customer.display_name,
        status=DocumentInstanceStatus.GENERATED,
        storage_path="test/delivery-note.html",
        content_checksum="a" * 64,
        generated_content_size_bytes=1,
    )


def test_issue_delivery_note_stock_is_idempotent_for_titan(django_user_model):
    actor = _actor(django_user_model)
    customer = Customer.objects.create(display_name="Titan customer")
    start = timezone.now().replace(microsecond=0)
    draft = ReservationDraft.objects.create(
        customer=customer, start_at=start, end_at=start + timedelta(hours=2)
    )
    item = InventoryItem.objects.create(
        name="Chair", kind="material", reported_inventory_quantity=5
    )
    ReservationDraftLine.objects.create(reservation_draft=draft, inventory_item=item, quantity=2)
    document = _document(draft=draft)

    first = issue_delivery_note_stock(document_instance=document, actor=actor)
    second = issue_delivery_note_stock(document_instance=document, actor=actor)

    assert len(first) == len(second) == 1
    assert InventoryStockMovement.objects.filter(document_instance=document).count() == 1
    assert InventoryStockMovement.objects.get(document_instance=document).quantity == 2


def test_issue_delivery_note_stock_supports_hahitantsoa_without_reservation_link(
    django_user_model,
):
    actor = _actor(django_user_model)
    customer = Customer.objects.create(display_name="Hahitantsoa customer")
    start = timezone.now().replace(microsecond=0)
    event = HahitantsoaEventDraft.objects.create(
        customer=customer,
        event_name="Event",
        start_at=start,
        end_at=start + timedelta(hours=2),
    )
    item = InventoryItem.objects.create(name="Table", kind="article", reported_inventory_quantity=4)
    HahitantsoaEventDraftLine.objects.create(event_draft=event, inventory_item=item, quantity=1)
    document = _document(event=event)

    issue_delivery_note_stock(document_instance=document, actor=actor)

    movement = InventoryStockMovement.objects.get(document_instance=document)
    assert movement.reservation_draft_id is None
    assert movement.movement_type == InventoryStockMovementType.OUTBOUND_DELIVERY


def test_issue_delivery_note_stock_rolls_back_when_stock_is_insufficient(django_user_model):
    actor = _actor(django_user_model)
    customer = Customer.objects.create(display_name="Stock customer")
    start = timezone.now().replace(microsecond=0)
    draft = ReservationDraft.objects.create(
        customer=customer, start_at=start, end_at=start + timedelta(hours=2)
    )
    item = InventoryItem.objects.create(
        name="Limited chair", kind="material", reported_inventory_quantity=1
    )
    ReservationDraftLine.objects.create(reservation_draft=draft, inventory_item=item, quantity=2)
    document = _document(draft=draft)

    with pytest.raises(InventoryStockMovementError) as error:
        issue_delivery_note_stock(document_instance=document, actor=actor)

    assert error.value.code == "insufficient_stock_for_dispatch"
    assert InventoryStockMovement.objects.filter(document_instance=document).count() == 0
