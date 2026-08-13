from datetime import timedelta

import pytest
from django.utils import timezone

from apps.customers.models import Customer
from apps.documents.models import DocumentInstance, DocumentInstanceStatus
from apps.inventory.models import (
    InventoryItem,
    InventoryReturnOperationStatus,
    InventoryStockMovementType,
)
from apps.inventory.services import (
    InventoryStockMovementError,
    create_inventory_return_operation,
    create_inventory_stock_movement,
    validate_inventory_return_operation,
)
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _draft():
    customer = Customer.objects.create(display_name="Return scope customer")
    start = timezone.now().replace(microsecond=0)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start,
        end_at=start + timedelta(hours=2),
    )


def _delivery_note(draft):
    return DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.delivery_note.v1",
        template_version="v1",
        template_label="Bon de livraison",
        business_scope="titan",
        document_type="delivery_note",
        template_status="validated_source_template",
        template_source_kind="source_backed",
        template_source_reference="test",
        template_path="test/delivery-note.html",
        template_preview_path="test/delivery-note.pdf",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
        status=DocumentInstanceStatus.GENERATED,
    )


def _line(item, quantity):
    return {
        "inventory_item": item,
        "expected_quantity": quantity,
        "returned_quantity": quantity,
        "damaged_quantity": 0,
        "missing_quantity": 0,
        "condition_status": "intact",
        "notes": "",
    }


def test_linked_return_requires_an_emitted_delivery_note(django_user_model):
    actor = django_user_model.objects.create_user(username="return-scope-actor", password="test")
    draft = _draft()
    document = DocumentInstance.objects.create(
        reservation_draft=draft,
        customer=draft.customer,
        template_key="titan.return_note.v1",
        template_version="v1",
        template_label="Retour",
        business_scope="titan",
        document_type="return_note",
        template_status="draft",
        template_source_kind="generated",
        template_source_reference="test",
        template_path="test/return.html",
        template_preview_path="test/return.pdf",
        reservation_public_reference=draft.public_reference,
        reservation_status=draft.status,
        customer_display_name=draft.customer.display_name,
    )
    item = InventoryItem.objects.create(name="Scope item", kind="material")
    operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        document_instance=document,
        lines=[_line(item, 1)],
    )

    with pytest.raises(InventoryStockMovementError) as error:
        validate_inventory_return_operation(return_operation=operation, actor=actor)

    assert error.value.code == "return_operation_scope_mismatch"
    operation.refresh_from_db()
    assert operation.status == InventoryReturnOperationStatus.DRAFT


def test_linked_return_cannot_exceed_delivery_quantity(django_user_model):
    actor = django_user_model.objects.create_user(username="return-quantity-actor", password="test")
    draft = _draft()
    document = _delivery_note(draft)
    item = InventoryItem.objects.create(name="Quantity item", kind="material")
    create_inventory_stock_movement(
        actor=actor,
        inventory_item=item,
        reservation_draft=draft,
        document_instance=document,
        movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
        quantity=1,
        source_label="test delivery",
        notes="Issued delivery",
    )
    operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        document_instance=document,
        lines=[_line(item, 2)],
    )

    with pytest.raises(InventoryStockMovementError) as error:
        validate_inventory_return_operation(return_operation=operation, actor=actor)

    assert error.value.code == "return_operation_quantity_exceeded"
    assert operation.status == InventoryReturnOperationStatus.DRAFT


def test_prior_validated_return_reduces_available_delivery_quantity(django_user_model):
    actor = django_user_model.objects.create_user(username="return-repeat-actor", password="test")
    draft = _draft()
    document = _delivery_note(draft)
    item = InventoryItem.objects.create(name="Repeat item", kind="material")
    create_inventory_stock_movement(
        actor=actor,
        inventory_item=item,
        reservation_draft=draft,
        document_instance=document,
        movement_type=InventoryStockMovementType.OUTBOUND_DELIVERY,
        quantity=2,
        source_label="test delivery",
        notes="Issued delivery",
    )

    first = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        document_instance=document,
        lines=[_line(item, 1)],
    )
    validate_inventory_return_operation(return_operation=first, actor=actor)

    second = create_inventory_return_operation(
        actor=actor,
        reservation_draft=draft,
        document_instance=document,
        lines=[_line(item, 2)],
    )
    with pytest.raises(InventoryStockMovementError) as error:
        validate_inventory_return_operation(return_operation=second, actor=actor)

    assert error.value.code == "return_operation_quantity_exceeded"
