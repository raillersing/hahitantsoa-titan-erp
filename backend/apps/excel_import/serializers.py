from rest_framework import serializers

from apps.excel_import.models import ImportJob

MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_IMPORT_SUFFIXES = {".csv", ".txt", ".xlsx"}


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

    def validate_file(self, value):
        from pathlib import Path

        if Path(value.name).suffix.casefold() not in ALLOWED_IMPORT_SUFFIXES:
            raise serializers.ValidationError("Only CSV (UTF-8) and XLSX files are supported.")
        if value.size > MAX_IMPORT_FILE_BYTES:
            raise serializers.ValidationError("The import file must not exceed 10 MB.")
        return value


class ImportJobMappingSerializer(serializers.Serializer):
    column_mapping = serializers.DictField()
