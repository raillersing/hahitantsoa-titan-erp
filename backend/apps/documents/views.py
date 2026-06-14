from django.http import Http404
from drf_spectacular.utils import OpenApiResponse, OpenApiTypes, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.registry import (
    get_document_template_definition,
    list_document_template_definitions,
)
from apps.documents.serializers import (
    DocumentTemplateDefinitionSerializer,
    TitanProformaDraftPreviewSerializer,
)
from apps.documents.services import (
    get_reservation_draft_commercial_document_context_service,
)
from apps.reservations.models import ReservationDraft

TITAN_PROFORMA_TEMPLATE_KEY = "titan.proforma.v1"


def runtime_document_scope_flags() -> dict[str, bool]:
    return {
        "pdf_runtime_generated": False,
        "reservation_confirmed": False,
        "inventory_blocked": False,
        "payment_created": False,
        "invoice_created": False,
        "contract_created": False,
    }


class DocumentTemplateRegistryAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses=inline_serializer(
            name="DocumentTemplateRegistryResponse",
            fields={
                "items": DocumentTemplateDefinitionSerializer(many=True),
                "count": serializers.IntegerField(),
            },
        )
    )
    def get(self, request):
        templates = list_document_template_definitions()
        serialized_templates = DocumentTemplateDefinitionSerializer(
            templates,
            many=True,
        ).data

        return Response(
            {
                "items": serialized_templates,
                "count": len(serialized_templates),
            }
        )


class DocumentTemplateDefinitionAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=DocumentTemplateDefinitionSerializer)
    def get(self, request, template_key: str):
        template_definition = get_document_template_definition(template_key)
        if template_definition is None:
            raise Http404("Document template definition not found.")

        serializer = DocumentTemplateDefinitionSerializer(template_definition)
        return Response(serializer.data)


class TitanProformaDraftPreviewAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=TitanProformaDraftPreviewSerializer)
    def get(self, request, reservation_draft_id):
        try:
            context = get_reservation_draft_commercial_document_context_service(
                reservation_draft_id=reservation_draft_id,
                template_key=TITAN_PROFORMA_TEMPLATE_KEY,
            )
        except ReservationDraft.DoesNotExist:
            raise Http404("Reservation draft not found.")

        serializer = TitanProformaDraftPreviewSerializer.from_commercial_document_context(
            context=context
        )
        return Response(serializer.data)


class DocumentInstancePrivateArtifactAPIView(APIView):
    http_method_names = ["get", "head", "options"]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: OpenApiResponse(
                description="Raw stored HTML content of the document artifact.",
                response=OpenApiTypes.STR,
            )
        }
    )
    def get(self, request, id):
        from django.core.files.storage import default_storage
        from django.http import HttpResponse

        from apps.documents.models import DocumentInstanceStatus
        from apps.documents.selectors import get_document_instance_by_id

        instance = get_document_instance_by_id(document_instance_id=id)
        if instance is None:
            raise Http404("Document instance not found.")

        if instance.status != DocumentInstanceStatus.GENERATED:
            raise Http404("Document instance is not generated.")

        if not instance.storage_path:
            raise Http404("Artifact storage path is empty.")

        if not default_storage.exists(instance.storage_path):
            raise Http404("Artifact file does not exist.")

        try:
            with default_storage.open(instance.storage_path, "rb") as f:
                content = f.read()
        except Exception:
            raise Http404("Failed to read artifact from storage.")

        from apps.audit.services import record_audit_event_on_commit

        record_audit_event_on_commit(
            actor=request.user,
            action="document.artifact_accessed",
            target_type="document_instance",
            target_id=str(instance.id),
            metadata={
                "template_key": instance.template_key,
                "content_checksum": instance.content_checksum,
                "generated_content_size_bytes": instance.generated_content_size_bytes,
            },
        )

        return HttpResponse(content, content_type="text/html; charset=utf-8")
