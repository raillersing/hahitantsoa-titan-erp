from rest_framework import serializers

from apps.excel_import.models import ImportJob


class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = (
            "id",
            "filename",
            "status",
            "column_mapping",
            "total_rows",
            "valid_rows",
            "error_rows",
            "error_log",
            "target_model",
            "created_at",
        )
        read_only_fields = ("id", "created_at")


class ImportJobUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    target_model = serializers.ChoiceField(
        choices=[("inventory_item", "Inventory Item"), ("customer", "Customer")],
        default="inventory_item",
    )


class ImportJobMappingSerializer(serializers.Serializer):
    column_mapping = serializers.DictField()
