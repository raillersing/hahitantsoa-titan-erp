from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.audit.services import record_audit_event_on_commit
from apps.documents.excess_receivable import (
    EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY,
    build_excess_receivable_invoice_context,
)
from apps.documents.models import DocumentInstance
from apps.inventory.models import (
    FIXED_INVENTORY_STOCK_MOVEMENT_DIRECTIONS,
    InventoryCautionRefundObligation,
    InventoryDamageLossExcessReceivable,
    InventoryDamageLossExcessReceivableStatus,
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementExecution,
    InventoryDamageLossSettlementExecutionStatus,
    InventoryDamageLossSettlementLine,
    InventoryDamageLossSettlementStatus,
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLine,
    InventoryReturnOperationStatus,
    InventoryStockMovement,
    InventoryStockMovementDirection,
    InventoryStockMovementType,
)
from apps.payments.models import CONFIRMED_PAYMENT_STATUS_VALUES, Payment, PaymentKind


class InventoryStockMovementError(ValueError):
    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION = "invalid_inventory_stock_movement_direction"
INVALID_INVENTORY_STOCK_MOVEMENT = "invalid_inventory_stock_movement"
INVALID_RETURN_OPERATION_STATE = "invalid_return_operation_state"
INVALID_RETURN_OPERATION = "invalid_return_operation"
INVALID_DAMAGE_LOSS_SETTLEMENT_STATE = "invalid_damage_loss_settlement_state"
INVALID_DAMAGE_LOSS_SETTLEMENT = "invalid_damage_loss_settlement"
INVALID_DAMAGE_LOSS_SETTLEMENT_RETURN_OPERATION_STATE = (
    "invalid_damage_loss_settlement_return_operation_state"
)
INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION = "invalid_damage_loss_settlement_execution"
INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_STATE = "invalid_damage_loss_settlement_execution_state"
INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_SETTLEMENT_STATE = (
    "invalid_damage_loss_settlement_execution_settlement_state"
)


@dataclass(frozen=True)
class ReturnOperationValidationResult:
    return_operation: InventoryReturnOperation
    stock_movements: tuple[InventoryStockMovement, ...]


@dataclass(frozen=True)
class DamageLossSettlementValidationResult:
    settlement: InventoryDamageLossSettlement


@dataclass(frozen=True)
class DamageLossSettlementExecutionResult:
    execution: InventoryDamageLossSettlementExecution
    refund_obligation: InventoryCautionRefundObligation | None
    excess_receivable: InventoryDamageLossExcessReceivable | None


def active_inventory_stock_movements():
    return InventoryStockMovement.objects.select_related(
        "inventory_item",
        "reservation_draft",
        "document_instance",
        "validated_by",
        "created_by",
        "updated_by",
    ).order_by("-effective_at", "-created_at", "id")


def active_inventory_return_operations():
    return (
        InventoryReturnOperation.objects.select_related(
            "reservation_draft",
            "document_instance",
            "validated_by",
            "created_by",
            "updated_by",
        )
        .prefetch_related("lines", "lines__inventory_item")
        .order_by("-created_at", "id")
    )


def active_inventory_damage_loss_settlements():
    return (
        InventoryDamageLossSettlement.objects.select_related(
            "return_operation",
            "return_operation__reservation_draft",
            "document_instance",
            "validated_by",
            "created_by",
            "updated_by",
        )
        .prefetch_related("lines", "lines__return_operation_line")
        .order_by("-created_at", "id")
    )


def active_inventory_damage_loss_settlement_executions():
    return (
        InventoryDamageLossSettlementExecution.objects.select_related(
            "settlement",
            "settlement__return_operation",
            "executed_by",
            "created_by",
            "updated_by",
        )
        .select_related("refund_obligation", "excess_receivable")
        .order_by("-created_at", "id")
    )


def resolve_inventory_stock_movement_direction(
    *,
    movement_type: str,
    direction: str | None,
) -> str:
    movement_type_value = InventoryStockMovementType(movement_type)
    expected_direction = FIXED_INVENTORY_STOCK_MOVEMENT_DIRECTIONS.get(movement_type_value)
    if expected_direction is not None:
        if direction is not None and direction != expected_direction:
            raise InventoryStockMovementError(
                (
                    f"Movement type '{movement_type}' requires direction "
                    f"'{expected_direction.value}'."
                ),
                code=INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION,
            )
        return expected_direction

    if direction is None:
        raise InventoryStockMovementError(
            "Movement type 'other' requires an explicit direction.",
            code=INVALID_INVENTORY_STOCK_MOVEMENT_DIRECTION,
        )

    return InventoryStockMovementDirection(direction)


@transaction.atomic
def create_inventory_stock_movement(
    *,
    inventory_item: InventoryItem,
    movement_type: str,
    direction: str | None = None,
    quantity: int,
    actor: object | None = None,
    reservation_draft=None,
    document_instance=None,
    return_operation=None,
    return_operation_line=None,
    source_label: str = "",
    notes: str = "",
    effective_at=None,
) -> InventoryStockMovement:
    actor_id = getattr(actor, "pk", None)
    resolved_direction = resolve_inventory_stock_movement_direction(
        movement_type=movement_type,
        direction=direction,
    )
    movement = InventoryStockMovement(
        inventory_item=inventory_item,
        reservation_draft=reservation_draft,
        document_instance=document_instance,
        return_operation=return_operation,
        return_operation_line=return_operation_line,
        movement_type=movement_type,
        direction=resolved_direction,
        quantity=quantity,
        source_label=source_label,
        notes=notes,
        effective_at=effective_at or timezone.now(),
        validated_at=timezone.now(),
        validated_by_id=actor_id,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    try:
        movement.full_clean()
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = first_field_errors[0] if first_field_errors else "Invalid stock movement."
        raise InventoryStockMovementError(
            message,
            code=INVALID_INVENTORY_STOCK_MOVEMENT,
        ) from error
    movement.save()
    record_audit_event_on_commit(
        actor=actor,
        action="inventory.stock_movement_created",
        target_type="inventory_stock_movement",
        target_id=str(movement.id),
        metadata={
            "inventory_item_id": str(movement.inventory_item_id),
            "movement_type": movement.movement_type,
            "direction": movement.direction,
            "quantity": movement.quantity,
            "signed_quantity": movement.signed_quantity,
            "reservation_draft_id": (
                str(movement.reservation_draft_id) if movement.reservation_draft_id else None
            ),
            "document_instance_id": (
                str(movement.document_instance_id) if movement.document_instance_id else None
            ),
            "return_operation_id": (
                str(movement.return_operation_id) if movement.return_operation_id else None
            ),
            "return_operation_line_id": (
                str(movement.return_operation_line_id)
                if movement.return_operation_line_id
                else None
            ),
        },
    )
    return movement


def _coerce_decimal_amount(value) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def calculate_caution_available_for_return_operation(
    return_operation: InventoryReturnOperation,
) -> Decimal:
    if return_operation.reservation_draft_id is None:
        return Decimal("0.00")

    aggregate = Payment.objects.filter(
        reservation_draft=return_operation.reservation_draft,
        payment_kind=PaymentKind.CAUTION,
        payment_status__in=CONFIRMED_PAYMENT_STATUS_VALUES,
    ).aggregate(total=Sum("amount"))
    return aggregate["total"] or Decimal("0.00")


@transaction.atomic
def create_inventory_damage_loss_settlement(
    *,
    return_operation: InventoryReturnOperation,
    lines: list[dict] | tuple[dict, ...],
    actor: object | None = None,
    document_instance=None,
    notes: str = "",
) -> InventoryDamageLossSettlement:
    actor_id = getattr(actor, "pk", None)
    settlement = InventoryDamageLossSettlement(
        return_operation=return_operation,
        document_instance=document_instance,
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    try:
        settlement.full_clean()
        settlement.save()
        line_models = []
        for line_data in lines:
            line = InventoryDamageLossSettlementLine(
                settlement=settlement,
                created_by_id=actor_id,
                updated_by_id=actor_id,
                **line_data,
            )
            line.full_clean()
            line_models.append(line)
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = first_field_errors[0] if first_field_errors else "Invalid damage/loss settlement."
        raise InventoryStockMovementError(
            message,
            code=(
                INVALID_DAMAGE_LOSS_SETTLEMENT_RETURN_OPERATION_STATE
                if "return_operation" in error.message_dict
                else INVALID_DAMAGE_LOSS_SETTLEMENT
            ),
        ) from error

    InventoryDamageLossSettlementLine.objects.bulk_create(line_models)
    record_audit_event_on_commit(
        actor=actor,
        action="inventory.damage_loss_settlement_created",
        target_type="inventory_damage_loss_settlement",
        target_id=str(settlement.id),
        metadata={
            "return_operation_id": str(settlement.return_operation_id),
            "reservation_draft_id": (
                str(settlement.return_operation.reservation_draft_id)
                if settlement.return_operation.reservation_draft_id
                else None
            ),
            "line_count": len(line_models),
        },
    )
    return settlement


@transaction.atomic
def create_inventory_damage_loss_settlement_execution(
    *,
    settlement: InventoryDamageLossSettlement,
    actor: object | None = None,
    notes: str = "",
) -> InventoryDamageLossSettlementExecution:
    actor_id = getattr(actor, "pk", None)
    execution = InventoryDamageLossSettlementExecution(
        settlement=settlement,
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    try:
        execution.full_clean()
        execution.save()
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = (
            first_field_errors[0]
            if first_field_errors
            else "Invalid damage/loss settlement execution."
        )
        raise InventoryStockMovementError(
            message,
            code=(
                INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_SETTLEMENT_STATE
                if "settlement" in error.message_dict
                else INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION
            ),
        ) from error

    record_audit_event_on_commit(
        actor=actor,
        action="inventory.damage_loss_settlement_execution_created",
        target_type="inventory_damage_loss_settlement_execution",
        target_id=str(execution.id),
        metadata={
            "settlement_id": str(execution.settlement_id),
            "return_operation_id": str(execution.settlement.return_operation_id),
        },
    )
    return execution


@transaction.atomic
def create_inventory_return_operation(
    *,
    actor: object | None = None,
    reservation_draft=None,
    document_instance=None,
    notes: str = "",
    lines: list[dict] | tuple[dict, ...],
) -> InventoryReturnOperation:
    actor_id = getattr(actor, "pk", None)
    return_operation = InventoryReturnOperation(
        reservation_draft=reservation_draft,
        document_instance=document_instance,
        notes=notes,
        created_by_id=actor_id,
        updated_by_id=actor_id,
    )
    try:
        return_operation.full_clean()
        return_operation.save()
        line_models = []
        for line_data in lines:
            line = InventoryReturnOperationLine(
                return_operation=return_operation,
                created_by_id=actor_id,
                updated_by_id=actor_id,
                **line_data,
            )
            line.full_clean()
            line_models.append(line)
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = first_field_errors[0] if first_field_errors else "Invalid return operation."
        raise InventoryStockMovementError(
            message,
            code=INVALID_RETURN_OPERATION,
        ) from error

    for line in line_models:
        line.return_operation = return_operation
    InventoryReturnOperationLine.objects.bulk_create(line_models)

    record_audit_event_on_commit(
        actor=actor,
        action="inventory.return_operation_created",
        target_type="inventory_return_operation",
        target_id=str(return_operation.id),
        metadata={
            "reservation_draft_id": (
                str(return_operation.reservation_draft_id)
                if return_operation.reservation_draft_id
                else None
            ),
            "document_instance_id": (
                str(return_operation.document_instance_id)
                if return_operation.document_instance_id
                else None
            ),
            "line_count": len(line_models),
        },
    )
    return return_operation


@transaction.atomic
def validate_inventory_return_operation(
    *,
    return_operation: InventoryReturnOperation,
    actor: object | None = None,
) -> ReturnOperationValidationResult:
    locked_return_operation = InventoryReturnOperation.objects.select_for_update().get(
        pk=return_operation.pk
    )
    locked_lines = list(
        InventoryReturnOperationLine.objects.select_related("inventory_item")
        .filter(return_operation=locked_return_operation)
        .order_by("created_at", "id")
    )
    if locked_return_operation.status != InventoryReturnOperationStatus.DRAFT:
        raise InventoryStockMovementError(
            "Return operation is already validated.",
            code=INVALID_RETURN_OPERATION_STATE,
        )

    actor_id = getattr(actor, "pk", None)
    validated_at = timezone.now()
    stock_movements: list[InventoryStockMovement] = []

    for line in locked_lines:
        movement_specs = []
        if line.intact_quantity > 0:
            movement_specs.append((InventoryStockMovementType.INBOUND_RETURN, line.intact_quantity))
        if line.damaged_quantity > 0:
            movement_specs.append((InventoryStockMovementType.DAMAGE, line.damaged_quantity))
        if line.missing_quantity > 0:
            movement_specs.append((InventoryStockMovementType.LOSS, line.missing_quantity))

        for movement_type, quantity in movement_specs:
            source_label = f"return_operation:{locked_return_operation.id}"
            movement_notes = line.notes or locked_return_operation.notes or source_label
            movement = create_inventory_stock_movement(
                actor=actor,
                inventory_item=line.inventory_item,
                reservation_draft=locked_return_operation.reservation_draft,
                document_instance=locked_return_operation.document_instance,
                return_operation=locked_return_operation,
                return_operation_line=line,
                movement_type=movement_type,
                quantity=quantity,
                source_label=source_label,
                notes=movement_notes,
                effective_at=validated_at,
            )
            stock_movements.append(movement)

    locked_return_operation.status = InventoryReturnOperationStatus.VALIDATED
    locked_return_operation.validated_at = validated_at
    locked_return_operation.validated_by_id = actor_id
    locked_return_operation.updated_by_id = actor_id
    try:
        locked_return_operation.full_clean()
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = first_field_errors[0] if first_field_errors else "Invalid return operation."
        raise InventoryStockMovementError(
            message,
            code=INVALID_RETURN_OPERATION,
        ) from error
    locked_return_operation.save()

    record_audit_event_on_commit(
        actor=actor,
        action="inventory.return_operation_validated",
        target_type="inventory_return_operation",
        target_id=str(locked_return_operation.id),
        metadata={
            "stock_movement_count": len(stock_movements),
            "reservation_draft_id": (
                str(locked_return_operation.reservation_draft_id)
                if locked_return_operation.reservation_draft_id
                else None
            ),
        },
    )
    return ReturnOperationValidationResult(
        return_operation=locked_return_operation,
        stock_movements=tuple(stock_movements),
    )


@transaction.atomic
def validate_inventory_damage_loss_settlement(
    *,
    settlement: InventoryDamageLossSettlement,
    actor: object | None = None,
) -> DamageLossSettlementValidationResult:
    locked_settlement = InventoryDamageLossSettlement.objects.select_for_update().get(
        pk=settlement.pk
    )
    locked_settlement = InventoryDamageLossSettlement.objects.select_related(
        "return_operation",
        "return_operation__reservation_draft",
    ).get(pk=locked_settlement.pk)
    locked_lines = list(
        InventoryDamageLossSettlementLine.objects.filter(settlement=locked_settlement).order_by(
            "created_at", "id"
        )
    )
    if locked_settlement.settlement_status != InventoryDamageLossSettlementStatus.DRAFT:
        raise InventoryStockMovementError(
            "Damage/loss settlement is not in draft state.",
            code=INVALID_DAMAGE_LOSS_SETTLEMENT_STATE,
        )

    if locked_settlement.return_operation.status != InventoryReturnOperationStatus.VALIDATED:
        raise InventoryStockMovementError(
            "Damage/loss settlement requires a validated return operation.",
            code=INVALID_DAMAGE_LOSS_SETTLEMENT_RETURN_OPERATION_STATE,
        )

    damage_loss_total = sum(
        (_coerce_decimal_amount(line.total_amount) for line in locked_lines),
        Decimal("0.00"),
    )
    caution_available = calculate_caution_available_for_return_operation(
        locked_settlement.return_operation
    )
    caution_applied = min(damage_loss_total, caution_available)
    refund_due = max(caution_available - damage_loss_total, Decimal("0.00"))
    excess_due = max(damage_loss_total - caution_available, Decimal("0.00"))
    actor_id = getattr(actor, "pk", None)
    validated_at = timezone.now()

    locked_settlement.damage_loss_total = damage_loss_total
    locked_settlement.caution_available = caution_available
    locked_settlement.caution_applied = caution_applied
    locked_settlement.refund_due = refund_due
    locked_settlement.excess_due = excess_due
    locked_settlement.settlement_status = InventoryDamageLossSettlementStatus.VALIDATED
    locked_settlement.validated_at = validated_at
    locked_settlement.validated_by_id = actor_id
    locked_settlement.updated_by_id = actor_id
    try:
        locked_settlement.full_clean()
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = first_field_errors[0] if first_field_errors else "Invalid damage/loss settlement."
        raise InventoryStockMovementError(
            message,
            code=INVALID_DAMAGE_LOSS_SETTLEMENT,
        ) from error
    locked_settlement.save()

    record_audit_event_on_commit(
        actor=actor,
        action="inventory.damage_loss_settlement_validated",
        target_type="inventory_damage_loss_settlement",
        target_id=str(locked_settlement.id),
        metadata={
            "return_operation_id": str(locked_settlement.return_operation_id),
            "reservation_draft_id": (
                str(locked_settlement.return_operation.reservation_draft_id)
                if locked_settlement.return_operation.reservation_draft_id
                else None
            ),
            "damage_loss_total": str(damage_loss_total),
            "caution_available": str(caution_available),
            "caution_applied": str(caution_applied),
            "refund_due": str(refund_due),
            "excess_due": str(excess_due),
            "line_count": len(locked_lines),
        },
    )
    return DamageLossSettlementValidationResult(settlement=locked_settlement)


@transaction.atomic
def execute_inventory_damage_loss_settlement_execution(
    *,
    execution: InventoryDamageLossSettlementExecution,
    actor: object | None = None,
) -> DamageLossSettlementExecutionResult:
    locked_execution = InventoryDamageLossSettlementExecution.objects.select_for_update().get(
        pk=execution.pk
    )
    locked_execution = InventoryDamageLossSettlementExecution.objects.select_related(
        "settlement",
        "settlement__return_operation",
    ).get(pk=locked_execution.pk)
    if locked_execution.status != InventoryDamageLossSettlementExecutionStatus.DRAFT:
        raise InventoryStockMovementError(
            "Damage/loss settlement execution is not in draft state.",
            code=INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_STATE,
        )

    if (
        locked_execution.settlement.settlement_status
        != InventoryDamageLossSettlementStatus.VALIDATED
    ):
        raise InventoryStockMovementError(
            "Damage/loss settlement execution requires a validated settlement.",
            code=INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION_SETTLEMENT_STATE,
        )

    actor_id = getattr(actor, "pk", None)
    executed_at = timezone.now()
    locked_settlement = locked_execution.settlement
    locked_execution.damage_loss_total_snapshot = locked_settlement.damage_loss_total
    locked_execution.caution_available_snapshot = locked_settlement.caution_available
    locked_execution.caution_applied_snapshot = locked_settlement.caution_applied
    locked_execution.refund_due_snapshot = locked_settlement.refund_due
    locked_execution.excess_due_snapshot = locked_settlement.excess_due
    locked_execution.status = InventoryDamageLossSettlementExecutionStatus.EXECUTED
    locked_execution.executed_at = executed_at
    locked_execution.executed_by_id = actor_id
    locked_execution.updated_by_id = actor_id
    try:
        locked_execution.full_clean()
    except ValidationError as error:
        first_field_errors = next(iter(error.message_dict.values()), error.messages)
        message = (
            first_field_errors[0]
            if first_field_errors
            else "Invalid damage/loss settlement execution."
        )
        raise InventoryStockMovementError(
            message,
            code=INVALID_DAMAGE_LOSS_SETTLEMENT_EXECUTION,
        ) from error
    locked_execution.save()

    refund_obligation = None
    if locked_execution.refund_due_snapshot > Decimal("0.00"):
        refund_obligation = InventoryCautionRefundObligation(
            settlement_execution=locked_execution,
            amount=locked_execution.refund_due_snapshot,
            created_by_id=actor_id,
            updated_by_id=actor_id,
        )
        refund_obligation.full_clean()
        refund_obligation.save()

    excess_receivable = None
    if locked_execution.excess_due_snapshot > Decimal("0.00"):
        excess_receivable = InventoryDamageLossExcessReceivable(
            settlement_execution=locked_execution,
            amount=locked_execution.excess_due_snapshot,
            created_by_id=actor_id,
            updated_by_id=actor_id,
        )
        excess_receivable.full_clean()
        excess_receivable.save()

    record_audit_event_on_commit(
        actor=actor,
        action="inventory.damage_loss_settlement_execution_executed",
        target_type="inventory_damage_loss_settlement_execution",
        target_id=str(locked_execution.id),
        metadata={
            "settlement_id": str(locked_execution.settlement_id),
            "damage_loss_total_snapshot": str(locked_execution.damage_loss_total_snapshot),
            "caution_available_snapshot": str(locked_execution.caution_available_snapshot),
            "caution_applied_snapshot": str(locked_execution.caution_applied_snapshot),
            "refund_due_snapshot": str(locked_execution.refund_due_snapshot),
            "excess_due_snapshot": str(locked_execution.excess_due_snapshot),
            "refund_obligation_id": str(refund_obligation.id) if refund_obligation else None,
            "excess_receivable_id": str(excess_receivable.id) if excess_receivable else None,
        },
    )
    return DamageLossSettlementExecutionResult(
        execution=locked_execution,
        refund_obligation=refund_obligation,
        excess_receivable=excess_receivable,
    )


@transaction.atomic
def generate_excess_receivable_invoice_document(
    *,
    excess_receivable: InventoryDamageLossExcessReceivable,
    actor: object | None = None,
    notes: str = "",
) -> DocumentInstance:
    """
    Generate an invoice/document for an excess receivable and link it to the settlement.

    Args:
        excess_receivable: The excess receivable to generate an invoice for
        actor: The user performing the action
        notes: Optional notes to include with the document instance

    Returns:
        The generated DocumentInstance

    Raises:
        ValidationError: If the excess receivable is not in PENDING_INVOICE
            status or has zero amount
    """
    # Cross-app runtime import is local to keep the module import cycle-safe.
    from apps.documents.runtime import generate_document_instance_html

    # Validate that the excess receivable is ready for invoicing
    if excess_receivable.status != InventoryDamageLossExcessReceivableStatus.PENDING_INVOICE:
        raise ValidationError(
            f"Excess receivable must be in PENDING_INVOICE status to generate invoice. "
            f"Current status: {excess_receivable.status}"
        )

    if excess_receivable.amount <= 0:
        raise ValidationError("Excess receivable must have a positive amount to generate invoice.")

    # Get the actor ID for audit trails
    actor_id = getattr(actor, "pk", None) if actor else None

    # Build the context for the excess receivable invoice
    context = build_excess_receivable_invoice_context(excess_receivable=excess_receivable)

    # Create the DocumentInstance with the excess receivable invoice template
    template_key = EXCESS_RECEIVABLE_INVOICE_TEMPLATE_KEY
    instance = DocumentInstance.objects.create(
        reservation_draft=None,  # Not directly linked to a reservation draft
        customer=None,  # Will be set from context below
        template_key=context.template.key,
        template_version=context.template.version,
        template_label=context.template.label,
        business_scope=context.template.business_scope,
        document_type=context.template.document_type,
        template_status=context.template.status,
        template_source_kind=context.template.source_kind,
        template_source_reference=context.template.source_reference,
        template_path=context.template.template_path,
        template_preview_path=context.template.preview_path,
        template_validated_by_client=context.template.validated_by_client,
        template_notes=context.template.notes,
        # Customer and reservation data from context
        reservation_public_reference=context.excess_receivable.reservation_public_reference,
        reservation_status=context.excess_receivable.reservation_status,
        customer_display_name=context.excess_receivable.customer_display_name,
        customer_email=context.excess_receivable.customer_email,
        customer_phone=context.excess_receivable.customer_phone,
        customer_address=context.excess_receivable.customer_address,
        status="prepared",
        prepared_at=timezone.now(),
        prepared_by_id=actor_id,
        notes=notes,
    )

    # Link the document instance to the settlement
    settlement = excess_receivable.settlement_execution.settlement
    settlement.document_instance = instance
    settlement.save(update_fields=["document_instance", "updated_at"])

    # Generate the document HTML content
    result = generate_document_instance_html(document_instance=instance, actor=actor)

    # Update the excess receivable status to INVOICED
    excess_receivable.status = InventoryDamageLossExcessReceivableStatus.INVOICED
    excess_receivable.save(update_fields=["status", "updated_at"])

    # Record audit events
    record_audit_event_on_commit(
        actor=actor,
        action="excess_receivable.invoice_document_prepared",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "excess_receivable_id": str(excess_receivable.id),
            "template_key": template_key,
            "status": instance.status,
        },
    )

    record_audit_event_on_commit(
        actor=actor,
        action="excess_receivable.invoice_document_generated",
        target_type="document_instance",
        target_id=str(instance.id),
        metadata={
            "excess_receivable_id": str(excess_receivable.id),
            "template_key": template_key,
            "status": instance.status,
            "content_checksum": result.content_checksum,
        },
    )

    return instance
