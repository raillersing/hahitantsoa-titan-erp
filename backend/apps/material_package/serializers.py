from rest_framework import serializers

from apps.material_package.models import MaterialPackage, MaterialPackageLine


class MaterialPackageLineSerializer(serializers.ModelSerializer):
    inventory_item_name = serializers.CharField(source="inventory_item.name", read_only=True)

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
            "is_active",
            "lines",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        package = MaterialPackage.objects.create(**validated_data)
        for line_data in lines_data:
            MaterialPackageLine.objects.create(package=package, **line_data)
        return package

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            instance.lines.all().delete()
            for line_data in lines_data:
                MaterialPackageLine.objects.create(package=instance, **line_data)

        return instance
