from django.db import transaction
from rest_framework import serializers

from apps.customers.models import Customer
from apps.hahitantsoa.models import HahitantsoaEventDraft, HahitantsoaEventDraftLine
from apps.hahitantsoa.scope import assert_hahitantsoa_shared_inventory_item_kind
from apps.hahitantsoa.services import (
    HahitantsoaSharedAvailabilityItemPreview,
    get_hahitantsoa_shared_availability_item_previews,
)
from apps.inventory.models import InventoryItem
from apps.reservations.periods import validate_reservation_period
from apps.reservations.serializers import ReservationAvailabilityPreviewRequestSerializer


class HahitantsoaDiscoveryItemSerializer(serializers.Serializer):
    concept = serializers.CharField()
    label = serializers.CharField()


class HahitantsoaSharedAvailabilityItemPreviewSerializer(serializers.Serializer):
    inventory_item_id = serializers.UUIDField()
    inventory_item_name = serializers.CharField()
    inventory_item_description = serializers.CharField()
    inventory_item_kind = serializers.CharField()
    start_at = serializers.DateTimeField()
    end_at = serializers.DateTimeField()
    status = serializers.CharField()

    @classmethod
    def from_preview(cls, preview: HahitantsoaSharedAvailabilityItemPreview):
        return cls(
            {
                "inventory_item_id": preview.inventory_item.id,
                "inventory_item_name": preview.inventory_item.name,
                "inventory_item_description": preview.inventory_item.description,
                "inventory_item_kind": preview.inventory_item.kind,
                "start_at": preview.period.start_at,
                "end_at": preview.period.end_at,
                "status": preview.status,
            }
        )

    @classmethod
    def many_from_period(cls, *, start_at, end_at):
        previews = get_hahitantsoa_shared_availability_item_previews(
            start_at=start_at,
            end_at=end_at,
        )
        return cls(
            [
                {
                    "inventory_item_id": preview.inventory_item.id,
                    "inventory_item_name": preview.inventory_item.name,
                    "inventory_item_description": preview.inventory_item.description,
                    "inventory_item_kind": preview.inventory_item.kind,
                    "start_at": preview.period.start_at,
                    "end_at": preview.period.end_at,
                    "status": preview.status,
                }
                for preview in previews
            ],
            many=True,
        )


class HahitantsoaSharedAvailabilityResponseSerializer(serializers.Serializer):
    items = HahitantsoaSharedAvailabilityItemPreviewSerializer(many=True)
    count = serializers.IntegerField()

    @classmethod
    def from_period(cls, *, start_at, end_at):
        item_serializer = HahitantsoaSharedAvailabilityItemPreviewSerializer.many_from_period(
            start_at=start_at,
            end_at=end_at,
        )
        return cls(
            {
                "items": item_serializer.data,
                "count": len(item_serializer.data),
            }
        )


class HahitantsoaEventDraftLineSerializer(serializers.ModelSerializer):
    inventory_item_id = serializers.PrimaryKeyRelatedField(
        source="inventory_item",
        queryset=InventoryItem.objects.filter(is_active=True, is_deleted=False),
    )
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    inventory_item_kind = serializers.CharField(source="inventory_item.kind", read_only=True)

    class Meta:
        model = HahitantsoaEventDraftLine
        fields = (
            "id",
            "inventory_item_id",
            "inventory_item_name",
            "inventory_item_kind",
            "quantity",
            "notes",
        )
        read_only_fields = ("id", "inventory_item_name", "inventory_item_kind")

    def validate_inventory_item_id(self, inventory_item: InventoryItem) -> InventoryItem:
        try:
            assert_hahitantsoa_shared_inventory_item_kind(inventory_item.kind)
        except ValueError as error:
            raise serializers.ValidationError(
                "Inventory item kind is not allowed for Hahitantsoa shared event drafts."
            ) from error

        if not inventory_item.is_active or inventory_item.is_deleted:
            raise serializers.ValidationError("Inventory item must be active.")

        return inventory_item

    def validate_quantity(self, quantity: int) -> int:
        if quantity < 1:
            raise serializers.ValidationError("Quantity must be greater than zero.")

        return quantity


class HahitantsoaEventDraftSerializer(serializers.ModelSerializer):
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer",
        queryset=Customer.objects.filter(is_active=True, is_deleted=False),
    )
    customer_display_name = serializers.CharField(source="customer.display_name", read_only=True)
    lines = HahitantsoaEventDraftLineSerializer(many=True)

    class Meta:
        model = HahitantsoaEventDraft
        fields = (
            "id",
            "public_reference",
            "status",
            "customer_id",
            "customer_display_name",
            "event_name",
            "venue_name",
            "location_details",
            "service_notes",
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
                    {"lines": "Each inventory item can appear only once per event draft."}
                )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        event_draft = HahitantsoaEventDraft(**validated_data)
        event_draft.full_clean()
        event_draft.save()

        for line_data in lines_data:
            line = HahitantsoaEventDraftLine(event_draft=event_draft, **line_data)
            line.full_clean()
            line.save()

        return event_draft

    @transaction.atomic
    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.full_clean()
        instance.save()

        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                line = HahitantsoaEventDraftLine(event_draft=instance, **line_data)
                line.full_clean()
                line.save()

        return instance


__all__ = [
    "HahitantsoaDiscoveryItemSerializer",
    "HahitantsoaSharedAvailabilityItemPreviewSerializer",
    "HahitantsoaSharedAvailabilityResponseSerializer",
    "HahitantsoaEventDraftLineSerializer",
    "HahitantsoaEventDraftSerializer",
    "ReservationAvailabilityPreviewRequestSerializer",
]
