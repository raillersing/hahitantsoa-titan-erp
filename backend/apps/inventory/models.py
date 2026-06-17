from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import (
    AuditableModel,
    SoftDeleteModel,
    TimestampedModel,
    UUIDModel,
)
from apps.inventory.scope import InventoryItemKind, assert_titan_allowed_item_kind

INVENTORY_ITEM_KIND_CHOICES = [
    (item_kind.value, item_kind.value) for item_kind in InventoryItemKind
]
INVENTORY_ITEM_KIND_VALUES = [item_kind.value for item_kind in InventoryItemKind]


class InventoryAvailabilityStatus(models.TextChoices):
    BLOCKED = "blocked", "blocked"
    RESERVED = "reserved", "reserved"


INVENTORY_AVAILABILITY_STATUS_VALUES = [
    availability_status.value for availability_status in InventoryAvailabilityStatus
]


class InventoryStockMovementType(models.TextChoices):
    OUTBOUND_DELIVERY = "outbound_delivery", "outbound_delivery"
    INBOUND_RETURN = "inbound_return", "inbound_return"
    DAMAGE = "damage", "damage"
    LOSS = "loss", "loss"
    ADJUSTMENT_IN = "adjustment_in", "adjustment_in"
    ADJUSTMENT_OUT = "adjustment_out", "adjustment_out"
    OTHER = "other", "other"


class InventoryStockMovementDirection(models.TextChoices):
    INBOUND = "inbound", "inbound"
    OUTBOUND = "outbound", "outbound"


class InventoryReturnOperationStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    VALIDATED = "validated", "validated"


class InventoryReturnOperationLineConditionStatus(models.TextChoices):
    INTACT = "intact", "intact"
    DAMAGED = "damaged", "damaged"
    MISSING = "missing", "missing"
    MIXED = "mixed", "mixed"


class InventoryDamageLossSettlementStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    VALIDATED = "validated", "validated"
    CANCELLED = "cancelled", "cancelled"


class InventoryDamageLossSettlementLineKind(models.TextChoices):
    DAMAGE = "damage", "damage"
    LOSS = "loss", "loss"
    REPAIR = "repair", "repair"
    NON_INVENTORY_DAMAGE = "non_inventory_damage", "non_inventory_damage"
    OTHER = "other", "other"


class InventoryDamageLossSettlementAmountSource(models.TextChoices):
    MANUAL = "manual", "manual"
    INVENTORY_DEFAULT = "inventory_default", "inventory_default"
    PRICING_TABLE = "pricing_table", "pricing_table"
    OVERRIDE = "override", "override"


class InventoryDamageLossSettlementExecutionStatus(models.TextChoices):
    DRAFT = "draft", "draft"
    EXECUTED = "executed", "executed"
    CANCELLED = "cancelled", "cancelled"


class InventoryCautionRefundObligationStatus(models.TextChoices):
    PENDING = "pending", "pending"
    SETTLED = "settled", "settled"
    CANCELLED = "cancelled", "cancelled"


class InventoryDamageLossExcessReceivableStatus(models.TextChoices):
    PENDING_INVOICE = "pending_invoice", "pending_invoice"
    INVOICED = "invoiced", "invoiced"
    CANCELLED = "cancelled", "cancelled"


FIXED_INVENTORY_STOCK_MOVEMENT_DIRECTIONS = {
    InventoryStockMovementType.OUTBOUND_DELIVERY: InventoryStockMovementDirection.OUTBOUND,
    InventoryStockMovementType.DAMAGE: InventoryStockMovementDirection.OUTBOUND,
    InventoryStockMovementType.LOSS: InventoryStockMovementDirection.OUTBOUND,
    InventoryStockMovementType.ADJUSTMENT_OUT: InventoryStockMovementDirection.OUTBOUND,
    InventoryStockMovementType.INBOUND_RETURN: InventoryStockMovementDirection.INBOUND,
    InventoryStockMovementType.ADJUSTMENT_IN: InventoryStockMovementDirection.INBOUND,
}


class InventoryItem(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=32, choices=INVENTORY_ITEM_KIND_CHOICES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Inventory item"
        verbose_name_plural = "Inventory items"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(kind__in=INVENTORY_ITEM_KIND_VALUES),
                name="inventory_item_kind_allowed_for_titan",
            ),
        ]

    def clean(self) -> None:
        try:
            item_kind = assert_titan_allowed_item_kind(self.kind)
        except ValueError as error:
            raise ValidationError(
                {"kind": "Inventory item kind is not allowed for Titan."}
            ) from error

        self.kind = item_kind.value

    def __str__(self) -> str:
        return self.name


class InventoryAvailability(UUIDModel, TimestampedModel, SoftDeleteModel, AuditableModel):
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="availability_periods",
    )
    reservation_draft = models.ForeignKey(
        "reservations.ReservationDraft",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inventory_availability_blocks",
    )
    hahitantsoa_event_draft = models.ForeignKey(
        "hahitantsoa.HahitantsoaEventDraft",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="inventory_availability_blocks",
    )
    status = models.CharField(max_length=32, choices=InventoryAvailabilityStatus.choices)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["start_at", "end_at"]
        verbose_name = "Inventory availability"
        verbose_name_plural = "Inventory availabilities"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=INVENTORY_AVAILABILITY_STATUS_VALUES),
                name="inventory_availability_status_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(end_at__gt=models.F("start_at")),
                name="inventory_availability_end_after_start",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.inventory_item} {self.status} from {self.start_at} to {self.end_at}"


class InventoryStockMovement(UUIDModel, TimestampedModel, AuditableModel):
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    reservation_draft = models.ForeignKey(
        "reservations.ReservationDraft",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    document_instance = models.ForeignKey(
        "documents.DocumentInstance",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="inventory_stock_movements",
    )
    return_operation = models.ForeignKey(
        "inventory.InventoryReturnOperation",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    return_operation_line = models.ForeignKey(
        "inventory.InventoryReturnOperationLine",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    movement_type = models.CharField(max_length=32, choices=InventoryStockMovementType.choices)
    direction = models.CharField(
        max_length=16,
        choices=InventoryStockMovementDirection.choices,
    )
    quantity = models.PositiveIntegerField()
    source_label = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    effective_at = models.DateTimeField(default=timezone.now)
    validated_at = models.DateTimeField(default=timezone.now)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-effective_at", "-created_at", "id"]
        verbose_name = "Inventory stock movement"
        verbose_name_plural = "Inventory stock movements"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="inventory_stock_movement_quantity_positive",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(
                        movement_type=InventoryStockMovementType.OTHER,
                        direction__in=[
                            InventoryStockMovementDirection.INBOUND,
                            InventoryStockMovementDirection.OUTBOUND,
                        ],
                    )
                    | ~models.Q(movement_type=InventoryStockMovementType.OTHER)
                ),
                name="inventory_stock_movement_other_requires_direction",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(reservation_draft__isnull=False)
                    | models.Q(document_instance__isnull=False)
                    | (~models.Q(source_label="") & ~models.Q(notes=""))
                ),
                name="inventory_stock_movement_standalone_requires_source_and_notes",
            ),
        ]

    def clean(self) -> None:
        if self.quantity <= 0:
            raise ValidationError({"quantity": "Quantity must be greater than zero."})

        try:
            expected_direction = FIXED_INVENTORY_STOCK_MOVEMENT_DIRECTIONS[
                InventoryStockMovementType(self.movement_type)
            ]
        except KeyError:
            expected_direction = None

        if expected_direction is not None and self.direction != expected_direction:
            raise ValidationError(
                {
                    "direction": (
                        f"Movement type '{self.movement_type}' requires direction "
                        f"'{expected_direction.value}'."
                    )
                }
            )

        if (
            self.reservation_draft_id is None
            and self.document_instance_id is None
            and ((self.source_label or "").strip() == "" or (self.notes or "").strip() == "")
        ):
            raise ValidationError(
                {"source_label": ("Standalone stock movements require source_label and notes.")}
            )

        if not self.inventory_item.is_active or self.inventory_item.is_deleted:
            raise ValidationError({"inventory_item": "Stock movement item must be active."})

    @property
    def signed_quantity(self) -> int:
        if self.direction == InventoryStockMovementDirection.INBOUND:
            return self.quantity
        return -self.quantity

    def __str__(self) -> str:
        return f"{self.inventory_item} {self.movement_type} {self.direction} x {self.quantity}"


class InventoryReturnOperation(UUIDModel, TimestampedModel, AuditableModel):
    reservation_draft = models.ForeignKey(
        "reservations.ReservationDraft",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="return_operations",
    )
    document_instance = models.ForeignKey(
        "documents.DocumentInstance",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="return_operations",
    )
    status = models.CharField(
        max_length=32,
        choices=InventoryReturnOperationStatus.choices,
        default=InventoryReturnOperationStatus.DRAFT,
    )
    notes = models.TextField(blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Inventory return operation"
        verbose_name_plural = "Inventory return operations"
        constraints = [
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(status=InventoryReturnOperationStatus.DRAFT)
                        & models.Q(validated_at__isnull=True)
                    )
                    | (
                        models.Q(status=InventoryReturnOperationStatus.VALIDATED)
                        & models.Q(validated_at__isnull=False)
                    )
                ),
                name="inventory_return_operation_status_validated_at_consistent",
            ),
        ]

    def clean(self) -> None:
        if self.status == InventoryReturnOperationStatus.VALIDATED and self.validated_by_id is None:
            raise ValidationError(
                {"validated_by": "Validated return operations require validated_by."}
            )

        if self.status == InventoryReturnOperationStatus.DRAFT and self.validated_by_id is not None:
            raise ValidationError(
                {"validated_by": "Draft return operations cannot have validated_by."}
            )

    def __str__(self) -> str:
        return f"Return operation {self.id} ({self.status})"


class InventoryReturnOperationLine(UUIDModel, TimestampedModel, AuditableModel):
    return_operation = models.ForeignKey(
        InventoryReturnOperation,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="return_operation_lines",
    )
    expected_quantity = models.PositiveIntegerField()
    returned_quantity = models.PositiveIntegerField(default=0)
    damaged_quantity = models.PositiveIntegerField(default=0)
    missing_quantity = models.PositiveIntegerField(default=0)
    condition_status = models.CharField(
        max_length=32,
        choices=InventoryReturnOperationLineConditionStatus.choices,
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Inventory return operation line"
        verbose_name_plural = "Inventory return operation lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(expected_quantity__gt=0),
                name="inventory_return_operation_line_expected_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(returned_quantity__gte=0),
                name="inventory_return_operation_line_returned_quantity_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(damaged_quantity__gte=0),
                name="inventory_return_operation_line_damaged_quantity_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(missing_quantity__gte=0),
                name="inventory_return_operation_line_missing_quantity_non_negative",
            ),
        ]

    def clean(self) -> None:
        if self.expected_quantity <= 0:
            raise ValidationError(
                {"expected_quantity": "Expected quantity must be greater than zero."}
            )

        if self.damaged_quantity > self.returned_quantity:
            raise ValidationError(
                {"damaged_quantity": "Damaged quantity cannot exceed returned quantity."}
            )

        if self.returned_quantity + self.missing_quantity > self.expected_quantity:
            raise ValidationError(
                {
                    "missing_quantity": (
                        "Returned quantity plus missing quantity cannot exceed expected quantity."
                    )
                }
            )

        intact_quantity = self.returned_quantity - self.damaged_quantity
        condition_status = InventoryReturnOperationLineConditionStatus(self.condition_status)

        if condition_status == InventoryReturnOperationLineConditionStatus.INTACT:
            if intact_quantity <= 0 or self.damaged_quantity != 0 or self.missing_quantity != 0:
                raise ValidationError(
                    {"condition_status": ("Intact lines require returned intact quantity only.")}
                )
        elif condition_status == InventoryReturnOperationLineConditionStatus.DAMAGED:
            if self.damaged_quantity <= 0 or intact_quantity != 0 or self.missing_quantity != 0:
                raise ValidationError(
                    {"condition_status": ("Damaged lines require damaged returned quantity only.")}
                )
        elif condition_status == InventoryReturnOperationLineConditionStatus.MISSING:
            if self.returned_quantity != 0 or self.missing_quantity <= 0:
                raise ValidationError(
                    {
                        "condition_status": (
                            "Missing lines require missing quantity and no returned quantity."
                        )
                    }
                )
        elif condition_status == InventoryReturnOperationLineConditionStatus.MIXED:
            categories = sum(
                [
                    intact_quantity > 0,
                    self.damaged_quantity > 0,
                    self.missing_quantity > 0,
                ]
            )
            if categories < 2:
                raise ValidationError(
                    {
                        "condition_status": (
                            "Mixed lines require at least two non-zero result categories."
                        )
                    }
                )

        if not self.inventory_item.is_active or self.inventory_item.is_deleted:
            raise ValidationError({"inventory_item": "Return operation item must be active."})

    @property
    def intact_quantity(self) -> int:
        return self.returned_quantity - self.damaged_quantity

    def __str__(self) -> str:
        return f"{self.return_operation} - {self.inventory_item} x {self.expected_quantity}"


class InventoryDamageLossSettlement(UUIDModel, TimestampedModel, AuditableModel):
    return_operation = models.OneToOneField(
        InventoryReturnOperation,
        on_delete=models.PROTECT,
        related_name="damage_loss_settlement",
    )
    document_instance = models.ForeignKey(
        "documents.DocumentInstance",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="damage_loss_settlements",
    )
    settlement_status = models.CharField(
        max_length=32,
        choices=InventoryDamageLossSettlementStatus.choices,
        default=InventoryDamageLossSettlementStatus.DRAFT,
    )
    damage_loss_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    caution_available = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    caution_applied = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refund_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    excess_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Inventory damage/loss settlement"
        verbose_name_plural = "Inventory damage/loss settlements"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(damage_loss_total__gte=0),
                name="inventory_damage_loss_settlement_total_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(caution_available__gte=0),
                name="inventory_damage_loss_settlement_caution_available_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(caution_applied__gte=0),
                name="inventory_damage_loss_settlement_caution_applied_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(refund_due__gte=0),
                name="inventory_damage_loss_settlement_refund_due_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(excess_due__gte=0),
                name="inventory_damage_loss_settlement_excess_due_non_negative",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(settlement_status=InventoryDamageLossSettlementStatus.DRAFT)
                        & models.Q(validated_at__isnull=True)
                        & models.Q(validated_by__isnull=True)
                    )
                    | (
                        models.Q(settlement_status=InventoryDamageLossSettlementStatus.CANCELLED)
                        & models.Q(validated_at__isnull=True)
                        & models.Q(validated_by__isnull=True)
                    )
                    | (
                        models.Q(settlement_status=InventoryDamageLossSettlementStatus.VALIDATED)
                        & models.Q(validated_at__isnull=False)
                        & models.Q(validated_by__isnull=False)
                    )
                ),
                name="inventory_damage_loss_settlement_status_marker_consistent",
            ),
        ]

    def clean(self) -> None:
        if (
            self.settlement_status == InventoryDamageLossSettlementStatus.VALIDATED
            and self.validated_by_id is None
        ):
            raise ValidationError({"validated_by": "Validated settlements require validated_by."})

        if (
            self.settlement_status != InventoryDamageLossSettlementStatus.VALIDATED
            and self.validated_by_id is not None
        ):
            raise ValidationError(
                {"validated_by": "Only validated settlements may keep validated_by."}
            )

        if self.return_operation_id and (
            self.return_operation.status != InventoryReturnOperationStatus.VALIDATED
        ):
            raise ValidationError(
                {
                    "return_operation": (
                        "Damage/loss settlement requires a validated return operation."
                    )
                }
            )

    def __str__(self) -> str:
        return f"Damage/loss settlement {self.id} ({self.settlement_status})"


class InventoryDamageLossSettlementLine(UUIDModel, TimestampedModel, AuditableModel):
    settlement = models.ForeignKey(
        InventoryDamageLossSettlement,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    return_operation_line = models.ForeignKey(
        InventoryReturnOperationLine,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="damage_loss_settlement_lines",
    )
    manual_label = models.CharField(max_length=255, blank=True)
    settlement_line_kind = models.CharField(
        max_length=32,
        choices=InventoryDamageLossSettlementLineKind.choices,
    )
    quantity = models.PositiveIntegerField()
    unit_amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_source = models.CharField(
        max_length=32,
        choices=InventoryDamageLossSettlementAmountSource.choices,
        default=InventoryDamageLossSettlementAmountSource.MANUAL,
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Inventory damage/loss settlement line"
        verbose_name_plural = "Inventory damage/loss settlement lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="inventory_damage_loss_settlement_line_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_amount__gt=0),
                name="inventory_damage_loss_settlement_line_unit_amount_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=0),
                name="inventory_damage_loss_settlement_line_total_amount_non_negative",
            ),
        ]

    def clean(self) -> None:
        if self.quantity <= 0:
            raise ValidationError({"quantity": "Quantity must be greater than zero."})

        if self.unit_amount is None or self.unit_amount <= 0:
            raise ValidationError({"unit_amount": "Unit amount must be greater than zero."})

        if self.amount_source != InventoryDamageLossSettlementAmountSource.MANUAL:
            raise ValidationError(
                {"amount_source": "Only manual amount_source is allowed in this bundle."}
            )

        if self.return_operation_line_id is None and not (self.manual_label or "").strip():
            raise ValidationError(
                {"manual_label": ("Manual non-inventory settlement lines require manual_label.")}
            )

        if (
            self.return_operation_line_id is not None
            and self.settlement_id
            and self.return_operation_line.return_operation_id
            != self.settlement.return_operation_id
        ):
            raise ValidationError(
                {
                    "return_operation_line": (
                        "Settlement line return_operation_line must belong "
                        "to the same return_operation."
                    )
                }
            )

        self.total_amount = self.quantity * self.unit_amount

    def __str__(self) -> str:
        return f"{self.settlement} - {self.settlement_line_kind} x {self.quantity}"


class InventoryDamageLossSettlementExecution(UUIDModel, TimestampedModel, AuditableModel):
    settlement = models.OneToOneField(
        InventoryDamageLossSettlement,
        on_delete=models.PROTECT,
        related_name="execution",
    )
    status = models.CharField(
        max_length=32,
        choices=InventoryDamageLossSettlementExecutionStatus.choices,
        default=InventoryDamageLossSettlementExecutionStatus.DRAFT,
    )
    executed_at = models.DateTimeField(null=True, blank=True)
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    damage_loss_total_snapshot = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    caution_available_snapshot = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    caution_applied_snapshot = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refund_due_snapshot = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    excess_due_snapshot = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Inventory damage/loss settlement execution"
        verbose_name_plural = "Inventory damage/loss settlement executions"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(damage_loss_total_snapshot__gte=0),
                name="inventory_damage_loss_execution_total_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(caution_available_snapshot__gte=0),
                name="inventory_damage_loss_execution_caution_available_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(caution_applied_snapshot__gte=0),
                name="inventory_damage_loss_execution_caution_applied_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(refund_due_snapshot__gte=0),
                name="inventory_damage_loss_execution_refund_due_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(excess_due_snapshot__gte=0),
                name="inventory_damage_loss_execution_excess_due_non_negative",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        models.Q(status=InventoryDamageLossSettlementExecutionStatus.DRAFT)
                        & models.Q(executed_at__isnull=True)
                        & models.Q(executed_by__isnull=True)
                    )
                    | (
                        models.Q(status=InventoryDamageLossSettlementExecutionStatus.CANCELLED)
                        & models.Q(executed_at__isnull=True)
                        & models.Q(executed_by__isnull=True)
                    )
                    | (
                        models.Q(status=InventoryDamageLossSettlementExecutionStatus.EXECUTED)
                        & models.Q(executed_at__isnull=False)
                        & models.Q(executed_by__isnull=False)
                    )
                ),
                name="inventory_damage_loss_execution_status_marker_consistent",
            ),
        ]

    def clean(self) -> None:
        if (
            self.status == InventoryDamageLossSettlementExecutionStatus.EXECUTED
            and self.executed_by_id is None
        ):
            raise ValidationError({"executed_by": "Executed records require executed_by."})

        if (
            self.status != InventoryDamageLossSettlementExecutionStatus.EXECUTED
            and self.executed_by_id is not None
        ):
            raise ValidationError({"executed_by": "Only executed records may keep executed_by."})

        if self.settlement_id and (
            self.settlement.settlement_status != InventoryDamageLossSettlementStatus.VALIDATED
        ):
            raise ValidationError(
                {"settlement": "Settlement execution requires a validated settlement."}
            )

    def __str__(self) -> str:
        return f"Damage/loss execution {self.id} ({self.status})"


class InventoryCautionRefundObligation(UUIDModel, TimestampedModel, AuditableModel):
    settlement_execution = models.OneToOneField(
        InventoryDamageLossSettlementExecution,
        on_delete=models.PROTECT,
        related_name="refund_obligation",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=32,
        choices=InventoryCautionRefundObligationStatus.choices,
        default=InventoryCautionRefundObligationStatus.PENDING,
    )

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Inventory caution refund obligation"
        verbose_name_plural = "Inventory caution refund obligations"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="inventory_caution_refund_obligation_amount_positive",
            ),
        ]

    def clean(self) -> None:
        if (
            self.settlement_execution_id
            and self.settlement_execution.status
            != InventoryDamageLossSettlementExecutionStatus.EXECUTED
        ):
            raise ValidationError(
                {
                    "settlement_execution": (
                        "Refund obligations require an executed settlement execution."
                    )
                }
            )

    def __str__(self) -> str:
        return f"Refund obligation {self.amount} ({self.status})"


class InventoryDamageLossExcessReceivable(UUIDModel, TimestampedModel, AuditableModel):
    settlement_execution = models.OneToOneField(
        InventoryDamageLossSettlementExecution,
        on_delete=models.PROTECT,
        related_name="excess_receivable",
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=32,
        choices=InventoryDamageLossExcessReceivableStatus.choices,
        default=InventoryDamageLossExcessReceivableStatus.PENDING_INVOICE,
    )

    class Meta:
        ordering = ["-created_at", "id"]
        verbose_name = "Inventory damage/loss excess receivable"
        verbose_name_plural = "Inventory damage/loss excess receivables"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="inventory_damage_loss_excess_receivable_amount_positive",
            ),
        ]

    def clean(self) -> None:
        if (
            self.settlement_execution_id
            and self.settlement_execution.status
            != InventoryDamageLossSettlementExecutionStatus.EXECUTED
        ):
            raise ValidationError(
                {
                    "settlement_execution": (
                        "Excess receivables require an executed settlement execution."
                    )
                }
            )

    def __str__(self) -> str:
        return f"Excess receivable {self.amount} ({self.status})"
