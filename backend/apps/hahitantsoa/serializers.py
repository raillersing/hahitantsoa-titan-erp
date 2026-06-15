from rest_framework import serializers

from apps.hahitantsoa.services import (
    HahitantsoaSharedAvailabilityItemPreview,
    get_hahitantsoa_shared_availability_item_previews,
)
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


__all__ = [
    "HahitantsoaDiscoveryItemSerializer",
    "HahitantsoaSharedAvailabilityItemPreviewSerializer",
    "HahitantsoaSharedAvailabilityResponseSerializer",
    "ReservationAvailabilityPreviewRequestSerializer",
]
