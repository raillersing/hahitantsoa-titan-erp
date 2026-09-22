from decimal import Decimal

from rest_framework import serializers

from apps.documents.models import DocumentInstance
from apps.hahitantsoa.models import HahitantsoaEventDraft
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
    InventoryStockMovementType,
    InventoryStorageLocation,
)
from apps.inventory.scope import assert_titan_allowed_item_kind
from apps.logistics.models import LogisticsEvent
from apps.reservations.models import ReservationDraft


class InventoryItemSerializer(serializers.ModelSerializer):
    kind = serializers.CharField(max_length=32)
    stock_summary = serializers.SerializerMethodField()

    def get_stock_summary(self, obj):
        if obj._state.adding:
            return {
                "reported_inventory_quantity": obj.reported_inventory_quantity,
                "reported_damaged_quantity": obj.reported_damaged_quantity,
                "current_stock": obj.reported_inventory_quantity,
                "available_stock": max(
                    obj.reported_inventory_quantity - obj.reported_damaged_quantity, 0
                ),
                "reserved_stock": 0,
                "out_stock": 0,
                "return_stock": 0,
                "damaged_lost_stock": 0,
            }

        movements = list(obj.stock_movements.all()) if not obj._state.adding else []
        initial_movements = [
            movement
            for movement in movements
            if movement.source_label == "Initial inventory import"
        ]
        if initial_movements:
            baseline = sum(movement.quantity for movement in initial_movements)
            operational_movements = [
                movement for movement in movements if movement not in initial_movements
            ]
        else:
            baseline = obj.reported_inventory_quantity
            operational_movements = movements

        current_stock = max(
            baseline + sum(movement.signed_quantity for movement in operational_movements),
            0,
        )
        outbound = sum(
            movement.quantity
            for movement in operational_movements
            if movement.movement_type == InventoryStockMovementType.OUTBOUND_DELIVERY
        )
        returns = sum(
            movement.quantity
            for movement in operational_movements
            if movement.movement_type == InventoryStockMovementType.INBOUND_RETURN
        )
        damaged_lost = sum(
            movement.quantity
            for movement in operational_movements
            if movement.movement_type
            in {InventoryStockMovementType.DAMAGE, InventoryStockMovementType.LOSS}
        )
        canonical_breakage_without_legacy_movement = sum(
            line.effective_breakage_quantity
            for line in obj.return_operation_lines.filter(
                return_operation__status="validated"
            ).prefetch_related("stock_movements")
            if not any(
                movement.movement_type
                in {InventoryStockMovementType.DAMAGE, InventoryStockMovementType.LOSS}
                for movement in line.stock_movements.all()
            )
        )
        return {
            "reported_inventory_quantity": obj.reported_inventory_quantity,
            "reported_damaged_quantity": obj.reported_damaged_quantity,
            "current_stock": current_stock,
            "available_stock": max(current_stock - obj.reported_damaged_quantity, 0),
            "reserved_stock": 0,
            "out_stock": outbound,
            "return_stock": returns,
            "damaged_lost_stock": damaged_lost + canonical_breakage_without_legacy_movement,
        }

    class Meta:
        model = InventoryItem
        fields = (
            "id",
            "name",
            "kind",
            "description",
            "code",
            "section",
            "unit",
            "purchase_price",
            "rental_price",
            "breakage_price",
            "reported_inventory_quantity",
            "reported_damaged_quantity",
            "image_url",
            "stock_summary",
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


class InventoryStorageLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryStorageLocation
        fields = ("id", "name", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class InventoryStorageLocationCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, trim_whitespace=True)

    def validate_name(self, value):
        if InventoryStorageLocation.objects.filter(name__iexact=value.strip()).exists():
            raise serializers.ValidationError("A storage location with this name already exists.")
        return value.strip()


class InventoryStockMovementSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryStockMovement
        fields = (
            "id",
            "inventory_item",
            "storage_location",
            "reservation_draft",
            "hahitantsoa_event_draft",
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
    storage_location = serializers.PrimaryKeyRelatedField(
        queryset=InventoryStorageLocation.objects.all(), required=False, allow_null=True
    )
    reservation_draft = serializers.PrimaryKeyRelatedField(
        queryset=ReservationDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )
    hahitantsoa_event_draft = serializers.PrimaryKeyRelatedField(
        queryset=HahitantsoaEventDraft.objects.filter(is_deleted=False),
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
            "conforming_quantity",
            "breakage_quantity",
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
            "hahitantsoa_event_draft",
            "logistics_event",
            "document_instance",
            "status",
            "notes",
            "idempotency_key",
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
    conforming_quantity = serializers.IntegerField(min_value=0, required=False)
    breakage_quantity = serializers.IntegerField(min_value=0, required=False)
    returned_quantity = serializers.IntegerField(min_value=0, required=False)
    damaged_quantity = serializers.IntegerField(min_value=0, required=False, default=0)
    missing_quantity = serializers.IntegerField(min_value=0, required=False, default=0)
    condition_status = serializers.ChoiceField(
        choices=InventoryReturnOperationLine._meta.get_field("condition_status").choices,
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        canonical_keys = {"conforming_quantity", "breakage_quantity"}
        # Nested serializers do not keep their own ``initial_data``.  Presence
        # in validated attrs is the reliable DRF contract at this level.
        provided_canonical_keys = canonical_keys.intersection(attrs)
        if provided_canonical_keys and provided_canonical_keys != canonical_keys:
            raise serializers.ValidationError(
                "Les quantités conforme et casse doivent être renseignées ensemble."
            )
        if provided_canonical_keys:
            if (
                attrs["conforming_quantity"] + attrs["breakage_quantity"]
                != attrs["expected_quantity"]
            ):
                raise serializers.ValidationError(
                    {
                        "breakage_quantity": (
                            "Un retour complet exige que conforme plus casse égale "
                            "la quantité attendue."
                        )
                    }
                )
            return attrs

        return attrs


class InventoryReturnOperationCreateSerializer(serializers.Serializer):
    reservation_draft = serializers.PrimaryKeyRelatedField(
        queryset=ReservationDraft.objects.filter(is_deleted=False),
        required=False,
        allow_null=True,
    )
    hahitantsoa_event_draft = serializers.PrimaryKeyRelatedField(
        queryset=HahitantsoaEventDraft.objects.filter(is_deleted=False),
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
    idempotency_key = serializers.CharField(
        required=False, allow_blank=True, max_length=96, default=""
    )
    lines = InventoryReturnOperationLineCreateSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        res = attrs.get("reservation_draft")
        evt = attrs.get("hahitantsoa_event_draft")
        if res and evt:
            raise serializers.ValidationError(
                "Un retour ne peut concerner qu'un dossier Titan ou un événement Hahitantsoa."
            )
        if not res and not evt:
            raise serializers.ValidationError(
                "Un retour doit être rattaché à une réservation Titan ou un événement Hahitantsoa."
            )

        from apps.hahitantsoa.closeout import is_hahitantsoa_event_closed
        from apps.reservations.closeout import is_reservation_closed

        if res and is_reservation_closed(res):
            raise serializers.ValidationError(
                {"reservation_draft": "Ce dossier est clôturé. Aucun retour n'est autorisé."}
            )
        if evt and is_hahitantsoa_event_closed(evt):
            raise serializers.ValidationError(
                {
                    "hahitantsoa_event_draft": (
                        "Cet événement est clôturé. Aucun retour n'est autorisé."
                    )
                }
            )

        doc = attrs.get("document_instance")
        if doc is not None:
            if res and doc.reservation_draft_id != res.id:
                raise serializers.ValidationError(
                    {"document_instance": "Le bon de livraison ne correspond pas à la réservation."}
                )
            if evt and doc.hahitantsoa_event_draft_id != evt.id:
                raise serializers.ValidationError(
                    {"document_instance": "Le bon de livraison ne correspond pas à l'événement."}
                )

        if attrs.get("idempotency_key") and not (res or evt):
            raise serializers.ValidationError(
                {"idempotency_key": "La clé de reprise nécessite un dossier métier."}
            )
        return attrs


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
        required=True,
    )
    # Accepted only for transport compatibility.  The service derives the
    # persisted label from return_operation_line.inventory_item.
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
    lines = InventoryDamageLossSettlementLineCreateSerializer(many=True, allow_empty=True)

    def validate(self, attrs):
        return_operation = attrs.get("return_operation")
        if return_operation:
            from apps.hahitantsoa.closeout import is_hahitantsoa_event_closed
            from apps.reservations.closeout import is_reservation_closed

            if is_reservation_closed(return_operation.reservation_draft_id):
                raise serializers.ValidationError(
                    {"return_operation": "Ce dossier est clôturé. Aucun règlement n'est autorisé."}
                )
            if is_hahitantsoa_event_closed(return_operation.hahitantsoa_event_draft_id):
                raise serializers.ValidationError(
                    {
                        "return_operation": (
                            "Cet événement est clôturé. Aucun règlement n'est autorisé."
                        )
                    }
                )
        return attrs


class InventoryCautionRefundObligationSerializer(serializers.ModelSerializer):
    receipt_document_id = serializers.SerializerMethodField()
    payment_id = serializers.SerializerMethodField()

    class Meta:
        model = InventoryCautionRefundObligation
        fields = (
            "id",
            "amount",
            "status",
            "receipt_document_id",
            "payment_id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        )
        read_only_fields = fields

    def get_receipt_document_id(self, obj) -> str | None:
        payments = getattr(obj, "refund_payments", None)
        if payments is None:
            return None
        all_payments = payments.all()
        payment = all_payments[0] if all_payments else None
        if payment and payment.receipt_document_id:
            return str(payment.receipt_document_id)
        return None

    def get_payment_id(self, obj) -> str | None:
        payments = getattr(obj, "refund_payments", None)
        if payments is None:
            return None
        all_payments = payments.all()
        payment = all_payments[0] if all_payments else None
        return str(payment.id) if payment else None


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

    def validate(self, attrs):
        settlement = attrs.get("settlement")
        if settlement and settlement.return_operation:
            from apps.hahitantsoa.closeout import is_hahitantsoa_event_closed
            from apps.reservations.closeout import is_reservation_closed

            if is_reservation_closed(settlement.return_operation.reservation_draft_id):
                raise serializers.ValidationError(
                    {"settlement": "Ce dossier est clôturé. Aucune exécution n'est autorisée."}
                )
            if is_hahitantsoa_event_closed(settlement.return_operation.hahitantsoa_event_draft_id):
                raise serializers.ValidationError(
                    {"settlement": "Cet événement est clôturé. Aucune exécution n'est autorisée."}
                )
        return attrs
