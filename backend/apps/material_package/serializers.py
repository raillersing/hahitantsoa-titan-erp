from rest_framework import serializers

from apps.common.catalog_images import validate_catalog_image_url
from apps.inventory.models import INVENTORY_ITEM_KIND_VALUES, InventoryItem
from apps.material_package.models import MaterialPackage, MaterialPackageLine
from apps.material_package.services import save_material_package


class MaterialPackageLineSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)
    inventory_item = serializers.PrimaryKeyRelatedField(
        queryset=InventoryItem.objects.filter(
            is_active=True, is_deleted=False, kind__in=INVENTORY_ITEM_KIND_VALUES
        )
    )
    quantity = serializers.IntegerField(min_value=1)

    class Meta:
        model = MaterialPackageLine
        fields = [
            "id",
            "inventory_item",
            "inventory_item_name",
            "quantity",
            "created_at",
        ]
        read_only_fields = ["id", "inventory_item_name", "created_at"]


class MaterialPackageSerializer(serializers.ModelSerializer):
    lines = MaterialPackageLineSerializer(many=True, read_only=True)

    class Meta:
        model = MaterialPackage
        fields = [
            "id",
            "name",
            "description",
            "price",
            "image_url",
            "is_active",
            "lines",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class MaterialPackageCreateSerializer(serializers.ModelSerializer):
    lines = MaterialPackageLineSerializer(many=True, required=False)

    class Meta:
        model = MaterialPackage
        fields = [
            "id",
            "name",
            "description",
            "price",
            "image_url",
            "is_active",
            "lines",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_image_url(self, value: str) -> str:
        try:
            return validate_catalog_image_url(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        return save_material_package(attributes=validated_data, lines=lines_data)

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        return save_material_package(attributes=validated_data, lines=lines_data, instance=instance)
