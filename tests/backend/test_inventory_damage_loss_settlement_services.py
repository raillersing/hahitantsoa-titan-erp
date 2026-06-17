from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

import apps.inventory.services as inventory_services
from apps.audit.models import AuditEvent
from apps.customers.models import Customer
from apps.documents.models import DocumentInstance
from apps.inventory.models import (
    InventoryDamageLossSettlementStatus,
    InventoryItem,
    InventoryStockMovement,
)
from apps.inventory.services import (
    INVALID_DAMAGE_LOSS_SETTLEMENT_RETURN_OPERATION_STATE,
    INVALID_DAMAGE_LOSS_SETTLEMENT_STATE,
    InventoryStockMovementError,
    create_inventory_damage_loss_settlement,
    create_inventory_return_operation,
    validate_inventory_damage_loss_settlement,
    validate_inventory_return_operation,
)
from apps.payments.models import Payment, PaymentKind, PaymentMethod, PaymentStatus
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
        display_name="Settlement service customer",
        email="settlement-service@example.test",
        phone="+261340001002",
        address="Antananarivo",
    )
    start_at = timezone.now().replace(microsecond=0)
    end_at = start_at + timedelta(hours=4)
    return ReservationDraft.objects.create(
        customer=customer,
        start_at=start_at,
        end_at=end_at,
        notes="Settlement service reservation",
    )


def _validated_return_operation(django_user_model):
    actor = django_user_model.objects.create_user(
        username="settlement-service",
        password="test-pass",
    )
    reservation_draft = _reservation_draft()
    return_operation = create_inventory_return_operation(
        actor=actor,
        reservation_draft=reservation_draft,
        notes="Validated return for settlement",
        lines=[
            {
                "inventory_item": _inventory_item("Settlement service damaged"),
                "expected_quantity": 3,
                "returned_quantity": 2,
                "damaged_quantity": 1,
                "missing_quantity": 1,
                "condition_status": "mixed",
                "notes": "Damaged and missing",
            }
        ],
    )
    result = validate_inventory_return_operation(return_operation=return_operation, actor=actor)
    return actor, reservation_draft, result.return_operation


def test_create_damage_loss_settlement_persists_manual_and_return_lines_without_side_effects(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, _, return_operation = _validated_return_operation(django_user_model)
    line = return_operation.lines.get()
    before_payment_count = Payment.objects.count()
    before_document_count = DocumentInstance.objects.count()
    before_stock_movement_count = InventoryStockMovement.objects.count()

    with django_capture_on_commit_callbacks(execute=True):
        settlement = create_inventory_damage_loss_settlement(
            actor=actor,
            return_operation=return_operation,
            notes="Draft settlement",
            lines=[
                {
                    "return_operation_line": line,
                    "settlement_line_kind": "damage",
                    "quantity": 1,
                    "unit_amount": Decimal("25000.00"),
                    "notes": "Broken leg",
                },
                {
                    "manual_label": "Nettoyage hors inventaire",
                    "settlement_line_kind": "non_inventory_damage",
                    "quantity": 1,
                    "unit_amount": Decimal("5000.00"),
                    "notes": "Cleaning fee",
                },
            ],
        )

    settlement.refresh_from_db()
    assert settlement.settlement_status == InventoryDamageLossSettlementStatus.DRAFT
    assert settlement.lines.count() == 2
    assert InventoryStockMovement.objects.count() == before_stock_movement_count
    assert Payment.objects.count() == before_payment_count
    assert DocumentInstance.objects.count() == before_document_count
    assert AuditEvent.objects.filter(
        action="inventory.damage_loss_settlement_created",
        target_id=str(settlement.id),
    ).exists()


def test_create_damage_loss_settlement_rejects_draft_return_operation(django_user_model) -> None:
    actor = django_user_model.objects.create_user(
        username="settlement-draft-return",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        lines=[
            {
                "inventory_item": _inventory_item("Draft return settlement item"),
                "expected_quantity": 1,
                "returned_quantity": 1,
                "damaged_quantity": 0,
                "missing_quantity": 0,
                "condition_status": "intact",
                "notes": "",
            }
        ],
    )

    with pytest.raises(InventoryStockMovementError) as error_info:
        create_inventory_damage_loss_settlement(
            actor=actor,
            return_operation=return_operation,
            lines=[
                {
                    "manual_label": "Manual issue",
                    "settlement_line_kind": "other",
                    "quantity": 1,
                    "unit_amount": Decimal("1000.00"),
                    "notes": "",
                }
            ],
        )

    assert error_info.value.code == INVALID_DAMAGE_LOSS_SETTLEMENT_RETURN_OPERATION_STATE


def test_validate_damage_loss_settlement_computes_caution_refund_and_excess(
    django_user_model,
    django_capture_on_commit_callbacks,
) -> None:
    actor, reservation_draft, return_operation = _validated_return_operation(django_user_model)
    Payment.objects.create(
        reservation_draft=reservation_draft,
        payment_kind=PaymentKind.CAUTION,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.PENDING,
        amount=Decimal("10000.00"),
        source_label="Pending caution",
    )
    confirmed_receipt = DocumentInstance.objects.create(
        reservation_draft=reservation_draft,
        customer=reservation_draft.customer,
        template_key="shared.payment_receipt.v1",
        template_version="v1",
        template_label="Recu de caution",
        business_scope="shared",
        document_type="payment_receipt",
        template_status="generated_draft_template",
        template_source_kind="generated_from_brand_style",
        template_source_reference="docs/references/source/Document_B_Presentation_Metier_Evenementiel_v3.4.pdf",
        template_path="backend/apps/documents/templates_documents/shared/payment_receipt/v1/template.html",
        template_preview_path="backend/apps/documents/templates_documents/shared/payment_receipt/v1/preview.pdf",
        template_validated_by_client=False,
        template_notes="Receipt",
        reservation_public_reference=reservation_draft.public_reference,
        reservation_status=reservation_draft.status,
        customer_display_name=reservation_draft.customer.display_name,
        customer_email=reservation_draft.customer.email,
        customer_phone=reservation_draft.customer.phone,
        customer_address=reservation_draft.customer.address,
        status="generated",
    )
    Payment.objects.create(
        reservation_draft=reservation_draft,
        receipt_document=confirmed_receipt,
        payment_kind=PaymentKind.CAUTION,
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.CONFIRMED,
        amount=Decimal("50000.00"),
        paid_at=return_operation.validated_at,
        source_label="Confirmed caution",
        confirmed_at=return_operation.validated_at,
        confirmed_by=actor,
    )
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_operation,
        lines=[
            {
                "return_operation_line": return_operation.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 2,
                "unit_amount": Decimal("20000.00"),
                "notes": "Two units billed",
            },
            {
                "manual_label": "Cleaning surcharge",
                "settlement_line_kind": "other",
                "quantity": 1,
                "unit_amount": Decimal("5000.00"),
                "notes": "Extra manual charge",
            },
        ],
    )

    with django_capture_on_commit_callbacks(execute=True):
        result = validate_inventory_damage_loss_settlement(settlement=settlement, actor=actor)

    settlement.refresh_from_db()
    assert result.settlement.id == settlement.id
    assert settlement.settlement_status == InventoryDamageLossSettlementStatus.VALIDATED
    assert settlement.damage_loss_total == Decimal("45000.00")
    assert settlement.caution_available == Decimal("50000.00")
    assert settlement.caution_applied == Decimal("45000.00")
    assert settlement.refund_due == Decimal("5000.00")
    assert settlement.excess_due == Decimal("0.00")
    assert AuditEvent.objects.filter(
        action="inventory.damage_loss_settlement_validated",
        target_id=str(settlement.id),
    ).exists()


def test_validate_damage_loss_settlement_computes_excess_due_without_caution(
    django_user_model,
) -> None:
    actor = django_user_model.objects.create_user(
        username="settlement-no-caution",
        password="test-pass",
    )
    return_operation = create_inventory_return_operation(
        actor=actor,
        lines=[
            {
                "inventory_item": _inventory_item("Standalone return settlement"),
                "expected_quantity": 1,
                "returned_quantity": 0,
                "damaged_quantity": 0,
                "missing_quantity": 1,
                "condition_status": "missing",
                "notes": "",
            }
        ],
    )
    result = validate_inventory_return_operation(return_operation=return_operation, actor=actor)
    return_operation = result.return_operation
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_operation,
        lines=[
            {
                "return_operation_line": return_operation.lines.get(),
                "settlement_line_kind": "loss",
                "quantity": 1,
                "unit_amount": Decimal("30000.00"),
                "notes": "Missing item",
            }
        ],
    )

    validate_inventory_damage_loss_settlement(settlement=settlement, actor=actor)

    settlement.refresh_from_db()
    assert settlement.caution_available == Decimal("0.00")
    assert settlement.caution_applied == Decimal("0.00")
    assert settlement.refund_due == Decimal("0.00")
    assert settlement.excess_due == Decimal("30000.00")


def test_validate_damage_loss_settlement_rolls_back_on_failure(
    django_user_model,
    monkeypatch,
) -> None:
    actor, _, return_operation = _validated_return_operation(django_user_model)
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_operation,
        lines=[
            {
                "return_operation_line": return_operation.lines.get(),
                "settlement_line_kind": "damage",
                "quantity": 1,
                "unit_amount": Decimal("15000.00"),
                "notes": "",
            }
        ],
    )
    before_payment_count = Payment.objects.count()
    before_document_count = DocumentInstance.objects.count()
    before_stock_movement_count = InventoryStockMovement.objects.count()

    def _failing_calculate_caution_available_for_return_operation(_return_operation):
        raise InventoryStockMovementError(
            "Synthetic settlement failure.",
            code="synthetic_damage_loss_settlement_failure",
        )

    monkeypatch.setattr(
        inventory_services,
        "calculate_caution_available_for_return_operation",
        _failing_calculate_caution_available_for_return_operation,
    )

    with pytest.raises(InventoryStockMovementError) as error_info:
        validate_inventory_damage_loss_settlement(settlement=settlement, actor=actor)

    settlement.refresh_from_db()
    assert error_info.value.code == "synthetic_damage_loss_settlement_failure"
    assert settlement.settlement_status == InventoryDamageLossSettlementStatus.DRAFT
    assert settlement.validated_at is None
    assert Payment.objects.count() == before_payment_count
    assert DocumentInstance.objects.count() == before_document_count
    assert InventoryStockMovement.objects.count() == before_stock_movement_count


def test_validate_damage_loss_settlement_rejects_second_validation(django_user_model) -> None:
    actor, _, return_operation = _validated_return_operation(django_user_model)
    settlement = create_inventory_damage_loss_settlement(
        actor=actor,
        return_operation=return_operation,
        lines=[
            {
                "return_operation_line": return_operation.lines.get(),
                "settlement_line_kind": "damage",
                "quantity": 1,
                "unit_amount": Decimal("15000.00"),
                "notes": "",
            }
        ],
    )
    validate_inventory_damage_loss_settlement(settlement=settlement, actor=actor)

    with pytest.raises(InventoryStockMovementError) as error_info:
        validate_inventory_damage_loss_settlement(settlement=settlement, actor=actor)

    assert error_info.value.code == INVALID_DAMAGE_LOSS_SETTLEMENT_STATE
