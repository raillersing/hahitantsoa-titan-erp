from rest_framework import serializers

from apps.inventory.models import InventoryItem
from apps.inventory.scope import assert_titan_allowed_item_kind


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
