from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.reservations.commercial import (
    recalculate_reservation_draft_totals,
    snapshot_inventory_rental_price,
)
from apps.reservations.models import (
    ReservationDraft,
    ReservationDraftAmendment,
    ReservationDraftLine,
    ReservationDraftStatus,
)
from apps.reservations.periods import validate_reservation_period
from apps.reservations.preview import ReservationItemPreview
from apps.reservations.scope import assert_reservable_inventory_item_kind
from apps.reservations.services import (
    ReservationAvailabilitySummary,
    get_reservation_availability_summary_service,
    get_reservation_available_item_previews_service,
    preview_reservation_item_service,
)


class LifecycleStepSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    status = serializers.CharField()
    occurred_at = serializers.DateTimeField(allow_null=True)


class LifecycleSummarySerializer(serializers.Serializer):
    domain = serializers.CharField()
    dossier_id = serializers.UUIDField()
    public_reference = serializers.CharField()
    status = serializers.CharField()
    next_action = serializers.CharField()
    blockers = serializers.ListField(child=serializers.CharField())
    owner_id = serializers.UUIDField(allow_null=True)
    steps = LifecycleStepSerializer(many=True)


class ReservationAvailabilityPreviewRequestSerializer(serializers.Serializer):
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()

    def validate_start_at(self, value):
        raw_value = self.initial_data.get("start_at")
        if isinstance(raw_value, str) and not raw_value.endswith("Z"):
            if "+" not in raw_value and raw_value.count("-") <= 2:
                raise serializers.ValidationError(
                    "Reservation period start_at must be timezone-aware."
                )
        return value

    def validate_end_at(self, value):
        raw_value = self.initial_data.get("end_at")
        if isinstance(raw_value, str) and not raw_value.endswith("Z"):
            if "+" not in raw_value and raw_value.count("-") <= 2:
                raise serializers.ValidationError(
                    "Reservation period end_at must be timezone-aware."
                )
        return value


class ReservationDraftAmendmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationDraftAmendment
        fields = (
            "id",
            "reservation_draft",
            "reason",
            "notes",
            "changed_start_at",
            "changed_end_at",
            "changed_lines",
            "document_instance_id",
            "amendment_sequence",
            "source_contract_document_id",
            "applied_at",
            "applied_by",
            "created_at",
            "created_by",
        )
        read_only_fields = fields


class ReservationDraftAmendmentLineSerializer(serializers.Serializer):
    inventory_item_id = serializers.PrimaryKeyRelatedField(
        source="inventory_item",
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
    )
    quantity = serializers.IntegerField(min_value=1)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_inventory_item(self, inventory_item):
        try:
            assert_reservable_inventory_item_kind(inventory_item.kind)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error
        return inventory_item


class ReservationDraftAmendmentCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255, trim_whitespace=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    changed_start_at = serializers.DateTimeField(required=False)
    changed_end_at = serializers.DateTimeField(required=False)
    changed_lines = ReservationDraftAmendmentLineSerializer(many=True, required=False)


class ReservationAvailabilitySummarySerializer(serializers.Serializer):
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    available_item_count = serializers.IntegerField()
    available_preview_count = serializers.IntegerField()
    available_item_kinds = serializers.ListField(child=serializers.CharField())

    @classmethod
    def from_summary(cls, summary: ReservationAvailabilitySummary):
        return cls(
            {
                "start_at": summary.period.start_at,
                "end_at": summary.period.end_at,
                "available_item_count": summary.available_item_count,
                "available_preview_count": summary.available_preview_count,
                "available_item_kinds": summary.available_item_kinds,
            }
        )

    @classmethod
    def from_period(cls, *, start_at, end_at):
        return cls.from_summary(
            get_reservation_availability_summary_service(
                start_at=start_at,
                end_at=end_at,
            )
        )


class ReservationAvailableItemPreviewSerializer(serializers.Serializer):
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    status = serializers.CharField()

    @classmethod
    def from_preview(cls, preview: ReservationItemPreview):
        return cls(
            {
                "inventory_item_id": preview.inventory_item.id,
                "inventory_item_name": preview.inventory_item.name,
                "inventory_item_kind": preview.inventory_item_kind,
                "start_at": preview.period.start_at,
                "end_at": preview.period.end_at,
                "status": preview.status,
            }
        )

    @classmethod
    def many_from_period(cls, *, start_at, end_at):
        previews = get_reservation_available_item_previews_service(
            start_at=start_at,
            end_at=end_at,
        )
        return cls(
            [
                {
                    "inventory_item_id": preview.inventory_item.id,
                    "inventory_item_name": preview.inventory_item.name,
                    "inventory_item_kind": preview.inventory_item_kind,
                    "start_at": preview.period.start_at,
                    "end_at": preview.period.end_at,
                    "status": preview.status,
                }
                for preview in previews
            ],
            many=True,
        )


class ReservationItemAvailabilityPreviewSerializer(serializers.Serializer):
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    status = serializers.CharField()
    conflict_count = serializers.IntegerField()

    @classmethod
    def from_period(cls, *, inventory_item, start_at, end_at):
        preview = preview_reservation_item_service(
            inventory_item=inventory_item,
            inventory_item_kind=inventory_item.kind,
            start_at=start_at,
            end_at=end_at,
        )
        return cls(
            {
                "inventory_item_id": preview.inventory_item.id,
                "inventory_item_name": preview.inventory_item.name,
                "inventory_item_kind": preview.inventory_item_kind,
                "start_at": preview.period.start_at,
                "end_at": preview.period.end_at,
                "status": preview.status,
                "conflict_count": len(preview.conflicts),
            }
        )


class ReservationDraftLineSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.PrimaryKeyRelatedField(
        source="inventory_item",
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
    )
    inventory_item_name = serializers.CharField(
        source="inventory_item.name",
        read_only=True,
    )
    inventory_item_kind = serializers.CharField(
        source="inventory_item.kind",
        read_only=True,
    )

    class Meta:
        model = ReservationDraftLine
        fields = (
            "id",
            "inventory_item_id",
            "inventory_item_name",
            "inventory_item_kind",
            "quantity",
            "unit_rental_price",
            "notes",
        )
        read_only_fields = (
            "id",
            "inventory_item_name",
            "inventory_item_kind",
            "unit_rental_price",
        )

    def validate_inventory_item(self, inventory_item: InventoryItem) -> InventoryItem:
        try:
            assert_reservable_inventory_item_kind(inventory_item.kind)
        except ValueError as error:
            raise serializers.ValidationError(
                "Inventory item kind is not reservable in Titan."
            ) from error

        if not inventory_item.is_active or inventory_item.is_deleted:
            raise serializers.ValidationError("Inventory item must be active.")

        return inventory_item

    def validate_quantity(self, quantity: int) -> int:
        if quantity < 1:
            raise serializers.ValidationError("Quantity must be greater than zero.")

        return quantity


class ReservationDraftSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.filter(is_active=True, is_deleted=False),
    )
    customer_display_name = serializers.CharField(
        source="customer.display_name",
        read_only=True,
    )
    contract_signed_at = serializers.DateTimeField(read_only=True)
    contract_signed_by_id = serializers.UUIDField(read_only=True, allow_null=True)
    required_deposit_received_at = serializers.DateTimeField(read_only=True)
    required_deposit_received_by_id = serializers.UUIDField(
        read_only=True,
        allow_null=True,
    )
    confirmed_at = serializers.DateTimeField(read_only=True)
    confirmed_by_id = serializers.UUIDField(read_only=True, allow_null=True)
    cancelled_at = serializers.DateTimeField(read_only=True)
    cancelled_by_id = serializers.UUIDField(read_only=True, allow_null=True)
    lines = ReservationDraftLineSerializer(many=True)
    subtotal_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    required_deposit_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = ReservationDraft
        fields = (
            "id",
            "public_reference",
            "status",
            "customer_id",
            "customer_display_name",
            "start_at",
            "end_at",
            "notes",
            "subtotal_amount",
            "delivery_fee",
            "discount_amount",
            "discount_reason",
            "total_amount",
            "required_deposit_amount",
            "contract_signed_at",
            "contract_signed_by_id",
            "required_deposit_received_at",
            "required_deposit_received_by_id",
            "confirmed_at",
            "confirmed_by_id",
            "cancelled_at",
            "cancelled_by_id",
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_reference",
            "status",
            "customer_display_name",
            "subtotal_amount",
            "total_amount",
            "required_deposit_amount",
            "contract_signed_at",
            "contract_signed_by_id",
            "required_deposit_received_at",
            "required_deposit_received_by_id",
            "confirmed_at",
            "confirmed_by_id",
            "cancelled_at",
            "cancelled_by_id",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        start_at = attrs.get("start_at", getattr(self.instance, "start_at", None))
        end_at = attrs.get("end_at", getattr(self.instance, "end_at", None))
        try:
            validate_reservation_period(start_at=start_at, end_at=end_at)
        except ValueError as error:
            raise serializers.ValidationError({"detail": str(error)}) from error

        should_validate_lines = self.instance is None or "lines" in attrs
        if should_validate_lines:
            lines = attrs.get("lines") or []
            if not lines:
                raise serializers.ValidationError({"lines": "At least one line is required."})

            inventory_item_ids = [line["inventory_item"].id for line in lines]
            if len(inventory_item_ids) != len(set(inventory_item_ids)):
                raise serializers.ValidationError(
                    {"lines": "Each inventory item can appear only once per draft."}
                )

        discount_amount = attrs.get(
            "discount_amount",
            getattr(self.instance, "discount_amount", Decimal("0")),
        )
        discount_reason = attrs.get(
            "discount_reason",
            getattr(self.instance, "discount_reason", ""),
        )
        if discount_amount and not discount_reason.strip():
            raise serializers.ValidationError({"discount_reason": "A discount reason is required."})

        return attrs

    def validate_discount_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Discount must be non-negative.")
        return value

    def validate_delivery_fee(self, value):
        if value < 0:
            raise serializers.ValidationError("Delivery fee must be non-negative.")
        return value

    def _actor(self):
        actor = getattr(self.context.get("request"), "user", None)
        if actor is None or not actor.is_authenticated:
            raise serializers.ValidationError({"detail": "An authenticated actor is required."})
        return actor

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        actor = self._actor()
        if validated_data.get("discount_amount", Decimal("0")):
            validated_data["discount_applied_at"] = timezone.now()
            validated_data["discount_applied_by"] = actor
        reservation_draft = ReservationDraft.objects.create(
            status=ReservationDraftStatus.DRAFT,
            created_by=actor,
            updated_by=actor,
            **validated_data,
        )

        for line_data in lines_data:
            line_data["unit_rental_price"] = snapshot_inventory_rental_price(
                inventory_item=line_data["inventory_item"]
            )
            ReservationDraftLine.objects.create(
                reservation_draft=reservation_draft,
                **line_data,
            )

        recalculate_reservation_draft_totals(reservation_draft=reservation_draft)

        from apps.documents.services import create_document_instance_from_reservation_draft

        create_document_instance_from_reservation_draft(
            reservation_draft=reservation_draft,
            template_key="titan.proforma.v1",
            actor=actor,
        )

        return reservation_draft

    @transaction.atomic
    def update(self, instance, validated_data):
        instance = ReservationDraft.objects.select_for_update().get(pk=instance.pk)
        if (
            instance.status != ReservationDraftStatus.DRAFT
            or instance.contract_signed_at is not None
        ):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "A signed or non-draft reservation must be changed through an amendment."
                    )
                }
            )

        lines_data = validated_data.pop("lines", None)
        actor = self._actor()
        discount_changed = bool({"discount_amount", "discount_reason"} & validated_data.keys())

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if instance.discount_amount:
            if discount_changed:
                instance.discount_applied_at = timezone.now()
                instance.discount_applied_by = actor
        else:
            instance.discount_applied_at = None
            instance.discount_applied_by = None
        instance.updated_by = actor

        if lines_data is not None:
            existing_prices = {
                line.inventory_item_id: line.unit_rental_price for line in instance.lines.all()
            }
            instance.lines.all().delete()
            for line_data in lines_data:
                inventory_item = line_data["inventory_item"]
                line_data["unit_rental_price"] = existing_prices.get(
                    inventory_item.id,
                    snapshot_inventory_rental_price(inventory_item=inventory_item),
                )
                ReservationDraftLine.objects.create(
                    reservation_draft=instance,
                    created_by=actor,
                    updated_by=actor,
                    **line_data,
                )

        recalculate_reservation_draft_totals(reservation_draft=instance)

        return instance
