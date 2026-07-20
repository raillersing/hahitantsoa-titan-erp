import csv
import io

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


class ImportJobListCreateAPIView(generics.ListCreateAPIView):
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method.lower() == "post":
            return ImportJobUploadSerializer
        return ImportJobSerializer

    def get_queryset(self):
        return ImportJob.objects.all()

    def perform_create(self, serializer):
        uploaded_file = serializer.validated_data["file"]
        target_model = serializer.validated_data.get("target_model", "inventory_item")

        # Parse CSV
        try:
            content = uploaded_file.read().decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(content))
            rows = list(reader)
            headers = reader.fieldnames or []
        except Exception as e:
            return Response(
                {"detail": f"Failed to parse file: {e}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job = ImportJob.objects.create(
            created_by=self.request.user,
            filename=uploaded_file.name,
            status="mapping",
            target_model=target_model,
            total_rows=len(rows),
            column_mapping={h: "" for h in headers},
        )

        return Response(ImportJobSerializer(job).data, status=status.HTTP_201_CREATED)


class ImportJobMappingUpdateAPIView(APIView):
    http_method_names = ["patch", "head", "options"]
    permission_classes = [IsAuthenticated]

    def patch(self, request, id):
        from django.shortcuts import get_object_or_404

        job = get_object_or_404(ImportJob, pk=id)
        serializer = ImportJobMappingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job.column_mapping = serializer.validated_data["column_mapping"]
        job.status = "previewing"
        job.save(update_fields=["column_mapping", "status", "updated_at"])
        return Response(ImportJobSerializer(job).data)


class ImportJobValidateAPIView(APIView):
    http_method_names = ["post", "head", "options"]
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        from django.shortcuts import get_object_or_404

        job = get_object_or_404(ImportJob, pk=id)
        # Placeholder validation — mark as completed for now
        job.status = "completed"
        job.valid_rows = job.total_rows
        job.save(update_fields=["status", "valid_rows", "updated_at"])
        return Response(ImportJobSerializer(job).data)
