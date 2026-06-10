from django.db import transaction
from rest_framework import serializers

from apps.customers.models import Customer
from apps.inventory.models import InventoryItem
from apps.reservations.models import (
    ReservationDraft,
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


class ReservationAvailabilityPreviewRequestSerializer(serializers.Serializer):
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()

    def validate_start_at(self, value):
        raw_value = self.initial_data.get("start_at")
        if isinstance(raw_value, str) and raw_value.endswith("Z") is False:
            if "+" not in raw_value and raw_value.count("-") <= 2:
                raise serializers.ValidationError(
                    "Reservation period start_at must be timezone-aware."
                )
        return value

    def validate_end_at(self, value):
        raw_value = self.initial_data.get("end_at")
        if isinstance(raw_value, str) and raw_value.endswith("Z") is False:
            if "+" not in raw_value and raw_value.count("-") <= 2:
                raise serializers.ValidationError(
                    "Reservation period end_at must be timezone-aware."
                )
        return value


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
            "notes",
        )
        read_only_fields = (
            "id",
            "inventory_item_name",
            "inventory_item_kind",
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
    lines = ReservationDraftLineSerializer(many=True)

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
            "lines",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "public_reference",
            "status",
            "customer_display_name",
            "created_at",
            "updated_at",
        )

    def validate(self, attrs):
        start_at = attrs.get("start_at")
        end_at = attrs.get("end_at")
        try:
            validate_reservation_period(start_at=start_at, end_at=end_at)
        except ValueError as error:
            raise serializers.ValidationError({"detail": str(error)}) from error

        lines = attrs.get("lines") or []
        if not lines:
            raise serializers.ValidationError({"lines": "At least one line is required."})

        inventory_item_ids = [line["inventory_item"].id for line in lines]
        if len(inventory_item_ids) != len(set(inventory_item_ids)):
            raise serializers.ValidationError(
                {"lines": "Each inventory item can appear only once per draft."}
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        reservation_draft = ReservationDraft.objects.create(
            status=ReservationDraftStatus.DRAFT,
            **validated_data,
        )

        for line_data in lines_data:
            ReservationDraftLine.objects.create(
                reservation_draft=reservation_draft,
                **line_data,
            )

        return reservation_draft
