import csv
import io

from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.excel_import.models import ImportJob
from apps.excel_import.serializers import (
    ImportJobMappingSerializer,
    ImportJobSerializer,
    ImportJobUploadSerializer,
)
from apps.inventory.models import InventoryItem
from apps.inventory.scope import assert_titan_allowed_item_kind


class ImportJobListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return ImportJobUploadSerializer
        return ImportJobSerializer

    def get_queryset(self):
        return ImportJob.objects.all()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded_file = serializer.validated_data["file"]
        target_model = serializer.validated_data.get("target_model", "inventory_item")

        # The import UI needs the persisted job and its mapping immediately after
        # upload.  The upload serializer only validates the multipart payload; it
        # is not the response serializer for the created ImportJob.
        try:
            content = uploaded_file.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(content))
            rows = list(reader)
            headers = reader.fieldnames or []
        except (UnicodeDecodeError, csv.Error) as error:
            return Response(
                {"detail": f"Failed to parse CSV file: {error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not headers:
            return Response(
                {"detail": "The CSV file must contain a header row."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job = ImportJob.objects.create(
            created_by=request.user,
            filename=uploaded_file.name,
            status="mapping",
            target_model=target_model,
            total_rows=len(rows),
            column_mapping={header: "" for header in headers},
            source_rows=rows,
        )
        return Response(
            ImportJobSerializer(job).data,
            status=status.HTTP_201_CREATED,
        )

class ImportJobMappingUpdateAPIView(APIView):
    http_method_names = ["patch", "head", "options"]
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        from django.shortcuts import get_object_or_404

        job = get_object_or_404(ImportJob, pk=id)
        serializer = ImportJobMappingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mapping = serializer.validated_data["column_mapping"]
        allowed_fields = {"name", "kind", "description"}
        invalid_fields = set(mapping.values()) - {"", *allowed_fields}
        if invalid_fields:
            return Response(
                {"detail": f"Unsupported import fields: {', '.join(sorted(invalid_fields))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        job.column_mapping = mapping
        job.status = "previewing"
        job.save(update_fields=["column_mapping", "status", "updated_at"])
        return Response(ImportJobSerializer(job).data)


class ImportJobValidateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        from django.shortcuts import get_object_or_404

        job = get_object_or_404(ImportJob, pk=id)
        if job.target_model != "inventory_item":
            return Response(
                {"detail": "Only inventory_item imports are currently supported."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        mapping = job.column_mapping or {}
        name_column = next((column for column, field in mapping.items() if field == "name"), None)
        kind_column = next((column for column, field in mapping.items() if field == "kind"), None)
        description_column = next(
            (column for column, field in mapping.items() if field == "description"),
            None,
        )
        if not name_column:
            return Response(
                {"detail": "The import mapping must include a name column."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        errors = []
        valid_rows = []
        for row_number, row in enumerate(job.source_rows or [], start=2):
            name = str(row.get(name_column, "")).strip()
            kind = str(row.get(kind_column, "material") if kind_column else "material").strip()
            description = str(row.get(description_column, "") if description_column else "").strip()
            if not name:
                errors.append({"row": row_number, "error": "The name is required."})
                continue
            try:
                kind = assert_titan_allowed_item_kind(kind).value
            except ValueError:
                errors.append({"row": row_number, "error": f"Invalid inventory kind: {kind}."})
                continue
            valid_rows.append((name, kind, description))

        with transaction.atomic():
            if not errors:
                for name, kind, description in valid_rows:
                    item = InventoryItem.objects.filter(name=name).first()
                    if item is None:
                        InventoryItem.objects.create(
                            name=name,
                            kind=kind,
                            description=description,
                            is_active=True,
                            is_deleted=False,
                            deleted_at=None,
                            created_by=request.user,
                            updated_by=request.user,
                        )
                    else:
                        item.kind = kind
                        item.description = description
                        item.is_active = True
                        item.is_deleted = False
                        item.deleted_at = None
                        item.updated_by = request.user
                        item.save(
                            update_fields=[
                                "kind",
                                "description",
                                "is_active",
                                "is_deleted",
                                "deleted_at",
                                "updated_by",
                                "updated_at",
                            ]
                        )

            job.status = "completed" if not errors else "failed"
            job.valid_rows = len(valid_rows)
            job.error_rows = len(errors)
            job.error_log = errors
            job.save(
                update_fields=[
                    "status",
                    "valid_rows",
                    "error_rows",
                    "error_log",
                    "updated_at",
                ]
            )
        return Response(ImportJobSerializer(job).data)
