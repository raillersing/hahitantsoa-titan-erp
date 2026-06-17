from datetime import timedelta

import pytest
from django.utils import timezone

import apps.inventory.services as inventory_services
from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.inventory.models import (
    InventoryItem,
    InventoryReturnOperationStatus,
    InventoryStockMovement,
    InventoryStockMovementType,
)
from apps.inventory.services import (
    INVALID_RETURN_OPERATION_STATE,
    InventoryStockMovementError,
    create_inventory_return_operation,
    validate_inventory_return_operation,
)
from apps.payments.models import Payment
from apps.reservations.models import ReservationDraft

pytestmark = pytest.mark.django_db


def _inventory_item(name: str) -> InventoryItem:
    return InventoryItem.objects.create(
        name=name,
        kind="material",
        description=f"{name} description",
    )


def _reservation_draft() -> ReservationDraft:
    customer = Customer.objects.create(
        display_name="Return service customer",
        email="return-service@example.test",
        phone="+261340000888",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0) + timedelta(days=2)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Return service draft",
    )


def test_create_return_operation_persists_lines_without_stock_movements(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(username="return-creator", password="test-pass")
    item = _inventory_item("Return service item")

    with django_capture_on_commit_callbacks(execute=True):
        return_operation = create_inventory_return_operation(
            actor=actor,
            reservation_draft=_reservation_draft(),
            notes="Return inspection started",
            lines=[
                {
                    "inventory_item": item,
                    "expected_quantity": 2,
                    "returned_quantity": 2,
                    "damaged_quantity": 0,
                    "missing_quantity": 0,
                    "condition_status": "intact",
                    "notes": "Everything returned intact",
                }
            ],
        )

    assert return_operation.status == InventoryReturnOperationStatus.DRAFT
    assert return_operation.lines.count() == 1
    assert InventoryStockMovement.objects.count() == 0
    assert AuditEvent.objects.filter(
        action="inventory.return_operation_created",
        target_id=str(return_operation.id),
    ).exists()


def test_validate_return_operation_creates_expected_stock_movements(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor = django_user_model.objects.create_user(
        username="return-validator",
        password="test-pass",
    )
    intact_item = _inventory_item("Return intact item")
    mixed_item = _inventory_item("Return mixed item")
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=_reservation_draft(),
        notes="Validate return operation",
        lines=[
            {
                "inventory_item": intact_item,
                "expected_quantity": 2,
                "returned_quantity": 2,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "Two intact",
            },
            {
                "inventory_item": mixed_item,
                "expected_quantity": 3,
                "returned_quantity": 2,
                "damaged_quantity": 1,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "One intact, one damaged, one missing",
            },
        ],
    )

    with django_capture_on_commit_callbacks(execute=True):
        result = validate_inventory_return_operation(
            return_operation=return_operation,
            actor=actor,
        )

    return_operation.refresh_from_db()
    movement_types = list(
        InventoryStockMovement.objects.filter(return_operation=return_operation)
        .order_by("movement_type", "quantity")
        .values_list("movement_type", "quantity")
    )

    assert return_operation.status == InventoryReturnOperationStatus.VALIDATED
    assert return_operation.validated_by_id == actor.id
    assert len(result.stock_movements) == 4
    assert movement_types == [
        (InventoryStockMovementType.DAMAGE, 1),
        (InventoryStockMovementType.INBOUND_RETURN, 1),
        (InventoryStockMovementType.INBOUND_RETURN, 2),
        (InventoryStockMovementType.LOSS, 1),
    ]
    assert AuditEvent.objects.filter(
        action="inventory.return_operation_validated",
        target_id=str(return_operation.id),
    ).exists()


def test_validate_return_operation_rolls_back_if_stock_movement_creation_fails(
    django_user_model,
    monkeypatch,
) -> None:
    actor = django_user_model.objects.create_user(
        username="return-rollback",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=_reservation_draft(),
        lines=[
            {
                "inventory_item": _inventory_item("Rollback item"),
                "expected_quantity": 2,
                "returned_quantity": 1,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "One missing should rollback",
            }
        ],
    )
    before_document_count = DocumentInstance.objects.count()
    before_payment_count = Payment.objects.count()

    original_create = inventory_services.create_inventory_stock_movement
    call_count = {"value": 0}

    def _failing_create_inventory_stock_movement(*args, **kwargs):
        call_count["value"] += 1
        if call_count["value"] == 2:
            raise InventoryStockMovementError(
                "Synthetic rollback failure.",
                code="synthetic_return_stock_movement_failure",
            )
        return original_create(*args, **kwargs)

    monkeypatch.setattr(
        inventory_services,
        "create_inventory_stock_movement",
        _failing_create_inventory_stock_movement,
    )

    with pytest.raises(InventoryStockMovementError) as error_info:
        validate_inventory_return_operation(
            return_operation=return_operation,
            actor=actor,
        )

    return_operation.refresh_from_db()
    assert error_info.value.code == "synthetic_return_stock_movement_failure"
    assert return_operation.status == InventoryReturnOperationStatus.DRAFT
    assert return_operation.validated_at is None
    assert InventoryStockMovement.objects.filter(return_operation=return_operation).count() == 0
    assert DocumentInstance.objects.count() == before_document_count
    assert Payment.objects.count() == before_payment_count


def test_validate_return_operation_rejects_second_validation(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="return-revalidate",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        lines=[
            {
                "inventory_item": _inventory_item("Revalidate item"),
                "expected_quantity": 1,
                "returned_quantity": 1,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            }
        ],
    )
    validate_inventory_return_operation(return_operation=return_operation, actor=actor)

    with pytest.raises(InventoryStockMovementError) as error_info:
        validate_inventory_return_operation(return_operation=return_operation, actor=actor)

    assert error_info.value.code == INVALID_RETURN_OPERATION_STATE
