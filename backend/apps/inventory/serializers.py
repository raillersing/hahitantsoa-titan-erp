from decimal import Decimal

from rest_framework import serializers

from apps.documents.models import DocumentInstance
from apps.inventory.models import (
    InventoryCautionRefundObligation,
    InventoryDamageLossExcessReceivable,
    InventoryDamageLossSettlement,
    InventoryDamageLossSettlementExecution,
    InventoryDamageLossSettlementLine,
    InventoryItem,
    InventoryReturnOperation,
    InventoryReturnOperationLine,
    InventoryStockMovement,
)
from apps.inventory.scope import assert_titan_allowed_item_kind
from apps.logistics.models import LogisticsEvent
from apps.reservations.models import ReservationDraft


class InventoryItemSerializer(serializers.ModelSerializer):
    kind = serializers.CharField(max_length=32)

    class Meta:
        model = InventoryItem
        fields = (
            "id",
            "name",
            "kind",
            "description",
            "is_active",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "is_deleted",
            "deleted_at",
            "created_by",
            "updated_by",
        )

    def validate_kind(self, value: str) -> str:
        try:
            item_kind = assert_titan_allowed_item_kind(value)
        except ValueError as error:
            raise serializers.ValidationError(
                "Inventory item kind is not allowed for Titan."
            ) from error

        return item_kind.value


class InventoryStockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryStockMovement
        fields = (
            "id",
            "inventory_item",
            "reservation_draft",
            "document_instance",
            "movement_type",
            "direction",
            "quantity",
            "source_label",
            "notes",
            "effective_at",
            "validated_at",
            "validated_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = fields


class InventoryStockMovementCreateSerializer(serializers.Serializer):
    inventory_item = serializers.PrimaryKeyRelatedField(
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
    )
    reservation_draft = serializers.PrimaryKeyRelatedField(
        queryset=ReservationDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )
    document_instance = serializers.PrimaryKeyRelatedField(
        queryset=DocumentInstance.objects.all(),
        required=False,
        allow_null=True,
    )
    movement_type = serializers.ChoiceField(
        choices=InventoryStockMovement._meta.get_field("movement_type").choices
    )
    direction = serializers.ChoiceField(
        choices=InventoryStockMovement._meta.get_field("direction").choices,
        required=False,
        allow_null=True,
    )
    quantity = serializers.IntegerField(min_value=1)
    source_label = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    effective_at = serializers.DateTimeField(required=False)


class InventoryReturnOperationLineSerializer(serializers.ModelSerializer):
    intact_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = InventoryReturnOperationLine
        fields = (
            "id",
            "inventory_item",
            "expected_quantity",
            "returned_quantity",
            "damaged_quantity",
            "missing_quantity",
            "condition_status",
            "notes",
            "intact_quantity",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = fields


class InventoryReturnOperationSerializer(serializers.ModelSerializer):
    lines = InventoryReturnOperationLineSerializer(many=True, read_only=True)

    class Meta:
        model = InventoryReturnOperation
        fields = (
            "id",
            "reservation_draft",
            "logistics_event",
            "document_instance",
            "status",
            "notes",
            "validated_at",
            "validated_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "lines",
        )
        read_only_fields = fields


class InventoryReturnOperationLineCreateSerializer(serializers.Serializer):
    inventory_item = serializers.PrimaryKeyRelatedField(
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
    )
    expected_quantity = serializers.IntegerField(min_value=1)
    returned_quantity = serializers.IntegerField(min_value=0)
    damaged_quantity = serializers.IntegerField(min_value=0, required=False, default=0)
    missing_quantity = serializers.IntegerField(min_value=0, required=False, default=0)
    condition_status = serializers.ChoiceField(
        choices=InventoryReturnOperationLine._meta.get_field("condition_status").choices
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InventoryReturnOperationCreateSerializer(serializers.Serializer):
    reservation_draft = serializers.PrimaryKeyRelatedField(
        queryset=ReservationDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )
    logistics_event = serializers.PrimaryKeyRelatedField(
        queryset=LogisticsEvent.objects.all(),
        required=False,
        allow_null=True,
    )
    document_instance = serializers.PrimaryKeyRelatedField(
        queryset=DocumentInstance.objects.all(),
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    lines = InventoryReturnOperationLineCreateSerializer(many=True, allow_empty=False)


class InventoryDamageLossSettlementLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryDamageLossSettlementLine
        fields = (
            "id",
            "return_operation_line",
            "manual_label",
            "settlement_line_kind",
            "quantity",
            "unit_amount",
            "amount_source",
            "total_amount",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = fields


class InventoryDamageLossSettlementSerializer(serializers.ModelSerializer):
    lines = InventoryDamageLossSettlementLineSerializer(many=True, read_only=True)

    class Meta:
        model = InventoryDamageLossSettlement
        fields = (
            "id",
            "return_operation",
            "document_instance",
            "settlement_status",
            "damage_loss_total",
            "caution_available",
            "caution_applied",
            "refund_due",
            "excess_due",
            "notes",
            "validated_at",
            "validated_by",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "lines",
        )
        read_only_fields = fields


class InventoryDamageLossSettlementLineCreateSerializer(serializers.Serializer):
    return_operation_line = serializers.PrimaryKeyRelatedField(
        queryset=InventoryReturnOperationLine.objects.select_related("return_operation"),
        required=False,
        allow_null=True,
    )
    manual_label = serializers.CharField(required=False, allow_blank=True, default="")
    settlement_line_kind = serializers.ChoiceField(
        choices=InventoryDamageLossSettlementLine._meta.get_field("settlement_line_kind").choices
    )
    quantity = serializers.IntegerField(min_value=1)
    unit_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    amount_source = serializers.ChoiceField(
        choices=InventoryDamageLossSettlementLine._meta.get_field("amount_source").choices,
        required=False,
        default="manual",
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InventoryDamageLossSettlementCreateSerializer(serializers.Serializer):
    return_operation = serializers.PrimaryKeyRelatedField(
        queryset=InventoryReturnOperation.objects.prefetch_related("lines"),
    )
    document_instance = serializers.PrimaryKeyRelatedField(
        queryset=DocumentInstance.objects.all(),
        required=False,
        allow_null=True,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    lines = InventoryDamageLossSettlementLineCreateSerializer(many=True, allow_empty=False)


class InventoryCautionRefundObligationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryCautionRefundObligation
        fields = (
            "id",
            "amount",
            "status",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = fields


class InventoryDamageLossExcessReceivableSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryDamageLossExcessReceivable
        fields = (
            "id",
            "amount",
            "status",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = fields


class InventoryDamageLossSettlementExecutionSerializer(serializers.ModelSerializer):
    refund_obligation = InventoryCautionRefundObligationSerializer(read_only=True)
    excess_receivable = InventoryDamageLossExcessReceivableSerializer(read_only=True)

    class Meta:
        model = InventoryDamageLossSettlementExecution
        fields = (
            "id",
            "settlement",
            "status",
            "executed_at",
            "executed_by",
            "damage_loss_total_snapshot",
            "caution_available_snapshot",
            "caution_applied_snapshot",
            "refund_due_snapshot",
            "excess_due_snapshot",
            "notes",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "refund_obligation",
            "excess_receivable",
        )
        read_only_fields = fields


class InventoryDamageLossSettlementExecutionCreateSerializer(serializers.Serializer):
    settlement = serializers.PrimaryKeyRelatedField(
        queryset=InventoryDamageLossSettlement.objects.select_related("return_operation"),
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")
